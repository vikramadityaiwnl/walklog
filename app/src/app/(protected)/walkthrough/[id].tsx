import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { PaperClipIcon, Cog6ToothIcon } from "react-native-heroicons/outline";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
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
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, screenStyles.content]}
      >
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
            <View style={styles.between}>
              <View style={{ flex: 1, gap: 5 }}>
                <AppText variant="title" style={styles.heading}>
                  {screen.walkthrough.title}
                </AppText>

                {screen.walkthrough.clientName || screen.walkthrough.address ? (
                  <AppText style={styles.subheading}>
                    {[screen.walkthrough.clientName, screen.walkthrough.address]
                      .filter(Boolean)
                      .join(" · ")}
                  </AppText>
                ) : null}
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Walkthrough settings"
                hitSlop={10}
                onPress={() =>
                  router.push({
                    pathname: "/walkthrough/settings",
                    params: { id },
                  })
                }
                style={screenStyles.settings}
              >
                <Cog6ToothIcon size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {screen.items.length === 0 ? (
              <AppText style={styles.subheading}>
                No items yet. Add an observation to get started.
              </AppText>
            ) : null}

            {screen.items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Open item ${item.issueSummary}`}
                onPress={() =>
                  router.push({
                    pathname: "/walkthrough/item-view",
                    params: { walkthroughId: id, id: item.id },
                  })
                }
                style={styles.card}
              >
                <AppText weight="bold" style={styles.cardTitle}>
                  {item.issueSummary}
                </AppText>

                <AppText style={styles.subheading}>
                  {item.location || "Unspecified area"} · {item.trade}
                </AppText>

                <View style={styles.between}>
                  <AppText style={styles.link}>
                    {item.priority} priority
                  </AppText>

                  <View style={screenStyles.attachments}>
                    <PaperClipIcon size={16} color={colors.muted} />

                    <AppText style={screenStyles.attachmentText}>
                      {item.photos.length}{" "}
                      {item.photos.length === 1 ? "attachment" : "attachments"}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={screenStyles.actions}>
        {screen.status === "ready" ? (
          <AppButton
            title="+ Add item"
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
  settings: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  attachments: { flexDirection: "row", alignItems: "center", gap: 4 },
  attachmentText: { color: colors.muted, fontSize: 13 },
  actions: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
});
