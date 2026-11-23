import { useEffect } from "react";
import { AppState, Platform, Pressable, StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { usePathname } from "expo-router";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { ArrowDownTrayIcon } from "react-native-heroicons/outline";
import { useDeviceModelStore } from "../store/device-model-store";
import { colors } from "../theme";
import { formatBytes } from "../utils/format-bytes";
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
  const pathname = usePathname();

  const percentage =
    model.status === "downloading" && model.progress?.total
      ? Math.min(
          100,
          Math.round((model.progress.bytes / model.progress.total) * 100),
        )
      : null;
  const progressStyle = useAnimatedStyle(
    () => ({
      width: withTiming(`${percentage ?? 0}%`, {
        duration: 180,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [percentage],
  );

  if (
    Platform.OS !== "android" ||
    pathname === "/profile" ||
    (model.status !== "downloadable" && model.status !== "downloading")
  )
    return null;

  return (
    <Animated.View
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
      layout={LinearTransition.duration(180).reduceMotion(ReduceMotion.System)}
    >
      <Pressable
        accessibilityRole="button"
        disabled={model.status === "downloading"}
        onPress={() => void download()}
        style={styles.banner}
      >
        <View style={styles.icon}>
          <ArrowDownTrayIcon size={21} color={colors.muted} />
        </View>

        <View style={styles.copy}>
          <AppText weight="semibold">
            {model.status === "downloading"
              ? "Downloading on-device AI"
              : "Download on-device AI"}
          </AppText>

          <AppText style={styles.description}>
            Download Gemini Nano to process notes on this device.
          </AppText>

          {model.status === "downloading" && percentage !== null ? (
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, progressStyle]} />
            </View>
          ) : null}

          {model.status === "downloading" ? (
            <AppText style={styles.description}>
              {model.progress?.total
                ? `Downloading ${formatBytes(model.progress.bytes)} of ${formatBytes(model.progress.total)}`
                : "Preparing the model on this device."}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 24,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.neutralSoft,
  },
  icon: { width: 30, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1, gap: 4 },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: colors.muted },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
