import { Square3Stack3DIcon } from "react-native-heroicons/outline";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { AppHeader } from "../../../components/app-header";
import { EmptyState } from "../../../components/empty-state";
import { colors } from "../../../theme";

export default function Projects() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />

      <View style={styles.header}>
        <AppText variant="title" style={styles.heading}>
          Projects
        </AppText>

        <AppText style={styles.subtitle}>
          Keep related site visits together.
        </AppText>
      </View>

      <EmptyState
        icon={<Square3Stack3DIcon size={48} color={colors.accent} />}
        title="A place for the bigger picture"
        description="Group walkthroughs for the same site or client into a project."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 28 },
  heading: { fontSize: 32, letterSpacing: -1, marginTop: 8 },
  subtitle: { color: colors.muted, lineHeight: 23, marginTop: 5 },
});
