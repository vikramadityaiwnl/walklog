import { Pressable, StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Props {
  label: string;
  selected: boolean;
  mode: "single" | "multiple";
  onPress: () => void;
}

export function Chip(props: Props) {
  const selectionStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(
        props.selected ? colors.accentSoft : colors.background,
        { duration: 180, reduceMotion: ReduceMotion.System },
      ),
      borderColor: withTiming(props.selected ? colors.accent : colors.border, {
        duration: 180,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [props.selected],
  );

  return (
    <Pressable
      accessibilityRole={props.mode === "single" ? "radio" : "checkbox"}
      accessibilityState={{ checked: props.selected }}
      onPress={props.onPress}
    >
      <Animated.View style={[styles.chip, selectionStyle]}>
        <AppText style={props.selected ? styles.selectedText : undefined}>
          {props.label}
        </AppText>
      </Animated.View>
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
  selectedText: { color: colors.accent },
});
