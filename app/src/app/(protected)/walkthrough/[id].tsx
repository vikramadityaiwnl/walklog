import { useCallback, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import type { PunchItem, Walkthrough } from "../../../models/walkthrough";
import { deleteItemPhotos } from "../../../services/walkthrough-photos";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { useAuthStore } from "../../../store/auth-store";

type ScreenState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; walkthrough: Walkthrough; items: PunchItem[] };

export default function WalkthroughDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuthStore((state) => state.auth);
  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const [screen, setScreen] = useState<ScreenState>({ status: "loading" });
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId || !id) return;

      let active = true;
      const storage = createWalkthroughStorage(ownerId);
      void Promise.all([storage.getWalkthrough(id), storage.listItems(id)])
        .then(([walkthrough, items]) => {
          if (active)
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
    }, [ownerId, id]),
  );

  function confirmDelete() {
    if (screen.status !== "ready" || !ownerId || deleting) return;

    const items = screen.items;
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
                await createWalkthroughStorage(ownerId).deleteWalkthrough(id);
                await deleteItemPhotos(
                  items.flatMap((item) => item.photos),
                ).catch(() => {});
                router.back();
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
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <AppText style={styles.link}>‹ Walkthroughs</AppText>
        </Pressable>
        {screen.status === "loading" ? <AppText>Loading…</AppText> : null}
        {screen.status === "error" ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {screen.message}
          </AppText>
        ) : null}
        {screen.status === "ready" ? (
          <>
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <AppText variant="title" style={styles.heading}>
                  {screen.walkthrough.title}
                </AppText>
                <AppText style={styles.subheading}>
                  {[screen.walkthrough.clientName, screen.walkthrough.address]
                    .filter(Boolean)
                    .join(" · ") || "Walkthrough"}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({ pathname: "/walkthrough/edit", params: { id } })
                }
              >
                <AppText style={styles.link}>Edit</AppText>
              </Pressable>
            </View>
            <View style={styles.between}>
              <AppText weight="bold" style={styles.cardTitle}>
                Items ({screen.items.length})
              </AppText>
            </View>
            {screen.items.length === 0 ? (
              <AppText style={styles.subheading}>
                No items yet. Add an observation to get started.
              </AppText>
            ) : null}
            {screen.items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit item ${item.issueSummary}`}
                onPress={() =>
                  router.push({
                    pathname: "/walkthrough/item",
                    params: { walkthroughId: id, id: item.id },
                  })
                }
                style={styles.card}
              >
                <View style={styles.row}>
                  {item.photos[0] ? (
                    <Image
                      source={{ uri: item.photos[0].localUri }}
                      style={styles.photo}
                    />
                  ) : null}
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText weight="bold" style={styles.cardTitle}>
                      {item.issueSummary}
                    </AppText>
                    <AppText style={styles.subheading}>
                      {item.location || "Unspecified area"} · {item.trade}
                    </AppText>
                    <AppText style={styles.link}>
                      {item.priority} priority
                    </AppText>
                  </View>
                </View>
              </Pressable>
            ))}
            <AppButton
              title="+ Add item"
              onPress={() =>
                router.push({
                  pathname: "/walkthrough/item",
                  params: { walkthroughId: id },
                })
              }
            />
            <Pressable
              accessibilityRole="button"
              disabled={deleting}
              onPress={confirmDelete}
              style={styles.back}
            >
              <AppText style={styles.danger}>
                {deleting ? "Deleting…" : "Delete walkthrough"}
              </AppText>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
