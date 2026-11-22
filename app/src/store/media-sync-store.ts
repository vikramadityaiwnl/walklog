import { create } from "zustand";

type MediaStatus = "idle" | "waiting" | "uploading" | "error";

interface MediaSyncStore {
  status: MediaStatus;
  setStatus: (status: MediaStatus) => void;
}

export const useMediaSyncStore = create<MediaSyncStore>((set) => ({
  status: "idle",
  setStatus: (status) => set({ status }),
}));
