import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ChevronRightIcon,
  FolderIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "../../../components/app-text";
import { AppHeader } from "../../../components/app-header";
import { EmptyState } from "../../../components/empty-state";
import { LoadingState } from "../../../components/loading-state";
import { Overlay } from "../../../components/overlay";
import type { Project, Walkthrough } from "../../../models/walkthrough";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useAuthStore } from "../../../store/auth-store";
import { bannerColor } from "../../../utils/banner-illustrations";
import { BannerIllustration } from "../../../components/banner-illustration";
import { colors } from "../../../theme";

type Screen =
  | { status: "loading" | "error" }
  | { status: "ready"; projects: Project[]; walkthroughs: Walkthrough[] };

export default function Projects() {
  const auth = useAuthStore((state) => state.auth);
  const firestoreRevision = useFirestoreStore((state) => state.revision);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [screen, setScreen] = useState<Screen>({ status: "loading" });

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      let active = true;
      const storage = createWalkthroughStorage(ownerId);
      void Promise.all([storage.listProjects(), storage.listWalkthroughs()])
        .then(([projects, walkthroughs]) => {
          if (active) setScreen({ status: "ready", projects, walkthroughs });
        })
        .catch(() => {
          if (active) setScreen({ status: "error" });
        });
      return () => {
        active = false;
      };
    }, [ownerId, firestoreRevision]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />
      <View style={styles.main}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <AppText variant="title" style={styles.heading}>
              Projects
            </AppText>
            <AppText style={styles.subtitle}>
              Keep related site visits together.
            </AppText>
          </View>
          {screen.status === "loading" ? <LoadingState /> : null}
          {screen.status === "error" ? (
            <AppText>
              Couldn’t load projects. Please reopen this screen.
            </AppText>
          ) : null}
          {screen.status === "ready" && !screen.projects.length ? (
            <EmptyState
              icon={<FolderIcon size={48} color={colors.muted} />}
              title="No projects yet"
              description="Create a project to keep related walkthroughs together."
              compact
            />
          ) : null}
          {screen.status === "ready"
            ? screen.projects.map((project) => {
                const count = screen.walkthroughs.filter(
                  (walkthrough) => walkthrough.projectId === project.id,
                ).length;
                return (
                  <Pressable
                    key={project.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${project.name}`}
                    onPress={() =>
                      router.push({
                        pathname: "/project/[id]",
                        params: { id: project.id },
                      })
                    }
                    style={[
                      styles.card,
                      {
                        backgroundColor: bannerColor,
                      },
                    ]}
                  >
                    {project.bannerPhotoUri ? (
                      <Image
                        source={{ uri: project.bannerPhotoUri }}
                        style={StyleSheet.absoluteFill}
                        contentFit="cover"
                      />
                    ) : null}
                    {!project.bannerPhotoUri ? (
                      <BannerIllustration
                        illustration={project.bannerIllustration}
                      />
                    ) : null}
                    <Overlay />
                    <View style={styles.cardContent}>
                      <View style={styles.cardText}>
                        <View style={styles.titleRow}>
                          <FolderIcon size={20} color={colors.onAccent} />
                          <AppText variant="title" style={styles.cardTitle}>
                            {project.name}
                          </AppText>
                        </View>
                        <AppText style={styles.cardCount}>
                          {count} {count === 1 ? "walkthrough" : "walkthroughs"}
                        </AppText>
                      </View>
                      <ChevronRightIcon size={22} color={colors.onAccent} />
                    </View>
                  </Pressable>
                );
              })
            : null}
        </ScrollView>
        {screen.status === "ready" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New project"
            onPress={() => router.push("/project/edit")}
            style={styles.floatingAction}
          >
            <PlusIcon size={28} color={colors.onAccent} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  main: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 100,
    gap: 18,
  },
  header: { gap: 8 },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subtitle: { color: colors.muted, lineHeight: 22 },
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
  cardText: { flex: 1, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    color: colors.onAccent,
    fontSize: 21,
    lineHeight: 28,
    flexShrink: 1,
  },
  cardCount: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.85,
  },
  floatingAction: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
