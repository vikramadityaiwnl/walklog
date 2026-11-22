import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  description: string;
}

export function LoadingState(props: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} />

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
  },
  description: {
    color: colors.muted,
    lineHeight: 24,
    marginTop: 10,
    maxWidth: 290,
    textAlign: "center",
  },
});
