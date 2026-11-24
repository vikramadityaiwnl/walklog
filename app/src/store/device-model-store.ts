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

let activeDownload: {
  controller: AbortController;
  timer: ReturnType<typeof setInterval>;
} | null = null;
let refreshId = 0;

export const useDeviceModelStore = create<DeviceModelStore>((set, get) => ({
  model: { status: "checking" },
  refresh: async () => {
    const id = ++refreshId;
    try {
      const model: ModelAvailability = await checkModelAvailability();
      if (id !== refreshId) return;

      if (activeDownload) {
        if (model.status !== "available") return;

        const download = activeDownload;
        activeDownload = null;
        clearInterval(download.timer);
        download.controller.abort();
      }

      set({ model });
    } catch {
      if (id === refreshId && !activeDownload)
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
      activeDownload ||
      get().model.status !== "downloadable"
    )
      return;
    const controller = new AbortController();
    const timer = setInterval(() => void get().refresh(), 5000);
    activeDownload = { controller, timer };
    ++refreshId;
    set({
      model: {
        status: "downloading",
        message: "Downloading on-device AI.",
        progress: { bytes: 0, total: 0 },
      },
    });
    try {
      await downloadModel((progress) => {
        if (activeDownload?.controller !== controller) return;

        set({
          model: {
            status: "downloading",
            message: "Downloading on-device AI.",
            progress,
          },
        });
      }, controller.signal);
      if (activeDownload?.controller !== controller) return;

      clearInterval(timer);
      activeDownload = null;
      await get().refresh();
    } catch (error) {
      if (activeDownload?.controller !== controller) return;

      if (__DEV__) console.warn("On-device model download failed", error);
      clearInterval(timer);
      activeDownload = null;
      ++refreshId;
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
