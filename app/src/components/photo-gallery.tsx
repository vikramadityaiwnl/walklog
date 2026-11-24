import { Image } from "expo-image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
} from "react-native-heroicons/outline";
import {
  Animated as NativeAnimated,
  Easing,
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
import { AppText } from "./app-text";
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
  const slideX = useRef(new NativeAnimated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRemoval = useRef<Photo | null>(null);
  const onRemoved = useRef(props.onRemoved);
  onRemoved.current = props.onRemoved;

  const photosRef = useRef(props.photos);
  photosRef.current = props.photos;

  const activePhotoIndex =
    viewer.status === "closed"
      ? -1
      : props.photos.findIndex(
          (photo) => photo.localUri === viewer.photo.localUri,
        );
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
    slideX.setValue(0);
    setViewer((current) =>
      current.status === "closing" ? { status: "closed" } : current,
    );
    if (removed) onRemoved.current?.(removed);
  }

  function closeViewer() {
    if (viewer.status !== "open") return;

    slideX.stopAnimation();
    slideX.setValue(0);
    setViewer({ status: "closing", photo: viewer.photo });
    if (Platform.OS !== "ios") {
      dismissTimer.current = setTimeout(
        finishDismissal,
        reducedMotion ? 0 : 300,
      );
    }
  }

  function changePhoto(direction: "previous" | "next") {
    if (viewer.status !== "open") return;

    const nextIndex = activePhotoIndex + (direction === "next" ? 1 : -1);
    const photo = photosRef.current[nextIndex];
    if (!photo) return;

    slideX.stopAnimation();
    slideX.setValue(direction === "next" ? width : -width);
    setViewer({ status: "open", photo });
    NativeAnimated.timing(slideX, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
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
            <AppText style={styles.photoCount}>
              {Math.max(activePhotoIndex + 1, 1)} of {props.photos.length}{" "}
              {props.photos.length === 1 ? "image" : "images"}
            </AppText>

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
            <View style={styles.fullImage}>
              <NativeAnimated.View
                style={[
                  styles.slideImage,
                  { transform: [{ translateX: slideX }] },
                ]}
              >
                <Image
                  source={{ uri: viewer.photo.localUri }}
                  contentFit="contain"
                  style={styles.image}
                />
              </NativeAnimated.View>

              {activePhotoIndex > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous photo"
                  disabled={props.busy}
                  onPress={() => changePhoto("previous")}
                  style={({ pressed }) => [
                    styles.navigationButton,
                    styles.previousButton,
                    pressed && styles.navigationButtonPressed,
                  ]}
                >
                  <ChevronLeftIcon size={28} color={colors.onAccent} />
                </Pressable>
              ) : null}

              {activePhotoIndex >= 0 &&
              activePhotoIndex < props.photos.length - 1 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next photo"
                  disabled={props.busy}
                  onPress={() => changePhoto("next")}
                  style={({ pressed }) => [
                    styles.navigationButton,
                    styles.nextButton,
                    pressed && styles.navigationButtonPressed,
                  ]}
                >
                  <ChevronRightIcon size={28} color={colors.onAccent} />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.viewerActions}>
            <AppButton
              title="Delete photo"
              variant="secondary"
              labelColor={colors.onAccent}
              icon={<TrashIcon size={19} color={colors.onAccent} />}
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
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  photoCount: { color: colors.onAccent, fontSize: 14 },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fullImage: { flex: 1, overflow: "hidden", width: "100%" },
  slideImage: { flex: 1, width: "100%" },
  image: { flex: 1, width: "100%" },
  navigationButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    opacity: 0.78,
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -22 }],
    width: 44,
  },
  navigationButtonPressed: { opacity: 1 },
  previousButton: { left: 16 },
  nextButton: { right: 16 },
  viewerActions: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
