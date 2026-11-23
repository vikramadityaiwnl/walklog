import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import {
  SparklesIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from "react-native-heroicons/outline";
import { Badge } from "../../../components/badge";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { AppButton } from "../../../components/app-button";
import { LoadingState } from "../../../components/loading-state";
import { EmptyState } from "../../../components/empty-state";
import { InferenceSelector } from "../../../components/inference-selector";
import { useAuthStore } from "../../../store/auth-store";
import { useInferenceStore } from "../../../store/inference-store";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import {
  refineItem,
  refinementUsesPhoto,
  type ItemRefinement,
} from "../../../services/walkthrough/refine-item";
import type { PunchItem } from "../../../models/walkthrough";
import { colors } from "../../../theme";

type Screen =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      item: PunchItem;
      result?: ItemRefinement;
      resultMode?: "device" | "cloud";
      busy?: "refining" | "saving";
      message?: string;
    };

export default function RefineItem() {
  const insets = useSafeAreaInsets();
  const { id, walkthroughId } = useLocalSearchParams<{
    id: string;
    walkthroughId: string;
  }>();
  const auth = useAuthStore((state) => state.auth);
  const mode = useInferenceStore((state) => state.mode);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [screen, setScreen] = useState<Screen>({ status: "loading" });

  useEffect(() => {
    if (!ownerId || !id || !walkthroughId) return;
    let active = true;
    void createWalkthroughStorage(ownerId)
      .listItems(walkthroughId)
      .then((items) => {
        if (!active) return;
        const item = items.find((entry) => entry.id === id);
        setScreen(
          item
            ? { status: "ready", item }
            : { status: "error", message: "Item not found." },
        );
      })
      .catch(() => {
        if (active)
          setScreen({ status: "error", message: "Couldn’t load this item." });
      });
    return () => {
      active = false;
    };
  }, [ownerId, id, walkthroughId]);

  async function generate() {
    if (
      !ownerId ||
      screen.status !== "ready" ||
      screen.busy ||
      (mode !== "device" && mode !== "cloud")
    )
      return;
    const item = screen.item;
    const selected = mode;
    setScreen({ status: "ready", item, busy: "refining" });
    try {
      const result = await refineItem(item, selected, ownerId);
      setScreen({ status: "ready", item, result, resultMode: selected });
    } catch (error) {
      setScreen({
        status: "ready",
        item,
        message:
          error instanceof Error
            ? error.message
            : "Couldn’t refine this item. Please try again.",
      });
    }
  }

  async function apply() {
    if (
      !ownerId ||
      screen.status !== "ready" ||
      !screen.result ||
      !screen.resultMode ||
      screen.busy
    )
      return;
    const { item, result, resultMode } = screen;
    setScreen({ ...screen, busy: "saving" });
    try {
      const storage = createWalkthroughStorage(ownerId);
      const current = (await storage.listItems(walkthroughId)).find(
        (entry) => entry.id === id,
      );
      if (!current || current.updatedAt !== item.updatedAt)
        throw new Error(
          "This item changed. Reopen refinement to use the latest details.",
        );
      await storage.saveItem({
        ...current,
        issueSummary: result.issueSummary,
        processingMode: resultMode,
        location: result.location,
        trade: result.trade,
        priority: result.priority,
        refinement: {
          recommendedAction: result.actions.join("\n"),
          actions: result.actions.map((text) => ({ text, completed: false })),
          source: resultMode,
          usedPhoto: refinementUsesPhoto(resultMode) && item.photos.length > 0,
        },
        cloudVerification: undefined,
        updatedAt: Date.now(),
      });
      router.back();
    } catch (error) {
      setScreen({
        status: "ready",
        item,
        result,
        resultMode,
        message:
          error instanceof Error
            ? error.message
            : "Couldn’t save the refinement.",
      });
    }
  }

  const includesPhoto = refinementUsesPhoto(mode);

  if (screen.status === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Loading item"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (screen.status === "ready" && screen.busy) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState
          description={
            screen.busy === "saving"
              ? "Saving your refined item."
              : "Reviewing your item and preparing a suggestion."
          }
        />
      </SafeAreaView>
    );
  }

  if (
    screen.status === "error" ||
    (screen.status === "ready" && screen.message)
  ) {
    const message =
      screen.status === "error"
        ? screen.message
        : (screen.message ?? "Please try again.");

    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<ExclamationTriangleIcon size={40} color={colors.accent} />}
          title="Couldn’t refine item"
          description={message}
        />

        <View style={styles.errorActions}>
          <View style={styles.action}>
            <AppButton
              title="Back"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>

          {screen.status === "ready" ? (
            <View style={styles.action}>
              <AppButton
                title="Try again"
                onPress={() => setScreen({ ...screen, message: undefined })}
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (screen.status === "ready" && screen.result && screen.resultMode) {
    const result = screen.result;
    const usedPhoto =
      refinementUsesPhoto(screen.resultMode) && screen.item.photos.length > 0;

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.reviewIntro}>
            <AppText variant="title" style={styles.heading}>
              Refinement ready
            </AppText>

            <AppText style={styles.description}>
              Review the updated details before applying them.
            </AppText>
          </View>

          <View style={styles.reviewSection}>
            <AppText weight="semibold" style={styles.reviewTitle}>
              {result.issueSummary}
            </AppText>

            <View style={styles.badges}>
              {result.location ? <Badge label={result.location} /> : null}
              {result.trade ? <Badge label={result.trade} /> : null}
              {result.priority ? (
                <Badge
                  label={`${result.priority} priority`}
                  tone={
                    result.priority === "High"
                      ? "danger"
                      : result.priority === "Medium"
                        ? "warning"
                        : "info"
                  }
                />
              ) : null}
            </View>
          </View>

          <View style={styles.reviewSection}>
            <View style={styles.actionHeading}>
              <AppText variant="title" style={styles.sectionTitle}>
                Suggested actions
              </AppText>

              <Badge label={usedPhoto ? "Photos included" : "Text only"} />
            </View>

            <AppText style={styles.hint}>
              You can check these off after applying.
            </AppText>

            <View style={styles.reviewChecklist}>
              {result.actions.map((action, index) => (
                <View key={`${index}-${action}`} style={styles.reviewAction}>
                  <View style={styles.checkbox} />

                  <AppText style={styles.checklistText}>{action}</AppText>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.action}>
            <AppButton
              title="Try again"
              variant="secondary"
              onPress={() => setScreen({ status: "ready", item: screen.item })}
            />
          </View>

          <View style={styles.action}>
            <AppButton title="Apply" onPress={apply} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title" style={styles.heading}>
            Refine item
          </AppText>

          <AppText style={styles.description}>
            Polish the details and get a suggested next step.
          </AppText>
        </View>

        {screen.status === "ready" ? (
          <>
            <View style={styles.section}>
              <InferenceSelector />

              <View style={styles.notice}>
                <ShieldCheckIcon size={20} color={colors.accent} />

                <View style={styles.noticeText}>
                  <AppText weight="semibold" style={styles.noticeTitle}>
                    {mode === "cloud"
                      ? "Cloud refinement"
                      : "On-device refinement"}
                  </AppText>

                  <AppText style={styles.noticeBody}>
                    {mode === "cloud"
                      ? "Your item details, notes and attached photos are sent to cloud AI."
                      : includesPhoto
                        ? "Your item details, notes and first photo, if attached, are processed on this device."
                        : "Your item details and notes are processed on this device."}
                  </AppText>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.itemDetails}>
                <AppText weight="bold" style={styles.itemTitle}>
                  {screen.item.issueSummary}
                </AppText>

                <View style={styles.badges}>
                  {screen.item.location ? (
                    <Badge label={screen.item.location} />
                  ) : null}
                  {screen.item.trade ? (
                    <Badge label={screen.item.trade} />
                  ) : null}
                  {screen.item.priority ? (
                    <Badge
                      label={`${screen.item.priority} priority`}
                      tone={
                        screen.item.priority === "High"
                          ? "danger"
                          : screen.item.priority === "Medium"
                            ? "warning"
                            : "info"
                      }
                    />
                  ) : null}
                </View>
              </View>
            </View>

            {includesPhoto && screen.item.photos.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeading}>
                  <AppText variant="title" style={styles.sectionTitle}>
                    Photos
                  </AppText>
                  <AppText style={styles.hint}>
                    {mode === "cloud"
                      ? "These photos will be included."
                      : "The first photo will be included."}
                  </AppText>
                </View>

                <View style={styles.photoList}>
                  {(mode === "cloud"
                    ? screen.item.photos
                    : screen.item.photos.slice(0, 1)
                  ).map((photo, index) => (
                    <Image
                      key={`${photo.localUri}-${index}`}
                      source={{ uri: photo.localUri }}
                      style={styles.photo}
                      contentFit="cover"
                    />
                  ))}
                </View>
              </View>
            ) : !includesPhoto ? (
              <View style={styles.notice}>
                <ShieldCheckIcon size={20} color={colors.accent} />
                <View style={styles.noticeText}>
                  <AppText weight="semibold" style={styles.noticeTitle}>
                    Photos stay out of this refinement
                  </AppText>
                  <AppText style={styles.noticeBody}>
                    On-device AI on this device supports text only. Choose cloud
                    AI to include your photos.
                  </AppText>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {screen.status === "ready" ? (
        <View
          style={[
            styles.actions,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <View style={styles.action}>
            <AppButton
              title="Refine with AI"
              icon={<SparklesIcon size={19} color={colors.onAccent} />}
              onPress={generate}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  reviewContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 32,
  },
  reviewIntro: { gap: 8 },
  reviewSection: { gap: 12 },
  reviewTitle: { fontSize: 17, lineHeight: 24 },
  reviewChecklist: { gap: 4 },
  reviewAction: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 100,
    gap: 32,
  },
  intro: { gap: 6 },
  heading: { fontSize: 30, lineHeight: 38 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  section: { gap: 14 },
  sectionHeading: { gap: 4 },
  sectionTitle: { fontSize: 19, lineHeight: 26 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  notice: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.accentFaint,
    borderRadius: 12,
    padding: 16,
  },
  noticeText: { flex: 1, gap: 3 },
  noticeTitle: { color: colors.accent, fontSize: 14 },
  noticeBody: { color: colors.foreground, fontSize: 13, lineHeight: 19 },
  itemDetails: { gap: 12 },
  itemTitle: { fontSize: 17, lineHeight: 24 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  notes: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 6,
  },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 0.7 },
  notesText: { fontSize: 14, lineHeight: 21 },
  actionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  checklistRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingTop: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    marginTop: 1,
  },
  checklistText: { flex: 1, fontSize: 14, lineHeight: 21 },
  photoList: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 8,
    backgroundColor: colors.accentFaint,
  },
  resultCard: {
    backgroundColor: colors.accentFaint,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  resultHeading: { flexDirection: "row", alignItems: "center", gap: 7 },
  error: { color: colors.danger },
  actions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  action: { flex: 1 },
});
