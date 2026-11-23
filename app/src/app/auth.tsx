import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton } from "../components/app-button";
import { AppText } from "../components/app-text";
import { ErrorState } from "../components/error-state";
import { signInWithGoogle } from "../services/firebase/google-sign-in";
import { useAuthStore } from "../store/auth-store";
import { colors } from "../theme";

type SignInState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

export default function AuthScreen() {
  const auth = useAuthStore((state) => state.auth);

  const [signIn, setSignIn] = useState<SignInState>({ status: "idle" });

  async function handleSignIn() {
    setSignIn({ status: "loading" });

    try {
      await signInWithGoogle();
      setSignIn({ status: "idle" });
    } catch (error) {
      setSignIn({
        status: "error",
        message:
          error instanceof Error ? error.message : "Google sign-in failed.",
      });
    }
  }

  if (auth.status !== "ready") return null;

  if (auth.user) return <Redirect href="/(protected)/(tabs)" />;

  if (signIn.status === "error") {
    return (
      <ErrorState
        title="Couldn’t sign in"
        description={signIn.message}
        actions={[
          { title: "Try again", onPress: () => setSignIn({ status: "idle" }) },
        ]}
      />
    );
  }

  return (
    <View style={styles.container}>
      <AppText variant="title">Sign in to walklog</AppText>

      <AppButton
        title="Continue with Google"
        disabled={signIn.status === "loading"}
        onPress={handleSignIn}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});
