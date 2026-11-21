import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
}

export function EmptyState(props: Props) {
  return (
    <View style={styles.container}>
      {props.icon}

      <AppText
        variant="title"
        style={[styles.title, props.compact && styles.compactTitle]}
      >
        {props.title}
      </AppText>

      <AppText
        style={[styles.description, props.compact && styles.compactDescription]}
      >
        {props.description}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: { fontSize: 22, lineHeight: 30, marginTop: 24, textAlign: "center" },
  compactTitle: { fontSize: 19, lineHeight: 26 },
  compactDescription: { fontSize: 14, lineHeight: 21 },
  description: {
    color: colors.muted,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 290,
    textAlign: "center",
  },
});
