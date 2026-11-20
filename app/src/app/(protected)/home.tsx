import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { AppButton } from "../../components/app-button";
import { AppText } from "../../components/app-text";
import { signOutUser } from "../../services/google-sign-in";
import { useAuthStore } from "../../store/auth-store";

type SignOutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function ProtectedHome() {
  const auth = useAuthStore((state) => state.auth);
  const [signingOut, setSigningOut] = useState<SignOutState>({
    status: "idle",
  });

  async function handleSignOut() {
    setSigningOut({ status: "loading" });

    try {
      await signOutUser();
    } catch (error) {
      setSigningOut({
        status: "error",
        message: error instanceof Error ? error.message : "Sign-out failed.",
      });
    }
  }

  if (auth.status !== "ready" || !auth.user) return null;

  return (
    <View style={styles.container}>
      <AppText variant="title">
        {auth.user.displayName ?? "Name unavailable"}
      </AppText>
      <AppText>{auth.user.email ?? "Email unavailable"}</AppText>
      <AppButton
        title="AI playground"
        onPress={() => router.push("/(protected)/ai-playground")}
      />
      <AppButton
        title="Sign out"
        disabled={signingOut.status === "loading"}
        onPress={handleSignOut}
      />
      {signingOut.status === "error" ? (
        <AppText accessibilityRole="alert">{signingOut.message}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
});
