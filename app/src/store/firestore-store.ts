import { create } from "zustand";
import type { Project, PunchItem, Walkthrough } from "../models/walkthrough";

type CollectionName = "projects" | "walkthroughs" | "items";

interface FirestoreStore {
  ownerId?: string;
  revision: number;
  projects: Project[];
  walkthroughs: Walkthrough[];
  items: PunchItem[];
  loaded: Record<CollectionName, boolean>;
  pending: boolean;
  deletionsPending: boolean;
  deletionError: boolean;
  notifyChange: () => void;
  beginSession: (ownerId: string) => void;
  setProjects: (projects: Project[]) => void;
  setWalkthroughs: (walkthroughs: Walkthrough[]) => void;
  setItems: (items: PunchItem[]) => void;
  setPending: (pending: boolean) => void;
  setDeletionsPending: (pending: boolean) => void;
  setDeletionError: (error: boolean) => void;
}

export const useFirestoreStore = create<FirestoreStore>((set) => ({
  ownerId: undefined,
  revision: 0,
  projects: [],
  walkthroughs: [],
  items: [],
  loaded: { projects: false, walkthroughs: false, items: false },
  pending: false,
  deletionsPending: false,
  deletionError: false,
  notifyChange: () => set((state) => ({ revision: state.revision + 1 })),
  beginSession: (ownerId) =>
    set((state) =>
      state.ownerId === ownerId
        ? state
        : {
            ownerId,
            projects: [],
            walkthroughs: [],
            items: [],
            loaded: { projects: false, walkthroughs: false, items: false },
            pending: false,
            revision: state.revision + 1,
          },
    ),
  setProjects: (projects) =>
    set((state) => ({
      projects,
      loaded: { ...state.loaded, projects: true },
    })),
  setWalkthroughs: (walkthroughs) =>
    set((state) => ({
      walkthroughs,
      loaded: { ...state.loaded, walkthroughs: true },
    })),
  setItems: (items) =>
    set((state) => ({
      items,
      loaded: { ...state.loaded, items: true },
    })),
  setPending: (pending) => set({ pending }),
  setDeletionsPending: (pending) => set({ deletionsPending: pending }),
  setDeletionError: (error) => set({ deletionError: error }),
}));
