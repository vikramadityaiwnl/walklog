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
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { AppHeader } from "../../../components/app-header";
import { AppText } from "../../../components/app-text";
import { EmptyState } from "../../../components/empty-state";
import { LoadingState } from "../../../components/loading-state";
import { Overlay } from "../../../components/overlay";
import { ProjectPicker } from "../../../components/project-picker";
import type { Project, Walkthrough } from "../../../models/walkthrough";
import { bannerColor } from "../../../utils/banner-illustrations";
import { BannerIllustration } from "../../../components/banner-illustration";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";
import {
  listItemEnter,
  listItemExit,
  listItemLayout,
} from "../../../utils/list-motion";
import Svg, {
  Defs,
  FeColorMatrix,
  Filter,
  Image as SvgImage,
} from "react-native-svg";

type ListState =
  | { status: "loading" | "error" }
  | {
      status: "ready";
      walkthroughs: Walkthrough[];
      projects: Project[];
      counts: Record<string, number>;
    };

interface Props {
  selected: boolean;
}

interface ArtworkProps {
  walkthrough: Walkthrough;
  muted: boolean;
}

const layoutTransition = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
const fadeIn = FadeIn.duration(140).reduceMotion(ReduceMotion.System);
const fadeOut = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

function SelectionIndicator(props: Props) {
  const selectedStyle = useAnimatedStyle(
    () => ({
      backgroundColor: withTiming(
        props.selected ? colors.accent : "transparent",
        { duration: 140, reduceMotion: ReduceMotion.System },
      ),
      borderColor: withTiming(
        props.selected ? colors.accent : colors.onAccent,
        { duration: 140, reduceMotion: ReduceMotion.System },
      ),
    }),
    [props.selected],
  );

  return (
    <Animated.View
      entering={fadeIn}
      exiting={fadeOut}
      style={[styles.checkbox, selectedStyle]}
    >
      {props.selected ? (
        <Animated.View entering={fadeIn} exiting={fadeOut}>
          <CheckIcon size={16} color={colors.onAccent} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function WalkthroughArtwork(props: ArtworkProps) {
  const grayscaleStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(props.muted ? 1 : 0, {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [props.muted],
  );

  return (
    <>
      <View pointerEvents="none" style={styles.artwork}>
        {props.walkthrough.bannerPhotoUri ? (
          <Image
            source={{ uri: props.walkthrough.bannerPhotoUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <BannerIllustration
            illustration={props.walkthrough.bannerIllustration}
          />
        )}
      </View>

      <Animated.View
        pointerEvents="none"
        style={[styles.grayscaleArtwork, grayscaleStyle]}
      >
        {props.walkthrough.bannerPhotoUri ? (
          <Svg width="100%" height="100%">
            <Defs>
              <Filter id="grayscale">
                <FeColorMatrix type="saturate" values="0" />
              </Filter>
            </Defs>

            <SvgImage
              href={{ uri: props.walkthrough.bannerPhotoUri }}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid slice"
              filter="url(#grayscale)"
            />
          </Svg>
        ) : (
          <BannerIllustration
            illustration={props.walkthrough.bannerIllustration}
          />
        )}
      </Animated.View>
    </>
  );
}

export default function Walkthroughs() {
  const navigation = useNavigation();

  const auth = useAuthStore((state) => state.auth);

  const firestoreRevision = useFirestoreStore((state) => state.revision);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [list, setList] = useState<ListState>({ status: "loading" });
  const [selected, setSelected] = useState<string[] | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  const selectionHeaderStyle = useAnimatedStyle(
    () => ({
      height: withTiming(selected !== null ? 24 : 0, {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      }),
      marginTop: withTiming(selected !== null ? 18 : 0, {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      }),
      opacity: withTiming(selected !== null ? 1 : 0, {
        duration: 220,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [selected !== null],
  );

  useLayoutEffect(() => {
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
      <Animated.View
        key={walkthrough.id}
        collapsable={false}
        entering={listItemEnter}
        exiting={listItemExit}
        layout={listItemLayout}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${selected !== null ? "Select" : "Open"} ${walkthrough.title}`}
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
          <WalkthroughArtwork
            walkthrough={walkthrough}
            muted={selected !== null && !isSelected}
          />
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
              <SelectionIndicator selected={isSelected} />
            ) : (
              <Animated.View entering={fadeIn} exiting={fadeOut}>
                <ChevronRightIcon size={22} color={colors.onAccent} />
              </Animated.View>
            )}
          </View>
        </Pressable>
      </Animated.View>
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
          <View>
            <View style={styles.headingGroup}>
              <AppText variant="title" style={styles.heading}>
                Walkthroughs
              </AppText>

              <AppText style={styles.subheading}>
                A clear record of every site visit.
              </AppText>
            </View>

            <Animated.View
              style={[styles.selectionHeaderContainer, selectionHeaderStyle]}
              pointerEvents={selected !== null ? "auto" : "none"}
              accessibilityElementsHidden={selected === null}
              importantForAccessibility={
                selected === null ? "no-hide-descendants" : "auto"
              }
            >
              {list.status === "ready" ? (
                <View style={styles.selectionHeader}>
                  <AppText weight="semibold">
                    {selected?.length ?? 0} selected
                  </AppText>

                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      setSelected(
                        selected?.length === list.walkthroughs.length
                          ? []
                          : list.walkthroughs.map((entry) => entry.id),
                      )
                    }
                  >
                    <AppText style={styles.selectAll} weight="semibold">
                      {selected?.length === list.walkthroughs.length
                        ? "Deselect all"
                        : "Select all"}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}
            </Animated.View>
          </View>

          {list.status === "loading" ? <LoadingState /> : null}

          {list.status === "error" ? (
            <EmptyState
              icon={
                <ClipboardDocumentListIcon size={48} color={colors.muted} />
              }
              title="Couldn’t load walkthroughs"
              description="Please reopen this screen to try again."
            />
          ) : null}

          {list.status === "ready" ? (
            <View
              style={[
                styles.cards,
                !list.walkthroughs.length && styles.emptyCards,
              ]}
            >
              {!list.walkthroughs.length ? (
                <EmptyState
                  icon={
                    <ClipboardDocumentListIcon size={48} color={colors.muted} />
                  }
                  title="No walkthroughs yet"
                  description="Tap the plus button to start your first walkthrough."
                  compact
                />
              ) : null}

              {list.walkthroughs.map(card)}
            </View>
          ) : null}
        </ScrollView>

        {selected !== null ? (
          <Animated.View
            entering={FadeInDown.duration(220).reduceMotion(
              ReduceMotion.System,
            )}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.selectionActions}
          >
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
          </Animated.View>
        ) : list.status === "ready" ? (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            style={styles.floatingAction}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="New walkthrough"
              onPress={() => router.push("/walkthrough/edit")}
              style={styles.floatingButton}
            >
              <PlusIcon size={28} color={colors.onAccent} />
            </Pressable>
          </Animated.View>
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
  cards: { gap: 18 },
  emptyCards: { flex: 1 },
  selectionHeaderContainer: { overflow: "hidden" },
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
  artwork: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: bannerColor,
  },
  grayscaleArtwork: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#666666",
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
  selectionActions: { flexDirection: "row", gap: 10, padding: 16 },
  selectionButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  moveButton: {
    flex: 2,
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
  },
  disabled: { opacity: 0.5 },
  white: { color: colors.onAccent },
  floatingAction: {
    position: "absolute",
    right: 24,
    bottom: 24,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
