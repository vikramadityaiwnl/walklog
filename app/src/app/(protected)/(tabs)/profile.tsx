import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { Avatar } from "../../../components/avatar";
import { signOutUser } from "../../../services/google-sign-in";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type SignOutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function Profile() {
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Avatar name={auth.user.displayName ?? ""} />
      <View style={styles.details}>
        <AppText variant="title">
          {auth.user.displayName ?? "Name unavailable"}
        </AppText>
        <AppText>{auth.user.email ?? "Email unavailable"}</AppText>
      </View>
      <AppButton
        title="Sign out"
        disabled={signingOut.status === "loading"}
        onPress={handleSignOut}
      />
      {signingOut.status === "error" ? (
        <AppText accessibilityRole="alert">{signingOut.message}</AppText>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: 20,
    padding: 24,
  },
  details: { gap: 4 },
});
