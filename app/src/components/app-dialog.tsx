import { CameraIcon, PhotoIcon } from "react-native-heroicons/outline";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  ReduceMotion,
  FadeIn,
  useReducedMotion,
} from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import { useDialogStore } from "../store/dialog-store";
import { colors } from "../theme";
import { AppButton } from "./app-button";
import { AppText } from "./app-text";

interface Props {
  surface?: "root" | "photo-viewer" | "project-picker";
}

export function AppDialog(props: Props) {
  const reducedMotion = useReducedMotion();
  const { dialog, closeDialog, finishDismissal } = useDialogStore(
    useShallow((state) => ({
      dialog: state.dialog,
      closeDialog: state.closeDialog,
      finishDismissal: state.finishDismissal,
    })),
  );

  const content =
    dialog.status === "closed" ||
    dialog.content.surface !== (props.surface ?? "root")
      ? null
      : dialog.content;
  const actions = content?.actions ?? [];
  const photoChoices = actions.filter((action) => action.icon);
  const cancel = actions.find((action) => action.style === "cancel");
  const showPhotoChoices =
    photoChoices.length === 2 && actions.length === 3 && !!cancel;

  return (
    <Modal
      transparent
      visible={dialog.status === "open" && !!content}
      animationType={reducedMotion ? "none" : "fade"}
      onRequestClose={() => closeDialog()}
      onDismiss={finishDismissal}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          style={StyleSheet.absoluteFill}
          onPress={() => closeDialog()}
        />

        {content ? (
          <Animated.View
            accessibilityViewIsModal
            entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
            style={styles.dialog}
          >
            <AppText variant="title" style={styles.title}>
              {content?.title}
            </AppText>

            {content?.message ? (
              <AppText style={styles.message}>{content.message}</AppText>
            ) : null}

            {showPhotoChoices ? (
              <View style={styles.actions}>
                <View style={styles.choiceRow}>
                  {photoChoices.map((action) => (
                    <Pressable
                      key={action.text}
                      accessibilityRole="button"
                      onPress={() => closeDialog(action)}
                      style={({ pressed }) => [
                        styles.choice,
                        pressed && styles.choicePressed,
                      ]}
                    >
                      {action.icon === "camera" ? (
                        <CameraIcon size={26} color={colors.accent} />
                      ) : (
                        <PhotoIcon size={26} color={colors.accent} />
                      )}

                      <AppText weight="semibold" style={styles.choiceLabel}>
                        {action.text}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                <AppButton
                  title={cancel.text}
                  variant="secondary"
                  onPress={() => closeDialog(cancel)}
                />
              </View>
            ) : (
              <View
                style={[
                  styles.actions,
                  actions.length <= 2 && styles.actionRow,
                ]}
              >
                {actions.map((action, index) => (
                  <View
                    key={`${action.text}-${index}`}
                    style={actions.length <= 2 && styles.action}
                  >
                    <AppButton
                      title={action.text}
                      variant={
                        action.style === "cancel"
                          ? "secondary"
                          : action.style === "destructive"
                            ? "danger"
                            : undefined
                      }
                      onPress={() => closeDialog(action)}
                    />
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
  },
  title: { fontSize: 20, lineHeight: 28 },
  message: { color: colors.muted, lineHeight: 22, marginTop: 8 },
  actions: { marginTop: 24, gap: 8 },
  actionRow: { flexDirection: "row" },
  action: { flex: 1 },
  choiceRow: { flexDirection: "row", gap: 10 },
  choice: {
    flex: 1,
    minHeight: 88,
    borderRadius: 12,
    backgroundColor: colors.accentFaint,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 10,
  },
  choiceLabel: { color: colors.foreground, fontSize: 14, textAlign: "center" },
  choicePressed: { opacity: 0.65 },
});
