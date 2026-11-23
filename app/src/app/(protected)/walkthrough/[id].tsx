import { Image } from "expo-image";
import { useCallback, useState } from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import {
  ClipboardDocumentListIcon,
  MapPinIcon,
  WrenchScrewdriverIcon,
  PlusIcon,
  CheckIcon,
  DocumentTextIcon,
} from "react-native-heroicons/outline";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { ScreenBanner } from "../../../components/screen-banner";
import { LoadingState } from "../../../components/loading-state";
import { bannerColor } from "../../../utils/banner-illustrations";
import { SafeAreaView } from "react-native-safe-area-context";
import { Badge } from "../../../components/badge";
import { EmptyState } from "../../../components/empty-state";
import { AppText } from "../../../components/app-text";
import type { PunchItem, Walkthrough } from "../../../models/walkthrough";
import { deleteItemPhotos } from "../../../services/walkthrough/photos";
import { useDialogStore } from "../../../store/dialog-store";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; walkthrough: Walkthrough; items: PunchItem[] };

type Selection =
  { status: "inactive" } | { status: "selecting" | "saving"; ids: string[] };

export default function WalkthroughDetail() {
  const { id, fromProjectId } = useLocalSearchParams<{
    id: string;
    fromProjectId?: string;
  }>();

  const auth = useAuthStore((state) => state.auth);
  const firestoreRevision = useFirestoreStore((state) => state.revision);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [screen, setScreen] = useState<ScreenState>({ status: "loading" });
  const [selection, setSelection] = useState<Selection>({ status: "inactive" });

  const showDialog = useDialogStore((state) => state.showDialog);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId || !id) return;

      let active = true;
      const storage = createWalkthroughStorage(ownerId);
      void Promise.all([storage.getWalkthrough(id), storage.listItems(id)])
        .then(([walkthrough, items]) => {
          if (active)
            setScreen(
              walkthrough
                ? { status: "ready", walkthrough, items }
                : {
                    status: "error",
                    message: "This walkthrough could not be found.",
                  },
            );
        })
        .catch(() => {
          if (active)
            setScreen({
              status: "error",
              message: "Couldn’t load this walkthrough.",
            });
        });

      return () => {
        active = false;
      };
    }, [ownerId, id, firestoreRevision]),
  );

  function toggleSelection(itemId: string) {
    setSelection((current) => {
      if (current.status === "saving") return current;
      if (current.status === "inactive")
        return { status: "selecting", ids: [itemId] };

      return {
        status: "selecting",
        ids: current.ids.includes(itemId)
          ? current.ids.filter((id) => id !== itemId)
          : [...current.ids, itemId],
      };
    });
  }

  async function updateSelected() {
    if (
      !ownerId ||
      screen.status !== "ready" ||
      selection.status !== "selecting" ||
      !selection.ids.length
    )
      return;

    const selectedItems = screen.items.filter((item) =>
      selection.ids.includes(item.id),
    );
    const status: PunchItem["status"] = selectedItems.every(
      (item) => item.status === "Done",
    )
      ? "Open"
      : "Done";
    const updated = selectedItems.map((item) => ({
      ...item,
      status,
      updatedAt: Date.now(),
    }));
    setSelection({ ...selection, status: "saving" });
    try {
      await createWalkthroughStorage(ownerId).updateItems(updated);
      setScreen((current) =>
        current.status === "ready"
          ? {
              ...current,
              items: current.items.map(
                (item) => updated.find((entry) => entry.id === item.id) ?? item,
              ),
            }
          : current,
      );
      setSelection({ status: "inactive" });
    } catch {
      setSelection({ ...selection, status: "selecting" });
      showDialog("Couldn’t update items", "Please try again.");
    }
  }

  function confirmDelete() {
    if (
      !ownerId ||
      screen.status !== "ready" ||
      selection.status !== "selecting" ||
      !selection.ids.length
    )
      return;

    const selectedItems = screen.items.filter((item) =>
      selection.ids.includes(item.id),
    );
    showDialog(
      selectedItems.length === 1
        ? "Delete item?"
        : `Delete ${selectedItems.length} items?`,
      "This also deletes their photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setSelection({ ...selection, status: "saving" });
              try {
                await createWalkthroughStorage(ownerId).deleteItems(
                  selection.ids,
                );
                setScreen((current) =>
                  current.status === "ready"
                    ? {
                        ...current,
                        items: current.items.filter(
                          (item) => !selection.ids.includes(item.id),
                        ),
                      }
                    : current,
                );
                setSelection({ status: "inactive" });
                await deleteItemPhotos(
                  selectedItems.flatMap((item) => [
                    ...item.photos,
                    ...(item.bannerPhotoUri
                      ? [{ localUri: item.bannerPhotoUri }]
                      : []),
                  ]),
                ).catch(() => {});
              } catch {
                setSelection({ ...selection, status: "selecting" });
                showDialog("Couldn’t delete items", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }

  const selecting = selection.status !== "inactive";
  const selectedIds = selecting ? selection.ids : [];
  const allDone =
    screen.status === "ready" &&
    selectedIds.length > 0 &&
    screen.items
      .filter((item) => selectedIds.includes(item.id))
      .every((item) => item.status === "Done");

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
              title={screen.walkthrough.title}
              subtitle={
                [screen.walkthrough.clientName, screen.walkthrough.address]
                  .filter(Boolean)
                  .join(" · ") || undefined
              }
              color={bannerColor}
              imageUri={screen.walkthrough.bannerPhotoUri}
              bannerIllustration={screen.walkthrough.bannerIllustration}
              action="settings"
              onAction={() =>
                router.push({
                  pathname: "/walkthrough/settings",
                  params: { id, fromProjectId },
                })
              }
            />

            <View
              style={[
                styles.content,
                screen.items.length === 0 && styles.emptyContent,
              ]}
            >
              {!selecting && screen.items.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open walkthrough report"
                  onPress={() =>
                    router.push({
                      pathname: "/walkthrough/report",
                      params: { id },
                    } as Href)
                  }
                  style={styles.reportLink}
                >
                  <DocumentTextIcon size={20} color={colors.accent} />

                  <View style={styles.reportText}>
                    <AppText weight="semibold">Walkthrough report</AppText>

                    <AppText style={styles.reportHint}>
                      View or share a PDF
                    </AppText>
                  </View>
                </Pressable>
              ) : null}

              {selecting ? (
                <View style={styles.selectionHeader}>
                  <AppText weight="semibold">{`${selectedIds.length} selected`}</AppText>

                  <Pressable
                    accessibilityRole="button"
                    disabled={selection.status === "saving"}
                    onPress={() =>
                      setSelection({
                        status: "selecting",
                        ids:
                          selectedIds.length === screen.items.length
                            ? []
                            : screen.items.map((item) => item.id),
                      })
                    }
                  >
                    <AppText weight="semibold" style={styles.selectAll}>
                      {selectedIds.length === screen.items.length
                        ? "Deselect all"
                        : "Select all"}
                    </AppText>
                  </Pressable>
                </View>
              ) : null}

              {screen.items.length === 0 ? (
                <EmptyState
                  icon={
                    <ClipboardDocumentListIcon size={48} color={colors.muted} />
                  }
                  title="No items yet"
                  description="Add an item to start documenting this walkthrough."
                  compact
                />
              ) : (
                <View>
                  {screen.items.map((item, index) => (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open item ${item.issueSummary}, ${item.status}, ${item.priority ? `${item.priority} priority` : ""}`}
                      accessibilityState={{
                        selected: selecting && selectedIds.includes(item.id),
                        disabled: selection.status === "saving",
                      }}
                      disabled={selection.status === "saving"}
                      onLongPress={() => toggleSelection(item.id)}
                      onPress={() => {
                        if (selecting) toggleSelection(item.id);
                        else
                          router.push({
                            pathname: "/walkthrough/item-view",
                            params: { walkthroughId: id, id: item.id },
                          });
                      }}
                      style={[
                        styles.itemRow,
                        index < screen.items.length - 1 && styles.itemDivider,
                      ]}
                    >
                      <View style={styles.row}>
                        {selecting ? (
                          <View
                            style={[
                              styles.checkbox,
                              selectedIds.includes(item.id) &&
                                styles.checkboxSelected,
                            ]}
                          >
                            {selectedIds.includes(item.id) ? (
                              <CheckIcon size={14} color={colors.onAccent} />
                            ) : null}
                          </View>
                        ) : null}

                        {item.bannerPhotoUri ? (
                          <Image
                            source={{ uri: item.bannerPhotoUri }}
                            style={styles.bannerThumbnail}
                          />
                        ) : null}

                        <View style={styles.itemText}>
                          <AppText weight="bold" style={styles.cardTitle}>
                            {item.issueSummary}
                          </AppText>

                          <View style={styles.metadata}>
                            <View style={styles.metadataItem}>
                              <MapPinIcon size={15} color={colors.muted} />

                              <AppText style={styles.metadataText}>
                                {item.location || "Unspecified area"}
                              </AppText>
                            </View>

                            {item.trade ? (
                              <View style={styles.metadataItem}>
                                <WrenchScrewdriverIcon
                                  size={15}
                                  color={colors.muted}
                                />

                                <AppText style={styles.metadataText}>
                                  {item.trade}
                                </AppText>
                              </View>
                            ) : null}
                          </View>

                          <View style={styles.badges}>
                            <Badge
                              label={item.status}
                              tone={item.status === "Done" ? "success" : "info"}
                            />

                            {item.priority ? (
                              <Badge
                                label={item.priority}
                                tone={
                                  item.priority === "High"
                                    ? "danger"
                                    : item.priority === "Medium"
                                      ? "warning"
                                      : "info"
                                }
                              />
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {selecting ? (
        <View style={styles.selectionActions}>
          <Pressable
            accessibilityRole="button"
            disabled={selection.status === "saving"}
            onPress={() => setSelection({ status: "inactive" })}
            style={styles.selectionButton}
          >
            <AppText weight="semibold" style={styles.selectionText}>
              Cancel
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={selection.status === "saving" || !selectedIds.length}
            onPress={confirmDelete}
            style={[
              styles.selectionButton,
              !selectedIds.length && styles.disabledAction,
            ]}
          >
            <AppText
              weight="semibold"
              style={[styles.selectionText, styles.deleteText]}
            >
              Delete
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={selection.status === "saving" || !selectedIds.length}
            onPress={updateSelected}
            style={[
              styles.selectionButton,
              styles.primaryAction,
              !selectedIds.length && styles.disabledAction,
            ]}
          >
            <AppText
              weight="semibold"
              style={[styles.selectionText, styles.primaryText]}
            >
              {allDone ? "Mark open" : "Mark done"}
            </AppText>
          </Pressable>
        </View>
      ) : screen.status === "ready" ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add items"
          onPress={() =>
            router.push({
              pathname: "/walkthrough/capture",
              params: { walkthroughId: id },
            })
          }
          style={styles.floatingAction}
        >
          <PlusIcon size={28} color={colors.onAccent} />
        </Pressable>
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
  reportLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  reportText: { flex: 1, gap: 2 },
  reportHint: { color: colors.muted, fontSize: 13 },
  label: { fontSize: 14 },
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
  emptyContent: { flexGrow: 1 },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  selectAll: { color: colors.accent, fontSize: 14 },
  selectionActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  selectionButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  selectionText: { fontSize: 14 },
  deleteText: { color: colors.danger },
  primaryAction: { backgroundColor: colors.accent },
  primaryText: { color: colors.onAccent },
  disabledAction: { opacity: 0.45 },
  checkbox: {
    height: 22,
    width: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  itemRow: { paddingVertical: 16 },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bannerThumbnail: { width: 60, height: 60, borderRadius: 10 },
  itemText: { flex: 1, gap: 8 },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: 16,
    rowGap: 6,
  },
  metadataItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
  },
  metadataText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
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
