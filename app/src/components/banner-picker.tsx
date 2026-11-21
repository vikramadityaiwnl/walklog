import { Image, Pressable, StyleSheet, View } from "react-native";
import { AppText } from "./app-text";
import { colors } from "../theme";

interface Props {
  uri?: string;
  busy: boolean;
  onChoose: () => void;
  onRemove: () => void;
}

export function BannerPicker(props: Props) {
  return (
    <View style={styles.section}>
      <AppText weight="semibold">Banner image</AppText>

      {props.uri ? (
        <Image source={{ uri: props.uri }} style={styles.preview} />
      ) : (
        <AppText style={styles.description}>
          Use a photo or keep the background color.
        </AppText>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={props.busy}
          onPress={props.onChoose}
          style={styles.action}
        >
          <AppText style={styles.link}>
            {props.busy
              ? "Adding image…"
              : props.uri
                ? "Change image"
                : "Add image"}
          </AppText>
        </Pressable>

        {props.uri ? (
          <Pressable
            accessibilityRole="button"
            disabled={props.busy}
            onPress={props.onRemove}
            style={styles.action}
          >
            <AppText style={styles.danger}>Remove image</AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 8 },
  preview: { width: "100%", height: 140, borderRadius: 10 },
  description: { color: colors.muted },
  actions: { flexDirection: "row", gap: 24 },
  action: { paddingVertical: 8 },
  link: { color: colors.accent },
  danger: { color: colors.danger },
});
