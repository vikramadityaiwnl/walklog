import { useEffect, useState } from "react";
import { useNetworkState } from "expo-network";
import { Pressable, StyleSheet, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { checkModelAvailability } from "../services/firebase/ai";
import { useInferenceStore } from "../store/inference-store";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  align?: "start" | "center";
  requiresAudio?: boolean;
}

export function InferenceSelector(props: Props) {
  const { mode, setMode } = useInferenceStore(
    useShallow((state) => ({ mode: state.mode, setMode: state.setMode })),
  );
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
    if (mode === "device" && localReady === false && cloudReady)
      setMode("cloud");
    if (mode === "cloud" && !cloudReady && localReady === true)
      setMode("device");
  }, [mode, localReady, cloudReady, setMode]);

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
              selected: mode === option,
              disabled: !available,
            }}
            disabled={!available}
            onPress={() => setMode(option)}
            style={[
              styles.option,
              mode === option && available && styles.selected,
            ]}
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
