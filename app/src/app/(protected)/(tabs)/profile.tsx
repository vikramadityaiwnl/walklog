import { useState } from "react";
import {
  BellIcon,
  CloudIcon,
  PaintBrushIcon,
} from "react-native-heroicons/outline";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppHeader } from "../../../components/app-header";
import { AppText } from "../../../components/app-text";
import { Avatar } from "../../../components/avatar";
import { signOutUser } from "../../../services/google-sign-in";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type SignOutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

const preferences = [
  {
    title: "Notifications",
    description: "Updates and reminders",
    icon: BellIcon,
  },
  {
    title: "Appearance",
    description: "Choose how walklog looks",
    icon: PaintBrushIcon,
  },
  {
    title: "Data & sync",
    description: "Manage your synced data",
    icon: CloudIcon,
  },
];

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
      <AppHeader />

      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="title" style={styles.heading}>
          Profile
        </AppText>

        <AppText style={styles.subtitle}>
          Your account and preferences, in one place.
        </AppText>

        <View style={styles.identity}>
          <Avatar name={auth.user.displayName ?? ""} />

          <View style={styles.identityText}>
            <AppText variant="title" style={styles.name}>
              {auth.user.displayName ?? "Name unavailable"}
            </AppText>

            <AppText style={styles.email}>
              {auth.user.email ?? "Email unavailable"}
            </AppText>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <AppText weight="bold" style={styles.sectionTitle}>
            Preferences
          </AppText>
        </View>

        {preferences.map((preference) => (
          <View key={preference.title} style={styles.setting}>
            <View style={styles.settingIcon}>
              <preference.icon size={20} color={colors.accent} />
            </View>

            <View style={styles.settingText}>
              <AppText weight="semibold">{preference.title}</AppText>

              <AppText style={styles.settingDescription}>
                {preference.description}
              </AppText>
            </View>
          </View>
        ))}

        <View style={styles.signOut}>
          <AppButton
            title="Sign out"
            disabled={signingOut.status === "loading"}
            onPress={handleSignOut}
          />

          {signingOut.status === "error" ? (
            <AppText accessibilityRole="alert">{signingOut.message}</AppText>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  heading: { fontSize: 32, letterSpacing: -1, marginTop: 8 },
  subtitle: { color: colors.muted, lineHeight: 23, marginTop: 5 },
  identity: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    paddingVertical: 32,
  },
  identityText: { flex: 1, gap: 4 },
  name: { fontSize: 20, lineHeight: 27 },
  email: { color: colors.muted, fontSize: 14 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 28,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16 },
  setting: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingVertical: 17,
  },
  settingIcon: {
    alignItems: "center",
    backgroundColor: colors.accentFaint,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  settingText: { flex: 1, gap: 3 },
  settingDescription: { color: colors.muted, fontSize: 13 },
  signOut: { gap: 12, marginTop: 32 },
});
