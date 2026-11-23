import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "../theme";
import { AppButton } from "./app-button";
import { EmptyState } from "./empty-state";

interface ErrorAction {
  title: string;
  onPress: () => void;
  variant?: "danger" | "secondary" | "outline";
  disabled?: boolean;
}

interface Props {
  title: string;
  description: string;
  icon?: ReactNode;
  actions: [ErrorAction] | [ErrorAction, ErrorAction];
}

export function ErrorState(props: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <EmptyState
        variant="error"
        icon={
          props.icon ?? (
            <ExclamationTriangleIcon size={40} color={colors.accent} />
          )
        }
        title={props.title}
        description={props.description}
      />

      <View style={styles.actions}>
        {props.actions.map((action, index) => (
          <View key={`${index}-${action.title}`} style={styles.action}>
            <AppButton
              title={action.title}
              onPress={action.onPress}
              variant={action.variant}
              disabled={action.disabled}
            />
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
});
