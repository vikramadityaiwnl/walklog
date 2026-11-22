import * as FileSystem from "expo-file-system/legacy";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  where,
  writeBatch,
  type WriteBatch,
} from "@react-native-firebase/firestore";
import type { Project, PunchItem, Walkthrough } from "../../models/walkthrough";
import { getBannerIllustration } from "../../utils/banner-illustrations";
import { useDialogStore } from "../../store/dialog-store";

const database = getFirestore();

function localPhotoUri(uri?: string): string | undefined {
  if (!uri) return uri;
  const marker = "/walkthrough-photos/";
  const index = uri.lastIndexOf(marker);
  return index < 0 || !FileSystem.documentDirectory
    ? uri
    : `${FileSystem.documentDirectory}walkthrough-photos/${uri.slice(index + marker.length)}`;
}

function readWalkthrough(value: Walkthrough): Walkthrough {
  return {
    ...value,
    bannerIllustration: getBannerIllustration(
      value.id,
      value.bannerIllustration,
    ),
    bannerPhotoUri: localPhotoUri(value.bannerPhotoUri),
  };
}

function readProject(value: Project): Project {
  return {
    ...value,
    bannerIllustration: getBannerIllustration(
      value.id,
      value.bannerIllustration,
    ),
    bannerPhotoUri: localPhotoUri(value.bannerPhotoUri),
  };
}

function readItem(value: PunchItem): PunchItem {
  return {
    ...value,
    bannerPhotoUri: localPhotoUri(value.bannerPhotoUri),
    photos: (value.photos ?? []).map((photo) => ({
      ...photo,
      localUri: localPhotoUri(photo.localUri) ?? photo.localUri,
    })),
  };
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
  const projectRef = (id: string) => doc(projects, id);
  const walkthroughRef = (id: string) => doc(walkthroughs, id);
  const itemRef = (id: string) => doc(items, id);

  async function allProjects() {
    return (await getDocs(projects)).docs.map((entry) =>
      readProject(entry.data() as Project),
    );
  }

  async function allWalkthroughs() {
    return (await getDocs(walkthroughs)).docs.map((entry) =>
      readWalkthrough(entry.data() as Walkthrough),
    );
  }

  async function allItems() {
    return (await getDocs(items)).docs.map((entry) =>
      readItem(entry.data() as PunchItem),
    );
  }

  function checkBatchSize(count: number) {
    if (count > 499)
      throw new Error("Too many changes at once. Try a smaller selection.");
  }

  async function saveItemBatch(changed: PunchItem[]) {
    const affected = [...new Set(changed.map((item) => item.walkthroughId))];
    checkBatchSize(changed.length + affected.length);
    const batch = writeBatch(database);
    for (const item of changed) {
      requireId(item.id, "Item ID");
      requireId(item.walkthroughId, "Walkthrough ID");
      batch.set(itemRef(item.id), clean(item));
    }
    for (const id of affected)
      batch.update(walkthroughRef(id), { updatedAt: Date.now() });
    await commitLocally(ownerId, batch);
  }

  async function deleteItemBatch(ids: string[]) {
    const current = (await allItems()).filter((item) => ids.includes(item.id));
    const affected = [...new Set(current.map((item) => item.walkthroughId))];
    checkBatchSize(current.length + affected.length);
    const batch = writeBatch(database);
    for (const item of current) batch.delete(itemRef(item.id));
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
      batch.set(projectRef(project.id), clean(project));
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
      batch.set(projectRef(project.id), clean(project));
      for (const entry of selected)
        batch.set(
          walkthroughRef(entry.id),
          clean({ ...entry, projectId: project.id, updatedAt: Date.now() }),
        );
      await commitLocally(ownerId, batch);
    },
    async saveProject(project: Project): Promise<void> {
      const batch = writeBatch(database);
      batch.set(projectRef(project.id), clean(project));
      await commitLocally(ownerId, batch);
    },
    async listWalkthroughs(): Promise<Walkthrough[]> {
      return (await allWalkthroughs()).sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      );
    },
    async getWalkthrough(id: string): Promise<Walkthrough | null> {
      requireId(id, "Walkthrough ID");
      const snapshot = await getDoc(walkthroughRef(id));
      return snapshot.exists()
        ? readWalkthrough(snapshot.data() as Walkthrough)
        : null;
    },
    async saveWalkthrough(walkthrough: Walkthrough): Promise<void> {
      requireId(walkthrough.id, "Walkthrough ID");
      const batch = writeBatch(database);
      batch.set(walkthroughRef(walkthrough.id), clean(walkthrough));
      await commitLocally(ownerId, batch);
    },
    async listItems(walkthroughId: string): Promise<PunchItem[]> {
      requireId(walkthroughId, "Walkthrough ID");
      const snapshot = await getDocs(
        query(items, where("walkthroughId", "==", walkthroughId)),
      );

      return snapshot.docs
        .map((entry) => readItem(entry.data() as PunchItem))
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
          clean({
            ...entry,
            projectId: projectId ?? undefined,
            updatedAt: Date.now(),
          }),
        );
      await commitLocally(ownerId, batch);
    },
    async deleteWalkthrough(id: string): Promise<void> {
      const children = (await allItems()).filter(
        (item) => item.walkthroughId === id,
      );
      checkBatchSize(children.length + 1);
      const batch = writeBatch(database);
      for (const item of children) batch.delete(itemRef(item.id));
      batch.delete(walkthroughRef(id));
      await commitLocally(ownerId, batch);
    },
    async deleteProject(id: string): Promise<PunchItem["photos"]> {
      const [allProjectsList, allWalkthroughsList] = await Promise.all([
        allProjects(),
        allWalkthroughs(),
      ]);
      const project = allProjectsList.find((entry) => entry.id === id);
      if (!project) throw new Error("Project not found");
      const selected = allWalkthroughsList.filter(
        (entry) => entry.projectId === id,
      );
      checkBatchSize(1 + selected.length);
      const photos: PunchItem["photos"] = [];
      if (project.bannerPhotoUri)
        photos.push({ localUri: project.bannerPhotoUri });
      const batch = writeBatch(database);
      for (const entry of selected)
        batch.set(
          walkthroughRef(entry.id),
          clean({ ...entry, projectId: undefined, updatedAt: Date.now() }),
        );
      batch.delete(projectRef(id));
      await commitLocally(ownerId, batch);
      return photos;
    },
  };
}
