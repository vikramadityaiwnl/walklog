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
import { getBannerColor } from "../../../utils/banner-colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { Badge } from "../../../components/badge";
import { useDialogStore } from "../../../store/dialog-store";
import { PhotoGallery } from "../../../components/photo-gallery";
import type { PunchItem } from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough/photos";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
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
  const firestoreRevision = useFirestoreStore((state) => state.revision);

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
    }, [ownerId, walkthroughId, id, firestoreRevision]),
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

            <View style={styles.body}>
              <View style={styles.overview}>
                <View style={styles.badges}>
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

                <View style={styles.details}>
                  <View style={styles.detail}>
                    <View style={styles.detailLabel}>
                      <MapPinIcon size={16} color={colors.muted} />

                      <AppText style={styles.label}>Location</AppText>
                    </View>

                    <AppText
                      weight="semibold"
                      style={!screen.item.location && styles.unspecified}
                    >
                      {screen.item.location || "Not specified"}
                    </AppText>
                  </View>

                  <View style={styles.detail}>
                    <View style={styles.detailLabel}>
                      <WrenchScrewdriverIcon size={16} color={colors.muted} />

                      <AppText style={styles.label}>Trade</AppText>
                    </View>

                    <AppText
                      weight="semibold"
                      style={!screen.item.trade && styles.unspecified}
                    >
                      {screen.item.trade || "Not specified"}
                    </AppText>
                  </View>
                </View>
              </View>

              <View style={styles.photos}>
                <View style={styles.headingRow}>
                  <AppText variant="title" style={styles.sectionTitle}>
                    Photos
                  </AppText>

                  {screen.item.photos.length ? (
                    <AppText style={styles.photoCount}>
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
                    style={styles.addPhoto}
                  >
                    <View style={styles.photoIcon}>
                      <CameraIcon size={22} color={colors.accent} />
                    </View>

                    <View style={styles.photoCopy}>
                      <AppText weight="semibold">Add photos</AppText>

                      <AppText style={styles.photoHint}>
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

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subheading: { color: colors.muted, lineHeight: 22 },
  section: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  card: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 18 },
  link: { color: colors.accent },
  danger: { color: colors.danger },
  photo: { width: 96, height: 96, borderRadius: 10 },
  error: { color: colors.danger },
  back: { paddingVertical: 10, alignSelf: "flex-start" },
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
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
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
