import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Cog6ToothIcon,
  PencilSquareIcon,
} from "react-native-heroicons/outline";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./app-text";
import { Overlay } from "./overlay";
import { colors } from "../theme";

interface Props {
  title: string;
  subtitle?: string;
  color: string;
  imageUri?: string;
  action: "settings" | "edit";
  onAction: () => void;
  disabled?: boolean;
  actionLabel?: string;
}

export function ScreenBanner(props: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.banner,
        {
          height: Math.max(210, height * 0.25),
          paddingTop: insets.top,
          backgroundColor: props.color,
        },
      ]}
    >
      {props.imageUri ? (
        <Image
          source={{ uri: props.imageUri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : null}

      <Overlay />

      <View style={styles.content}>
        <View style={styles.text}>
          <AppText variant="title" style={styles.title}>
            {props.title}
          </AppText>

          {props.subtitle ? (
            <AppText style={styles.subtitle}>{props.subtitle}</AppText>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            props.actionLabel ??
            (props.action === "settings" ? "Walkthrough settings" : "Edit item")
          }
          disabled={props.disabled}
          onPress={props.onAction}
          hitSlop={8}
          style={styles.action}
        >
          {props.action === "settings" ? (
            <Cog6ToothIcon size={24} color={colors.onAccent} />
          ) : (
            <PencilSquareIcon size={24} color={colors.onAccent} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: "100%", justifyContent: "flex-end" },
  content: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  text: { flex: 1, gap: 4 },
  title: { color: colors.onAccent, fontSize: 30, lineHeight: 38 },
  subtitle: { color: colors.onAccent, opacity: 0.9, lineHeight: 22 },
  action: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
