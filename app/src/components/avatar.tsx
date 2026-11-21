import { StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  name: string;
  size?: "small";
}

export function Avatar(props: Props) {
  const initials = props.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase();

  return (
    <View
      style={[styles.container, props.size === "small" && styles.small]}
      accessibilityLabel={props.name}
    >
      <AppText
        variant="title"
        style={[
          styles.initials,
          props.size === "small" && styles.smallInitials,
        ]}
      >
        {initials || "?"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  initials: { color: colors.onAccent },
  small: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
  },
  smallInitials: { color: colors.accent, fontSize: 16 },
});
