import { useState } from "react";
import * as Crypto from "expo-crypto";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "./app-text";
import { AppButton } from "./app-button";
import { colors } from "../theme";
import { createWalkthroughStorage } from "../services/walkthrough/storage";
import type { Project } from "../models/walkthrough";

interface Props {
  visible: boolean;
  ownerId: string;
  projects: Project[];
  onClose: () => void;
  onMoved: () => void;
  walkthroughIds: string[];
}

export function ProjectPicker(props: Props) {
  const [state, setState] = useState<{
    status: "idle" | "creating" | "saving" | "error";
    name: string;
    message?: string;
  }>({ status: "idle", name: "" });

  async function move(projectId: string | null, name?: string) {
    setState({ ...state, status: "saving" });
    try {
      const storage = createWalkthroughStorage(props.ownerId);
      let target = projectId;
      if (name) {
        target = Crypto.randomUUID();
        await storage.createProject({
          id: target,
          name,
          createdAt: Date.now(),
        });
      }
      await storage.moveWalkthroughs(props.walkthroughIds, target);
      setState({ status: "idle", name: "" });
      props.onMoved();
    } catch {
      setState({
        status: "error",
        name: state.name,
        message: "Couldn’t move walkthroughs. Please try again.",
      });
    }
  }

  function close() {
    setState({ status: "idle", name: "" });
    props.onClose();
  }

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.container}>
        <View style={styles.heading}>
          <AppText variant="title" style={styles.title}>
            Move to project
          </AppText>
          <AppText style={styles.muted}>
            Choose a project for the selected walkthroughs.
          </AppText>
        </View>
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
        >
          {props.projects.map((project) => (
            <Pressable
              key={project.id}
              accessibilityRole="button"
              disabled={state.status === "saving"}
              onPress={() => void move(project.id)}
              style={styles.option}
            >
              <AppText weight="semibold">{project.name}</AppText>
            </Pressable>
          ))}
          {state.status === "creating" ||
          (state.status === "error" && state.name) ? (
            <View style={styles.form}>
              <AppText weight="semibold">Project name</AppText>
              <TextInput
                accessibilityLabel="Project name"
                value={state.name}
                onChangeText={(name) => setState({ status: "creating", name })}
                placeholder="Project name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <AppButton
                title="Create and move"
                disabled={!state.name.trim()}
                onPress={() => void move(null, state.name.trim())}
              />
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={state.status === "saving"}
              onPress={() => setState({ status: "creating", name: "" })}
              style={styles.option}
            >
              <AppText weight="semibold" style={styles.accent}>
                + New project
              </AppText>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            disabled={state.status === "saving"}
            onPress={() => void move(null)}
            style={styles.option}
          >
            <AppText>Remove from project</AppText>
          </Pressable>
          {state.message ? (
            <AppText style={styles.error}>{state.message}</AppText>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <AppButton
            title="Cancel"
            variant="secondary"
            disabled={state.status === "saving"}
            onPress={close}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { paddingHorizontal: 24, paddingTop: 28, gap: 6 },
  title: { fontSize: 28 },
  muted: { color: colors.muted },
  list: { padding: 24, gap: 12 },
  option: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  form: { gap: 12, paddingVertical: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.foreground,
  },
  accent: { color: colors.accent },
  error: { color: colors.danger },
  footer: { padding: 24 },
});
