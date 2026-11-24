import { useEffect } from "react";
import { useNetworkState } from "expo-network";
import { useShallow } from "zustand/react/shallow";
import { useDeviceModelStatus } from "./device-model-status";
import { saveInferencePreference } from "../services/firebase/user-preferences";
import { useAuthStore } from "../store/auth-store";
import { useDialogStore } from "../store/dialog-store";
import { useInferenceStore } from "../store/inference-store";
import type { InferenceChoice } from "../store/inference-store";
import { colors } from "../theme";
import { SegmentedControl } from "./segmented-control";

interface Props {
  align?: "start" | "center";
  lockedMode?: InferenceChoice;
  requiresAudio?: boolean;
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
      if (localReady === true) setMode("device");
      else if (localReady === false && cloudReady) setMode("cloud");
    } else if (cloudReady) setMode("cloud");
    else if (localReady === true) setMode("device");
  }, [preference, localReady, cloudReady, model.status, setMode]);

  function choose(option: "device" | "cloud") {
    if (props.lockedMode) return;

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
      value={props.lockedMode ?? mode}
      onChange={choose}
      align={props.align}
      compact
      options={(["device", "cloud"] as const).map((option) => {
        const available =
          option === "device" ? localReady === true : cloudReady;

        return {
          value: option,
          label: option === "device" ? "On device" : "Cloud",
          disabled: !!props.lockedMode || !available,
          indicatorColor: available ? colors.success : colors.muted,
        };
      })}
    />
  );
}
