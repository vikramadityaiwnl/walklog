import { BellAlertIcon } from "react-native-heroicons/outline";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { colors } from "../../theme";

export default function Reminders() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <AppText variant="title" style={styles.heading}>
          Reminders
        </AppText>
      </View>

      <EmptyState
        icon={<BellAlertIcon size={48} color={colors.muted} />}
        title="No reminders yet"
        description="Your reminders will appear here when you have something to follow up on."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  heading: { fontSize: 24 },
});
