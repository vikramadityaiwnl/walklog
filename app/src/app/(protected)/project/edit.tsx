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
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { BannerPicker } from "../../../components/banner-picker";
import { ProjectPicker } from "../../../components/project-picker";
import { useBannerDraft } from "../../../hooks/use-banner-draft";
import type { Project } from "../../../models/walkthrough";
import {
  createFirestoreId,
  createWalkthroughStorage,
} from "../../../services/walkthrough/storage";
import { deleteItemPhotos } from "../../../services/walkthrough/photos";
import { useAuthStore } from "../../../store/auth-store";
import { useDialogStore } from "../../../store/dialog-store";
import { colors } from "../../../theme";
import { randomBannerIllustration } from "../../../utils/banner-illustrations";

type Form = {
  status: "loading" | "ready" | "saving" | "error";
  name: string;
  project?: Project;
  message?: string;
};

export default function ProjectEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const auth = useAuthStore((state) => state.auth);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [form, setForm] = useState<Form>({
    status: id ? "loading" : "ready",
    name: "",
  });
  const [deleting, setDeleting] = useState(false);
  const [move, setMove] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; projects: Project[]; ids: string[] }
  >({ status: "idle" });
  const showDialog = useDialogStore((state) => state.showDialog);
  const banner = useBannerDraft();
  const changed =
    !id ||
    (!!form.project &&
      (form.name !== form.project.name ||
        banner.uri !== form.project.bannerPhotoUri));

  useEffect(() => {
    if (!id || !ownerId) return;
    let active = true;
    void createWalkthroughStorage(ownerId)
      .listProjects()
      .then((projects) => {
        if (!active) return;
        const project = projects.find((entry) => entry.id === id);
        if (!project) {
          setForm({
            status: "error",
            name: "",
            message: "This project could not be found.",
          });
          return;
        }
        banner.load(project.bannerPhotoUri);
        setForm({ status: "ready", name: project.name, project });
      })
      .catch(() => {
        if (active)
          setForm({
            status: "error",
            name: "",
            message: "Couldn’t load this project.",
          });
      });
    return () => {
      active = false;
    };
  }, [id, ownerId]);

  async function save() {
    if (
      !ownerId ||
      banner.busy ||
      form.status === "saving" ||
      (id && !form.project)
    )
      return;
    if (!form.name.trim()) {
      setForm({ ...form, status: "error", message: "Enter a project name." });
      return;
    }
    banner.beginSave();
    setForm({ ...form, status: "saving", message: undefined });
    try {
      const project: Project = {
        ...form.project,
        id: form.project?.id ?? createFirestoreId(ownerId, "projects"),
        name: form.name.trim(),
        bannerIllustration:
          form.project?.bannerIllustration ?? randomBannerIllustration(),
        createdAt: form.project?.createdAt ?? Date.now(),
        bannerPhotoUri: banner.uri,
      };
      const storage = createWalkthroughStorage(ownerId);
      if (form.project) await storage.saveProject(project);
      else await storage.createProject(project);
      await banner.finishSave(true);
      if (id) router.back();
      else
        router.replace({
          pathname: "/project/[id]",
          params: { id: project.id },
        });
    } catch {
      await banner.finishSave(false);
      setForm({
        ...form,
        status: "error",
        message: "Couldn’t save this project. Please try again.",
      });
    }
  }

  function cancel() {
    if (!form.project) return;
    banner.reset();
    setForm({
      status: "ready",
      name: form.project.name,
      project: form.project,
    });
  }

  function confirmDelete() {
    if (
      !id ||
      !ownerId ||
      !form.project ||
      deleting ||
      banner.busy ||
      form.status === "saving"
    )
      return;

    showDialog(
      "Delete project?",
      "The project will be deleted. Its walkthroughs and their items will remain available in Walkthroughs.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                const photos =
                  await createWalkthroughStorage(ownerId).deleteProject(id);
                await deleteItemPhotos(photos).catch(() => {});
                router.dismissTo("/(protected)/(tabs)/projects");
              } catch {
                setDeleting(false);
                showDialog("Couldn’t delete project", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }

  async function moveWalkthroughs() {
    if (!ownerId || !id || move.status !== "idle") return;
    setMove({ status: "loading" });
    try {
      const storage = createWalkthroughStorage(ownerId);
      const [projects, walkthroughs] = await Promise.all([
        storage.listProjects(),
        storage.listWalkthroughs(),
      ]);
      const ids = walkthroughs
        .filter((entry) => entry.projectId === id)
        .map((entry) => entry.id);
      if (!ids.length) {
        setMove({ status: "idle" });
        showDialog(
          "No walkthroughs to move",
          "Add walkthroughs to this project first.",
        );
        return;
      }
      setMove({
        status: "ready",
        projects: projects.filter((entry) => entry.id !== id),
        ids,
      });
    } catch {
      setMove({ status: "idle" });
      showDialog("Couldn’t load walkthroughs", "Please try again.");
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.headingGroup}>
            <AppText variant="title" style={styles.heading}>
              {id ? "Settings" : "New project"}
            </AppText>
            <AppText style={styles.subheading}>
              {id
                ? "Update the details of this project."
                : "Keep related walkthroughs together."}
            </AppText>
          </View>
          {form.status === "loading" ? (
            <AppText>Loading project</AppText>
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold">Project name *</AppText>
                <TextInput
                  accessibilityLabel="Project name"
                  value={form.name}
                  onChangeText={(name) => setForm({ ...form, name })}
                  placeholder="e.g. Apartment renovation"
                  style={styles.input}
                />
              </View>
              {!id || form.project ? (
                <BannerPicker
                  uri={banner.uri}
                  busy={banner.busy || deleting || form.status === "saving"}
                  onChoose={banner.choose}
                  onRemove={banner.remove}
                />
              ) : null}

              {form.message ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {form.message}
                </AppText>
              ) : null}
            </>
          )}
        </ScrollView>
        {form.status !== "loading" && changed ? (
          <View style={styles.actions}>
            {id && form.project ? (
              <View style={styles.action}>
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  disabled={banner.busy || deleting || form.status === "saving"}
                  onPress={cancel}
                />
              </View>
            ) : null}
            <View style={styles.action}>
              <AppButton
                title={
                  form.status === "saving"
                    ? "Saving"
                    : id
                      ? "Save changes"
                      : "Create project"
                }
                disabled={
                  banner.busy ||
                  deleting ||
                  form.status === "saving" ||
                  (!!id && !form.project)
                }
                onPress={save}
              />
            </View>
          </View>
        ) : id && form.project && form.status !== "loading" ? (
          <View style={styles.actions}>
            <View style={styles.action}>
              <AppButton
                title={move.status === "loading" ? "Loading" : "Move all"}
                accessibilityLabel="Move all walkthroughs"
                variant="secondary"
                icon={<FolderIcon size={18} color={colors.foreground} />}
                disabled={move.status !== "idle" || deleting || banner.busy}
                onPress={moveWalkthroughs}
              />
            </View>

            <View style={styles.action}>
              <AppButton
                variant="danger"
                title={deleting ? "Deleting" : "Delete"}
                accessibilityLabel="Delete project"
                disabled={
                  banner.busy ||
                  deleting ||
                  form.status === "saving" ||
                  move.status !== "idle"
                }
                onPress={confirmDelete}
              />
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {ownerId && move.status === "ready" ? (
        <ProjectPicker
          visible
          ownerId={ownerId}
          projects={move.projects}
          walkthroughIds={move.ids}
          canRemoveFromProject={false}
          onClose={() => setMove({ status: "idle" })}
          onMoved={() => setMove({ status: "idle" })}
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
  headingGroup: { gap: 5, marginBottom: 8 },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subheading: { color: colors.muted, lineHeight: 22 },
  section: { gap: 8 },
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
  error: { color: colors.danger },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
});
