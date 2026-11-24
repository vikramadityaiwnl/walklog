import * as FileSystem from "expo-file-system/legacy";
import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  getFirestore,
  onSnapshot,
  query,
  where,
  writeBatch,
  type WriteBatch,
  type DocumentData,
  type DocumentReference,
} from "@react-native-firebase/firestore";
import type { Project, PunchItem, Walkthrough } from "../../models/walkthrough";
import { getBannerIllustration } from "../../utils/banner-illustrations";
import {
  localMediaId,
  localMediaUri,
  isRemoteMedia,
  mediaStoragePath,
} from "./media-refs";
import { useDialogStore } from "../../store/dialog-store";
import { useFirestoreStore } from "../../store/firestore-store";

const database = getFirestore();

function localPhotoUri(uri?: string): string | undefined {
  if (!uri) return uri;

  const marker = "/walkthrough-photos/";
  const index = uri.lastIndexOf(marker);

  return index < 0 || !FileSystem.documentDirectory
    ? uri
    : `${FileSystem.documentDirectory}walkthrough-photos/${uri.slice(index + marker.length)}`;
}

type StoredBanner = { pendingBannerId?: string; deletionPending?: boolean };

export type StoredItem = Omit<PunchItem, "photos"> &
  StoredBanner & {
    photos?: (string | PunchItem["photos"][number])[];
    pendingPhotoIds?: string[];
  };

export function readWalkthrough(
  value: Walkthrough & StoredBanner,
): Walkthrough {
  return {
    ...value,
    bannerIllustration: getBannerIllustration(
      value.id,
      value.bannerIllustration,
    ),
    bannerPhotoUri: value.pendingBannerId
      ? localMediaUri(value.pendingBannerId)
      : localPhotoUri(value.bannerPhotoUri),
  };
}

export function readProject(value: Project & StoredBanner): Project {
  return {
    ...value,
    bannerIllustration: getBannerIllustration(
      value.id,
      value.bannerIllustration,
    ),
    bannerPhotoUri: value.pendingBannerId
      ? localMediaUri(value.pendingBannerId)
      : localPhotoUri(value.bannerPhotoUri),
  };
}

export function readItem(value: StoredItem): PunchItem {
  const photos: PunchItem["photos"] = (value.photos ?? []).map((photo) =>
    typeof photo === "string"
      ? { localUri: photo, remoteUrl: photo }
      : {
          ...photo,
          localUri:
            photo.remoteUrl ?? localPhotoUri(photo.localUri) ?? photo.localUri,
        },
  );
  photos.push(
    ...(value.pendingPhotoIds ?? []).map((id) => ({
      localUri: localMediaUri(id),
      remoteUrl: undefined,
    })),
  );

  return {
    ...value,
    bannerPhotoUri: value.pendingBannerId
      ? localMediaUri(value.pendingBannerId)
      : localPhotoUri(value.bannerPhotoUri),
    photos,
  };
}

function serializeBanner<T extends { bannerPhotoUri?: string }>(value: T) {
  const id = localMediaId(value.bannerPhotoUri);

  return {
    ...value,
    bannerPhotoUri: isRemoteMedia(value.bannerPhotoUri)
      ? value.bannerPhotoUri
      : undefined,
    pendingBannerId: id,
  };
}

function serializeItem(item: PunchItem) {
  const remote: string[] = [];
  const pending: string[] = [];
  for (const photo of item.photos) {
    const url =
      photo.remoteUrl ??
      (isRemoteMedia(photo.localUri) ? photo.localUri : undefined);
    const id = localMediaId(photo.localUri);
    if (url) remote.push(url);
    else if (id) pending.push(id);
    else throw new Error("This image is unavailable on this device.");
  }

  return { ...serializeBanner(item), photos: remote, pendingPhotoIds: pending };
}

