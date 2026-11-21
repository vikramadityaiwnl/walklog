import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { ChipGroup } from "../../../components/chip-group";
import { BannerPicker } from "../../../components/banner-picker";
import { useBannerDraft } from "../../../hooks/use-banner-draft";
import {
  getBannerColor,
  randomBannerColor,
} from "../../../services/banner-colors";
import { AppText } from "../../../components/app-text";
import { PhotoGallery } from "../../../components/photo-gallery";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { Priority, PunchItem, Trade } from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough-photos";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";

const trades: Trade[] = [
  "General",
  "Plumbing",
  "Electrical",
  "Paint/Finish",
  "Carpentry",
  "HVAC",
];
const priorities: Priority[] = ["Low", "Medium", "High"];
type FormState =
  | { status: "loading" }
  | { status: "ready"; existing?: PunchItem }
  | { status: "saving"; existing?: PunchItem }
  | { status: "error"; message: string; existing?: PunchItem };

export default function ItemEdit() {
  const { id, walkthroughId } = useLocalSearchParams<{
    id?: string;
    walkthroughId: string;
  }>();
  const auth = useAuthStore((state) => state.auth);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [form, setForm] = useState<FormState>(
    id ? { status: "loading" } : { status: "ready" },
  );
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState<Trade>("General");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [photos, setPhotos] = useState<PunchItem["photos"]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const stagedPhotos = useRef<PunchItem["photos"]>([]);
  const mounted = useRef(false);
  const saving = useRef(false);
  const banner = useBannerDraft();

  const existing = form.status === "loading" ? undefined : form.existing;
  const hasChanges =
    !!existing &&
    (description !== existing.issueSummary ||
      location !== existing.location ||
      trade !== existing.trade ||
      priority !== existing.priority ||
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
          setForm({
            status: "error",
            message: "This item could not be found.",
          });

          return;
        }

        banner.load(item.bannerPhotoUri);
        setDescription(item.issueSummary);
        setLocation(item.location);
        setTrade(item.trade);
        setPriority(item.priority);
        setPhotos(item.photos);
        setForm({ status: "ready", existing: item });
      })
      .catch(() => {
        if (active)
          setForm({ status: "error", message: "Couldn’t load this item." });
      });

    return () => {
      active = false;
    };
  }, [id, ownerId, walkthroughId]);

  async function addPhoto(source: "camera" | "library") {
    setPhotoBusy(true);
    try {
      const photo = await selectItemPhoto(source);
      if (photo && !mounted.current) {
        await deleteItemPhotos([photo]);
      } else if (photo) {
        stagedPhotos.current.push(photo);
        setPhotos((current) => [...current, photo]);
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t add photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function choosePhoto() {
    Alert.alert("Add photo", "Choose a source", [
      {
        text: "Take photo",
        onPress: () => {
          void addPhoto("camera");
        },
      },
      {
        text: "Choose from library",
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
    setDescription(existing.issueSummary);
    setLocation(existing.location);
    setTrade(existing.trade);
    setPriority(existing.priority);
    setForm({ status: "ready", existing });
  }

  async function save() {
    if (
      !ownerId ||
      !walkthroughId ||
      form.status === "loading" ||
      form.status === "saving" ||
      photoBusy ||
      banner.busy
    )
      return;

    const existing = form.existing;
    if (id && !existing) return;

    if (!description.trim()) {
      setForm({
        status: "error",
        message: "Enter an issue description.",
        existing,
      });

      return;
    }

    saving.current = true;
    banner.beginSave();
    setForm({ status: "saving", existing });
    try {
      const now = Date.now();
      const item: PunchItem = {
        ...existing,
        id: existing?.id ?? Crypto.randomUUID(),
        walkthroughId,
        bannerColor: existing
          ? getBannerColor(existing.id, existing.bannerColor)
          : randomBannerColor(),
        bannerPhotoUri: banner.uri,
        rawTranscript: existing?.rawTranscript ?? "",
        issueSummary: description.trim(),
        location: location.trim() || "Unspecified Area",
        trade,
        priority,
        photos,
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
        (photo) => !photos.some((kept) => kept.localUri === photo.localUri),
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

      setForm({
        status: "error",
        message: "Couldn’t save the item. Please try again.",
        existing,
      });
    } finally {
      saving.current = false;
    }
  }

  function confirmDelete() {
    if (!ownerId || form.status === "loading" || !form.existing) return;

    const existing = form.existing;
    Alert.alert(
      "Delete item?",
      "This also deletes its photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setForm({ status: "saving", existing });
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
                setForm({
                  status: "error",
                  message: "Couldn’t delete the item. Please try again.",
                  existing,
                });
              }
            })();
          },
        },
      ],
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
            <AppText>Loading…</AppText>
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Issue description *
                </AppText>

                <TextInput
                  accessibilityLabel="Issue description"
                  multiline
                  value={description}
                  onChangeText={setDescription}
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
                  value={location}
                  onChangeText={setLocation}
                  placeholder="e.g. Kitchen"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Trade
                </AppText>

                <ChipGroup
                  label="Trade"
                  options={trades}
                  selection={{
                    mode: "single",
                    value: trade,
                    onChange: setTrade,
                  }}
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
                    value: priority,
                    onChange: setPriority,
                  }}
                />
              </View>

              {!id ? (
                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Photos
                  </AppText>

                  <PhotoGallery
                    photos={photos}
                    busy={banner.busy || photoBusy || form.status === "saving"}
                    onAdd={choosePhoto}
                    onRemove={async (photo) => {
                      setPhotos((current) =>
                        current.filter(
                          (entry) => entry.localUri !== photo.localUri,
                        ),
                      );

                      return true;
                    }}
                  />
                </View>
              ) : null}

              {id && form.existing ? (
                <BannerPicker
                  uri={banner.uri}
                  busy={banner.busy || photoBusy || form.status === "saving"}
                  onChoose={banner.choose}
                  onRemove={banner.remove}
                />
              ) : null}

              {form.status === "error" ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {form.message}
                </AppText>
              ) : null}
            </>
          )}
        </ScrollView>

        {form.status !== "loading" ? (
          <View style={styles.actions}>
            {id && hasChanges ? (
              <View style={styles.action}>
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  disabled={
                    banner.busy || photoBusy || form.status === "saving"
                  }
                  onPress={cancelChanges}
                />
              </View>
            ) : null}

            {showSave ? (
              <View style={styles.action}>
                <AppButton
                  title={
                    form.status === "saving"
                      ? "Saving…"
                      : id
                        ? "Save changes"
                        : "Add item"
                  }
                  disabled={
                    banner.busy ||
                    photoBusy ||
                    form.status === "saving" ||
                    (!!id && !form.existing)
                  }
                  onPress={save}
                />
              </View>
            ) : null}

            {id && form.existing && !hasChanges ? (
              <View style={styles.action}>
                <AppButton
                  title="Delete"
                  accessibilityLabel="Delete item"
                  variant="danger"
                  disabled={
                    banner.busy || photoBusy || form.status === "saving"
                  }
                  onPress={confirmDelete}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
