import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Button,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { initializeAppCheck } from "../services/app-check";

export default function RootLayout() {
  const [appCheck, setAppCheck] = useState<"initializing" | "ready" | "error">(
    "initializing",
  );

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

  if (appCheck === "initializing") {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#292D2C"
          accessibilityLabel="Starting WalkLog"
        />
      </View>
    );
  }

  if (appCheck === "error") {
    return (
      <View style={styles.container}>
        <Text>WalkLog could not start its security setup.</Text>
        <Button title="Try again" onPress={() => setAppCheck("initializing")} />
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
