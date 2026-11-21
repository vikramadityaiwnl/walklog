import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import {
  ClipboardDocumentListIcon,
  ChevronRightIcon,
} from "react-native-heroicons/outline";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.section}>
            <AppText variant="title" style={styles.heading}>
              Walkthroughs
            </AppText>
            <AppText style={styles.subheading}>
              A clear record of every site visit.
            </AppText>
          </View>
          {list.status === "loading" ? (
            <AppText>Loading walkthroughs…</AppText>
          ) : null}
          {list.status === "error" ? (
            <AppText accessibilityRole="alert" style={styles.error}>
              Couldn’t load walkthroughs. Please reopen this screen.
            </AppText>
          ) : null}
          {list.status === "ready" && list.walkthroughs.length === 0 ? (
            <EmptyState
              icon={
                <ClipboardDocumentListIcon size={48} color={colors.accent} />
              }
              title="Your first walkthrough starts here"
              description="Capture notes and photos on site, then turn them into a clear list of work."
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
                  <View style={styles.between}>
                    <AppText weight="bold" style={styles.cardTitle}>
                      {walkthrough.title}
                    </AppText>
                    <ChevronRightIcon size={20} color={colors.muted} />
                  </View>
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
                </Pressable>
              ))
            : null}
        </ScrollView>

        <View style={{ paddingHorizontal: 24, paddingBottom: 20 }}>
          <AppButton
            title="+ New walkthrough"
            onPress={() => router.push("/walkthrough/edit")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
