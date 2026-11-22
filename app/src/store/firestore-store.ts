import { create } from "zustand";

interface FirestoreStore {
  revision: number;
  pending: boolean;
  deletionsPending: boolean;
  deletionError: boolean;
  notifyChange: () => void;
  setPending: (pending: boolean) => void;
  setDeletionsPending: (pending: boolean) => void;
  setDeletionError: (error: boolean) => void;
}

export const useFirestoreStore = create<FirestoreStore>((set) => ({
  revision: 0,
  pending: false,
  deletionsPending: false,
  deletionError: false,
  notifyChange: () => set((state) => ({ revision: state.revision + 1 })),
  setPending: (pending) => set({ pending }),
  setDeletionsPending: (pending) => set({ deletionsPending: pending }),
  setDeletionError: (error) => set({ deletionError: error }),
}));
