import { ActivityIndicator, StyleSheet } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  description?: string;
}

export function LoadingState(props: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
      style={styles.container}
    >
      <ActivityIndicator color={colors.accent} />

      {props.description ? (
        <AppText style={styles.description}>{props.description}</AppText>
      ) : null}
    </Animated.View>
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
