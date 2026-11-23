import { create } from "zustand";

export type InferenceChoice = "device" | "cloud";

interface InferenceStore {
  mode: InferenceChoice;
  preference: InferenceChoice;
  setMode: (mode: InferenceChoice) => void;
  setPreference: (preference: InferenceChoice) => void;
}

export const useInferenceStore = create<InferenceStore>((set) => ({
  mode: "device",
  preference: "device",
  setMode: (mode) => set({ mode }),
  setPreference: (preference) => set({ preference }),
}));
