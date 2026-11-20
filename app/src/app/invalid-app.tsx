import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../components/app-button";
import { AppText } from "../components/app-text";
import { initializeAppCheck } from "../services/app-check";
import { useAppCheckStore } from "../store/app-check-store";
import { colors } from "../theme";

export default function InvalidApp() {
  const setAppCheck = useAppCheckStore((state) => state.setAppCheck);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.icon}>
          <AppText variant="title" style={styles.iconText}>
            !
          </AppText>
        </View>
        <AppText variant="title" style={styles.title}>
          Unable to verify this app
        </AppText>
        <AppText style={styles.description}>
          We couldn’t verify this installation of walklog. Please make sure you
          downloaded the app from an official source and try again.
        </AppText>
        <View style={styles.action}>
          <AppButton
            title="Try again"
            onPress={() => {
              setAppCheck("initializing");
              void initializeAppCheck();
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: 40,
    height: 80,
    justifyContent: "center",
    marginBottom: 28,
    width: 80,
  },
  iconText: { color: colors.accent, fontSize: 42 },
  title: { fontSize: 28, lineHeight: 36, textAlign: "center" },
  description: {
    color: colors.muted,
    lineHeight: 24,
    marginTop: 16,
    textAlign: "center",
  },
  action: { alignSelf: "stretch", marginTop: 32 },
});
