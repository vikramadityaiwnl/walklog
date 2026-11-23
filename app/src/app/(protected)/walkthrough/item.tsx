import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { colors } from "../../../theme";
import { AppButton } from "../../../components/app-button";
import { useDialogStore } from "../../../store/dialog-store";
import { ChipGroup } from "../../../components/chip-group";
import { BannerPicker } from "../../../components/banner-picker";
import { useBannerDraft } from "../../../hooks/use-banner-draft";
import {
  getBannerColor,
  randomBannerColor,
} from "../../../utils/banner-colors";
import { AppText } from "../../../components/app-text";
import { LoadingState } from "../../../components/loading-state";
import { PhotoGallery } from "../../../components/photo-gallery";
import { ErrorState } from "../../../components/error-state";
import type {
  ItemStatus,
  Priority,
  PunchItem,
  Trade,
} from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough/photos";
import {
  createFirestoreId,
  createWalkthroughStorage,
} from "../../../services/walkthrough/storage";
import { useAuthStore } from "../../../store/auth-store";
import {
  formFadeIn,
  formFadeOut,
  formLayout,
} from "../../../utils/form-motion";

const priorities: Priority[] = ["Low", "Medium", "High"];
const statuses: ItemStatus[] = ["Open", "Done"];

interface ItemDraft {
  description: string;
  location: string;
  trade?: Trade;
  priority?: Priority;
  status: ItemStatus;
  photos: PunchItem["photos"];
}

type FormState =
  | { status: "loading"; draft: ItemDraft }
  | { status: "ready"; draft: ItemDraft; existing?: PunchItem }
  | { status: "saving"; draft: ItemDraft; existing?: PunchItem }
  | {
      status: "error";
      draft: ItemDraft;
      message: string;
      existing?: PunchItem;
    };

