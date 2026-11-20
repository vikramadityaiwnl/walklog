import { create } from "zustand";

interface UpdateStore {
  status: "checking" | "ready";
  setStatus: (status: "checking" | "ready") => void;
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: "checking",
  setStatus: (status) => set({ status }),
}));
