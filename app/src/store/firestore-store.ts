import { create } from "zustand";

interface FirestoreStore {
  revision: number;
  pending: boolean;
  notifyChange: () => void;
  setPending: (pending: boolean) => void;
}

export const useFirestoreStore = create<FirestoreStore>((set) => ({
  revision: 0,
  pending: false,
  notifyChange: () => set((state) => ({ revision: state.revision + 1 })),
  setPending: (pending) => set({ pending }),
}));