export default function ItemEdit() {
  const { id, walkthroughId } = useLocalSearchParams<{
    id?: string;
    walkthroughId: string;
  }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [form, setForm] = useState<FormState>({
    status: id ? "loading" : "ready",
    draft: {
      description: "",
      location: "",
      trade: undefined,
      priority: undefined,
      status: "Open",
      photos: [],
    },
  });

  const [photoBusy, setPhotoBusy] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);

  const [deleting, setDeleting] = useState(false);

  const stagedPhotos = useRef<PunchItem["photos"]>([]);
  const mounted = useRef(false);
  const saving = useRef(false);

  const showDialog = useDialogStore((state) => state.showDialog);

  const banner = useBannerDraft();

  const existing = form.status === "loading" ? undefined : form.existing;
  const draft = form.draft;
  const hasChanges =
    !!existing &&
    (draft.description !== existing.issueSummary ||
      draft.location !== existing.location ||
      draft.trade !== existing.trade ||
      draft.priority !== existing.priority ||
      draft.status !== existing.status ||
      banner.uri !== existing.bannerPhotoUri);
  const showSave = !id || hasChanges;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      if (!saving.current) {
        void deleteItemPhotos(stagedPhotos.current).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!id || !ownerId || !walkthroughId) return;

    let active = true;

    void createWalkthroughStorage(ownerId)
      .listItems(walkthroughId)
      .then((items) => {
        if (!active) return;

        const item = items.find((entry) => entry.id === id);
        if (!item) {
          setForm((current) => ({
            ...current,
            status: "error",
            message: "This item could not be found.",
          }));

          return;
        }

        banner.load(item.bannerPhotoUri);
        setForm({
          status: "ready",
          existing: item,
          draft: {
            description: item.issueSummary,
            location: item.location,
            trade: item.trade,
            priority: item.priority,
            status: item.status,
            photos: item.photos,
          },
        });
      })
      .catch(() => {
        if (active)
          setForm((current) => ({
            ...current,
            status: "error",
            message: "Couldn’t load this item.",
          }));
      });

    return () => {
      active = false;
    };
  }, [id, ownerId, walkthroughId, loadRevision]);

  async function addPhoto(source: "camera" | "library") {
    setPhotoBusy(true);
    try {
      const photo = await selectItemPhoto(source);
      if (photo && !mounted.current) {
        await deleteItemPhotos([photo]);
      } else if (photo) {
        stagedPhotos.current.push(photo);
        setForm((current) => ({
          ...current,
          draft: {
            ...current.draft,
            photos: [...current.draft.photos, photo],
          },
        }));
      }
    } catch (error) {
      showDialog(
        "Couldn’t add photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function choosePhoto() {
    showDialog("Add photo", "Choose a source", [
      {
        text: "Camera",
        icon: "camera",
        onPress: () => {
          void addPhoto("camera");
        },
      },
      {
        text: "Photo library",
        icon: "photo-library",
        onPress: () => {
          void addPhoto("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function cancelChanges() {
    if (!existing) return;

    banner.reset();
    setForm({
      status: "ready",
      existing,
      draft: {
        description: existing.issueSummary,
        location: existing.location,
        trade: existing.trade,
        priority: existing.priority,
        status: existing.status,
        photos: existing.photos,
      },
    });
  }

  async function save() {
    if (
      !ownerId ||
      !walkthroughId ||
      form.status === "loading" ||
      form.status === "saving" ||
      photoBusy ||
      deleting ||
      banner.busy
    )
      return;

    const existing = form.existing;
    if (id && !existing) return;

    if (!draft.description.trim()) {
      setForm({
        status: "error",
        draft,
        message: "Enter an issue description.",
        existing,
      });

      return;
    }

    saving.current = true;
    banner.beginSave();
    setForm({ status: "saving", existing, draft });
    try {
      const now = Date.now();
      const item: PunchItem = {
        ...existing,
        id: existing?.id ?? createFirestoreId(ownerId, "items"),
        walkthroughId,
        bannerColor: existing
          ? getBannerColor(existing.id, existing.bannerColor)
          : randomBannerColor(),
        bannerPhotoUri: banner.uri,
        rawTranscript: existing?.rawTranscript ?? "",
        processingMode: existing ? existing.processingMode : "manual",
        issueSummary: draft.description.trim(),
        location: draft.location.trim(),
        trade: draft.trade,
        priority: draft.priority,
        status: draft.status,
        photos: draft.photos,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        cloudVerification: undefined,
      };
      await createWalkthroughStorage(ownerId).saveItem(item);
      await banner.finishSave(true);
      const removed = [
        ...(existing?.photos ?? []),
        ...stagedPhotos.current,
      ].filter(
        (photo) =>
          !draft.photos.some((kept) => kept.localUri === photo.localUri),
      );
      stagedPhotos.current = [];
      await deleteItemPhotos(removed).catch(() => {});
      if (mounted.current) router.back();
    } catch {
      await banner.finishSave(false);
      if (!mounted.current) {
        void deleteItemPhotos(stagedPhotos.current).catch(() => {});

        return;
      }

      setForm((current) => ({
        ...current,
        status: "error",
        message: "Couldn’t save the item. Please try again.",
        existing,
      }));
    } finally {
      saving.current = false;
    }
  }

  function confirmDelete() {
    if (
      !ownerId ||
      form.status === "loading" ||
      form.status === "saving" ||
      deleting ||
      !form.existing
    )
      return;

    const existing = form.existing;
    showDialog(
      "Delete item?",
      "This also deletes its photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                await createWalkthroughStorage(ownerId).deleteItem(existing.id);
                await deleteItemPhotos([
                  ...existing.photos,
                  ...(existing.bannerPhotoUri
                    ? [{ localUri: existing.bannerPhotoUri }]
                    : []),
                ]).catch(() => {});
                router.dismissTo({
                  pathname: "/walkthrough/[id]",
                  params: { id: walkthroughId },
                });
              } catch {
                setDeleting(false);
                setForm((current) => ({
                  ...current,
                  status: "error",
                  message: "Couldn’t delete the item. Please try again.",
                  existing,
                }));
              }
            })();
          },
        },
      ],
    );
  }

  if (form.status === "error") {
    return (
      <ErrorState
        title="Couldn’t complete action"
        description={form.message}
        actions={[
          {
            title: "Go home",
            variant: "secondary",
            onPress: () => router.replace("/(protected)/(tabs)"),
          },
          {
            title: "Try again",
            onPress: () => {
              if (id && !form.existing) {
                setForm({ status: "loading", draft: form.draft });
                setLoadRevision((current) => current + 1);
              } else {
                setForm({
                  status: "ready",
                  draft: form.draft,
                  existing: form.existing,
                });
              }
            },
          },
        ]}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={{ gap: 5, marginBottom: 8 }}>
            <AppText variant="title" style={styles.heading}>
              {id ? "Edit item" : "New item"}
            </AppText>

            <AppText style={styles.subheading}>
              {id
                ? "Update the details of this item."
                : "Record an issue and its details."}
            </AppText>
          </View>

          {form.status === "loading" ? (
            <LoadingState />
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Issue description *
                </AppText>

                <TextInput
                  accessibilityLabel="Issue description"
                  multiline
                  value={draft.description}
                  onChangeText={(description) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, description },
                    }))
                  }
                  placeholder="What needs attention?"
                  style={[styles.input, styles.multiline]}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Room or location
                </AppText>

                <TextInput
                  accessibilityLabel="Room or location"
                  value={draft.location}
                  onChangeText={(location) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, location },
                    }))
                  }
                  placeholder="e.g. Kitchen"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Trade
                </AppText>

                <TextInput
                  accessibilityLabel="Trade"
                  value={draft.trade ?? ""}
                  onChangeText={(trade) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, trade: trade || undefined },
                    }))
                  }
                  placeholder="e.g. Plumbing"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Priority
                </AppText>

                <ChipGroup
                  label="Priority"
                  options={priorities}
                  selection={{
                    mode: "single",
                    value: draft.priority,
                    onChange: (priority) =>
                      setForm((current) => ({
                        ...current,
                        draft: { ...current.draft, priority },
                      })),
                  }}
                />
              </View>

              {id ? (
                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Status
                  </AppText>

                  <ChipGroup
                    label="Status"
                    options={statuses}
                    selection={{
                      mode: "single",
                      value: draft.status,
                      onChange: (status) =>
                        setForm((current) => ({
                          ...current,
                          draft: { ...current.draft, status },
                        })),
                    }}
                  />
                </View>
              ) : null}

              {!id ? (
                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Photos
                  </AppText>

                  <PhotoGallery
                    photos={draft.photos}
                    busy={banner.busy || photoBusy || form.status === "saving"}
                    onAdd={choosePhoto}
                    onRemove={async (photo) => {
                      setForm((current) => ({
                        ...current,
                        draft: {
                          ...current.draft,
                          photos: current.draft.photos.filter(
                            (entry) => entry.localUri !== photo.localUri,
                          ),
                        },
                      }));

                      return true;
                    }}
                  />
                </View>
              ) : null}

              {id && form.existing ? (
                <BannerPicker
                  uri={banner.uri}
                  busy={
                    banner.busy ||
                    photoBusy ||
                    deleting ||
                    form.status === "saving"
                  }
                  onChoose={banner.choose}
                  onRemove={banner.remove}
                />
              ) : null}
            </>
          )}
        </ScrollView>

        {form.status !== "loading" ? (
          <Animated.View layout={formLayout} style={styles.actions}>
            {id && hasChanges ? (
              <Animated.View
                key="cancel"
                entering={formFadeIn}
                exiting={formFadeOut}
                layout={formLayout}
                style={styles.action}
              >
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  disabled={
                    banner.busy ||
                    photoBusy ||
                    deleting ||
                    form.status === "saving"
                  }
                  onPress={cancelChanges}
                />
              </Animated.View>
            ) : null}

            {showSave ? (
              <Animated.View
                key="save"
                entering={formFadeIn}
                exiting={formFadeOut}
                layout={formLayout}
                style={styles.action}
              >
                <AppButton
                  title={
                    form.status === "saving"
                      ? "Saving"
                      : id
                        ? "Save changes"
                        : "Add item"
                  }
                  disabled={
                    banner.busy ||
                    photoBusy ||
                    deleting ||
                    form.status === "saving" ||
                    (!!id && !form.existing)
                  }
                  onPress={save}
                />
              </Animated.View>
            ) : null}

            {id && form.existing && !hasChanges ? (
              <Animated.View
                key="delete"
                entering={formFadeIn}
                exiting={formFadeOut}
                layout={formLayout}
                style={styles.action}
              >
                <AppButton
                  title={deleting ? "Deleting" : "Delete"}
                  accessibilityLabel="Delete item"
                  variant="danger"
                  disabled={
                    banner.busy ||
                    photoBusy ||
                    deleting ||
                    form.status === "saving"
                  }
                  onPress={confirmDelete}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subheading: { color: colors.muted, lineHeight: 22 },
  section: { gap: 8 },
  label: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  card: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 18 },
  link: { color: colors.accent },
  danger: { color: colors.danger },
  photo: { width: 96, height: 96, borderRadius: 10 },
  back: { paddingVertical: 10, alignSelf: "flex-start" },
});
