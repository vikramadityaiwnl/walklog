import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  writeBatch,
} from "@react-native-firebase/firestore";
import { useDialogStore } from "../../store/dialog-store";
import { useFirestoreStore } from "../../store/firestore-store";

export function observeFirestore(ownerId: string): () => void {
  const database = getFirestore();
  const pendingCollections = new Map<string, boolean>();
  const unsubscribers = ["projects", "walkthroughs", "items"].map((name) =>
    onSnapshot(
      collection(database, "users", ownerId, name),
      { includeMetadataChanges: true },
      (snapshot) => {
        pendingCollections.set(name, snapshot.metadata.hasPendingWrites);
        useFirestoreStore
          .getState()
          .setPending([...pendingCollections.values()].some(Boolean));
        if (snapshot.docChanges().length)
          useFirestoreStore.getState().notifyChange();
      },
      () => {
        useDialogStore
          .getState()
          .showDialog(
            "Couldn’t sync data",
            "Check your connection and try again.",
          );
      },
    ),
  );
  const markers = collection(database, "users", ownerId, "mutations");
  let committed: { id: string; createdAt: number }[] = [];

  function cleanMarkers() {
    const expired = committed.filter(
      (entry) => entry.createdAt < Date.now() - 60_000,
    );
    committed = committed.filter(
      (entry) => entry.createdAt >= Date.now() - 60_000,
    );
    for (let index = 0; index < expired.length; index += 400) {
      const batch = writeBatch(database);
      for (const entry of expired.slice(index, index + 400))
        batch.delete(doc(markers, entry.id));
      void batch.commit().catch(() => {});
    }
  }

  unsubscribers.push(
    onSnapshot(
      markers,
      { includeMetadataChanges: true },
      (snapshot) => {
        committed = snapshot.docs
          .filter((entry) => !entry.metadata.hasPendingWrites)
          .map((entry) => ({
            id: entry.id,
            createdAt: Number(entry.data().createdAt) || 0,
          }));
        cleanMarkers();
      },
      () => {},
    ),
  );
  const timer = setInterval(cleanMarkers, 60_000);

  return () => {
    clearInterval(timer);
    for (const unsubscribe of unsubscribers) unsubscribe();
    useFirestoreStore.getState().setPending(false);
  };
}
