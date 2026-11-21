import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { Priority, PunchItem, Trade } from "../../../models/walkthrough";
import {
  deleteItemPhotos,
  selectItemPhoto,
} from "../../../services/walkthrough-photos";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";

const trades: Trade[] = [
  "General",
  "Plumbing",
  "Electrical",
  "Paint/Finish",
  "Carpentry",
  "HVAC",
];
const priorities: Priority[] = ["Low", "Medium", "High"];
type FormState =
  | { status: "loading" }
  | { status: "ready"; existing?: PunchItem }
  | { status: "saving"; existing?: PunchItem }
  | { status: "error"; message: string; existing?: PunchItem };

export default function ItemEdit() {
  const { id, walkthroughId } = useLocalSearchParams<{
    id?: string;
    walkthroughId: string;
  }>();
  const auth = useAuthStore((state) => state.auth);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [form, setForm] = useState<FormState>(
    id ? { status: "loading" } : { status: "ready" },
  );
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [trade, setTrade] = useState<Trade>("General");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [photos, setPhotos] = useState<PunchItem["photos"]>([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const stagedPhotos = useRef<PunchItem["photos"]>([]);
  const mounted = useRef(false);
  const saving = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      if (!saving.current) {
        void deleteItemPhotos(stagedPhotos.current).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!id || !ownerId || !walkthroughId) return;

    let active = true;
    void createWalkthroughStorage(ownerId)
      .listItems(walkthroughId)
      .then((items) => {
        if (!active) return;

        const item = items.find((entry) => entry.id === id);
        if (!item) {
          setForm({
            status: "error",
            message: "This item could not be found.",
          });

          return;
        }

        setDescription(item.issueSummary);
        setLocation(item.location);
        setTrade(item.trade);
        setPriority(item.priority);
        setPhotos(item.photos);
        setForm({ status: "ready", existing: item });
      })
      .catch(() => {
        if (active)
          setForm({ status: "error", message: "Couldn’t load this item." });
      });

    return () => {
      active = false;
    };
  }, [id, ownerId, walkthroughId]);

  async function addPhoto(source: "camera" | "library") {
    setPhotoBusy(true);
    try {
      const photo = await selectItemPhoto(source);
      if (photo && !mounted.current) {
        await deleteItemPhotos([photo]);
      } else if (photo) {
        stagedPhotos.current.push(photo);
        setPhotos((current) => [...current, photo]);
      }
    } catch (error) {
      Alert.alert(
        "Couldn’t add photo",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }

  function choosePhoto() {
    Alert.alert("Add photo", "Choose a source", [
      {
        text: "Take photo",
        onPress: () => {
          void addPhoto("camera");
        },
      },
      {
        text: "Choose from library",
        onPress: () => {
          void addPhoto("library");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  async function save() {
    if (
      !ownerId ||
      !walkthroughId ||
      form.status === "loading" ||
      form.status === "saving" ||
      photoBusy
    )
      return;

    const existing = form.existing;
    if (id && !existing) return;

    if (!description.trim()) {
      setForm({
        status: "error",
        message: "Enter an issue description.",
        existing,
      });

      return;
    }

    saving.current = true;
    setForm({ status: "saving", existing });
    try {
      const now = Date.now();
      const item: PunchItem = {
        ...existing,
        id: existing?.id ?? Crypto.randomUUID(),
        walkthroughId,
        rawTranscript: existing?.rawTranscript ?? "",
        issueSummary: description.trim(),
        location: location.trim() || "Unspecified Area",
        trade,
        priority,
        photos,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        cloudVerification: undefined,
      };
      await createWalkthroughStorage(ownerId).saveItem(item);
      const removed = [
        ...(existing?.photos ?? []),
        ...stagedPhotos.current,
      ].filter(
        (photo) => !photos.some((kept) => kept.localUri === photo.localUri),
      );
      stagedPhotos.current = [];
      await deleteItemPhotos(removed).catch(() => {});
      if (mounted.current) router.back();
    } catch {
      if (!mounted.current) {
        void deleteItemPhotos(stagedPhotos.current).catch(() => {});

        return;
      }

      setForm({
        status: "error",
        message: "Couldn’t save the item. Please try again.",
        existing,
      });
    } finally {
      saving.current = false;
    }
  }

  function confirmDelete() {
    if (!ownerId || form.status === "loading" || !form.existing) return;

    const existing = form.existing;
    Alert.alert(
      "Delete item?",
      "This also deletes its photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setForm({ status: "saving", existing });
              try {
                await createWalkthroughStorage(ownerId).deleteItem(existing.id);
                await deleteItemPhotos(existing.photos).catch(() => {});
                router.back();
              } catch {
                setForm({
                  status: "error",
                  message: "Couldn’t delete the item. Please try again.",
                  existing,
                });
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          disabled={form.status === "saving" || photoBusy}
          style={styles.back}
        >
          <AppText style={styles.link}>‹ Back</AppText>
        </Pressable>
        <AppText variant="title" style={styles.heading}>
          {id ? "Edit item" : "New item"}
        </AppText>
        {form.status === "loading" ? (
          <AppText>Loading…</AppText>
        ) : (
          <>
            <View style={styles.section}>
              <AppText weight="semibold" style={styles.label}>
                Issue description *
              </AppText>
              <TextInput
                accessibilityLabel="Issue description"
                multiline
                value={description}
                onChangeText={setDescription}
                placeholder="What needs attention?"
                style={[styles.input, styles.multiline]}
              />
            </View>
            <View style={styles.section}>
              <AppText weight="semibold" style={styles.label}>
                Room or location
              </AppText>
              <TextInput
                accessibilityLabel="Room or location"
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. Kitchen"
                style={styles.input}
              />
            </View>
            <View style={styles.section}>
              <AppText weight="semibold" style={styles.label}>
                Trade
              </AppText>
              <View style={styles.wrap}>
                {trades.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: trade === value }}
                    onPress={() => setTrade(value)}
                    style={[
                      styles.chip,
                      trade === value && styles.chipSelected,
                    ]}
                  >
                    <AppText>{value}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <AppText weight="semibold" style={styles.label}>
                Priority
              </AppText>
              <View style={styles.wrap}>
                {priorities.map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: priority === value }}
                    onPress={() => setPriority(value)}
                    style={[
                      styles.chip,
                      priority === value && styles.chipSelected,
                    ]}
                  >
                    <AppText>{value}</AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={styles.section}>
              <AppText weight="semibold" style={styles.label}>
                Photos
              </AppText>
              <View style={styles.wrap}>
                {photos.map((photo, index) => (
                  <View key={photo.localUri} style={{ gap: 4 }}>
                    <Image
                      source={{ uri: photo.localUri }}
                      style={styles.photo}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      onPress={() =>
                        setPhotos((current) =>
                          current.filter(
                            (entry) => entry.localUri !== photo.localUri,
                          ),
                        )
                      }
                    >
                      <AppText style={styles.danger}>Remove</AppText>
                    </Pressable>
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={photoBusy || form.status === "saving"}
                onPress={choosePhoto}
                style={styles.back}
              >
                <AppText style={styles.link}>
                  {photoBusy ? "Adding photo…" : "+ Add photo"}
                </AppText>
              </Pressable>
            </View>
            {form.status === "error" ? (
              <AppText accessibilityRole="alert" style={styles.error}>
                {form.message}
              </AppText>
            ) : null}
            <AppButton
              title={
                form.status === "saving"
                  ? "Saving…"
                  : id
                    ? "Save changes"
                    : "Add item"
              }
              disabled={
                photoBusy ||
                form.status === "saving" ||
                (!!id && !form.existing)
              }
              onPress={save}
            />
            {id && form.existing ? (
              <Pressable
                accessibilityRole="button"
                disabled={photoBusy || form.status === "saving"}
                onPress={confirmDelete}
                style={styles.back}
              >
                <AppText style={styles.danger}>Delete item</AppText>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
