import { Redirect } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { initializeAppCheck } from "../services/firebase/app-check";
import { initializeAuth } from "../services/firebase/auth";
import { initializeUpdates } from "../services/updates";
import { useAppCheckStore } from "../store/app-check-store";
import { useAuthStore } from "../store/auth-store";
import { useUpdateStore } from "../store/update-store";
import { colors } from "../theme";

export default function Index() {
  const auth = useAuthStore((state) => state.auth);
  const appCheck = useAppCheckStore((state) => state.appCheck);
  const updateStatus = useUpdateStore((state) => state.status);

  useEffect(() => {
    void initializeUpdates();

    if (appCheck === "initializing") void initializeAppCheck();

    initializeAuth();
  }, [appCheck]);

  if (updateStatus === "checking" || auth.status === "loading") {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color={colors.foreground}
          accessibilityLabel="Starting walklog"
        />
      </View>
    );
  }

  return <Redirect href={auth.user ? "/(protected)/(tabs)" : "/auth"} />;
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
