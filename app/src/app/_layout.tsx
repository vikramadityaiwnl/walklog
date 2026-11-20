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

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color="#292D2C"
          accessibilityLabel="Starting walklog"
        />
      </View>
    );
  }

  return (
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

          <Stack.Screen name="(protected)/ai-playground" />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
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
