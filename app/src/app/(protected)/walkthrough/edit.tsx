import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { useDialogStore } from "../../../store/dialog-store";
import { BannerPicker } from "../../../components/banner-picker";
import { useBannerDraft } from "../../../hooks/use-banner-draft";
import {
  getBannerColor,
  randomBannerColor,
} from "../../../services/banner-colors";
import { AppText } from "../../../components/app-text";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { Walkthrough } from "../../../models/walkthrough";
import { deleteItemPhotos } from "../../../services/walkthrough/photos";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useAuthStore } from "../../../store/auth-store";

interface WalkthroughDraft {
  title: string;
  clientName: string;
  address: string;
}

type FormState =
  | { status: "loading"; draft: WalkthroughDraft }
  | { status: "ready"; draft: WalkthroughDraft; existing?: Walkthrough }
  | { status: "saving"; draft: WalkthroughDraft; existing?: Walkthrough }
  | {
      status: "error";
      draft: WalkthroughDraft;
      message: string;
      existing?: Walkthrough;
    };

export default function WalkthroughEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState<FormState>({
    status: id ? "loading" : "ready",
    draft: { title: "", clientName: "", address: "" },
  });

  const showDialog = useDialogStore((state) => state.showDialog);

  const banner = useBannerDraft();

  const existing = form.status === "loading" ? undefined : form.existing;
  const draft = form.draft;
  const hasChanges =
    !!existing &&
    (draft.title !== existing.title ||
      draft.clientName !== (existing.clientName ?? "") ||
      draft.address !== (existing.address ?? "") ||
      banner.uri !== existing.bannerPhotoUri);
  const showSave = !id || hasChanges;

  useEffect(() => {
    if (!id || !ownerId) return;

    let active = true;
    void createWalkthroughStorage(ownerId)
      .getWalkthrough(id)
      .then((walkthrough) => {
        if (!active) return;

        if (!walkthrough) {
          setForm((current) => ({
            ...current,
            status: "error",
            message: "This walkthrough could not be found.",
          }));

          return;
        }

        banner.load(walkthrough.bannerPhotoUri);
        setForm({
          status: "ready",
          existing: walkthrough,
          draft: {
            title: walkthrough.title,
            clientName: walkthrough.clientName ?? "",
            address: walkthrough.address ?? "",
          },
        });
      })
      .catch(() => {
        if (active)
          setForm((current) => ({
            ...current,
            status: "error",
            message: "Couldn’t load this walkthrough.",
          }));
      });

    return () => {
      active = false;
    };
  }, [id, ownerId]);

  function cancelChanges() {
    if (!existing) return;

    banner.reset();
    setForm({
      status: "ready",
      existing,
      draft: {
        title: existing.title,
        clientName: existing.clientName ?? "",
        address: existing.address ?? "",
      },
    });
  }

  async function save() {
    if (
      !ownerId ||
      banner.busy ||
      form.status === "loading" ||
      form.status === "saving"
    )
      return;

    const existing = form.existing;
    if (id && !existing) return;

    if (!draft.title.trim()) {
      setForm({
        status: "error",
        draft,
        message: "Enter a walkthrough name.",
        existing,
      });

      return;
    }

    banner.beginSave();
    setForm({ status: "saving", existing, draft });
    try {
      const now = Date.now();
      const walkthrough: Walkthrough = {
        id: existing?.id ?? Crypto.randomUUID(),
        title: draft.title.trim(),
        bannerColor: existing
          ? getBannerColor(existing.id, existing.bannerColor)
          : randomBannerColor(),
        bannerPhotoUri: banner.uri,
        clientName: draft.clientName.trim() || undefined,
        address: draft.address.trim() || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        executiveSummary: existing?.executiveSummary,
        status: existing?.status ?? "in_progress",
      };
      await createWalkthroughStorage(ownerId).saveWalkthrough(walkthrough);
      await banner.finishSave(true);
      if (existing) router.back();
      else
        router.replace({
          pathname: "/walkthrough/[id]",
          params: { id: walkthrough.id },
        });
    } catch {
      await banner.finishSave(false);
      setForm((current) => ({
        ...current,
        status: "error",
        message: "Couldn’t save the walkthrough. Please try again.",
        existing,
      }));
    }
  }

  function confirmDelete() {
    if (
      !id ||
      !ownerId ||
      banner.busy ||
      deleting ||
      form.status === "loading" ||
      form.status === "saving" ||
      !form.existing
    )
      return;

    showDialog(
      "Delete walkthrough?",
      "This also deletes its items and photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                const storage = createWalkthroughStorage(ownerId);
                const items = await storage.listItems(id);
                await storage.deleteWalkthrough(id);
                await deleteItemPhotos([
                  ...items.flatMap((item) => [
                    ...item.photos,
                    ...(item.bannerPhotoUri
                      ? [{ localUri: item.bannerPhotoUri }]
                      : []),
                  ]),
                  ...(form.existing?.bannerPhotoUri
                    ? [{ localUri: form.existing.bannerPhotoUri }]
                    : []),
                ]).catch(() => {});
                router.dismissTo("/(protected)/(tabs)");
              } catch {
                setDeleting(false);
                showDialog("Couldn’t delete walkthrough", "Please try again.");
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
              {id ? "Settings" : "New walkthrough"}
            </AppText>

            <AppText style={styles.subheading}>
              {id
                ? "Update the details of this walkthrough."
                : "Keep a record of your site visit, even when you’re offline."}
            </AppText>
          </View>

          {form.status === "loading" ? (
            <AppText>Loading walkthrough</AppText>
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Walkthrough name *
                </AppText>

                <TextInput
                  accessibilityLabel="Walkthrough name"
                  value={draft.title}
                  onChangeText={(title) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, title },
                    }))
                  }
                  placeholder="e.g. Apartment 4B"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Client (optional)
                </AppText>

                <TextInput
                  accessibilityLabel="Client"
                  value={draft.clientName}
                  onChangeText={(clientName) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, clientName },
                    }))
                  }
                  placeholder="Client name"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Address (optional)
                </AppText>

                <TextInput
                  accessibilityLabel="Address"
                  value={draft.address}
                  onChangeText={(address) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, address },
                    }))
                  }
                  placeholder="Site address"
                  style={styles.input}
                />
              </View>

              {id && form.existing ? (
                <BannerPicker
                  uri={banner.uri}
                  busy={banner.busy || deleting || form.status === "saving"}
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
                  disabled={banner.busy || deleting || form.status === "saving"}
                  onPress={cancelChanges}
                />
              </View>
            ) : null}

            {showSave ? (
              <View style={styles.action}>
                <AppButton
                  title={
                    form.status === "saving"
                      ? "Saving"
                      : id
                        ? "Save changes"
                        : "Create walkthrough"
                  }
                  disabled={
                    banner.busy ||
                    deleting ||
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
                  variant="danger"
                  title={deleting ? "Deleting" : "Delete"}
                  accessibilityLabel="Delete walkthrough"
                  disabled={banner.busy || deleting || form.status === "saving"}
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
