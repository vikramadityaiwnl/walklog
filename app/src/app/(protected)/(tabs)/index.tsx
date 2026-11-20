import {
  ClipboardDocumentListIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { AppHeader } from "../../../components/app-header";
import { EmptyState } from "../../../components/empty-state";
import { colors } from "../../../theme";

export default function Walkthroughs() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />
      <View style={styles.header}>
        <AppText variant="title" style={styles.heading}>
          Walkthroughs
        </AppText>
        <AppText style={styles.subtitle}>
          A clear record of every site visit.
        </AppText>
      </View>

      <EmptyState
        icon={<ClipboardDocumentListIcon size={48} color={colors.accent} />}
        title="Your first walkthrough starts here"
        description="Capture notes and photos on site, then turn them into a clear list of work."
      />

      <View style={styles.footer}>
        <View
          style={styles.action}
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
        >
          <PlusIcon size={20} color={colors.onAccent} />
          <AppText weight="bold" style={styles.actionText}>
            New walkthrough
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 28 },
  heading: { fontSize: 32, letterSpacing: -1, marginTop: 8 },
  subtitle: { color: colors.muted, lineHeight: 23, marginTop: 5 },
  footer: { paddingBottom: 20, paddingHorizontal: 24 },
  action: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 54,
    opacity: 0.6,
  },
  actionText: { color: colors.onAccent },
});
