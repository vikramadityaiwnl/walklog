import { create } from "zustand";

export type InferenceChoice = "device" | "cloud";

interface InferenceStore {
  mode: InferenceChoice;
  setMode: (mode: InferenceChoice) => void;
}

export const useInferenceStore = create<InferenceStore>((set) => ({
  mode: "device",
  setMode: (mode) => set({ mode }),
}));
