import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  label: string;
  tone?: "neutral" | "info" | "warning" | "danger" | "success";
  icon?: ReactNode;
  accessibilityLabel?: string;
}

export function Badge(props: Props) {
  const tone = props.tone ?? "neutral";

  return (
    <View
      accessibilityLabel={props.accessibilityLabel}
      style={[styles.badge, styles[tone]]}
    >
      {props.icon}

      <AppText weight="semibold" style={[styles.text, styles[`${tone}Text`]]}>
        {props.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { fontSize: 12, lineHeight: 16 },
  neutral: { backgroundColor: colors.neutralSoft },
  neutralText: { color: colors.muted },
  info: { backgroundColor: colors.infoSoft },
  infoText: { color: colors.info },
  warning: { backgroundColor: colors.warningSoft },
  warningText: { color: colors.warning },
  danger: { backgroundColor: colors.dangerSoft },
  dangerText: { color: colors.danger },
  success: { backgroundColor: colors.successSoft },
  successText: { color: colors.success },
});
