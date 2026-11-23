import { useCallback, useState } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import {
  CameraIcon,
  CheckIcon,
  MapPinIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from "react-native-heroicons/outline";
import { ScreenBanner } from "../../../components/screen-banner";
import { getBannerColor } from "../../../utils/banner-colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { LoadingState } from "../../../components/loading-state";
import { AppButton } from "../../../components/app-button";
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

interface Props {
  completed: boolean;
}

const layoutTransition = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
const fadeIn = FadeIn.duration(140).reduceMotion(ReduceMotion.System);
const fadeOut = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

function ActionIndicator(props: Props) {
  const selectedStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(
        props.completed ? colors.accent : colors.background,
        { duration: 140, reduceMotion: ReduceMotion.System },
      ),
      borderColor: withTiming(props.completed ? colors.accent : colors.border, {
        duration: 140,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [props.completed],
  );

  return (
    <Animated.View style={[styles.checkbox, selectedStyle]}>
      {props.completed ? (
        <Animated.View entering={fadeIn} exiting={fadeOut}>
          <CheckIcon size={14} color={colors.onAccent} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

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

  const [actionBusy, setActionBusy] = useState(false);

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
    if (!ownerId || screen.status !== "ready" || photoBusy || actionBusy)
      return;

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
    if (!ownerId || screen.status !== "ready" || photoBusy || actionBusy)
      return false;

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

      return true;
    } catch {
      return false;
    } finally {
      setPhotoBusy(false);
    }
  }

  async function toggleAction(index: number) {
    if (
      !ownerId ||
      screen.status !== "ready" ||
      !screen.item.refinement ||
      actionBusy ||
      photoBusy
    )
      return;

    const item = screen.item;
    const refinement = item.refinement;
    if (!refinement) return;
    const actions = refinement.actions ?? [
      { text: refinement.recommendedAction, completed: false },
    ];
    const selected = actions[index];
    if (!selected) return;

    setActionBusy(true);
    try {
      const updated: PunchItem = {
        ...item,
        refinement: {
          ...refinement,
          actions: actions.map((action, actionIndex) =>
            actionIndex === index
              ? { ...action, completed: !action.completed }
              : action,
          ),
        },
        updatedAt: Date.now(),
      };
      await createWalkthroughStorage(ownerId).saveItem(updated);
      setScreen({ status: "ready", item: updated });
    } catch {
      showDialog("Couldn’t update action", "Please try again.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style={screen.status === "ready" ? "light" : "dark"} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {screen.status === "loading" ? <LoadingState /> : null}

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
              disabled={photoBusy || actionBusy}
              onAction={() =>
                router.push({
                  pathname: "/walkthrough/item",
                  params: { id, walkthroughId },
                })
              }
            />

            <Animated.View layout={layoutTransition} style={styles.body}>
              <View style={styles.overview}>
                <View style={styles.badges}>
                  <Animated.View key={screen.item.status} entering={fadeIn}>
                    <Badge
                      label={screen.item.status}
                      tone={screen.item.status === "Done" ? "success" : "info"}
                    />
                  </Animated.View>

                  {screen.item.priority ? (
                    <Animated.View key={screen.item.priority} entering={fadeIn}>
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
                    </Animated.View>
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

              <Animated.View layout={layoutTransition} style={styles.photos}>
                <View style={styles.headingRow}>
                  <AppText variant="title" style={styles.sectionTitle}>
                    Photos
                  </AppText>
                </View>

                <PhotoGallery
                  photos={screen.item.photos}
                  busy={photoBusy || actionBusy}
                  onAdd={choosePhoto}
                  onRemove={removePhoto}
                  onRemoved={(photo) => {
                    void deleteItemPhotos([photo]).catch(() => {});
                  }}
                  emptyState={
                    <Animated.View
                      key="empty"
                      entering={fadeIn}
                      exiting={fadeOut}
                      layout={layoutTransition}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Add photos"
                        disabled={photoBusy || actionBusy}
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
                    </Animated.View>
                  }
                />
              </Animated.View>
              {screen.item.refinement ? (
                <Animated.View layout={layoutTransition} style={styles.section}>
                  <View style={styles.headingRow}>
                    <AppText variant="title" style={styles.sectionTitle}>
                      Suggested actions
                    </AppText>

                    <Badge
                      label={
                        screen.item.refinement.usedPhoto
                          ? "Photos included"
                          : "Text only"
                      }
                    />
                  </View>

                  {(
                    screen.item.refinement.actions ?? [
                      {
                        text: screen.item.refinement.recommendedAction,
                        completed: false,
                      },
                    ]
                  ).map((action, index) => (
                    <Pressable
                      key={`${index}-${action.text}`}
                      accessibilityRole="checkbox"
                      accessibilityLabel={action.text}
                      accessibilityState={{
                        checked: action.completed,
                        disabled: actionBusy || photoBusy,
                      }}
                      disabled={actionBusy || photoBusy}
                      onPress={() => void toggleAction(index)}
                      style={styles.checklistRow}
                    >
                      <ActionIndicator completed={action.completed} />

                      <AppText
                        style={[
                          styles.checklistText,
                          action.completed && styles.completedText,
                        ]}
                      >
                        {action.text}
                      </AppText>
                    </Pressable>
                  ))}
                </Animated.View>
              ) : null}
            </Animated.View>
          </>
        ) : null}
      </ScrollView>

      {screen.status === "ready" ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton
              title="Refine with AI"
              variant="outline"
              icon={<SparklesIcon size={20} color={colors.accent} />}
              disabled={photoBusy || actionBusy}
              onPress={() =>
                router.push({
                  pathname: "/walkthrough/refine",
                  params: { id, walkthroughId },
                } as Href)
              }
            />
          </View>
        </View>
      ) : null}
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
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checklistText: { flex: 1, lineHeight: 22 },
  completedText: { color: colors.muted, textDecorationLine: "line-through" },
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
