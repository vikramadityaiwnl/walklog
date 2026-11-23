import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
} from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  variant?: "danger" | "secondary" | "outline";
  accessibilityLabel?: string;
  icon?: ReactNode;
}

export function AppButton(props: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        props.variant === "danger" && styles.danger,
        props.variant === "secondary" && styles.secondary,
        props.variant === "outline" && styles.outline,
        (pressed || props.disabled) && styles.dimmed,
      ]}
    >
      {props.icon}

      <AppText
        weight="semibold"
        style={[
          styles.label,
          props.variant === "secondary" && styles.secondaryLabel,
          props.variant === "outline" && styles.outlineLabel,
        ]}
      >
        {props.title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  danger: { backgroundColor: colors.danger },
  secondary: { backgroundColor: "transparent" },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  outlineLabel: { color: colors.accent },
  secondaryLabel: { color: colors.foreground },
  dimmed: { opacity: 0.6 },
  label: { color: colors.onAccent },
});
