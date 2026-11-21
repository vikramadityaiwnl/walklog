import { Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  label: string;
  selected: boolean;
  mode: "single" | "multiple";
  onPress: () => void;
}

export function Chip(props: Props) {
  return (
    <Pressable
      accessibilityRole={props.mode === "single" ? "radio" : "checkbox"}
      accessibilityState={{ checked: props.selected }}
      onPress={props.onPress}
      style={[styles.chip, props.selected && styles.selected]}
    >
      <AppText style={props.selected ? styles.selectedText : undefined}>
        {props.label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  selected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  selectedText: { color: colors.accent },
});