export function mediaUrls(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  const data = value as { bannerPhotoUri?: unknown; photos?: unknown };
  const result: string[] = [];
  if (
    typeof data.bannerPhotoUri === "string" &&
    isRemoteMedia(data.bannerPhotoUri)
  )
    result.push(data.bannerPhotoUri);
  if (Array.isArray(data.photos)) {
    for (const photo of data.photos) {
      if (typeof photo === "string" && isRemoteMedia(photo)) result.push(photo);
      else if (
        photo &&
        typeof photo === "object" &&
        typeof photo.remoteUrl === "string" &&
        isRemoteMedia(photo.remoteUrl)
      )
        result.push(photo.remoteUrl);
    }
  }

  return result;
}

function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function requireId(value: string, label: string) {
  if (!value.trim() || value.includes("/"))
    throw new Error(`${label} is invalid`);
}

/** Resolve when the atomic batch is visible in Firestore's persistent local cache. */
function commitLocally(ownerId: string, batch: WriteBatch): Promise<void> {
  const marker = doc(collection(database, "users", ownerId, "mutations"));
  batch.set(marker, { createdAt: Date.now() });

  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = () => {};
    unsubscribe = onSnapshot(
      marker,
      (snapshot) => {
        if (snapshot.exists() && !settled) {
          settled = true;
          unsubscribe();
          resolve();
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          unsubscribe();
          reject(error);
        }
      },
    );
    void batch.commit().catch((error: unknown) => {
      if (!settled) {
        settled = true;
        unsubscribe();
        reject(error);
      } else
        useDialogStore
          .getState()
          .showDialog(
            "Couldn’t sync changes",
            "Some changes were rejected. Check your connection and try again.",
          );
    });
  });
}

export function createFirestoreId(
  ownerId: string,
  kind: "projects" | "walkthroughs" | "items",
): string {
  requireId(ownerId, "Owner ID");

  return doc(collection(database, "users", ownerId, kind)).id;
}

