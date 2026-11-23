import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { colors } from "../theme";
import { AppText } from "./app-text";

interface Segment<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  muted?: boolean;
  indicatorColor?: string;
}

interface Props<T extends string> {
  label: string;
  options: readonly Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  fullWidth?: boolean;
  align?: "start" | "center";
  disabled?: boolean;
  compact?: boolean;
}

export function SegmentedControl<T extends string>(props: Props<T>) {
  const [layouts, setLayouts] = useState<
    Partial<Record<T, { x: number; width: number; height: number }>>
  >({});
  const [indicatorReady, setIndicatorReady] = useState(false);
  const positioned = useRef(false);
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const indicatorStyle = useAnimatedStyle(() => ({
    width: width.value,
    height: height.value,
    transform: [{ translateX: x.value }],
  }));

  useEffect(() => {
    const layout = layouts[props.value];
    if (!layout) return;

    const timing = { duration: 160, reduceMotion: ReduceMotion.System };
    x.value = positioned.current ? withTiming(layout.x, timing) : layout.x;
    width.value = positioned.current
      ? withTiming(layout.width, timing)
      : layout.width;
    height.value = layout.height;
    positioned.current = true;
    setIndicatorReady(true);
  }, [layouts, props.value, x, width, height]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={props.label}
      style={[
        styles.group,
        props.fullWidth
          ? styles.fullWidth
          : props.align === "center"
            ? styles.centered
            : styles.startAligned,
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, indicatorStyle]}
      />

      {props.options.map((option) => {
        const disabled = !!props.disabled || !!option.disabled;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: props.value === option.value,
              disabled,
            }}
            disabled={disabled}
            onPress={() => props.onChange(option.value)}
            onLayout={(event) => {
              const { x, width, height } = event.nativeEvent.layout;
              setLayouts((current) => {
                const previous = current[option.value];
                if (
                  previous?.x === x &&
                  previous.width === width &&
                  previous.height === height
                )
                  return current;

                return { ...current, [option.value]: { x, width, height } };
              });
            }}
            style={[
              styles.option,
              props.fullWidth && styles.equalWidth,
              props.compact && styles.compactOption,
              !indicatorReady &&
                props.value === option.value &&
                styles.initialSelection,
            ]}
          >
            {option.indicatorColor ? (
              <View
                style={[styles.dot, { backgroundColor: option.indicatorColor }]}
              />
            ) : null}

            <AppText
              weight="semibold"
              style={[
                props.compact && styles.compactLabel,
                (option.disabled || option.muted) && styles.disabled,
              ]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: "row",
    padding: 3,
    borderRadius: 12,
    backgroundColor: colors.accentFaint,
  },
  fullWidth: { alignSelf: "stretch" },
  centered: { alignSelf: "center" },
  startAligned: { alignSelf: "flex-start" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: 9,
    gap: 5,
  },
  equalWidth: { flex: 1 },
  compactOption: { paddingVertical: 8 },
  compactLabel: { fontSize: 12 },
  disabled: { color: colors.muted },
  initialSelection: { backgroundColor: colors.background },
  indicator: {
    position: "absolute",
    left: 0,
    top: 3,
    borderRadius: 9,
    backgroundColor: colors.background,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
