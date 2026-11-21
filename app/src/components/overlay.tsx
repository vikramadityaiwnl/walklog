import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

interface Props {
  variant?: "gradient" | "solid";
  color?: string;
}

export function Overlay(props: Props) {
  if (props.variant === "solid") {
    return (
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: props.color ?? "rgba(0, 0, 0, 0.45)" },
        ]}
      />
    );
  }

  return (
    <LinearGradient
      pointerEvents="none"
      colors={["transparent", "rgba(0, 0, 0, 0.78)"]}
      style={StyleSheet.absoluteFill}
    />
  );
}
