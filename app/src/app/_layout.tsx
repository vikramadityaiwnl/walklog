import { useEffect } from "react";
import { Stack } from "expo-router";
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_500Medium } from "@expo-google-fonts/dm-sans/500Medium";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_500Medium } from "@expo-google-fonts/manrope/500Medium";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { useFonts } from "expo-font";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useAppCheckStore } from "../store/app-check-store";
import { useAuthStore } from "../store/auth-store";
import { useUpdateStore } from "../store/update-store";
import { colors } from "../theme";
import { observeMedia } from "../services/firebase/media-sync";
import { observeDeletions } from "../services/firebase/deletion-sync";
import { observeFirestore } from "../services/firebase/firestore-sync";
import { observeUserPreferences } from "../services/firebase/user-preferences";
import { AppDialog } from "../components/app-dialog";

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

  const appCheck = useAppCheckStore((state) => state.appCheck);

  const updateStatus = useUpdateStore((state) => state.status);

  const userId = auth.status === "ready" ? auth.user?.uid : undefined;

  useEffect(() => {
    if (!userId || appCheck !== "ready") return;

    const stopFirestore = observeFirestore(userId);
    const stopPreferences = observeUserPreferences(userId);
    const stopMedia = observeMedia(userId);
    const stopDeletions = observeDeletions(userId);

    return () => {
      stopMedia();
      stopDeletions();
      stopPreferences();
      stopFirestore();
    };
  }, [userId, appCheck]);

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color={colors.foreground}
          accessibilityLabel="Starting walklog"
        />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected
          guard={
            updateStatus === "ready" &&
            auth.status === "ready" &&
            appCheck === "error"
          }
        >
          <Stack.Screen name="invalid-app" />
        </Stack.Protected>

        <Stack.Protected
          guard={
            updateStatus === "checking" ||
            auth.status === "loading" ||
            appCheck !== "error"
          }
        >
          <Stack.Screen name="index" />

          <Stack.Protected
            guard={
              updateStatus === "ready" && auth.status === "ready" && !auth.user
            }
          >
            <Stack.Screen name="auth" />
          </Stack.Protected>

          <Stack.Protected
            guard={
              updateStatus === "ready" && auth.status === "ready" && !!auth.user
            }
          >
            <Stack.Screen name="(protected)/(tabs)" />

            <Stack.Screen name="(protected)/project/[id]" />

            <Stack.Screen name="(protected)/project/edit" />

            <Stack.Screen name="(protected)/ai-playground" />

            <Stack.Screen
              name="(protected)/walkthrough/[id]"
              options={{ statusBarStyle: "light" }}
            />

            <Stack.Screen name="(protected)/walkthrough/edit" />

            <Stack.Screen name="(protected)/walkthrough/settings" />

            <Stack.Screen name="(protected)/walkthrough/item" />

            <Stack.Screen name="(protected)/walkthrough/refine" />

            <Stack.Screen name="(protected)/walkthrough/report" />

            <Stack.Screen
              name="(protected)/walkthrough/item-view"
              options={{ statusBarStyle: "light" }}
            />
          </Stack.Protected>
        </Stack.Protected>
      </Stack>

      <AppDialog />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
});
