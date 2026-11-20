import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useAuthStore } from "../store/auth-store";

let listening = false;

export function initializeAuth() {
  if (listening) return;

  try {
    onAuthStateChanged(getAuth(), (user) => {
      useAuthStore.getState().setAuth({ status: "ready", user });
    });

    listening = true;
  } catch (error) {
    console.warn("Firebase authentication initialization failed:", error);
    useAuthStore.getState().setAuth({ status: "ready", user: null });
  }
}
