import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { ExclamationTriangleIcon } from "react-native-heroicons/outline";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  icon?: ReactNode;
  title: string;
  description: string;
  compact?: boolean;
  variant?: "error";
  inline?: boolean;
}

export function EmptyState(props: Props) {
  return (
    <View style={[styles.container, props.inline && styles.inline]}>
      <Animated.View
        entering={FadeIn.duration(240).reduceMotion(ReduceMotion.System)}
      >
        {props.icon ??
          (props.variant === "error" ? (
            <ExclamationTriangleIcon
              size={props.inline ? 28 : 40}
              color={colors.accent}
            />
          ) : null)}
      </Animated.View>

      <AppText
        variant="title"
        style={[
          styles.title,
          props.compact && styles.compactTitle,
          props.inline && styles.inlineTitle,
        ]}
      >
        {props.title}
      </AppText>

      <AppText
        accessibilityRole={props.variant === "error" ? "alert" : undefined}
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
  inline: { flex: 0, paddingHorizontal: 12, paddingVertical: 16 },
  inlineTitle: { marginTop: 10, fontSize: 16, lineHeight: 22 },
  compactDescription: { fontSize: 14, lineHeight: 21 },
  description: {
    color: colors.muted,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 290,
    textAlign: "center",
  },
});
