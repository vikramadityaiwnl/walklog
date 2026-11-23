import { create } from "zustand";
import { Platform } from "react-native";
import { checkModelAvailability, downloadModel } from "../services/firebase/ai";
import type {
  ModelAvailability,
  ModelDownloadProgress,
} from "../services/firebase/ai";

type DeviceModelState =
  | { status: "checking" }
  | {
      status: "available" | "downloadable" | "downloading" | "unavailable";
      message: string;
      progress?: ModelDownloadProgress;
    }
  | { status: "error"; message: string };

interface DeviceModelStore {
  model: DeviceModelState;
  refresh: () => Promise<void>;
  download: () => Promise<void>;
}

let downloading = false;
let refreshId = 0;

export const useDeviceModelStore = create<DeviceModelStore>((set, get) => ({
  model: { status: "checking" },
  refresh: async () => {
    if (downloading) return;
    const id = ++refreshId;
    try {
      const model: ModelAvailability = await checkModelAvailability();
      if (id === refreshId && !downloading) set({ model });
    } catch {
      if (id === refreshId && !downloading)
        set({
          model: {
            status: "error",
            message: "Couldn’t check on-device AI. Try again.",
          },
        });
    }
  },
  download: async () => {
    if (
      Platform.OS !== "android" ||
      downloading ||
      get().model.status !== "downloadable"
    )
      return;
    downloading = true;
    ++refreshId;
    set({
      model: {
        status: "downloading",
        message: "Downloading on-device AI.",
        progress: { bytes: 0, total: 0 },
      },
    });
    try {
      await downloadModel((progress) =>
        set({
          model: {
            status: "downloading",
            message: "Downloading on-device AI.",
            progress,
          },
        }),
      );
      downloading = false;
      await get().refresh();
    } catch (error) {
      if (__DEV__) console.warn("On-device model download failed", error);
      downloading = false;
      set({
        model: {
          status: "error",
          message:
            "Couldn’t download the AI model. Check your connection and try again.",
        },
      });
    }
  },
}));
