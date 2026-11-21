import { useEffect, useRef, useState } from "react";
import { useDialogStore } from "../store/dialog-store";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../services/walkthrough-photos";

export function useBannerDraft() {
  const showDialog = useDialogStore((state) => state.showDialog);

  const [uri, setUri] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const original = useRef<string | undefined>(undefined);
  const staged = useRef<string[]>([]);
  const mounted = useRef(false);
  const saving = useRef(false);

  function discard(uris: string[]) {
    return deleteItemPhotos(uris.map((localUri) => ({ localUri }))).catch(
      () => {},
    );
  }

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      if (!saving.current) void discard(staged.current);
    };
  }, []);

  function load(value?: string) {
    original.current = value;
    setUri(value);
  }

  async function select(source: "camera" | "library") {
    setBusy(true);
    try {
      const photo = await selectItemPhoto(source);
      if (!photo) return;

      if (!mounted.current) {
        await discard([photo.localUri]);

        return;
      }

      staged.current.push(photo.localUri);
      setUri(photo.localUri);
    } catch (error) {
      showDialog(
        "Couldn’t add banner",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function choose() {
    showDialog("Banner image", "Choose a source", [
      {
        text: "Camera",
        icon: "camera",
        onPress: () => {
          void select("camera");
        },
      },
      {
        text: "Photo library",
        icon: "photo-library",
        onPress: () => {
          void select("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function reset() {
    void discard(staged.current);
    staged.current = [];
    setUri(original.current);
  }

  function beginSave() {
    saving.current = true;
  }

  async function finishSave(success: boolean) {
    saving.current = false;
    if (success) {
      const discarded = staged.current.filter((value) => value !== uri);
      if (original.current && original.current !== uri)
        discarded.push(original.current);
      staged.current = [];
      original.current = uri;
      await discard(discarded);
    } else if (!mounted.current) {
      await discard(staged.current);
      staged.current = [];
    }
  }

  return {
    uri,
    busy,
    load,
    choose,
    remove: () => setUri(undefined),
    reset,
    beginSave,
    finishSave,
  };
}
