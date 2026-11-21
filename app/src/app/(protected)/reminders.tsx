import { router } from "expo-router";
import { ArrowLeftIcon, BellAlertIcon } from "react-native-heroicons/outline";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../components/app-text";
import { EmptyState } from "../../components/empty-state";
import { colors } from "../../theme";

export default function Reminders() {
  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeftIcon size={24} color={colors.foreground} />
        </Pressable>

        <AppText variant="title" style={styles.heading}>
          Reminders
        </AppText>
      </View>

      <EmptyState
        icon={<BellAlertIcon size={48} color={colors.accent} />}
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
  back: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
    marginLeft: -10,
  },
  heading: { fontSize: 24 },
});
