import { create } from "zustand";

type AppCheckStatus = "initializing" | "ready" | "error";

interface AppCheckStore {
  appCheck: AppCheckStatus;
  setAppCheck: (appCheck: AppCheckStatus) => void;
}

export const useAppCheckStore = create<AppCheckStore>((set) => ({
  appCheck: "initializing",
  setAppCheck: (appCheck) => set({ appCheck }),
}));
