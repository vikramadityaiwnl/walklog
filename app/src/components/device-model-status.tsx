import { useEffect } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { ArrowDownTrayIcon } from "react-native-heroicons/outline";
import { useDeviceModelStore } from "../store/device-model-store";
import { colors } from "../theme";
import { AppText } from "./app-text";

export function useDeviceModelStatus() {
  const { model, refresh } = useDeviceModelStore(
    useShallow((state) => ({ model: state.model, refresh: state.refresh })),
  );

  useEffect(() => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    if (model.status !== "downloading" || model.progress) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [model, refresh]);

  return model;
}

export function DeviceModelBanner() {
  const model = useDeviceModelStatus();
  const download = useDeviceModelStore((state) => state.download);

  if (
    Platform.OS !== "android" ||
    (model.status !== "downloadable" && model.status !== "downloading")
  )
    return null;

  const percentage =
    model.status === "downloading" && model.progress?.total
      ? Math.min(
          100,
          Math.round((model.progress.bytes / model.progress.total) * 100),
        )
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={model.status === "downloading"}
      onPress={() => void download()}
      style={styles.banner}
    >
      <ArrowDownTrayIcon size={21} color={colors.accent} />

      <View style={styles.copy}>
        <AppText weight="semibold">
          {model.status === "downloading"
            ? "Downloading on-device AI"
            : "Download on-device AI"}
        </AppText>

        <AppText style={styles.description}>
          {percentage !== null
            ? `${percentage}% downloaded`
            : model.status === "downloading"
              ? "Preparing the model on this device."
              : "Download the model to process notes on this device."}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 24,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.accentFaint,
  },
  copy: { flex: 1, gap: 2 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
