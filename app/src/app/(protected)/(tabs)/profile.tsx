import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ArrowDownTrayIcon,
  CloudArrowUpIcon,
  CloudIcon,
  CpuChipIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { AppButton } from "../../../components/app-button";
import { AppHeader } from "../../../components/app-header";
import { AppText } from "../../../components/app-text";
import { Avatar } from "../../../components/avatar";
import { Badge } from "../../../components/badge";
import { InferenceSelector } from "../../../components/inference-selector";
import { ErrorState } from "../../../components/error-state";
import {
  clearTemporaryCache,
  getTemporaryCacheSize,
} from "../../../services/device-cache";
import { signOutUser } from "../../../services/firebase/google-sign-in";
import {
  deleteWhisperModel,
  downloadWhisperModel,
  getWhisperModel,
  whisperModelSize,
} from "../../../services/whisper/model";
import { useAuthStore } from "../../../store/auth-store";
import { useDialogStore } from "../../../store/dialog-store";
import { useFirestoreStore } from "../../../store/firestore-store";
import { useMediaSyncStore } from "../../../store/media-sync-store";
import { colors } from "../../../theme";

type SignOutState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

type ModelState =
  | { status: "ready"; installed: boolean }
  | { status: "downloading"; bytes: number; total: number }
  | { status: "deleting" }
  | { status: "error"; installed: boolean; message: string };

type CacheState =
  | { status: "ready"; bytes: number }
  | { status: "clearing"; bytes: number }
  | { status: "error"; bytes: number; message: string };

