import type { User } from "@react-native-firebase/auth";
import { create } from "zustand";

type AuthState = { status: "loading" } | { status: "ready"; user: User | null };

interface AuthStore {
  auth: AuthState;
  setAuth: (auth: AuthState) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  auth: { status: "loading" },
  setAuth: (auth) => set({ auth }),
}));
