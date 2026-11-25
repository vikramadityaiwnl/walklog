import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { FolderIcon } from "react-native-heroicons/outline";
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
import { BannerPicker } from "../../../components/banner-picker";
import { ProjectPicker } from "../../../components/project-picker";
import { useBannerDraft } from "../../../hooks/use-banner-draft";
import { AppText } from "../../../components/app-text";
import { LoadingState } from "../../../components/loading-state";
import { ErrorState } from "../../../components/error-state";
import type { Project, Walkthrough } from "../../../models/walkthrough";
import {
  createFirestoreId,
  createWalkthroughStorage,
} from "../../../services/walkthrough/storage";
import { useAuthStore } from "../../../store/auth-store";
import { randomBannerIllustration } from "../../../utils/banner-illustrations";
import {
  formFadeIn,
  formFadeOut,
  formLayout,
} from "../../../utils/form-motion";

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
  const { id, fromProjectId } = useLocalSearchParams<{
    id?: string;
    fromProjectId?: string;
  }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [deleting, setDeleting] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [move, setMove] = useState<
    { status: "idle" | "loading" } | { status: "ready"; projects: Project[] }
  >({ status: "idle" });

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
  }, [id, ownerId, loadRevision]);

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
        ...existing,
        id: existing?.id ?? createFirestoreId(ownerId, "walkthroughs"),
        title: draft.title.trim(),
        bannerIllustration:
          existing?.bannerIllustration ?? randomBannerIllustration(),
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
      "This removes the walkthrough, its items and photos. Cleanup finishes when you’re online.",
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
                await storage.deleteWalkthrough(id);
                if (fromProjectId)
                  router.dismissTo({
                    pathname: "/project/[id]",
                    params: { id: fromProjectId },
                  });
                else router.dismissTo("/(protected)/(tabs)");
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

  async function chooseProject() {
    if (!ownerId || !id || move.status !== "idle") return;

    setMove({ status: "loading" });
    try {
      const projects = await createWalkthroughStorage(ownerId).listProjects();
      setMove({ status: "ready", projects });
    } catch {
      setMove({ status: "idle" });
      showDialog("Couldn’t load projects", "Please try again.");
    }
  }

  async function finishMove() {
    setMove({ status: "idle" });
    if (!ownerId || !id) return;

    try {
      const walkthrough =
        await createWalkthroughStorage(ownerId).getWalkthrough(id);
      if (walkthrough)
        setForm((current) => ({ ...current, existing: walkthrough }));
    } catch {
      showDialog(
        "Couldn’t refresh walkthrough",
        "Reopen its settings to see the updated project.",
      );
    }
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
              {id ? "Settings" : "New walkthrough"}
            </AppText>

            <AppText style={styles.subheading}>
              {id
                ? "Update the details of this walkthrough."
                : "Keep a record of your site visit, even when you’re offline."}
            </AppText>
          </View>

          {form.status === "loading" ? (
            <LoadingState />
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Walkthrough name *
                </AppText>

                <TextInput
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  accessibilityLabel="Walkthrough name"
                  value={draft.title}
                  onChangeText={(title) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, title },
                    }))
                  }
                  placeholderTextColor={colors.muted}
                  placeholder="e.g. Apartment 4B"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Client (optional)
                </AppText>

                <TextInput
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  accessibilityLabel="Client"
                  value={draft.clientName}
                  onChangeText={(clientName) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, clientName },
                    }))
                  }
                  placeholderTextColor={colors.muted}
                  placeholder="Client name"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Address (optional)
                </AppText>

                <TextInput
                  selectionColor={colors.accent}
                  cursorColor={colors.accent}
                  accessibilityLabel="Address"
                  value={draft.address}
                  onChangeText={(address) =>
                    setForm((current) => ({
                      ...current,
                      draft: { ...current.draft, address },
                    }))
                  }
                  placeholderTextColor={colors.muted}
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
                  disabled={banner.busy || deleting || form.status === "saving"}
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
              </Animated.View>
            ) : null}

            {id && form.existing && !hasChanges ? (
              <Animated.View
                key="move"
                entering={formFadeIn}
                exiting={formFadeOut}
                layout={formLayout}
                style={styles.action}
              >
                <AppButton
                  title={
                    move.status === "loading"
                      ? "Loading"
                      : form.existing.projectId
                        ? "Move"
                        : "Add to project"
                  }
                  accessibilityLabel={
                    form.existing.projectId
                      ? "Move to another project"
                      : "Add to project"
                  }
                  variant="secondary"
                  icon={<FolderIcon size={18} color={colors.foreground} />}
                  disabled={move.status !== "idle" || deleting || banner.busy}
                  onPress={chooseProject}
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
                  variant="danger"
                  title={deleting ? "Deleting" : "Delete"}
                  accessibilityLabel="Delete walkthrough"
                  disabled={
                    banner.busy ||
                    deleting ||
                    form.status === "saving" ||
                    move.status !== "idle"
                  }
                  onPress={confirmDelete}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </KeyboardAvoidingView>

      {ownerId && id && move.status === "ready" ? (
        <ProjectPicker
          visible
          ownerId={ownerId}
          projects={move.projects.filter(
            (project) => project.id !== existing?.projectId,
          )}
          walkthroughIds={[id]}
          canRemoveFromProject={!!existing?.projectId}
          onClose={() => setMove({ status: "idle" })}
          onMoved={() => {
            void finishMove();
          }}
        />
      ) : null}
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
