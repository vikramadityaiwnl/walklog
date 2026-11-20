import { Stack } from "expo-router";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { getAuth, onAuthStateChanged } from "@react-native-firebase/auth";
import { useFonts } from "expo-font";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppText } from "../components/app-text";
import { AppButton } from "../components/app-button";
import { initializeAppCheck } from "../services/app-check";
import { useAuthStore } from "../store/auth-store";

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

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

  if (
    (!fontsLoaded && !fontError) ||
    appCheck === "initializing" ||
    auth.status === "loading"
  ) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#292D2C"
          accessibilityLabel="Starting walklog"
        />
      </View>
    );
  }

  if (appCheck === "error" || auth.status === "error") {
    return (
      <View style={styles.container}>
        <AppText>walklog could not finish starting.</AppText>
        {appCheck === "error" && auth.status !== "error" ? (
          <AppButton
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
