import { Platform } from "react-native";
import { create } from "zustand";

export interface DialogAction {
  text: string;
  style?: "cancel" | "destructive";
  icon?: "camera" | "photo-library";
  onPress?: () => void;
}

export interface DialogContent {
  title: string;
  message?: string;
  actions: DialogAction[];
  surface: "root" | "photo-viewer" | "project-picker";
}

type DialogState =
  | { status: "closed" }
  | { status: "open"; content: DialogContent }
  | { status: "closing"; content: DialogContent; onDismiss?: () => void };

interface DialogStore {
  dialog: DialogState;
  showDialog: (
    title: string,
    message?: string,
    actions?: DialogAction[],
    surface?: DialogContent["surface"],
  ) => void;
  closeDialog: (action?: DialogAction) => void;
  finishDismissal: () => void;
}

export const useDialogStore = create<DialogStore>((set, get) => ({
  dialog: { status: "closed" },
  showDialog: (title, message, actions, surface = "root") => {
    set({
      dialog: {
        status: "open",
        content: {
          title,
          message,
          actions: actions ?? [{ text: "OK" }],
          surface,
        },
      },
    });
  },
  closeDialog: (action) => {
    const dialog = get().dialog;
    if (dialog.status !== "open") return;

    set({
      dialog: {
        status: "closing",
        content: dialog.content,
        onDismiss: action?.onPress,
      },
    });
    if (Platform.OS !== "ios") setTimeout(() => get().finishDismissal(), 250);
  },
  finishDismissal: () => {
    const dialog = get().dialog;
    if (dialog.status !== "closing") return;

    set({ dialog: { status: "closed" } });
    dialog.onDismiss?.();
  },
}));