function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;

  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export default function Profile() {
  const reducedMotion = useReducedMotion();
  const auth = useAuthStore((state) => state.auth);
  const pendingChanges = useFirestoreStore((state) => state.pending);
  const deletionsPending = useFirestoreStore((state) => state.deletionsPending);
  const deletionError = useFirestoreStore((state) => state.deletionError);
  const mediaStatus = useMediaSyncStore((state) => state.status);

  const [signingOut, setSigningOut] = useState<SignOutState>({
    status: "idle",
  });
  const [model, setModel] = useState<ModelState>({
    status: "ready",
    installed: !!getWhisperModel(),
  });
  const [cache, setCache] = useState<CacheState>({ status: "ready", bytes: 0 });
  const [howItWorksVisible, setHowItWorksVisible] = useState(false);

  const showDialog = useDialogStore((state) => state.showDialog);
  const downloadProgress =
    model.status === "downloading" && model.total > 0
      ? Math.min(model.bytes / model.total, 1)
      : 0;
  const progressStyle = useAnimatedStyle(
    () => ({
      width: withTiming(`${downloadProgress * 100}%`, {
        duration: 180,
        reduceMotion: ReduceMotion.System,
      }),
    }),
    [downloadProgress],
  );

  useFocusEffect(
    useCallback(() => {
      setModel({ status: "ready", installed: !!getWhisperModel() });
      setCache({ status: "ready", bytes: getTemporaryCacheSize() });
    }, []),
  );

  const showChangeSync = pendingChanges || mediaStatus !== "idle";
  const showDeletionSync = deletionsPending || Boolean(deletionError);
  const photoSyncError = mediaStatus === "error";
  const photoSyncWaiting = mediaStatus === "waiting";
  const changeSyncTitle = photoSyncError
    ? "Photo sync paused"
    : photoSyncWaiting
      ? "Waiting to sync photos"
      : pendingChanges
        ? "Syncing changes"
        : "Syncing photos";
  const changeSyncDescription = photoSyncError
    ? "Some photos couldn’t sync. We’ll retry automatically."
    : photoSyncWaiting
      ? "Photos will sync when they’re ready."
      : pendingChanges
        ? "Your walkthrough changes are being saved to the cloud."
        : "Your photos are being saved to the cloud.";

  function confirmSignOut() {
    showDialog("Sign out?", "You can sign back in to access your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void handleSignOut();
        },
      },
    ]);
  }

  async function handleSignOut() {
    setSigningOut({ status: "loading" });

    try {
      await signOutUser();
    } catch (error) {
      setSigningOut({
        status: "error",
        message: error instanceof Error ? error.message : "Sign-out failed.",
      });
    }
  }

  async function downloadModel() {
    setModel({ status: "downloading", bytes: 0, total: whisperModelSize });
    try {
      await downloadWhisperModel((bytes, total) =>
        setModel({ status: "downloading", bytes, total }),
      );
      setModel({ status: "ready", installed: true });
    } catch (error) {
      setModel({
        status: "error",
        installed: false,
        message:
          error instanceof Error
            ? error.message
            : "Couldn’t download the transcription model.",
      });
    }
  }

  function removeModel() {
    showDialog(
      "Delete transcription model?",
      `This removes the ${formatBytes(whisperModelSize)} speech model. You can download it again later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setModel({ status: "deleting" });
            try {
              deleteWhisperModel();
              setModel({ status: "ready", installed: false });
            } catch (error) {
              setModel({
                status: "error",
                installed: true,
                message:
                  error instanceof Error
                    ? error.message
                    : "Couldn’t delete the transcription model.",
              });
            }
          },
        },
      ],
    );
  }

  function clearCache() {
    setCache({ status: "clearing", bytes: cache.bytes });
    try {
      clearTemporaryCache();
      setCache({ status: "ready", bytes: getTemporaryCacheSize() });
    } catch (error) {
      setCache({
        status: "error",
        bytes: cache.bytes,
        message:
          error instanceof Error
            ? error.message
            : "Couldn’t clear temporary files.",
      });
    }
  }

  function confirmClearCache() {
    showDialog(
      "Clear temporary cache?",
      `Remove ${formatBytes(cache.bytes)} of temporary files? Saved walkthroughs and Firestore offline data will stay on this device.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear cache", style: "destructive", onPress: clearCache },
      ],
    );
  }

  if (auth.status !== "ready" || !auth.user) return null;

  const profileError =
    signingOut.status === "error"
      ? {
          title: "Couldn’t sign out",
          message: signingOut.message,
          dismiss: () => setSigningOut({ status: "idle" }),
        }
      : model.status === "error"
        ? {
            title: "Transcription model issue",
            message: model.message,
            dismiss: () =>
              setModel({ status: "ready", installed: model.installed }),
          }
        : cache.status === "error"
          ? {
              title: "Couldn’t clear temporary files",
              message: cache.message,
              dismiss: () => setCache({ status: "ready", bytes: cache.bytes }),
            }
          : null;

  if (profileError) {
    return (
      <ErrorState
        title={profileError.title}
        description={profileError.message}
        actions={[
          {
            title: "Go home",
            variant: "secondary",
            onPress: () => {
              profileError.dismiss();
              router.replace("/(protected)/(tabs)");
            },
          },
          { title: "Try again", onPress: profileError.dismiss },
        ]}
      />
    );
  }

  const modelBusy =
    model.status === "downloading" || model.status === "deleting";
  const modelInstalled =
    (model.status === "ready" || model.status === "error") && model.installed;
  const cacheBusy = cache.status === "clearing";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AppHeader />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <Avatar name={auth.user.displayName ?? ""} />

          <View style={styles.identityText}>
            <AppText variant="title" style={styles.name}>
              {auth.user.displayName ?? "Name unavailable"}
            </AppText>

            <AppText style={styles.email}>
              {auth.user.email ?? "Email unavailable"}
            </AppText>
          </View>
        </View>

        {showChangeSync || showDeletionSync ? (
          <Animated.View
            entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(140).reduceMotion(ReduceMotion.System)}
            layout={LinearTransition.duration(180).reduceMotion(
              ReduceMotion.System,
            )}
            style={styles.syncCards}
          >
            {showChangeSync ? (
              <View accessibilityRole="summary" style={styles.syncCard}>
                <View style={styles.syncIcon}>
                  <CloudArrowUpIcon
                    size={21}
                    color={
                      photoSyncError
                        ? colors.danger
                        : photoSyncWaiting
                          ? colors.warning
                          : colors.muted
                    }
                  />
                </View>

                <View style={styles.syncText}>
                  <AppText weight="semibold">{changeSyncTitle}</AppText>
                  <AppText style={styles.syncDescription}>
                    {changeSyncDescription}
                  </AppText>
                </View>

                {!photoSyncError && !photoSyncWaiting ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : null}
              </View>
            ) : null}

            {showDeletionSync ? (
              <View accessibilityRole="summary" style={styles.syncCard}>
                <View style={styles.syncIcon}>
                  <TrashIcon
                    size={20}
                    color={deletionError ? colors.danger : colors.muted}
                  />
                </View>

                <View style={styles.syncText}>
                  <AppText weight="semibold">
                    {deletionError
                      ? "Deletion sync paused"
                      : "Finishing deletions"}
                  </AppText>
                  <AppText style={styles.syncDescription}>
                    {deletionError
                      ? "Deletion cleanup paused. We’ll retry automatically."
                      : "Deleted records will be cleaned up when you’re online."}
                  </AppText>
                </View>

                {!deletionError ? (
                  <ActivityIndicator color={colors.muted} size="small" />
                ) : null}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={styles.sectionHeading}>
          <AppText weight="bold" style={styles.sectionTitle}>
            Inference
          </AppText>
        </View>

        <View style={styles.settingSection}>
          <View style={styles.settingTitleRow}>
            <View style={styles.settingIcon}>
              <CpuChipIcon size={20} color={colors.accent} />
            </View>

            <View style={styles.settingText}>
              <AppText weight="semibold">Choose a default</AppText>
              <AppText style={styles.settingDescription}>
                Walklog will use your choice when it’s available and switch to
                the other option when needed.
              </AppText>
            </View>
          </View>

          <InferenceSelector allowUnavailable />
        </View>

        <View style={styles.sectionHeading}>
          <AppText weight="bold" style={styles.sectionTitle}>
            Transcription
          </AppText>
        </View>

        <View style={styles.settingSection}>
          <View style={styles.settingTitleRow}>
            <View style={styles.settingIcon}>
              <MicrophoneIcon size={20} color={colors.accent} />
            </View>

            <View style={styles.settingText}>
              <AppText weight="semibold">Whisper tiny multilingual</AppText>
              <View style={styles.badges}>
                <Badge label={formatBytes(whisperModelSize)} />
                <Badge
                  label={
                    model.status === "downloading"
                      ? "Downloading"
                      : model.status === "deleting"
                        ? "Removing"
                        : modelInstalled
                          ? "Downloaded"
                          : "Not downloaded"
                  }
                  tone={
                    modelInstalled
                      ? "success"
                      : model.status === "downloading" ||
                          model.status === "deleting"
                        ? "warning"
                        : "neutral"
                  }
                />
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                modelInstalled
                  ? "Delete transcription model"
                  : "Download transcription model"
              }
              accessibilityState={{ disabled: modelBusy }}
              disabled={modelBusy}
              onPress={
                modelInstalled ? removeModel : () => void downloadModel()
              }
              style={({ pressed }) => [
                styles.iconAction,
                (pressed || modelBusy) && styles.actionDimmed,
              ]}
            >
              {modelInstalled ? (
                <TrashIcon size={19} color={colors.foreground} />
              ) : (
                <ArrowDownTrayIcon size={19} color={colors.foreground} />
              )}
            </Pressable>
          </View>

          {model.status === "downloading" ? (
            <Animated.View
              entering={FadeIn.duration(180).reduceMotion(ReduceMotion.System)}
              layout={LinearTransition.duration(180).reduceMotion(
                ReduceMotion.System,
              )}
              style={styles.progressSection}
            >
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressFill, progressStyle]} />
              </View>

              <AppText style={styles.settingDescription}>
                Downloading {formatBytes(model.bytes)} of{" "}
                {formatBytes(model.total)}
              </AppText>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.sectionHeading}>
          <AppText weight="bold" style={styles.sectionTitle}>
            Storage & cache
          </AppText>
        </View>

        <View style={styles.settingSection}>
          <View style={styles.settingTitleRow}>
            <View style={styles.settingIcon}>
              <CloudIcon size={20} color={colors.accent} />
            </View>

            <View style={styles.settingText}>
              <AppText weight="semibold">Temporary files</AppText>
              <View style={styles.cacheSizeBadge}>
                <Badge label={formatBytes(cache.bytes)} />
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear temporary cache"
              accessibilityState={{ disabled: cacheBusy || cache.bytes === 0 }}
              disabled={cacheBusy || cache.bytes === 0}
              onPress={confirmClearCache}
              style={({ pressed }) => [
                styles.iconAction,
                (pressed || cacheBusy || cache.bytes === 0) &&
                  styles.actionDimmed,
              ]}
            >
              <TrashIcon size={19} color={colors.foreground} />
            </Pressable>
          </View>

          <AppText style={styles.footnote}>
            Temporary files only. Saved walkthroughs and projects are kept.
          </AppText>
        </View>

        <View style={styles.sectionHeading}>
          <AppText weight="bold" style={styles.sectionTitle}>
            Info
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setHowItWorksVisible(true)}
          style={({ pressed }) => [
            styles.infoRow,
            pressed && styles.actionDimmed,
          ]}
        >
          <View style={styles.settingIcon}>
            <InformationCircleIcon size={20} color={colors.accent} />
          </View>

          <View style={styles.settingText}>
            <AppText weight="semibold">How walklog works</AppText>
            <AppText style={styles.settingDescription}>
              Learn where processing happens and what syncs.
            </AppText>
          </View>
        </Pressable>

        <View style={styles.signOut}>
          <AppButton
            title={
              signingOut.status === "loading" ? "Signing out…" : "Sign out"
            }
            disabled={signingOut.status === "loading"}
            onPress={confirmSignOut}
          />
        </View>
      </ScrollView>

      <Modal
        visible={howItWorksVisible}
        animationType={reducedMotion ? "none" : "slide"}
        onRequestClose={() => setHowItWorksVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top", "bottom"]}>
          <View style={styles.modalHeading}>
            <AppText variant="title" style={styles.modalTitle}>
              How walklog works
            </AppText>
            <AppText style={styles.settingDescription}>
              Choose how AI runs; walklog keeps your saved records available
              offline.
            </AppText>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.infoCard}>
              <AppText weight="semibold">1. Transcribe on your device</AppText>
              <AppText style={styles.infoDescription}>
                Whisper converts recordings to text locally. The audio is not
                sent to the transcription model in the cloud.
              </AppText>
            </View>

            <View style={styles.infoCard}>
              <AppText weight="semibold">
                2. Choose where AI inference runs
              </AppText>
              <AppText style={styles.infoDescription}>
                On-device inference keeps the AI prompt on this device. Cloud
                inference sends the prompt and any selected media to Firebase AI
                for processing.
              </AppText>
            </View>

            <View style={styles.infoCard}>
              <AppText weight="semibold">3. Sync your walklog data</AppText>
              <AppText style={styles.infoDescription}>
                Saved walkthroughs sync to your Firestore account. Attached
                photos sync separately to Firebase Storage. Offline edits are
                queued and sync when you reconnect.
              </AppText>
            </View>

            <View style={styles.infoCard}>
              <AppText weight="semibold">4. Clear only temporary files</AppText>
              <AppText style={styles.infoDescription}>
                Clearing the app cache removes temporary files, while keeping
                saved records and Firestore’s offline cache intact.
              </AppText>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <AppButton
              title="Done"
              onPress={() => setHowItWorksVisible(false)}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 36 },
  identity: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    paddingVertical: 32,
  },
  identityText: { flex: 1, gap: 4 },
  name: { fontSize: 20, lineHeight: 27 },
  email: { color: colors.muted, fontSize: 14 },
  syncCards: { gap: 10, marginTop: 22 },
  syncCard: {
    alignItems: "center",
    backgroundColor: colors.neutralSoft,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  syncIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 30,
  },
  syncText: { flex: 1, gap: 4 },
  syncDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sectionHeading: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 28,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16 },
  settingSection: { gap: 16, paddingBottom: 4 },
  settingTitleRow: { alignItems: "center", flexDirection: "row", gap: 14 },
  settingIcon: {
    alignItems: "center",
    backgroundColor: colors.accentFaint,
    borderRadius: 12,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  settingText: { flex: 1, gap: 4 },
  cacheSizeBadge: { alignSelf: "flex-start" },
  settingDescription: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  footnote: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 3 },
  iconAction: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  actionDimmed: { opacity: 0.55 },
  progressSection: { gap: 8 },
  progressTrack: {
    backgroundColor: colors.accentFaint,
    borderRadius: 4,
    height: 7,
    overflow: "hidden",
  },
  progressFill: { backgroundColor: colors.accent, borderRadius: 4, height: 7 },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingVertical: 14,
  },
  signOut: { gap: 12, marginTop: 32 },
  modalContainer: { backgroundColor: colors.background, flex: 1 },
  modalHeading: {
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
  },
  modalTitle: { fontSize: 26, lineHeight: 34 },
  modalContent: { gap: 12, paddingHorizontal: 24, paddingBottom: 24 },
  infoCard: {
    backgroundColor: colors.accentFaint,
    borderRadius: 14,
    gap: 8,
    padding: 16,
  },
  infoDescription: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  modalFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
