import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
} from "react-native";
import { AppText } from "./app-text";

interface Props {
  title: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
}

export function AppButton(props: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.button,
        (pressed || props.disabled) && styles.dimmed,
      ]}
    >
      <AppText weight="semibold" style={styles.label}>
        {props.title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: "#A6532D",
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  dimmed: { opacity: 0.6 },
  label: { color: "#FFFFFF" },
});
