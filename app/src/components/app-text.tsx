import { StyleSheet, Text, type TextProps } from "react-native";
import { colors } from "../theme";

type TextVariant = "title" | "body";
type TextWeight = "regular" | "medium" | "semibold" | "bold";

interface Props extends TextProps {
  variant?: TextVariant;
  weight?: TextWeight;
}

const fontFamilies: Record<TextVariant, Record<TextWeight, string>> = {
  title: {
    regular: "Manrope_400Regular",
    medium: "Manrope_500Medium",
    semibold: "Manrope_600SemiBold",
    bold: "Manrope_700Bold",
  },
  body: {
    regular: "DMSans_400Regular",
    medium: "DMSans_500Medium",
    semibold: "DMSans_600SemiBold",
    bold: "DMSans_700Bold",
  },
};

export function AppText(props: Props) {
  const { variant, weight, ...textProps } = props;
  const textVariant = props.variant ?? "body";
  const textWeight =
    props.weight ?? (textVariant === "title" ? "bold" : "regular");

  return (
    <Text
      {...textProps}
      style={[
        styles[textVariant],
        { fontFamily: fontFamilies[textVariant][textWeight] },
        props.style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  title: { color: colors.foreground, fontSize: 28 },
  body: { color: colors.foreground, fontSize: 16 },
});
