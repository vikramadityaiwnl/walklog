import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  DocumentTextIcon,
  EyeIcon,
  ShareIcon,
} from "react-native-heroicons/outline";
import { AppText } from "../../../components/app-text";
import { AppButton } from "../../../components/app-button";
import { LoadingState } from "../../../components/loading-state";
import { ErrorState } from "../../../components/error-state";
import { EmptyState } from "../../../components/empty-state";
import { useAuthStore } from "../../../store/auth-store";
import { createWalkthroughStorage } from "../../../services/walkthrough/storage";
import { generateReport } from "../../../services/report/generate-report";
import type { PunchItem, Walkthrough } from "../../../models/walkthrough";
import { colors } from "../../../theme";
import { formFadeIn, formFadeOut } from "../../../utils/form-motion";

type Screen =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      walkthrough: Walkthrough;
      items: PunchItem[];
      operation?: "view" | "share";
      message?: string;
    };

export default function WalkthroughReport() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const auth = useAuthStore((state) => state.auth);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;

  const [screen, setScreen] = useState<Screen>({ status: "loading" });
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => {
    if (!ownerId || !id) return;

    let active = true;

    const storage = createWalkthroughStorage(ownerId);
    void Promise.all([storage.getWalkthrough(id), storage.listItems(id)])
      .then(([walkthrough, items]) => {
        if (!active) return;

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
  }, [ownerId, id, loadRevision]);

  async function openReport(operation: "view" | "share") {
    if (!ownerId || !id || screen.status !== "ready" || screen.operation)
      return;

    setScreen({ ...screen, operation, message: undefined });
    try {
      const storage = createWalkthroughStorage(ownerId);
      const [walkthrough, items] = await Promise.all([
        storage.getWalkthrough(id),
        storage.listItems(id),
      ]);
      if (!walkthrough) throw new Error("This walkthrough could not be found.");

      if (operation === "share" && !(await Sharing.isAvailableAsync()))
        throw new Error("Sharing is unavailable on this device.");

      const uri = await generateReport(walkthrough, items, ownerId);
      if (operation === "view") {
        const file = new File(uri);
        if (!(await file.canPreview({ mimeType: "application/pdf" })))
          throw new Error(
            "No PDF viewer is available on this device. You can share the report instead.",
          );
        await file.preview({
          mimeType: "application/pdf",
          title: walkthrough.title,
        });
      } else {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          UTI: "com.adobe.pdf",
          dialogTitle: "Share report",
        });
      }
      setScreen({ status: "ready", walkthrough, items });
    } catch (error) {
      setScreen((current) =>
        current.status === "ready"
          ? {
              ...current,
              operation: undefined,
              message:
                error instanceof Error
                  ? error.message
                  : "Couldn’t prepare your report. Please try again.",
            }
          : current,
      );
    }
  }

  if (screen.status === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (screen.status === "error") {
    return (
      <ErrorState
        title="Couldn’t load report"
        description={screen.message}
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

  const openCount = screen.items.filter(
    (item) => item.status === "Open",
  ).length;
  const doneCount = screen.items.length - openCount;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <AppText variant="title" style={styles.title}>
            Walkthrough report
          </AppText>

          <AppText style={styles.description}>
            A PDF of your walkthrough, ready to review or share.
          </AppText>
        </View>

        <Animated.View entering={formFadeIn} style={styles.report}>
          <View style={styles.reportIcon}>
            <DocumentTextIcon size={24} color={colors.accent} />
          </View>

          <View style={styles.reportInfo}>
            <AppText weight="semibold" style={styles.reportTitle}>
              {screen.walkthrough.title}
            </AppText>

            <AppText style={styles.description}>
              {[screen.walkthrough.clientName, screen.walkthrough.address]
                .filter(Boolean)
                .join(" · ") || "Walkthrough report"}
            </AppText>
          </View>
        </Animated.View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <AppText weight="bold" style={styles.statValue}>
              {screen.items.length}
            </AppText>

            <AppText style={styles.statLabel}>Items</AppText>
          </View>

          <View style={styles.stat}>
            <AppText weight="bold" style={styles.statValue}>
              {openCount}
            </AppText>

            <AppText style={styles.statLabel}>Open</AppText>
          </View>

          <View style={styles.stat}>
            <AppText weight="bold" style={styles.statValue}>
              {doneCount}
            </AppText>

            <AppText style={styles.statLabel}>Done</AppText>
          </View>
        </View>

        <AppText style={styles.hint}>
          The report includes item details, photos and suggested actions,
          grouped by location.
        </AppText>

        {screen.message ? (
          <Animated.View entering={formFadeIn} exiting={formFadeOut}>
            <EmptyState
              variant="error"
              title="Report unavailable"
              description={screen.message}
              compact
              inline
            />
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.action}>
          <AppButton
            title={screen.operation === "view" ? "Preparing" : "View PDF"}
            variant="outline"
            icon={<EyeIcon size={19} color={colors.accent} />}
            disabled={!!screen.operation}
            onPress={() => void openReport("view")}
          />
        </View>

        <View style={styles.action}>
          <AppButton
            title={screen.operation === "share" ? "Preparing" : "Share PDF"}
            icon={<ShareIcon size={19} color={colors.onAccent} />}
            disabled={!!screen.operation}
            onPress={() => void openReport("share")}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 24,
  },
  heading: { gap: 6 },
  title: { fontSize: 30, lineHeight: 38 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  report: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 16,
  },
  reportIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: colors.accentFaint,
  },
  reportInfo: { flex: 1, gap: 4 },
  reportTitle: { fontSize: 16, lineHeight: 22 },
  stats: { flexDirection: "row", gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.accentFaint,
    padding: 14,
    borderRadius: 10,
    gap: 2,
  },
  statValue: { fontSize: 22, lineHeight: 28, color: colors.accent },
  statLabel: { fontSize: 13, color: colors.muted },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
});
