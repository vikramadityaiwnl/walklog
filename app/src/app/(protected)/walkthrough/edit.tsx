import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { Walkthrough } from "../../../models/walkthrough";
import { deleteItemPhotos } from "../../../services/walkthrough-photos";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";

type FormState =
  | { status: "loading" }
  | { status: "ready"; existing?: Walkthrough }
  | { status: "saving"; existing?: Walkthrough }
  | { status: "error"; message: string; existing?: Walkthrough };

export default function WalkthroughEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const auth = useAuthStore((state) => state.auth);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [form, setForm] = useState<FormState>(
    id ? { status: "loading" } : { status: "ready" },
  );
  const [deleting, setDeleting] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [address, setAddress] = useState("");

  const existing = form.status === "loading" ? undefined : form.existing;
  const hasChanges =
    !!existing &&
    (title.trim() !== existing.title ||
      (clientName.trim() || undefined) !== existing.clientName ||
      (address.trim() || undefined) !== existing.address);
  const showSave = !id || hasChanges;

  useEffect(() => {
    if (!id || !ownerId) return;

    let active = true;
    void createWalkthroughStorage(ownerId)
      .getWalkthrough(id)
      .then((walkthrough) => {
        if (!active) return;

        if (!walkthrough) {
          setForm({
            status: "error",
            message: "This walkthrough could not be found.",
          });

          return;
        }

        setTitle(walkthrough.title);
        setClientName(walkthrough.clientName ?? "");
        setAddress(walkthrough.address ?? "");
        setForm({ status: "ready", existing: walkthrough });
      })
      .catch(() => {
        if (active)
          setForm({
            status: "error",
            message: "Couldn’t load this walkthrough.",
          });
      });

    return () => {
      active = false;
    };
  }, [id, ownerId]);

  function cancelChanges() {
    if (!existing) return;

    setTitle(existing.title);
    setClientName(existing.clientName ?? "");
    setAddress(existing.address ?? "");
    setForm({ status: "ready", existing });
  }

  async function save() {
    if (!ownerId || form.status === "loading" || form.status === "saving")
      return;

    const existing = form.existing;
    if (id && !existing) return;

    if (!title.trim()) {
      setForm({
        status: "error",
        message: "Enter a walkthrough name.",
        existing,
      });

      return;
    }

    setForm({ status: "saving", existing });
    try {
      const now = Date.now();
      const walkthrough: Walkthrough = {
        id: existing?.id ?? Crypto.randomUUID(),
        title: title.trim(),
        clientName: clientName.trim() || undefined,
        address: address.trim() || undefined,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        executiveSummary: existing?.executiveSummary,
        status: existing?.status ?? "in_progress",
      };
      await createWalkthroughStorage(ownerId).saveWalkthrough(walkthrough);
      if (existing) router.back();
      else
        router.replace({
          pathname: "/walkthrough/[id]",
          params: { id: walkthrough.id },
        });
    } catch {
      setForm({
        status: "error",
        message: "Couldn’t save the walkthrough. Please try again.",
        existing,
      });
    }
  }

  function confirmDelete() {
    if (
      !id ||
      !ownerId ||
      deleting ||
      form.status === "loading" ||
      form.status === "saving" ||
      !form.existing
    )
      return;

    Alert.alert(
      "Delete walkthrough?",
      "This also deletes its items and photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeleting(true);
              try {
                const storage = createWalkthroughStorage(ownerId);
                const items = await storage.listItems(id);
                await storage.deleteWalkthrough(id);
                await deleteItemPhotos(
                  items.flatMap((item) => item.photos),
                ).catch(() => {});
                router.dismissTo("/(protected)/(tabs)");
              } catch {
                setDeleting(false);
                Alert.alert("Couldn’t delete walkthrough", "Please try again.");
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={{ gap: 5, marginBottom: 8 }}>
            <AppText variant="title" style={styles.heading}>
              {id ? "Settings" : "New walkthrough"}
            </AppText>

            <AppText style={styles.subheading}>
              {id
                ? "Update the details of this walkthrough."
                : "Keep a record of your site visit, even when you’re offline."}
            </AppText>
          </View>

          {form.status === "loading" ? (
            <AppText>Loading…</AppText>
          ) : (
            <>
              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Walkthrough name *
                </AppText>

                <TextInput
                  accessibilityLabel="Walkthrough name"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="e.g. Apartment 4B"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Client (optional)
                </AppText>

                <TextInput
                  accessibilityLabel="Client"
                  value={clientName}
                  onChangeText={setClientName}
                  placeholder="Client name"
                  style={styles.input}
                />
              </View>

              <View style={styles.section}>
                <AppText weight="semibold" style={styles.label}>
                  Address (optional)
                </AppText>

                <TextInput
                  accessibilityLabel="Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Site address"
                  style={styles.input}
                />
              </View>

              {form.status === "error" ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {form.message}
                </AppText>
              ) : null}
            </>
          )}
        </ScrollView>

        {form.status !== "loading" ? (
          <View style={styles.actions}>
            {id && hasChanges ? (
              <View style={styles.action}>
                <AppButton
                  title="Cancel"
                  variant="secondary"
                  disabled={deleting || form.status === "saving"}
                  onPress={cancelChanges}
                />
              </View>
            ) : null}

            {showSave ? (
              <View style={styles.action}>
                <AppButton
                  title={
                    form.status === "saving"
                      ? "Saving…"
                      : id
                        ? "Save changes"
                        : "Create walkthrough"
                  }
                  disabled={
                    deleting ||
                    form.status === "saving" ||
                    (!!id && !form.existing)
                  }
                  onPress={save}
                />
              </View>
            ) : null}

            {id && form.existing && !hasChanges ? (
              <View style={styles.action}>
                <AppButton
                  variant="danger"
                  title={deleting ? "Deleting…" : "Delete"}
                  accessibilityLabel="Delete walkthrough"
                  disabled={deleting || form.status === "saving"}
                  onPress={confirmDelete}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
