import { create } from "zustand";

interface FirestoreStore {
  revision: number;
  notifyChange: () => void;
}

export const useFirestoreStore = create<FirestoreStore>((set) => ({
  revision: 0,
  notifyChange: () => set((state) => ({ revision: state.revision + 1 })),
}));
