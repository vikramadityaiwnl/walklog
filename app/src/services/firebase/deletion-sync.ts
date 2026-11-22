import { getAuth } from "@react-native-firebase/auth";
import {
  collection,
  deleteField,
  doc,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type Transaction,
} from "@react-native-firebase/firestore";
import * as Network from "expo-network";
import { useFirestoreStore } from "../../store/firestore-store";
import { mediaUrls } from "../walkthrough/storage";
import {
  localMediaId,
  localMediaUri,
  mediaStoragePath,
} from "../walkthrough/media-refs";
import { deleteItemPhotos } from "../walkthrough/photos";

type DeletionJob = {
  reference: DocumentReference<DocumentData>;
  kind: "project" | "walkthrough";
  targetId: string;
  pending: boolean;
};

export function observeDeletions(ownerId: string): () => void {
  const database = getFirestore();
  const projectCollection = collection(database, "users", ownerId, "projects");
  const walkthroughCollection = collection(
    database,
    "users",
    ownerId,
    "walkthroughs",
  );
  const itemCollection = collection(database, "users", ownerId, "items");
  const mediaDeletions = collection(
    database,
    "users",
    ownerId,
    "media-deletions",
  );
  const jobsCollection = collection(
    database,
    "users",
    ownerId,
    "deletion-jobs",
  );
  let jobs: DeletionJob[] = [];
  let active = true;
  let running = false;
  let rerun = false;
  let listenerHealthy = false;

  function mediaPaths(data: DocumentData): string[] {
    const paths = new Set(
      mediaUrls(data)
        .map((url) => mediaStoragePath(url, ownerId))
        .filter((path): path is string => !!path),
    );
    const addPending = (id: unknown) => {
      if (typeof id === "string" && /^[a-zA-Z0-9-]+$/.test(id))
        paths.add(`users/${ownerId}/media/${id}.jpg`);
    };
    addPending(data.pendingBannerId);
    addPending(localMediaId(data.bannerPhotoUri));
    if (Array.isArray(data.pendingPhotoIds))
      for (const id of data.pendingPhotoIds) addPending(id);
    if (Array.isArray(data.photos))
      for (const photo of data.photos)
        if (photo && typeof photo === "object")
          addPending(localMediaId((photo as { localUri?: string }).localUri));

    return [...paths];
  }

  function queueMedia(transaction: Transaction, data: DocumentData): void {
    const paths = mediaPaths(data);
    if (paths.length > 450)
      throw new Error("Too many photos to delete safely.");
    for (const path of paths)
      transaction.set(doc(mediaDeletions), { path, createdAt: Date.now() });
  }

  function localPhotos(data: DocumentData) {
    const ids = new Set<string>();
    if (typeof data.pendingBannerId === "string") ids.add(data.pendingBannerId);
    const bannerId = localMediaId(data.bannerPhotoUri);
    if (bannerId) ids.add(bannerId);
    if (Array.isArray(data.pendingPhotoIds))
      for (const id of data.pendingPhotoIds)
        if (typeof id === "string") ids.add(id);
    if (Array.isArray(data.photos))
      for (const photo of data.photos) {
        if (photo && typeof photo === "object") {
          const id = localMediaId((photo as { localUri?: string }).localUri);
          if (id) ids.add(id);
        }
      }

    return [...ids].map((id) => ({ localUri: localMediaUri(id) }));
  }

  async function process(job: DeletionJob) {
    const parent = doc(
      job.kind === "project" ? projectCollection : walkthroughCollection,
      job.targetId,
    );
    const children =
      job.kind === "project"
        ? query(walkthroughCollection, where("projectId", "==", job.targetId))
        : query(itemCollection, where("walkthroughId", "==", job.targetId));
    const snapshot = await getDocsFromServer(children);
    if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites)
      return;

    for (const child of snapshot.docs) {
      if (!active || getAuth().currentUser?.uid !== ownerId) return;
      const paths = job.kind === "walkthrough" ? mediaPaths(child.data()) : [];
      if (paths.length > 450) {
        for (let offset = 0; offset < paths.length; offset += 400) {
          if (!active || getAuth().currentUser?.uid !== ownerId) return;
          const batch = writeBatch(database);
          for (const path of paths.slice(offset, offset + 400))
            batch.set(doc(mediaDeletions), { path, createdAt: Date.now() });
          await batch.commit();
        }
      }
      const local = await runTransaction(database, async (transaction) => {
        const jobSnapshot = await transaction.get(job.reference);
        const parentSnapshot = await transaction.get(parent);
        const current = await transaction.get(child.ref);
        if (
          !jobSnapshot.exists() ||
          !parentSnapshot.exists() ||
          parentSnapshot.data().deletionPending !== true ||
          !current.exists()
        )
          return [];
        const data = current.data();
        if (job.kind === "project") {
          if (data.projectId === job.targetId && data.deletionPending !== true)
            transaction.update(child.ref, {
              projectId: deleteField(),
              updatedAt: Date.now(),
            });
          return [];
        }
        if (data.walkthroughId !== job.targetId) return [];
        if (paths.length <= 450) queueMedia(transaction, data);
        transaction.delete(child.ref);

        return localPhotos(data);
      });
      if (active && local.length) await deleteItemPhotos(local).catch(() => {});
    }

    const remaining = await getDocsFromServer(children);
    if (remaining.metadata.fromCache || remaining.metadata.hasPendingWrites)
      return;
    const unfinished = remaining.docs.some(
      (entry) =>
        job.kind === "walkthrough" || entry.data().deletionPending !== true,
    );
    if (unfinished) return;
    if (!active || getAuth().currentUser?.uid !== ownerId) return;
    const local = await runTransaction(database, async (transaction) => {
      const jobSnapshot = await transaction.get(job.reference);
      const parentSnapshot = await transaction.get(parent);
      if (!jobSnapshot.exists()) return [];
      if (!parentSnapshot.exists()) {
        transaction.delete(job.reference);
        return [];
      }
      const data = parentSnapshot.data();
      if (data.deletionPending !== true)
        throw new Error("Deletion marker is missing.");
      queueMedia(transaction, data);
      transaction.delete(parent);
      transaction.delete(job.reference);

      return localPhotos(data);
    });
    if (active && local.length) await deleteItemPhotos(local).catch(() => {});
  }

  async function run() {
    if (!active || getAuth().currentUser?.uid !== ownerId) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const network = await Network.getNetworkStateAsync().catch(() => null);
      if (
        !active ||
        !network?.isConnected ||
        network.isInternetReachable === false
      )
        return;
      let failed = false;
      for (const job of jobs) {
        if (!active || getAuth().currentUser?.uid !== ownerId) break;
        if (job.pending) continue;
        try {
          await process(job);
        } catch {
          failed = true;
        }
      }
      if (active)
        useFirestoreStore
          .getState()
          .setDeletionError(failed || !listenerHealthy);
    } finally {
      running = false;
      if (rerun && active) {
        rerun = false;
        void run();
      }
    }
  }

  let unsubscribe = () => {};
  let retryListener: ReturnType<typeof setTimeout> | undefined;

  function listen() {
    if (!active) return;
    unsubscribe = onSnapshot(
      jobsCollection,
      { includeMetadataChanges: true },
      (snapshot) => {
        listenerHealthy = true;
        jobs = snapshot.docs.flatMap((entry): DeletionJob[] => {
          const data = entry.data();
          if (
            (data.kind !== "project" && data.kind !== "walkthrough") ||
            typeof data.targetId !== "string" ||
            data.targetId.includes("/")
          )
            return [];
          return [
            {
              reference: entry.ref,
              kind: data.kind,
              targetId: data.targetId,
              pending: entry.metadata.hasPendingWrites,
            },
          ];
        });
        useFirestoreStore.getState().setDeletionsPending(jobs.length > 0);
        void run();
      },
      () => {
        if (!active) return;
        listenerHealthy = false;
        useFirestoreStore.getState().setDeletionsPending(true);
        useFirestoreStore.getState().setDeletionError(true);
        retryListener = setTimeout(listen, 30_000);
      },
    );
  }

  listen();
  const network = Network.addNetworkStateListener(() => {
    void run();
  });
  const timer = setInterval(() => {
    void run();
  }, 30_000);

  return () => {
    active = false;
    if (retryListener) clearTimeout(retryListener);
    clearInterval(timer);
    network.remove();
    unsubscribe();
    useFirestoreStore.getState().setDeletionsPending(false);
    useFirestoreStore.getState().setDeletionError(false);
  };
}
