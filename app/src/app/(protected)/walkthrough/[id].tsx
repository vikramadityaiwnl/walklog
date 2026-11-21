import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  ClipboardDocumentListIcon,
  PaperClipIcon,
  PlusIcon,
} from "react-native-heroicons/outline";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { ScreenBanner } from "../../../components/screen-banner";
import { getBannerColor } from "../../../services/banner-colors";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { Badge } from "../../../components/badge";
import { EmptyState } from "../../../components/empty-state";
import { AppText } from "../../../components/app-text";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { PunchItem, Walkthrough } from "../../../models/walkthrough";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; walkthrough: Walkthrough; items: PunchItem[] };

export default function WalkthroughDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [screen, setScreen] = useState<ScreenState>({ status: "loading" });

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
    }, [ownerId, id]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style={screen.status === "ready" ? "light" : "dark"} />

      <ScrollView contentContainerStyle={screenStyles.content}>
        {screen.status === "loading" ? (
          <View style={screenStyles.loading}>
            <ActivityIndicator
              color={colors.accent}
              accessibilityLabel="Loading walkthrough"
            />
          </View>
        ) : null}

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
              color={getBannerColor(
                screen.walkthrough.id,
                screen.walkthrough.bannerColor,
              )}
              imageUri={screen.walkthrough.bannerPhotoUri}
              action="settings"
              onAction={() =>
                router.push({
                  pathname: "/walkthrough/settings",
                  params: { id },
                })
              }
            />

            <View
              style={[
                styles.content,
                screen.items.length === 0 && screenStyles.emptyContent,
              ]}
            >
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
                      accessibilityLabel={`Open item ${item.issueSummary}, ${item.status}, ${item.priority} priority, ${item.photos.length} ${item.photos.length === 1 ? "attachment" : "attachments"}`}
                      onPress={() =>
                        router.push({
                          pathname: "/walkthrough/item-view",
                          params: { walkthroughId: id, id: item.id },
                        })
                      }
                      style={[
                        screenStyles.itemRow,
                        index < screen.items.length - 1 &&
                          screenStyles.itemDivider,
                      ]}
                    >
                      <View style={styles.row}>
                        {item.bannerPhotoUri ? (
                          <Image
                            source={{ uri: item.bannerPhotoUri }}
                            style={screenStyles.bannerThumbnail}
                          />
                        ) : null}

                        <View style={screenStyles.itemText}>
                          <AppText weight="bold" style={styles.cardTitle}>
                            {item.issueSummary}
                          </AppText>

                          <AppText style={styles.subheading}>
                            {item.location || "Unspecified area"} · {item.trade}
                          </AppText>

                          <View style={screenStyles.badges}>
                            <Badge
                              label={item.status}
                              tone={item.status === "Done" ? "success" : "info"}
                            />

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

                            <Badge
                              label={String(item.photos.length)}
                              accessibilityLabel={`${item.photos.length} ${item.photos.length === 1 ? "attachment" : "attachments"}`}
                              icon={
                                <PaperClipIcon size={14} color={colors.muted} />
                              }
                            />
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

      <View style={screenStyles.actions}>
        {screen.status === "ready" ? (
          <AppButton
            title="Add item"
            icon={
              <PlusIcon size={20} strokeWidth={2.2} color={colors.onAccent} />
            }
            onPress={() =>
              router.push({
                pathname: "/walkthrough/item",
                params: { walkthroughId: id },
              })
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  content: { flexGrow: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyContent: { flexGrow: 1 },
  itemRow: { paddingVertical: 16 },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bannerThumbnail: { width: 60, height: 60, borderRadius: 10 },
  itemText: { flex: 1, gap: 8 },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
});
