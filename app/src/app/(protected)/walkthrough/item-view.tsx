import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ScreenBanner } from "../../../components/screen-banner";
import { getBannerColor } from "../../../services/banner-colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { PhotoGallery } from "../../../components/photo-gallery";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { PunchItem } from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough-photos";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

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
      Alert.alert(
        "Couldn’t add photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function choosePhoto() {
    Alert.alert("Add photo", "Choose a source", [
      {
        text: "Take photo",
        onPress: () => {
          void addPhoto("camera");
        },
      },
      {
        text: "Choose from library",
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
      Alert.alert("Couldn’t remove photo", "Please try again.");

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

            <View style={styles.content}>
              <View style={screenStyles.details}>
                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Location
                  </AppText>

                  <AppText>
                    {screen.item.location || "Unspecified Area"}
                  </AppText>
                </View>

                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Trade
                  </AppText>

                  <AppText>{screen.item.trade}</AppText>
                </View>

                <View style={styles.section}>
                  <AppText weight="semibold" style={styles.label}>
                    Priority
                  </AppText>

                  <AppText>{screen.item.priority}</AppText>
                </View>
              </View>

              <View style={[styles.section, { marginTop: 12 }]}>
                <AppText weight="bold" style={styles.cardTitle}>
                  Photos
                </AppText>

                <PhotoGallery
                  photos={screen.item.photos}
                  busy={photoBusy}
                  onAdd={choosePhoto}
                  onRemove={removePhoto}
                />
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
  details: { gap: 18 },
});
