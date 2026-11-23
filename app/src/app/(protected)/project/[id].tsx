import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ChevronRightIcon,
  ClipboardDocumentListIcon,
} from "react-native-heroicons/outline";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import { AppText } from "../../../components/app-text";
import { LoadingState } from "../../../components/loading-state";
import { ScreenBanner } from "../../../components/screen-banner";
import { Overlay } from "../../../components/overlay";
import { bannerColor } from "../../../utils/banner-illustrations";
import { BannerIllustration } from "../../../components/banner-illustration";
import { EmptyState } from "../../../components/empty-state";
import { ErrorState } from "../../../components/error-state";
import type { Project, Walkthrough } from "../../../models/walkthrough";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";
import {
  listItemEnter,
  listItemExit,
  listItemLayout,
} from "../../../utils/list-motion";

type Screen =
  | { status: "loading" | "error" }
  | {
      status: "ready";
      project: Project;
      walkthroughs: Walkthrough[];
      counts: Record<string, number>;
    };

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const auth = useAuthStore((state) => state.auth);

  const firestoreRevision = useFirestoreStore((state) => state.revision);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [loadRevision, setLoadRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId || !id) return;

      let active = true;

      const storage = createWalkthroughStorage(ownerId);
      void Promise.all([storage.listProjects(), storage.listWalkthroughs()])
        .then(async ([projects, walkthroughs]) => {
          const project = projects.find((entry) => entry.id === id);
          const included = walkthroughs.filter(
            (entry) => entry.projectId === id,
          );
          const counts = Object.fromEntries(
            await Promise.all(
              included.map(
                async (entry) =>
                  [
                    entry.id,
                    (await storage.listItems(entry.id)).length,
                  ] as const,
              ),
            ),
          );
          if (active)
            setScreen(
              project
                ? {
                    status: "ready",
                    project,
                    walkthroughs: included,
                    counts,
                  }
                : { status: "error" },
            );
        })
        .catch(() => {
          if (active) setScreen({ status: "error" });
        });

      return () => {
        active = false;
      };
    }, [ownerId, id, firestoreRevision, loadRevision]),
  );

  if (screen.status === "error") {
    return (
      <ErrorState
        title="Couldn’t load project"
        description="Please try again."
        actions={[
          { title: "Back", variant: "secondary", onPress: () => router.back() },
          {
            title: "Try again",
            onPress: () => {
              setScreen({ status: "loading" });
              setLoadRevision((current) => current + 1);
            },
          },
        ]}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {screen.status === "loading" ? <LoadingState /> : null}

        {screen.status === "ready" ? (
          <>
            <ScreenBanner
              title={screen.project.name}
              subtitle={`${screen.walkthroughs.length} ${screen.walkthroughs.length === 1 ? "walkthrough" : "walkthroughs"}`}
              color={bannerColor}
              imageUri={screen.project.bannerPhotoUri}
              bannerIllustration={screen.project.bannerIllustration}
              action="settings"
              actionLabel="Project settings"
              onAction={() =>
                router.push({ pathname: "/project/edit", params: { id } })
              }
            />
            <View style={styles.body}>
              {!screen.walkthroughs.length ? (
                <EmptyState
                  icon={
                    <ClipboardDocumentListIcon size={48} color={colors.muted} />
                  }
                  title="No walkthroughs yet"
                  description="Select walkthroughs on the Walkthroughs tab to add them here."
                  compact
                />
              ) : (
                screen.walkthroughs.map((walkthrough) => (
                  <Animated.View
                    key={walkthrough.id}
                    entering={listItemEnter}
                    exiting={listItemExit}
                    layout={listItemLayout}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        router.push({
                          pathname: "/walkthrough/[id]",
                          params: { id: walkthrough.id, fromProjectId: id },
                        });
                      }}
                      style={[
                        styles.card,
                        {
                          backgroundColor: bannerColor,
                        },
                      ]}
                    >
                      {walkthrough.bannerPhotoUri ? (
                        <Image
                          source={{ uri: walkthrough.bannerPhotoUri }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      ) : null}

                      {!walkthrough.bannerPhotoUri ? (
                        <BannerIllustration
                          illustration={walkthrough.bannerIllustration}
                        />
                      ) : null}
                      <Overlay />
                      <View style={styles.cardContent}>
                        <View style={styles.cardText}>
                          <AppText variant="title" style={styles.cardTitle}>
                            {walkthrough.title}
                          </AppText>

                          {walkthrough.clientName || walkthrough.address ? (
                            <AppText style={styles.cardSubtitle}>
                              {[walkthrough.clientName, walkthrough.address]
                                .filter(Boolean)
                                .join(" · ")}
                            </AppText>
                          ) : null}

                          <AppText style={styles.cardCount}>
                            {screen.counts[walkthrough.id]}{" "}
                            {screen.counts[walkthrough.id] === 1
                              ? "item"
                              : "items"}
                          </AppText>
                        </View>
                        <ChevronRightIcon size={22} color={colors.onAccent} />
                      </View>
                    </Pressable>
                  </Animated.View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { flexGrow: 1 },
  body: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  heading: { gap: 6, marginBottom: 8 },
  title: { fontSize: 30, lineHeight: 38 },
  muted: { color: colors.muted },
  card: {
    minHeight: 180,
    justifyContent: "flex-end",
    borderRadius: 16,
    overflow: "hidden",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    padding: 18,
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { color: colors.onAccent, fontSize: 21, lineHeight: 28 },
  cardSubtitle: { color: colors.onAccent, lineHeight: 20 },
  cardCount: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
});