/** Documents are scoped to the signed-in user's Firebase UID. */
export function createWalkthroughStorage(ownerId: string) {
  requireId(ownerId, "Owner ID");
  const projects = collection(database, "users", ownerId, "projects");
  const walkthroughs = collection(database, "users", ownerId, "walkthroughs");
  const items = collection(database, "users", ownerId, "items");
  const mediaDeletions = collection(
    database,
    "users",
    ownerId,
    "media-deletions",
  );
  const deletionJobs = collection(database, "users", ownerId, "deletion-jobs");
  const projectRef = (id: string) => doc(projects, id);
  const walkthroughRef = (id: string) => doc(walkthroughs, id);
  const itemRef = (id: string) => doc(items, id);

  async function allProjects() {
    const store = useFirestoreStore.getState();
    if (store.ownerId === ownerId && store.loaded.projects)
      return store.projects;

    return (await getDocs(projects)).docs
      .filter((entry) => entry.data().deletionPending !== true)
      .map((entry) => readProject(entry.data() as Project));
  }

  async function allWalkthroughs() {
    const store = useFirestoreStore.getState();
    if (store.ownerId === ownerId && store.loaded.walkthroughs)
      return store.walkthroughs;

    return (await getDocs(walkthroughs)).docs
      .filter((entry) => entry.data().deletionPending !== true)
      .map((entry) => readWalkthrough(entry.data() as Walkthrough));
  }

  async function allItems() {
    const store = useFirestoreStore.getState();
    if (store.ownerId === ownerId && store.loaded.items) return store.items;

    return (await getDocs(items)).docs.map((entry) =>
      readItem(entry.data() as StoredItem),
    );
  }

  function checkBatchSize(count: number) {
    if (count > 499)
      throw new Error("Too many changes at once. Try a smaller selection.");
  }

  async function cachedData(
    reference: DocumentReference<DocumentData>,
  ): Promise<DocumentData | undefined> {
    const snapshot = await getDocFromCache(reference).catch(() => null);

    return snapshot?.exists() ? snapshot.data() : undefined;
  }

  function queueRemovedMedia(
    batch: WriteBatch,
    before: unknown,
    after?: unknown,
  ): number {
    const retained = new Set(
      mediaUrls(after)
        .map((url) => mediaStoragePath(url, ownerId))
        .filter(Boolean),
    );
    const removed = new Set(
      mediaUrls(before)
        .map((url) => mediaStoragePath(url, ownerId))
        .filter((path): path is string => !!path && !retained.has(path)),
    );
    for (const path of removed)
      batch.set(doc(mediaDeletions), { path, createdAt: Date.now() });

    return removed.size;
  }

  async function saveItemBatch(changed: PunchItem[]) {
    const affected = [...new Set(changed.map((item) => item.walkthroughId))];
    const batch = writeBatch(database);
    let count = changed.length + affected.length;
    for (const item of changed) {
      requireId(item.id, "Item ID");
      requireId(item.walkthroughId, "Walkthrough ID");
      const parent = await cachedData(walkthroughRef(item.walkthroughId));
      if (parent?.deletionPending === true)
        throw new Error("This walkthrough is being deleted.");
      const updated = clean(serializeItem(item));
      count += queueRemovedMedia(
        batch,
        await cachedData(itemRef(item.id)),
        updated,
      );
      batch.set(itemRef(item.id), updated);
    }
    checkBatchSize(count);
    for (const id of affected)
      batch.update(walkthroughRef(id), { updatedAt: Date.now() });
    await commitLocally(ownerId, batch);
  }

  async function deleteItemBatch(ids: string[]) {
    const current = (await allItems()).filter((item) => ids.includes(item.id));
    const affected = [...new Set(current.map((item) => item.walkthroughId))];
    const batch = writeBatch(database);
    let count = current.length + affected.length;
    for (const item of current) {
      count += queueRemovedMedia(batch, await cachedData(itemRef(item.id)));
      batch.delete(itemRef(item.id));
    }
    checkBatchSize(count);
    for (const id of affected)
      batch.update(walkthroughRef(id), { updatedAt: Date.now() });
    await commitLocally(ownerId, batch);
  }

  return {
    async listProjects(): Promise<Project[]> {
      return (await allProjects()).sort((a, b) => a.name.localeCompare(b.name));
    },
    async createProject(project: Project): Promise<void> {
      const batch = writeBatch(database);
      batch.set(projectRef(project.id), clean(serializeBanner(project)));
      await commitLocally(ownerId, batch);
    },
    async createProjectAndMove(project: Project, ids: string[]): Promise<void> {
      const selected = (await allWalkthroughs()).filter((entry) =>
        ids.includes(entry.id),
      );
      if (selected.length !== ids.length)
        throw new Error("Walkthrough not found");
      checkBatchSize(selected.length + 1);
      const batch = writeBatch(database);
      batch.set(projectRef(project.id), clean(serializeBanner(project)));
      for (const entry of selected)
        batch.set(
          walkthroughRef(entry.id),
          clean(
            serializeBanner({
              ...entry,
              projectId: project.id,
              updatedAt: Date.now(),
            }),
          ),
        );
      await commitLocally(ownerId, batch);
    },
    async saveProject(project: Project): Promise<void> {
      if ((await cachedData(projectRef(project.id)))?.deletionPending === true)
        throw new Error("This project is being deleted.");
      const batch = writeBatch(database);
      const updated = clean(serializeBanner(project));
      checkBatchSize(
        1 +
          queueRemovedMedia(
            batch,
            await cachedData(projectRef(project.id)),
            updated,
          ),
      );
      batch.set(projectRef(project.id), updated);
      await commitLocally(ownerId, batch);
    },
    async listWalkthroughs(): Promise<Walkthrough[]> {
      return (await allWalkthroughs()).sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      );
    },
    async getWalkthrough(id: string): Promise<Walkthrough | null> {
      requireId(id, "Walkthrough ID");
      const store = useFirestoreStore.getState();
      const snapshot =
        store.ownerId === ownerId && store.loaded.walkthroughs
          ? await getDocFromCache(walkthroughRef(id)).catch(() =>
              getDoc(walkthroughRef(id)),
            )
          : await getDoc(walkthroughRef(id));

      return snapshot.exists() && snapshot.data().deletionPending !== true
        ? readWalkthrough(snapshot.data() as Walkthrough)
        : null;
    },
    async saveWalkthrough(walkthrough: Walkthrough): Promise<void> {
      requireId(walkthrough.id, "Walkthrough ID");
      if (
        (await cachedData(walkthroughRef(walkthrough.id)))?.deletionPending ===
        true
      )
        throw new Error("This walkthrough is being deleted.");
      const batch = writeBatch(database);
      const updated = clean(serializeBanner(walkthrough));
      checkBatchSize(
        1 +
          queueRemovedMedia(
            batch,
            await cachedData(walkthroughRef(walkthrough.id)),
            updated,
          ),
      );
      batch.set(walkthroughRef(walkthrough.id), updated);
      await commitLocally(ownerId, batch);
    },
    async listItems(walkthroughId: string): Promise<PunchItem[]> {
      requireId(walkthroughId, "Walkthrough ID");
      const store = useFirestoreStore.getState();
      if (store.ownerId === ownerId && store.loaded.items) {
        const snapshot = await getDocsFromCache(
          query(items, where("walkthroughId", "==", walkthroughId)),
        );

        return snapshot.docs
          .map((entry) => readItem(entry.data() as StoredItem))
          .sort(
            (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
          );
      }

      if (
        (await getDoc(walkthroughRef(walkthroughId))).data()
          ?.deletionPending === true
      )
        throw new Error("This walkthrough is being deleted.");
      const snapshot = await getDocs(
        query(items, where("walkthroughId", "==", walkthroughId)),
      );

      return snapshot.docs
        .map((entry) => readItem(entry.data() as StoredItem))
        .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    },
    async saveItem(item: PunchItem): Promise<void> {
      await saveItemBatch([item]);
    },
    async createItems(values: PunchItem[]): Promise<void> {
      await saveItemBatch(values);
    },
    async updateItems(values: PunchItem[]): Promise<void> {
      await saveItemBatch(values);
    },
    async deleteItem(id: string): Promise<void> {
      await deleteItemBatch([id]);
    },
    async deleteItems(ids: string[]): Promise<void> {
      await deleteItemBatch(ids);
    },
    async moveWalkthroughs(
      ids: string[],
      projectId: string | null,
    ): Promise<void> {
      const selected = (await allWalkthroughs()).filter((entry) =>
        ids.includes(entry.id),
      );
      if (selected.length !== ids.length)
        throw new Error("Walkthrough not found");
      if (projectId && !(await getDoc(projectRef(projectId))).exists())
        throw new Error("Project not found");
      checkBatchSize(selected.length);
      const batch = writeBatch(database);
      for (const entry of selected)
        batch.set(
          walkthroughRef(entry.id),
          clean(
            serializeBanner({
              ...entry,
              projectId: projectId ?? undefined,
              updatedAt: Date.now(),
            }),
          ),
        );
      await commitLocally(ownerId, batch);
    },
    async deleteWalkthrough(id: string): Promise<void> {
      requireId(id, "Walkthrough ID");
      const batch = writeBatch(database);
      batch.update(walkthroughRef(id), { deletionPending: true });
      batch.set(doc(deletionJobs), {
        kind: "walkthrough",
        targetId: id,
        createdAt: Date.now(),
      });
      await commitLocally(ownerId, batch);
    },
    async deleteProject(id: string): Promise<void> {
      const allProjectsList = await allProjects();
      const project = allProjectsList.find((entry) => entry.id === id);
      if (!project) throw new Error("Project not found");

      const batch = writeBatch(database);
      batch.update(projectRef(id), { deletionPending: true });
      batch.set(doc(deletionJobs), {
        kind: "project",
        targetId: id,
        createdAt: Date.now(),
      });
      await commitLocally(ownerId, batch);
    },
  };
}
