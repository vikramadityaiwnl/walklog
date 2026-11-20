import { Image } from "expo-image";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { signOutUser } from "../../../services/google-sign-in";
import { useAuthStore } from "../../../store/auth-store";

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
      {auth.user.photoURL ? (
        <Image
          source={{ uri: auth.user.photoURL }}
          style={styles.photo}
          accessibilityLabel="Profile photo"
        />
      ) : null}
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
  container: { backgroundColor: "#F8F6F1", flex: 1, gap: 20, padding: 24 },
  photo: { borderRadius: 36, height: 72, width: 72 },
  details: { gap: 4 },
});
