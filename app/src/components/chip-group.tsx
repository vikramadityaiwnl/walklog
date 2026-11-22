import { StyleSheet, View } from "react-native";
import { Chip } from "./chip";

interface Props<T extends string> {
  label: string;
  options: readonly T[];
  selection:
    | { mode: "single"; value: T | undefined; onChange: (value: T) => void }
    | { mode: "multiple"; value: readonly T[]; onChange: (value: T[]) => void };
}

export function ChipGroup<T extends string>(props: Props<T>) {
  function handlePress(value: T) {
    if (props.selection.mode === "single") {
      props.selection.onChange(value);

      return;
    }

    const selected = props.selection.value;
    props.selection.onChange(
      selected.includes(value)
        ? selected.filter((entry) => entry !== value)
        : [...selected, value],
    );
  }

  return (
    <View
      accessibilityLabel={props.label}
      accessibilityRole={
        props.selection.mode === "single" ? "radiogroup" : undefined
      }
      style={styles.group}
    >
      {props.options.map((option) => (
        <Chip
          key={option}
          label={option}
          selected={
            props.selection.mode === "single"
              ? props.selection.value === option
              : props.selection.value.includes(option)
          }
          mode={props.selection.mode}
          onPress={() => handlePress(option)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
