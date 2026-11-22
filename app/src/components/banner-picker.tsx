import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { CameraIcon } from "react-native-heroicons/outline";
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add banner image"
          disabled={props.busy}
          onPress={props.onChoose}
          style={styles.addPhoto}
        >
          <View style={styles.photoIcon}>
            <CameraIcon size={22} color={colors.accent} />
          </View>

          <View style={styles.photoCopy}>
            <AppText weight="semibold">
              {props.busy ? "Adding image" : "Add banner image"}
            </AppText>

            <AppText style={styles.description}>
              Capture or choose a photo for the banner
            </AppText>
          </View>
        </Pressable>
      )}

      {props.uri ? (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={props.busy}
            onPress={props.onChoose}
            style={styles.action}
          >
            <AppText style={styles.link}>
              {props.busy
                ? "Adding image"
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 8 },
  preview: { width: "100%", height: 140, borderRadius: 10 },
  addPhoto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.accentFaint,
    borderRadius: 14,
    padding: 16,
  },
  photoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  photoCopy: { flex: 1, gap: 3 },
  description: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 24 },
  action: { paddingVertical: 8 },
  link: { color: colors.accent },
  danger: { color: colors.danger },
});
