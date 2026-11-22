import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  CameraIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
} from "react-native-heroicons/outline";
import { ScreenBanner } from "../../../components/screen-banner";
import { getBannerColor } from "../../../services/banner-colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { Badge } from "../../../components/badge";
import { useDialogStore } from "../../../store/dialog-store";
import { PhotoGallery } from "../../../components/photo-gallery";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { PunchItem } from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough/photos";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

const processingLabels: Record<PunchItem["processingMode"], string> = {
  device: "On device",
  cloud: "Cloud",
  manual: "Manual",
};

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; item: PunchItem };

export default function ItemView() {
  const { id, walkthroughId } = useLocalSearchParams<{
    id: string;
    walkthroughId: string;
  }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [screen, setScreen] = useState<ScreenState>({ status: "loading" });

  const [photoBusy, setPhotoBusy] = useState(false);

  const showDialog = useDialogStore((state) => state.showDialog);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId || !walkthroughId || !id) return;

      let active = true;
      void createWalkthroughStorage(ownerId)
        .listItems(walkthroughId)
        .then((items) => {
          if (!active) return;

          const item = items.find((entry) => entry.id === id);
          setScreen(
            item
              ? { status: "ready", item }
              : { status: "error", message: "This item could not be found." },
          );
        })
        .catch(() => {
          if (active)
            setScreen({ status: "error", message: "Couldn’t load this item." });
        });

      return () => {
        active = false;
      };
    }, [ownerId, walkthroughId, id]),
  );

  async function addPhoto(source: "camera" | "library") {
    if (!ownerId || screen.status !== "ready" || photoBusy) return;

    setPhotoBusy(true);
    let added: PunchItem["photos"][number] | null = null;
    try {
      added = await selectItemPhoto(source);
      if (!added) return;

      const item = {
        ...screen.item,
        photos: [...screen.item.photos, added],
        updatedAt: Date.now(),
        cloudVerification: undefined,
      };
      await createWalkthroughStorage(ownerId).saveItem(item);
      setScreen({ status: "ready", item });
    } catch (error) {
      if (added) await deleteItemPhotos([added]).catch(() => {});
      showDialog(
        "Couldn’t add photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function choosePhoto() {
    showDialog("Add photo", "Choose a source", [
      {
        text: "Camera",
        icon: "camera",
        onPress: () => {
          void addPhoto("camera");
        },
      },
      {
        text: "Photo library",
        icon: "photo-library",
        onPress: () => {
          void addPhoto("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function removePhoto(
    photo: PunchItem["photos"][number],
  ): Promise<boolean> {
    if (!ownerId || screen.status !== "ready" || photoBusy) return false;

    setPhotoBusy(true);
    try {
      const item = {
        ...screen.item,
        photos: screen.item.photos.filter(
          (entry) => entry.localUri !== photo.localUri,
        ),
        updatedAt: Date.now(),
        cloudVerification: undefined,
      };
      await createWalkthroughStorage(ownerId).saveItem(item);
      setScreen({ status: "ready", item });
      await deleteItemPhotos([photo]).catch(() => {});

      return true;
    } catch {
      return false;
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style={screen.status === "ready" ? "light" : "dark"} />

      <ScrollView contentContainerStyle={screenStyles.content}>
        {screen.status === "loading" ? (
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Loading item"
          />
        ) : null}

        {screen.status === "error" ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {screen.message}
          </AppText>
        ) : null}

        {screen.status === "ready" ? (
          <>
            <ScreenBanner
              title={screen.item.issueSummary}
              color={getBannerColor(screen.item.id, screen.item.bannerColor)}
              imageUri={screen.item.bannerPhotoUri}
              action="edit"
              disabled={photoBusy}
              onAction={() =>
                router.push({
                  pathname: "/walkthrough/item",
                  params: { id, walkthroughId },
                })
              }
            />

            <View style={screenStyles.body}>
              <View style={screenStyles.overview}>
                <View style={screenStyles.badges}>
                  <Badge
                    label={screen.item.status}
                    tone={screen.item.status === "Done" ? "success" : "info"}
                  />

                  {screen.item.priority ? (
                    <Badge
                      label={`${screen.item.priority} priority`}
                      tone={
                        screen.item.priority === "High"
                          ? "danger"
                          : screen.item.priority === "Medium"
                            ? "warning"
                            : "neutral"
                      }
                    />
                  ) : null}

                  <Badge label={processingLabels[screen.item.processingMode]} />
                </View>

                <View style={screenStyles.details}>
                  <View style={screenStyles.detail}>
                    <View style={screenStyles.detailLabel}>
                      <MapPinIcon size={16} color={colors.muted} />

                      <AppText style={screenStyles.label}>Location</AppText>
                    </View>

                    <AppText
                      weight="semibold"
                      style={!screen.item.location && screenStyles.unspecified}
                    >
                      {screen.item.location || "Not specified"}
                    </AppText>
                  </View>

                  <View style={screenStyles.detail}>
                    <View style={screenStyles.detailLabel}>
                      <WrenchScrewdriverIcon size={16} color={colors.muted} />

                      <AppText style={screenStyles.label}>Trade</AppText>
                    </View>

                    <AppText
                      weight="semibold"
                      style={!screen.item.trade && screenStyles.unspecified}
                    >
                      {screen.item.trade || "Not specified"}
                    </AppText>
                  </View>
                </View>
              </View>

              <View style={screenStyles.photos}>
                <View style={screenStyles.headingRow}>
                  <AppText variant="title" style={screenStyles.sectionTitle}>
                    Photos
                  </AppText>

                  {screen.item.photos.length ? (
                    <AppText style={screenStyles.photoCount}>
                      {screen.item.photos.length}
                    </AppText>
                  ) : null}
                </View>

                {screen.item.photos.length ? (
                  <PhotoGallery
                    photos={screen.item.photos}
                    busy={photoBusy}
                    onAdd={choosePhoto}
                    onRemove={removePhoto}
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add photos"
                    disabled={photoBusy}
                    onPress={choosePhoto}
                    style={screenStyles.addPhoto}
                  >
                    <View style={screenStyles.photoIcon}>
                      <CameraIcon size={22} color={colors.accent} />
                    </View>

                    <View style={screenStyles.photoCopy}>
                      <AppText weight="semibold">Add photos</AppText>

                      <AppText style={screenStyles.photoHint}>
                        Capture or choose photos of this item
                      </AppText>
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  content: { flexGrow: 1 },
  body: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, gap: 32 },
  overview: { gap: 24 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: { fontSize: 19, lineHeight: 26 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  details: {
    flexDirection: "row",
    gap: 20,
  },
  detail: { flex: 1, gap: 8 },
  detailLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { color: colors.muted, fontSize: 13 },
  unspecified: { color: colors.muted },
  photos: { gap: 16 },
  photoCount: { color: colors.muted, fontSize: 13 },
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
  photoHint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
});
