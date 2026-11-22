import {
  collection,
  deleteDoc,
  doc,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  runTransaction,
  setDoc,
  type DocumentData,
  type DocumentReference,
} from "@react-native-firebase/firestore";
import { getAuth } from "@react-native-firebase/auth";
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  putFile,
  ref,
  setMaxUploadRetryTime,
} from "@react-native-firebase/storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Network from "expo-network";
import { Image } from "expo-image";
import { useMediaSyncStore } from "../../store/media-sync-store";
import {
  localMediaId,
  localMediaUri,
  mediaStoragePath,
} from "../walkthrough/media-refs";

type MediaJob = {
  reference: DocumentReference<DocumentData>;
  id: string;
  kind: "banner" | "photo";
  legacyUri?: string;
  pending: boolean;
};

export function observeMedia(ownerId: string): () => void {
  const database = getFirestore();
  const bucket = getStorage();
  void setMaxUploadRetryTime(bucket, 15_000).catch(() => {});
  const documents = new Map<
    string,
    {
      reference: DocumentReference<DocumentData>;
      data: DocumentData;
      pending: boolean;
    }
  >();
  let deletions: {
    reference: DocumentReference<DocumentData>;
    path: string;
  }[] = [];
  let active = true;
  let running = false;
  let rerun = false;

  async function run() {
    if (!active || getAuth().currentUser?.uid !== ownerId) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      const jobs: MediaJob[] = [];
      const deletingWalkthroughs = new Set(
        [...documents.entries()]
          .filter(
            ([key, entry]) =>
              key.startsWith("walkthroughs/") &&
              entry.data.deletionPending === true,
          )
          .map(([key]) => key.slice("walkthroughs/".length)),
      );
      for (const {
        reference,
        data,
        pending: pendingWrite,
      } of documents.values()) {
        if (
          data.deletionPending === true ||
          deletingWalkthroughs.has(data.walkthroughId)
        )
          continue;
        const bannerId =
          typeof data.pendingBannerId === "string"
            ? data.pendingBannerId
            : localMediaId(data.bannerPhotoUri);
        if (bannerId)
          jobs.push({
            reference,
            id: bannerId,
            kind: "banner",
            pending: pendingWrite,
            legacyUri: data.pendingBannerId ? undefined : data.bannerPhotoUri,
          });
        for (const id of Array.isArray(data.pendingPhotoIds)
          ? data.pendingPhotoIds
          : []) {
          if (typeof id === "string")
            jobs.push({ reference, id, kind: "photo", pending: pendingWrite });
        }
        for (const photo of Array.isArray(data.photos) ? data.photos : []) {
          if (
            photo &&
            typeof photo === "object" &&
            typeof photo.localUri === "string" &&
            !photo.remoteUrl
          ) {
            const id = localMediaId(photo.localUri);
            if (id)
              jobs.push({
                reference,
                id,
                kind: "photo",
                pending: pendingWrite,
                legacyUri: photo.localUri,
              });
          }
        }
      }
      const network = await Network.getNetworkStateAsync().catch(() => null);
      if (!active) return;
      if (!network?.isConnected || network.isInternetReachable === false) {
        useMediaSyncStore
          .getState()
          .setStatus(jobs.length || deletions.length ? "waiting" : "idle");
        return;
      }
      useMediaSyncStore
        .getState()
        .setStatus(jobs.length || deletions.length ? "uploading" : "idle");
      let failed = false;
      let unavailable = false;
      for (const job of jobs) {
        if (job.pending) {
          unavailable = true;
          continue;
        }
        if (!active || getAuth().currentUser?.uid !== ownerId) break;
        try {
          const localUri = localMediaUri(job.id);
          if (!(await FileSystem.getInfoAsync(localUri)).exists) {
            unavailable = true;
            continue;
          }
          const object = ref(bucket, `users/${ownerId}/media/${job.id}.jpg`);
          await putFile(object, localUri, { contentType: "image/jpeg" });
          if (!active || getAuth().currentUser?.uid !== ownerId) break;
          const url = await getDownloadURL(object);
          await Image.writeToCacheAsync(localUri, url).catch(() => {});
          const attached = await runTransaction(
            database,
            async (transaction) => {
              const snapshot = await transaction.get(job.reference);
              if (!snapshot.exists()) return false;
              const current = snapshot.data();
              if (job.kind === "banner") {
                if (
                  current.pendingBannerId !== job.id &&
                  !(job.legacyUri && current.bannerPhotoUri === job.legacyUri)
                )
                  return current.bannerPhotoUri === url;
                transaction.update(job.reference, {
                  bannerPhotoUri: url,
                  pendingBannerId: null,
                });
              } else {
                const pending = Array.isArray(current.pendingPhotoIds)
                  ? current.pendingPhotoIds
                  : [];
                const photos = Array.isArray(current.photos)
                  ? current.photos
                  : [];
                const legacy =
                  job.legacyUri &&
                  photos.some(
                    (photo: unknown) =>
                      !!photo &&
                      typeof photo === "object" &&
                      (photo as { localUri?: string }).localUri ===
                        job.legacyUri,
                  );
                if (!pending.includes(job.id) && !legacy)
                  return photos.includes(url);
                const nextPhotos = photos.map((photo: unknown) =>
                  legacy &&
                  !!photo &&
                  typeof photo === "object" &&
                  (photo as { localUri?: string }).localUri === job.legacyUri
                    ? url
                    : photo,
                );
                if (!nextPhotos.includes(url)) nextPhotos.push(url);
                transaction.update(job.reference, {
                  photos: nextPhotos,
                  pendingPhotoIds: pending.filter(
                    (id: unknown) => id !== job.id,
                  ),
                });
              }
              return true;
            },
          );
          if (!attached && active && getAuth().currentUser?.uid === ownerId) {
            const deletion = doc(
              collection(database, "users", ownerId, "media-deletions"),
            );
            void setDoc(deletion, {
              path: `users/${ownerId}/media/${job.id}.jpg`,
              createdAt: Date.now(),
            }).catch(() => {});
          }
        } catch {
          failed = true;
          // The next connectivity or document update retries unfinished uploads.
        }
      }
      for (const deletion of deletions) {
        if (!active || getAuth().currentUser?.uid !== ownerId) break;
        try {
          const snapshots = await Promise.all(
            ["projects", "walkthroughs", "items"].map((name) =>
              getDocsFromServer(collection(database, "users", ownerId, name)),
            ),
          );
          if (
            snapshots.some(
              (snapshot) =>
                snapshot.metadata.fromCache ||
                snapshot.metadata.hasPendingWrites,
            )
          )
            continue;
          const mediaId = deletion.path
            .slice(deletion.path.lastIndexOf("/") + 1)
            .replace(/\.jpg$/, "");
          const deletingWalkthroughs = new Set(
            snapshots[1].docs
              .filter((entry) => entry.data().deletionPending === true)
              .map((entry) => entry.id),
          );
          let referenced = false;
          let awaitingDeletion = false;
          for (const snapshot of snapshots) {
            for (const entry of snapshot.docs) {
              const data = entry.data();
              const matches =
                data.pendingBannerId === mediaId ||
                localMediaId(data.bannerPhotoUri) === mediaId ||
                (Array.isArray(data.pendingPhotoIds) &&
                  data.pendingPhotoIds.includes(mediaId)) ||
                (typeof data.bannerPhotoUri === "string" &&
                  mediaStoragePath(data.bannerPhotoUri, ownerId) ===
                    deletion.path) ||
                (Array.isArray(data.photos) &&
                  data.photos.some((photo: unknown) => {
                    if (
                      photo &&
                      typeof photo === "object" &&
                      localMediaId(
                        (photo as { localUri?: string }).localUri,
                      ) === mediaId
                    )
                      return true;
                    const url =
                      typeof photo === "string"
                        ? photo
                        : photo && typeof photo === "object"
                          ? (photo as { remoteUrl?: string }).remoteUrl
                          : undefined;
                    return (
                      !!url && mediaStoragePath(url, ownerId) === deletion.path
                    );
                  }));
              if (matches) {
                if (
                  data.deletionPending === true ||
                  deletingWalkthroughs.has(data.walkthroughId)
                )
                  awaitingDeletion = true;
                else referenced = true;
              }
            }
          }
          if (!active || getAuth().currentUser?.uid !== ownerId) break;
          if (awaitingDeletion) {
            unavailable = true;
            continue;
          }
          if (!referenced) {
            await deleteObject(ref(bucket, deletion.path)).catch(
              (error: { code?: string }) => {
                if (error.code !== "storage/object-not-found") throw error;
              },
            );
          }
          await deleteDoc(deletion.reference);
        } catch {
          failed = true;
          // Keep the deletion record to retry when the network is available.
        }
      }
      if (active)
        useMediaSyncStore
          .getState()
          .setStatus(failed ? "error" : unavailable ? "waiting" : "idle");
    } finally {
      running = false;
      if (rerun && active) {
        rerun = false;
        void run();
      }
    }
  }

  const unsubscribers = ["projects", "walkthroughs", "items"].map((name) =>
    onSnapshot(
      collection(database, "users", ownerId, name),
      { includeMetadataChanges: true },
      (snapshot) => {
        for (const key of documents.keys())
          if (key.startsWith(`${name}/`)) documents.delete(key);
        for (const entry of snapshot.docs)
          documents.set(`${name}/${entry.id}`, {
            reference: entry.ref,
            data: entry.data(),
            pending: entry.metadata.hasPendingWrites,
          });
        void run();
      },
      () => {},
    ),
  );
  unsubscribers.push(
    onSnapshot(
      collection(database, "users", ownerId, "media-deletions"),
      { includeMetadataChanges: true },
      (snapshot) => {
        deletions = snapshot.docs
          .filter(
            (entry) =>
              !entry.metadata.hasPendingWrites &&
              typeof entry.data().path === "string" &&
              entry.data().path.startsWith(`users/${ownerId}/media/`),
          )
          .map((entry) => ({ reference: entry.ref, path: entry.data().path }));
        void run();
      },
      () => {},
    ),
  );
  const networkSubscription = Network.addNetworkStateListener(() => {
    void run();
  });
  const timer = setInterval(() => {
    void run();
  }, 30_000);

  return () => {
    active = false;
    useMediaSyncStore.getState().setStatus("idle");
    clearInterval(timer);
    networkSubscription.remove();
    for (const unsubscribe of unsubscribers) unsubscribe();
  };
}
