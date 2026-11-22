import { Image } from "expo-image";
import { useCallback, useLayoutEffect, useState } from "react";
import { router, useFocusEffect, useNavigation } from "expo-router";
import {
  CheckIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  FolderIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import {
  ActivityIndicator,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "../../../components/app-header";
import { AppText } from "../../../components/app-text";
import { EmptyState } from "../../../components/empty-state";
import { Overlay } from "../../../components/overlay";
import { ProjectPicker } from "../../../components/project-picker";
import type { Project, Walkthrough } from "../../../models/walkthrough";
import { bannerColor } from "../../../utils/banner-illustrations";
import { BannerIllustration } from "../../../components/banner-illustration";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type ListState =
  | { status: "loading" | "error" }
  | {
      status: "ready";
      walkthroughs: Walkthrough[];
      projects: Project[];
      counts: Record<string, number>;
    };

export default function Walkthroughs() {
  const navigation = useNavigation();
  const auth = useAuthStore((state) => state.auth);
  const firestoreRevision = useFirestoreStore((state) => state.revision);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [list, setList] = useState<ListState>({ status: "loading" });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  useLayoutEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    navigation.setOptions({
      tabBarStyle:
        selected !== null
          ? { display: "none" }
          : {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
    });
  }, [navigation, selected !== null]);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      let active = true;
      const storage = createWalkthroughStorage(ownerId);
      void (async () => {
        try {
          const [walkthroughs, projects] = await Promise.all([
            storage.listWalkthroughs(),
            storage.listProjects(),
          ]);
          const entries = await Promise.all(
            walkthroughs.map(
              async (walkthrough) =>
                [
                  walkthrough.id,
                  await storage.listItems(walkthrough.id),
                ] as const,
            ),
          );
          const counts = Object.fromEntries(
            entries.map(([id, items]) => [id, items.length]),
          );
          if (active)
            setList({
              status: "ready",
              walkthroughs,
              projects,
              counts,
            });
        } catch {
          if (active) setList({ status: "error" });
        }
      })();
      return () => {
        active = false;
      };
    }, [ownerId, revision, firestoreRevision]),
  );

  function toggle(id: string) {
    setSelected((current) =>
      current?.includes(id)
        ? current.filter((value) => value !== id)
        : [...(current ?? []), id],
    );
  }

  function card(walkthrough: Walkthrough) {
    if (list.status !== "ready") return null;
    const project = list.projects.find(
      (entry) => entry.id === walkthrough.projectId,
    );
    const isSelected = selected?.includes(walkthrough.id) ?? false;
    return (
      <Pressable
        key={walkthrough.id}
        accessibilityRole="button"
        accessibilityLabel={`Open ${walkthrough.title}`}
        accessibilityState={{ selected: isSelected }}
        onLongPress={() => toggle(walkthrough.id)}
        onPress={() => {
          if (selected !== null) {
            toggle(walkthrough.id);
            return;
          }
          router.push({
            pathname: "/walkthrough/[id]",
            params: { id: walkthrough.id },
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
          <BannerIllustration illustration={walkthrough.bannerIllustration} />
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
            <View style={styles.meta}>
              {project ? (
                <View style={styles.projectMeta}>
                  <FolderIcon size={16} color={colors.onAccent} />
                  <AppText
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={styles.projectName}
                  >
                    {project.name}
                  </AppText>
                </View>
              ) : null}
              <AppText style={[styles.metaText, styles.itemCount]}>
                {list.counts[walkthrough.id]}{" "}
                {list.counts[walkthrough.id] === 1 ? "item" : "items"}
              </AppText>
            </View>
          </View>

          {selected !== null ? (
            <View style={[styles.checkbox, isSelected && styles.checked]}>
              {isSelected ? (
                <CheckIcon size={16} color={colors.onAccent} />
              ) : null}
            </View>
          ) : (
            <ChevronRightIcon size={22} color={colors.onAccent} />
          )}
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={selected !== null ? ["top", "bottom"] : ["top"]}
    >
      <AppHeader />
      <View style={styles.main}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.headingGroup}>
            <AppText variant="title" style={styles.heading}>
              Walkthroughs
            </AppText>
            <AppText style={styles.subheading}>
              A clear record of every site visit.
            </AppText>
          </View>
          {selected !== null && list.status === "ready" ? (
            <View style={styles.selectionHeader}>
              <AppText weight="semibold">{selected.length} selected</AppText>

              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setSelected(
                    selected.length === list.walkthroughs.length
                      ? []
                      : list.walkthroughs.map((entry) => entry.id),
                  )
                }
              >
                <AppText style={styles.selectAll} weight="semibold">
                  {selected.length === list.walkthroughs.length
                    ? "Deselect all"
                    : "Select all"}
                </AppText>
              </Pressable>
            </View>
          ) : null}
          {list.status === "loading" ? (
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="Loading walkthroughs"
            />
          ) : null}
          {list.status === "error" ? (
            <EmptyState
              icon={
                <ClipboardDocumentListIcon size={48} color={colors.muted} />
              }
              title="Couldn’t load walkthroughs"
              description="Please reopen this screen to try again."
            />
          ) : null}
          {list.status === "ready" && !list.walkthroughs.length ? (
            <EmptyState
              icon={
                <ClipboardDocumentListIcon size={48} color={colors.muted} />
              }
              title="No walkthroughs yet"
              description="Tap the plus button to start your first walkthrough."
              compact
            />
          ) : null}
          {list.status === "ready" ? list.walkthroughs.map(card) : null}
        </ScrollView>
        {selected !== null ? (
          <View style={styles.selectionActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected(null)}
              style={styles.selectionButton}
            >
              <AppText>Cancel</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!selected.length}
              onPress={() => setPickerOpen(true)}
              style={[
                styles.selectionButton,
                styles.moveButton,
                !selected.length && styles.disabled,
              ]}
            >
              <AppText style={styles.white}>
                Move to project ({selected.length})
              </AppText>
            </Pressable>
          </View>
        ) : list.status === "ready" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New walkthrough"
            onPress={() => router.push("/walkthrough/edit")}
            style={styles.floatingAction}
          >
            <PlusIcon size={28} color={colors.onAccent} />
          </Pressable>
        ) : null}
      </View>
      {ownerId && list.status === "ready" ? (
        <ProjectPicker
          visible={pickerOpen}
          ownerId={ownerId}
          projects={list.projects}
          walkthroughIds={selected ?? []}
          canRemoveFromProject={list.walkthroughs.some(
            (entry) => selected?.includes(entry.id) && !!entry.projectId,
          )}
          onClose={() => setPickerOpen(false)}
          onMoved={() => {
            setPickerOpen(false);
            setSelected(null);
            setRevision((value) => value + 1);
          }}
        />
      ) : null}
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
  headingGroup: { gap: 8 },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectAll: { color: colors.accent },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subheading: { color: colors.muted, lineHeight: 22 },
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
  projectMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  projectName: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  itemCount: { flexShrink: 0 },
  meta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  metaText: {
    color: colors.onAccent,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: colors.onAccent,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectionActions: { flexDirection: "row", gap: 10, padding: 16 },
  selectionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  moveButton: { backgroundColor: colors.accent },
  disabled: { opacity: 0.5 },
  white: { color: colors.onAccent },
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
