import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ClipboardDocumentListIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "../../../components/avatar";
import { AppHeader } from "../../../components/app-header";
import { AppText } from "../../../components/app-text";
import { EmptyState } from "../../../components/empty-state";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { Walkthrough } from "../../../models/walkthrough";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";
import { colors } from "../../../theme";

type ListState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      walkthroughs: Walkthrough[];
      counts: Record<string, number>;
    };

export default function Walkthroughs() {
  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [list, setList] = useState<ListState>({ status: "loading" });

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!ownerId) return;

      setList({ status: "loading" });
      const storage = createWalkthroughStorage(ownerId);
      void (async () => {
        try {
          const walkthroughs = await storage.listWalkthroughs();
          const counts = Object.fromEntries(
            await Promise.all(
              walkthroughs.map(
                async (walkthrough) =>
                  [
                    walkthrough.id,
                    (await storage.listItems(walkthrough.id)).length,
                  ] as const,
              ),
            ),
          );

          if (active) setList({ status: "ready", walkthroughs, counts });
        } catch {
          if (active) setList({ status: "error" });
        }
      })();

      return () => {
        active = false;
      };
    }, [ownerId]),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />

      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.content, screenStyles.content]}
        >
          <View style={styles.section}>
            <AppText variant="title" style={styles.heading}>
              Walkthroughs
            </AppText>

            <AppText style={styles.subheading}>
              A clear record of every site visit.
            </AppText>
          </View>

          {list.status === "loading" ? (
            <View style={screenStyles.loading}>
              <ActivityIndicator
                color={colors.accent}
                accessibilityLabel="Loading walkthroughs"
              />
            </View>
          ) : null}

          {list.status === "error" ? (
            <EmptyState
              icon={
                <View style={screenStyles.errorIcon}>
                  <ExclamationTriangleIcon size={30} color={colors.danger} />
                </View>
              }
              title="Couldn’t load walkthroughs"
              description="Something went wrong. Please reopen this screen to try again."
            />
          ) : null}

          {list.status === "ready" && list.walkthroughs.length === 0 ? (
            <EmptyState
              icon={
                <ClipboardDocumentListIcon size={48} color={colors.muted} />
              }
              title="No walkthroughs yet"
              description="Tap the plus button to start your first walkthrough."
              compact
            />
          ) : null}

          {list.status === "ready"
            ? list.walkthroughs.map((walkthrough) => (
                <Pressable
                  key={walkthrough.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${walkthrough.title}`}
                  onPress={() =>
                    router.push({
                      pathname: "/walkthrough/[id]",
                      params: { id: walkthrough.id },
                    })
                  }
                  style={styles.card}
                >
                  <View style={styles.row}>
                    {walkthrough.bannerPhotoUri ? (
                      <Image
                        source={{ uri: walkthrough.bannerPhotoUri }}
                        style={screenStyles.bannerThumbnail}
                      />
                    ) : (
                      <Avatar name={walkthrough.title} size="small" />
                    )}

                    <View style={{ flex: 1, gap: 5 }}>
                      <AppText weight="bold" style={styles.cardTitle}>
                        {walkthrough.title}
                      </AppText>

                      {walkthrough.clientName || walkthrough.address ? (
                        <AppText style={styles.subheading}>
                          {[walkthrough.clientName, walkthrough.address]
                            .filter(Boolean)
                            .join(" · ")}
                        </AppText>
                      ) : null}

                      <AppText style={styles.subheading}>
                        {list.counts[walkthrough.id]}{" "}
                        {list.counts[walkthrough.id] === 1 ? "item" : "items"}
                      </AppText>
                    </View>

                    <ChevronRightIcon size={20} color={colors.muted} />
                  </View>
                </Pressable>
              ))
            : null}
        </ScrollView>

        {list.status === "ready" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New walkthrough"
            onPress={() => router.push("/walkthrough/edit")}
            style={screenStyles.floatingAction}
          >
            <PlusIcon size={28} color={colors.onAccent} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  content: { flexGrow: 1, paddingBottom: 100 },
  bannerThumbnail: { width: 48, height: 48, borderRadius: 12 },
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
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
  },
});
