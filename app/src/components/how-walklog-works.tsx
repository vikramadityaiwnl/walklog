import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import {
  CheckBadgeIcon,
  MicrophoneIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import { AppButton } from "./app-button";
import { AppText } from "./app-text";
import { colors } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function HowWalklogWorks(props: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <Modal
      visible={props.visible}
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={() => props.onClose()}
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
          <View style={styles.infoSection}>
            <View style={styles.infoHeading}>
              <CheckBadgeIcon size={20} color={colors.accent} />

              <AppText weight="semibold">Review AI suggestions</AppText>
            </View>

            <AppText style={styles.infoDescription}>
              AI can make mistakes or miss important details. Review generated
              information and suggested actions before relying on them.
            </AppText>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoHeading}>
              <MicrophoneIcon size={20} color={colors.accent} />

              <AppText weight="semibold">Capture your walkthrough</AppText>
            </View>

            <AppText style={styles.infoDescription}>
              Type notes, record or import audio, or capture or import video.
              Whisper transcribes audio on your device. Video and its audio are
              sent to cloud AI for analysis.
            </AppText>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoHeading}>
              <SparklesIcon size={20} color={colors.accent} />

              <AppText weight="semibold">Choose where AI runs</AppText>
            </View>

            <AppText style={styles.infoDescription}>
              For text and supported photos, choose on-device or cloud AI.
              On-device prompts stay on this device; cloud processing sends the
              prompt and selected media to Firebase AI. Video uses cloud AI.
            </AppText>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoHeading}>
              <CloudArrowUpIcon size={20} color={colors.accent} />

              <AppText weight="semibold">Sync your walklog data</AppText>
            </View>

            <AppText style={styles.infoDescription}>
              Saved walkthroughs sync to your Firestore account. Attached photos
              sync separately to Firebase Storage. Offline edits are queued and
              sync when you reconnect.
            </AppText>
          </View>

          <View style={[styles.infoSection, styles.lastSection]}>
            <View style={styles.infoHeading}>
              <TrashIcon size={20} color={colors.accent} />

              <AppText weight="semibold">Clear temporary files</AppText>
            </View>

            <AppText style={styles.infoDescription}>
              Clearing the app cache removes temporary files, while keeping
              saved records and Firestore’s offline cache intact.
            </AppText>
          </View>
        </ScrollView>

        <View style={styles.modalFooter}>
          <AppButton title="Done" onPress={() => props.onClose()} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  settingDescription: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  modalContainer: { backgroundColor: colors.background, flex: 1 },
  modalHeading: {
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
  },
  modalTitle: { fontSize: 26, lineHeight: 34 },
  modalContent: { paddingHorizontal: 24, paddingBottom: 24 },
  infoSection: {
    gap: 8,
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lastSection: { borderBottomWidth: 0 },
  infoHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoDescription: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  modalFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 },
});
