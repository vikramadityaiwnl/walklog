import { StyleSheet, View } from "react-native";
import { AppText } from "./app-text";

interface Props {
  name: string;
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
    <View style={styles.container} accessibilityLabel={props.name}>
      <AppText variant="title" style={styles.initials}>
        {initials || "?"}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: "#A6532D",
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    width: 72,
  },
  initials: { color: "#FFFFFF" },
});
