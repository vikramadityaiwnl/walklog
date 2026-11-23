import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlusIcon, XMarkIcon } from "react-native-heroicons/outline";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useReducedMotion,
} from "react-native-reanimated";
import type { PunchItem } from "../models/walkthrough";
import { colors } from "../theme";
import { AppButton } from "./app-button";
import { AppDialog } from "./app-dialog";
import { useDialogStore } from "../store/dialog-store";

type Photo = PunchItem["photos"][number];

interface Props {
  photos: Photo[];
  busy: boolean;
  onAdd: () => void;
  onRemove: (photo: Photo) => Promise<boolean>;
  onRemoved?: (photo: Photo) => void;
  emptyState?: ReactNode;
}

type ViewerState =
  { status: "closed" } | { status: "open" | "closing"; photo: Photo };

export function PhotoGallery(props: Props) {
  const reducedMotion = useReducedMotion();

  const [viewer, setViewer] = useState<ViewerState>({ status: "closed" });
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoval = useRef<Photo | null>(null);
  const onRemoved = useRef(props.onRemoved);
  onRemoved.current = props.onRemoved;

  const showDialog = useDialogStore((state) => state.showDialog);

  const { width } = useWindowDimensions();

  const tileWidth = Math.max(60, (width - 68) / 3);

  useEffect(
    () => () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (pendingRemoval.current) onRemoved.current?.(pendingRemoval.current);
    },
    [],
  );

  function finishDismissal() {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
    const removed = pendingRemoval.current;
    pendingRemoval.current = null;
    setViewer((current) =>
      current.status === "closing" ? { status: "closed" } : current,
    );
    if (removed) onRemoved.current?.(removed);
  }

  function closeViewer() {
    if (viewer.status !== "open") return;

    setViewer({ status: "closing", photo: viewer.photo });
    if (Platform.OS !== "ios") {
      dismissTimer.current = setTimeout(
        finishDismissal,
        reducedMotion ? 0 : 300,
      );
    }
  }

  function confirmRemove() {
    if (viewer.status !== "open" || props.busy) return;

    const photo = viewer.photo;

    showDialog(
      "Delete photo?",
      "This removes the photo from this item.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void props.onRemove(photo).then((removed) => {
              if (removed) {
                pendingRemoval.current = photo;
                closeViewer();
              } else
                showDialog(
                  "Couldn’t remove photo",
                  "Please try again.",
                  undefined,
                  "photo-viewer",
                );
            });
          },
        },
      ],
      "photo-viewer",
    );
  }

  return (
    <>
      {props.photos.length === 0 && props.emptyState ? (
        props.emptyState
      ) : (
        <Animated.View
          layout={LinearTransition.duration(180).reduceMotion(
            ReduceMotion.System,
          )}
          style={styles.gallery}
        >
          {props.photos.map((photo, index) => (
            <Animated.View
              key={photo.localUri}
              entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
              exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)}
              layout={LinearTransition.duration(180).reduceMotion(
                ReduceMotion.System,
              )}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View photo ${index + 1}`}
                disabled={viewer.status !== "closed"}
                onPress={() => setViewer({ status: "open", photo })}
                style={[styles.tile, { width: tileWidth, height: tileWidth }]}
              >
                <Image
                  source={{ uri: photo.localUri }}
                  style={styles.thumbnail}
                />
              </Pressable>
            </Animated.View>
          ))}

          <Animated.View
            layout={LinearTransition.duration(180).reduceMotion(
              ReduceMotion.System,
            )}
          >
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
          </Animated.View>
        </Animated.View>
      )}

      <Modal
        visible={viewer.status === "open"}
        animationType={reducedMotion ? "none" : "fade"}
        onRequestClose={() => {
          if (!props.busy) closeViewer();
        }}
        onDismiss={finishDismissal}
      >
        <SafeAreaView style={styles.viewer}>
          <View style={styles.viewerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              disabled={props.busy}
              hitSlop={10}
              onPress={closeViewer}
              style={styles.close}
            >
              <XMarkIcon size={26} color={colors.onAccent} />
            </Pressable>
          </View>

          {viewer.status !== "closed" ? (
            <Image
              source={{ uri: viewer.photo.localUri }}
              contentFit="contain"
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
          <AppDialog surface="photo-viewer" />
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
    borderStyle: "dashed",
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
