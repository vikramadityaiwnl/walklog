import { useEffect, useState } from "react";
import { useNetworkState } from "expo-network";
import { Pressable, StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { checkModelAvailability } from "../services/firebase/ai";
import { saveInferencePreference } from "../services/firebase/user-preferences";
import { useAuthStore } from "../store/auth-store";
import { useDialogStore } from "../store/dialog-store";
import { useInferenceStore } from "../store/inference-store";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  align?: "start" | "center";
  requiresAudio?: boolean;
  allowUnavailable?: boolean;
}

export function InferenceSelector(props: Props) {
  const { preference, setMode } = useInferenceStore(
    useShallow((state) => ({
      preference: state.preference,
      setMode: state.setMode,
    })),
  );
  const auth = useAuthStore((state) => state.auth);
  const network = useNetworkState();
  const [deviceReady, setDeviceReady] = useState<boolean | null>(null);
  const cloudReady =
    network.isConnected === true && network.isInternetReachable !== false;
  const localReady = deviceReady;

  useEffect(() => {
    let active = true;
    void checkModelAvailability()
      .then((result) => {
        if (active) setDeviceReady(result.status === "available");
      })
      .catch(() => {
        if (active) setDeviceReady(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (preference === "device") {
      if (localReady === true) setMode("device");
      else if (localReady === false && cloudReady) setMode("cloud");
    } else if (cloudReady) setMode("cloud");
    else if (localReady === true) setMode("device");
  }, [preference, localReady, cloudReady, setMode]);

  function choose(option: "device" | "cloud") {
    const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
    if (!ownerId) return;

    void saveInferencePreference(ownerId, option).catch(() => {
      useDialogStore
        .getState()
        .showDialog(
          "Couldn’t sync preference",
          "Your inference preference couldn’t be saved to your account. Please try again.",
        );
    });
  }

  return (
    <View
      accessibilityLabel="AI processing mode"
      style={[
        styles.group,
        props.align === "center" ? styles.centered : styles.startAligned,
      ]}
    >
      {(["device", "cloud"] as const).map((option) => {
        const available =
          option === "device" ? localReady === true : cloudReady;

        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{
              selected: preference === option,
              disabled: !available && !props.allowUnavailable,
            }}
            disabled={!available && !props.allowUnavailable}
            onPress={() => choose(option)}
            style={[styles.option, preference === option && styles.selected]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: available ? colors.success : colors.muted },
              ]}
            />
            <AppText
              weight="semibold"
              style={[styles.label, !available && styles.disabled]}
            >
              {option === "device" ? "On device" : "Cloud"}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.accentFaint,
  },
  startAligned: { alignSelf: "flex-start" },
  centered: { alignSelf: "center" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 9,
    gap: 5,
  },
  selected: { backgroundColor: colors.background },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 12 },
  disabled: { color: colors.muted },
});
