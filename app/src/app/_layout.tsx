import { Stack } from "expo-router";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { initializeAppCheck } from "../services/app-check";
import { useAuthStore } from "../store/auth-store";

export default function RootLayout() {
  const auth = useAuthStore((state) => state.auth);
  const setAuth = useAuthStore((state) => state.setAuth);
  const [appCheck, setAppCheck] = useState<"initializing" | "ready" | "error">(
    "initializing",
  );

  useEffect(() => {
    try {
      return onAuthStateChanged(getAuth(), (user) => {
        setAuth({ status: "ready", user });
      });
    } catch (error) {
      console.warn("Firebase authentication initialization failed:", error);
      setAuth({ status: "error" });
    }
  }, [setAuth]);

  useEffect(() => {
    if (appCheck !== "initializing") return;

    let active = true;

    void initializeAppCheck().then(
      () => {
        if (active) setAppCheck("ready");
      },
      (error: unknown) => {
        console.warn("Firebase App Check initialization failed:", error);
        if (active) setAppCheck("error");
      },
    );

    return () => {
      active = false;
    };
  }, [appCheck]);

  if (appCheck === "initializing" || auth.status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#292D2C"
          accessibilityLabel="Starting WalkLog"
        />
      </View>
    );
  }

  if (appCheck === "error" || auth.status === "error") {
    return (
      <View style={styles.container}>
        <Text>WalkLog could not finish starting.</Text>
        {appCheck === "error" && auth.status !== "error" ? (
          <Button
            title="Try again"
            onPress={() => setAppCheck("initializing")}
          />
        ) : null}
      </View>
    );
  }

  return <Stack />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#F8F6F1",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});
