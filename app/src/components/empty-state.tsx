import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
}

export function EmptyState(props: Props) {
  return (
    <View style={styles.container}>
      {props.icon}

      <AppText variant="title" style={styles.title}>
        {props.title}
      </AppText>

      <AppText style={styles.description}>{props.description}</AppText>
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
  description: {
    color: colors.muted,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 290,
    textAlign: "center",
  },
});
