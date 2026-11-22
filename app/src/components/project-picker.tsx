import { useState } from "react";
import {
  ChevronRightIcon,
  FolderIcon,
  FolderMinusIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "./app-text";
import { AppButton } from "./app-button";
import { AppDialog } from "./app-dialog";
import { BannerPicker } from "./banner-picker";
import { useBannerDraft } from "../hooks/use-banner-draft";
import { colors } from "../theme";
import {
  createFirestoreId,
  createWalkthroughStorage,
} from "../services/walkthrough/storage";
import type { Project } from "../models/walkthrough";
import { randomBannerIllustration } from "../utils/banner-illustrations";

interface Props {
  visible: boolean;
  ownerId: string;
  projects: Project[];
  onClose: () => void;
  onMoved: () => void;
  walkthroughIds: string[];
  canRemoveFromProject: boolean;
}

type PickerState = {
  status: "choosing" | "creating" | "saving" | "error";
  name: string;
  message?: string;
};

export function ProjectPicker(props: Props) {
  const [state, setState] = useState<PickerState>({
    status: "choosing",
    name: "",
  });
  const banner = useBannerDraft("project-picker");

  async function move(projectId: string | null, create = false) {
    if (state.status === "saving" || banner.busy) return;
    setState({ ...state, status: "saving" });
    if (create) banner.beginSave();
    try {
      const storage = createWalkthroughStorage(props.ownerId);
      if (create) {
        await storage.createProjectAndMove(
          {
            id: createFirestoreId(props.ownerId, "projects"),
            name: state.name.trim(),
            createdAt: Date.now(),
            bannerIllustration: randomBannerIllustration(),
            bannerPhotoUri: banner.uri,
          },
          props.walkthroughIds,
        );
        await banner.finishSave(true);
        banner.load(undefined);
      } else {
        await storage.moveWalkthroughs(props.walkthroughIds, projectId);
      }
      setState({ status: "choosing", name: "" });
      props.onMoved();
    } catch {
      if (create) await banner.finishSave(false);
      setState({
        status: "error",
        name: state.name,
        message: "Couldn’t move walkthroughs. Please try again.",
      });
    }
  }

  function close() {
    if (state.status === "saving" || banner.busy) return;
    banner.reset();
    setState({ status: "choosing", name: "" });
    props.onClose();
  }

  const creating =
    state.status === "creating" || (state.status === "error" && !!state.name);

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.heading}>
            <AppText variant="title" style={styles.title}>
              {creating ? "New project" : "Move to project"}
            </AppText>

            <AppText style={styles.muted}>
              {creating
                ? "Create a home for these walkthroughs."
                : "Choose where to keep the selected walkthroughs."}
            </AppText>
          </View>

          <ScrollView
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          >
            {creating ? (
              <View style={styles.form}>
                <View style={styles.field}>
                  <AppText weight="semibold">Project name</AppText>

                  <TextInput
                    accessibilityLabel="Project name"
                    value={state.name}
                    onChangeText={(name) =>
                      setState({ status: "creating", name })
                    }
                    placeholder="e.g. Apartment renovation"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                  />
                </View>

                <BannerPicker
                  uri={banner.uri}
                  busy={banner.busy || state.status === "saving"}
                  onChoose={banner.choose}
                  onRemove={banner.remove}
                />

                <AppButton
                  title="Create and move"
                  disabled={
                    !state.name.trim() ||
                    banner.busy ||
                    state.status === "saving"
                  }
                  onPress={() => void move(null, true)}
                />
              </View>
            ) : (
              <>
                {props.projects.map((project) => (
                  <Pressable
                    key={project.id}
                    accessibilityRole="button"
                    disabled={state.status === "saving"}
                    onPress={() => void move(project.id)}
                    style={styles.option}
                  >
                    <View style={styles.optionIcon}>
                      <FolderIcon size={21} color={colors.accent} />
                    </View>

                    <AppText weight="semibold" style={styles.optionName}>
                      {project.name}
                    </AppText>

                    <ChevronRightIcon size={20} color={colors.muted} />
                  </Pressable>
                ))}

                <Pressable
                  accessibilityRole="button"
                  disabled={state.status === "saving"}
                  onPress={() => setState({ status: "creating", name: "" })}
                  style={styles.option}
                >
                  <View style={styles.optionIcon}>
                    <PlusIcon size={21} color={colors.accent} />
                  </View>

                  <AppText weight="semibold" style={styles.accent}>
                    New project
                  </AppText>
                </Pressable>
              </>
            )}

            {state.message ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {state.message}
              </AppText>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            {props.canRemoveFromProject && !creating ? (
              <View style={styles.action}>
                <AppButton
                  title="Remove"
                  accessibilityLabel="Remove from project"
                  variant="danger"
                  icon={<FolderMinusIcon size={18} color={colors.onAccent} />}
                  disabled={state.status === "saving"}
                  onPress={() => void move(null)}
                />
              </View>
            ) : null}

            <View style={styles.action}>
              <AppButton
                title="Cancel"
                variant="secondary"
                disabled={state.status === "saving" || banner.busy}
                onPress={close}
              />
            </View>
          </View>
        </KeyboardAvoidingView>

        <AppDialog surface="project-picker" />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { paddingHorizontal: 24, paddingTop: 28, gap: 6 },
  title: { fontSize: 28, lineHeight: 36 },
  muted: { color: colors.muted, lineHeight: 22 },
  list: { padding: 24, gap: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentFaint,
  },
  optionName: { flex: 1 },
  form: { gap: 20 },
  field: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 50,
    color: colors.foreground,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    lineHeight: 22,
    textAlignVertical: "center",
  },
  accent: { color: colors.accent },
  error: { color: colors.danger },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 12,
  },
  action: { flex: 1 },
});
