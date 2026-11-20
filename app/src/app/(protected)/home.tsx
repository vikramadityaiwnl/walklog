import { useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
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
      <Text>{auth.user.displayName ?? "Name unavailable"}</Text>
      <Text>{auth.user.email ?? "Email unavailable"}</Text>
      <Button
        title="Sign out"
        disabled={signingOut.status === "loading"}
        onPress={handleSignOut}
      />
      {signingOut.status === "error" ? (
        <Text accessibilityRole="alert">{signingOut.message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },
});
