import { useState } from "react";
import { PlusIcon, XMarkIcon } from "react-native-heroicons/outline";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { PunchItem } from "../models/walkthrough";
import { colors } from "../theme";
import { AppButton } from "./app-button";

type Photo = PunchItem["photos"][number];

interface Props {
  photos: Photo[];
  busy: boolean;
  onAdd: () => void;
  onRemove: (photo: Photo) => Promise<boolean>;
}

export function PhotoGallery(props: Props) {
  const [selected, setSelected] = useState<Photo | null>(null);
  const { width } = useWindowDimensions();
  const tileWidth = Math.max(60, (width - 68) / 3);

  function confirmRemove() {
    if (!selected || props.busy) return;

    Alert.alert("Delete photo?", "This removes the photo from this item.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void props.onRemove(selected).then((removed) => {
            if (removed) setSelected(null);
          });
        },
      },
    ]);
  }

  return (
    <>
      <View style={styles.gallery}>
        {props.photos.map((photo, index) => (
          <Pressable
            key={photo.localUri}
            accessibilityRole="button"
            accessibilityLabel={`View photo ${index + 1}`}
            onPress={() => setSelected(photo)}
            style={[styles.tile, { width: tileWidth, height: tileWidth }]}
          >
            <Image source={{ uri: photo.localUri }} style={styles.thumbnail} />
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          disabled={props.busy}
          onPress={props.onAdd}
          style={[
            styles.tile,
            styles.add,
            { width: tileWidth, height: tileWidth },
          ]}
        >
          <PlusIcon size={26} color={colors.accent} />
        </Pressable>
      </View>

      <Modal
        visible={selected !== null}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              hitSlop={10}
              onPress={() => setSelected(null)}
              style={styles.close}
            >
              <XMarkIcon size={26} color={colors.onAccent} />
            </Pressable>
          </View>

          {selected ? (
            <Image
              source={{ uri: selected.localUri }}
              resizeMode="contain"
              style={styles.fullImage}
            />
          ) : null}

          <View style={styles.viewerActions}>
            <AppButton
              title="Delete photo"
              variant="danger"
              disabled={props.busy}
              onPress={confirmRemove}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: { borderRadius: 10, overflow: "hidden" },
  thumbnail: { width: "100%", height: "100%" },
  add: {
    borderWidth: 1,
    borderStyle: "dotted",
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentFaint,
  },
  viewer: { flex: 1, backgroundColor: "#171717" },
  viewerHeader: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: { flex: 1, width: "100%" },
  viewerActions: { paddingHorizontal: 24, paddingVertical: 16 },
});
