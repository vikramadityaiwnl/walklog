import { useEffect } from "react";
import { Platform } from "react-native";
import { useNetworkState } from "expo-network";
import { useShallow } from "zustand/react/shallow";
import { useDeviceModelStatus } from "./device-model-status";
import { saveInferencePreference } from "../services/firebase/user-preferences";
import { useAuthStore } from "../store/auth-store";
import { useDialogStore } from "../store/dialog-store";
import { useInferenceStore } from "../store/inference-store";
import { colors } from "../theme";
import { SegmentedControl } from "./segmented-control";

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

  const mode = useInferenceStore((state) => state.mode);

  const auth = useAuthStore((state) => state.auth);

  const network = useNetworkState();
  const model = useDeviceModelStatus();
  const deviceReady =
    model.status === "checking" ? null : model.status === "available";
  const cloudReady =
    network.isConnected === true && network.isInternetReachable !== false;
  const localReady = deviceReady;

  useEffect(() => {
    if (preference === "device") {
      if (localReady === true || Platform.OS === "android") setMode("device");
      else if (localReady === false && cloudReady) setMode("cloud");
    } else if (cloudReady) setMode("cloud");
    else if (localReady === true) setMode("device");
  }, [preference, localReady, cloudReady, model.status, setMode]);

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
    <SegmentedControl
      label="AI processing mode"
      value={mode}
      onChange={choose}
      align={props.align}
      compact
      options={(["device", "cloud"] as const).map((option) => {
        const available =
          option === "device" ? localReady === true : cloudReady;

        return {
          value: option,
          label: option === "device" ? "On device" : "Cloud",
          disabled:
            !available &&
            !props.allowUnavailable &&
            !(
              option === "device" &&
              Platform.OS === "android" &&
              (model.status === "downloadable" ||
                model.status === "downloading")
            ),
          muted: !available,
          indicatorColor: available ? colors.success : colors.muted,
        };
      })}
    />
  );
}
