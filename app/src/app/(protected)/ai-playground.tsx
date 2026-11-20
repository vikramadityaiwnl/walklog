import { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { AppButton } from "../../components/app-button";
import { AppText } from "../../components/app-text";
import { colors } from "../../theme";
import {
  checkModelAvailability,
  downloadModel,
  generateText,
  type Generation,
  type InferenceMode,
  type ModelAvailability,
} from "../../services/firebase-ai";

type AvailabilityState =
  | { status: "checking" }
  | { status: "ready"; value: ModelAvailability }
  | { status: "error"; message: string };
type OperationState =
  | { status: "idle" }
  | { status: "generating" | "downloading" }
  | { status: "complete"; result: Generation; elapsedMs: number }
  | { status: "error"; message: string };

const modes: { label: string; value: InferenceMode }[] = [
  { label: "Automatic", value: "auto" },
  { label: "On device", value: "device" },
  { label: "Cloud", value: "cloud" },
];

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export default function AiPlayground() {
  const [availability, setAvailability] = useState<AvailabilityState>({
    status: "checking",
  });
  const [operation, setOperation] = useState<OperationState>({
    status: "idle",
  });
  const [mode, setMode] = useState<InferenceMode>("auto");
  const [prompt, setPrompt] = useState(
    "Summarize this site note: The kitchen cabinet hinge is loose.",
  );
  const busy =
    operation.status === "generating" || operation.status === "downloading";

  async function refreshAvailability() {
    setAvailability({ status: "checking" });
    try {
      setAvailability({
        status: "ready",
        value: await checkModelAvailability(),
      });
    } catch (error) {
      setAvailability({ status: "error", message: messageFor(error) });
    }
  }

  useEffect(() => {
    void refreshAvailability();
  }, []);

  async function handleDownload() {
    setOperation({ status: "downloading" });
    try {
      await downloadModel();
      await refreshAvailability();
      setOperation({ status: "idle" });
    } catch (error) {
      setOperation({ status: "error", message: messageFor(error) });
      await refreshAvailability();
    }
  }

  async function handleGenerate() {
    setOperation({ status: "generating" });
    const started = Date.now();
    try {
      const result = await generateText(prompt, mode);
      setOperation({
        status: "complete",
        result,
        elapsedMs: Date.now() - started,
      });
    } catch (error) {
      setOperation({ status: "error", message: messageFor(error) });
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <AppText variant="title">AI playground</AppText>
      <AppText weight="semibold">On-device availability</AppText>
      <AppText>
        {availability.status === "checking"
          ? "Checking…"
          : availability.status === "error"
            ? availability.message
            : availability.value.message}
      </AppText>
      <AppButton
        title="Check again"
        disabled={busy || availability.status === "checking"}
        onPress={() => void refreshAvailability()}
      />
      {Platform.OS === "android" &&
      availability.status === "ready" &&
      availability.value.status === "downloadable" ? (
        <AppButton
          title={
            operation.status === "downloading"
              ? "Downloading…"
              : "Download model"
          }
          disabled={busy}
          onPress={() => void handleDownload()}
        />
      ) : null}
      <AppText weight="semibold">Inference mode</AppText>
      <View style={styles.modes}>
        {modes.map((item) => (
          <Pressable
            key={item.value}
            accessible
            accessibilityRole="radio"
            accessibilityState={{
              checked: mode === item.value,
              disabled: busy,
            }}
            disabled={busy}
            onPress={() => setMode(item.value)}
            style={[styles.mode, mode === item.value && styles.selected]}
          >
            <AppText>{item.label}</AppText>
          </Pressable>
        ))}
      </View>
      <AppText>
        Automatic prefers the on-device model and may use the cloud. On device
        and Cloud only use their selected source.
      </AppText>
      <TextInput
        accessibilityLabel="Prompt"
        multiline
        editable={!busy}
        value={prompt}
        onChangeText={setPrompt}
        style={styles.input}
      />
      <AppButton
        title={operation.status === "generating" ? "Generating…" : "Generate"}
        disabled={busy || !prompt.trim()}
        onPress={() => void handleGenerate()}
      />
      {operation.status === "error" ? (
        <AppText accessibilityRole="alert">{operation.message}</AppText>
      ) : null}
      {operation.status === "complete" ? (
        <View style={styles.result}>
          <AppText weight="semibold">{`Source: ${operation.result.source} · ${operation.elapsedMs} ms`}</AppText>
          <AppText selectable>{operation.result.text}</AppText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: 14,
    padding: 24,
  },
  modes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  mode: {
    borderColor: colors.foreground,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  selected: {
    backgroundColor: colors.accentSelected,
    borderColor: colors.accent,
  },
  input: {
    borderColor: colors.foreground,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.foreground,
    fontFamily: "DMSans_400Regular",
    minHeight: 120,
    padding: 12,
    textAlignVertical: "top",
  },
  result: { gap: 8 },
});
