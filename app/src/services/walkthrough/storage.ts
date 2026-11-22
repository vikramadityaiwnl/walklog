import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import type { Project, PunchItem, Walkthrough } from "../../models/walkthrough";
import { getBannerIllustration } from "../../utils/banner-illustrations";

const DATABASE_NAME = "walklog.db";

function localPhotoUri(uri?: string): string | undefined {
  if (!uri) return uri;
  const marker = "/walkthrough-photos/";
  const index = uri.lastIndexOf(marker);

  return index < 0 || !FileSystem.documentDirectory
    ? uri
    : `${FileSystem.documentDirectory}walkthrough-photos/${uri.slice(index + marker.length)}`;
}

function readWalkthrough(data: string): Walkthrough {
  const walkthrough = JSON.parse(data) as Walkthrough;

  return {
    ...walkthrough,
    bannerIllustration: getBannerIllustration(
      walkthrough.id,
      walkthrough.bannerIllustration,
    ),
    bannerPhotoUri: localPhotoUri(walkthrough.bannerPhotoUri),
  };
}

function readItem(data: string): PunchItem {
  const item = JSON.parse(data) as PunchItem;

  return {
    ...item,
    bannerPhotoUri: localPhotoUri(item.bannerPhotoUri),
    photos: item.photos.map((photo) => ({
      ...photo,
      localUri: localPhotoUri(photo.localUri) ?? photo.localUri,
    })),
  };
}
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = initializeDatabase().catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

async function initializeDatabase(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);

  try {
    await database.execAsync("PRAGMA foreign_keys = ON;");
    const version = await database.getFirstAsync<{ user_version: number }>(
      "PRAGMA user_version",
    );

    if (!version || version.user_version > 3) {
      throw new Error("Unsupported local database version");
    }

    if (version.user_version === 0) {
      await database.execAsync(`
        BEGIN TRANSACTION;
        CREATE TABLE walkthroughs (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        CREATE TABLE punch_items (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          walkthrough_id TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (owner_id, id),
          FOREIGN KEY (owner_id, walkthrough_id)
            REFERENCES walkthroughs (owner_id, id) ON DELETE CASCADE
        );
        CREATE INDEX punch_items_walkthrough_idx
          ON punch_items (owner_id, walkthrough_id, created_at);
        PRAGMA user_version = 1;
        COMMIT;
      `);
    }

    if (version.user_version < 2) {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS projects (
          owner_id TEXT NOT NULL,
          id TEXT NOT NULL,
          data TEXT NOT NULL,
          PRIMARY KEY (owner_id, id)
        );
        PRAGMA user_version = 2;
      `);
    }

    if (version.user_version < 3) {
      await database.execAsync(`
        BEGIN TRANSACTION;
        CREATE TRIGGER punch_item_inserted AFTER INSERT ON punch_items BEGIN
          UPDATE walkthroughs SET updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), data = json_set(data, '$.updatedAt', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)) WHERE owner_id = NEW.owner_id AND id = NEW.walkthrough_id;
        END;
        CREATE TRIGGER punch_item_updated AFTER UPDATE ON punch_items BEGIN
          UPDATE walkthroughs SET updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), data = json_set(data, '$.updatedAt', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)) WHERE owner_id = NEW.owner_id AND id = NEW.walkthrough_id;
        END;
        CREATE TRIGGER punch_item_deleted AFTER DELETE ON punch_items BEGIN
          UPDATE walkthroughs SET updated_at = CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), data = json_set(data, '$.updatedAt', CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)) WHERE owner_id = OLD.owner_id AND id = OLD.walkthrough_id;
        END;
        PRAGMA user_version = 3;
        COMMIT;
      `);
    }

    return database;
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
}

function requireId(value: string, name: string): void {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }
}

/** All records are scoped to the signed-in user's Firebase UID. */
export function createWalkthroughStorage(ownerId: string) {
  requireId(ownerId, "Owner ID");

  return {
    async listProjects(): Promise<Project[]> {
      const database = await getDatabase();
      const rows = await database.getAllAsync<{ data: string }>(
        "SELECT data FROM projects WHERE owner_id = ? ORDER BY json_extract(data, '$.name') COLLATE NOCASE",
        ownerId,
      );

      return rows.map((row) => {
        const project = JSON.parse(row.data) as Project;

        return {
          ...project,
          bannerIllustration: getBannerIllustration(
            project.id,
            project.bannerIllustration,
          ),
          bannerPhotoUri: localPhotoUri(project.bannerPhotoUri),
        };
      });
    },

    async createProject(project: Project): Promise<void> {
      const database = await getDatabase();
      await database.runAsync(
        "INSERT INTO projects (owner_id, id, data) VALUES (?, ?, ?)",
        ownerId,
        project.id,
        JSON.stringify(project),
      );
    },

    async saveProject(project: Project): Promise<void> {
      const database = await getDatabase();
      await database.runAsync(
        "UPDATE projects SET data = ? WHERE owner_id = ? AND id = ?",
        JSON.stringify(project),
        ownerId,
        project.id,
      );
    },

    async deleteProject(id: string): Promise<PunchItem["photos"]> {
      requireId(id, "Project ID");
      const database = await getDatabase();
      const photos: PunchItem["photos"] = [];
      await database.withExclusiveTransactionAsync(async (transaction) => {
        const projectRow = await transaction.getFirstAsync<{ data: string }>(
          "SELECT data FROM projects WHERE owner_id = ? AND id = ?",
          ownerId,
          id,
        );
        if (!projectRow) throw new Error("Project not found");
        const project = JSON.parse(projectRow.data) as Project;
        const projectBanner = localPhotoUri(project.bannerPhotoUri);
        if (projectBanner) photos.push({ localUri: projectBanner });

        const rows = await transaction.getAllAsync<{ data: string }>(
          "SELECT data FROM walkthroughs WHERE owner_id = ? AND json_extract(data, '$.projectId') = ?",
          ownerId,
          id,
        );
        for (const row of rows) {
          const walkthrough = readWalkthrough(row.data);
          if (walkthrough.bannerPhotoUri)
            photos.push({ localUri: walkthrough.bannerPhotoUri });
          const items = await transaction.getAllAsync<{ data: string }>(
            "SELECT data FROM punch_items WHERE owner_id = ? AND walkthrough_id = ?",
            ownerId,
            walkthrough.id,
          );
          for (const itemRow of items) {
            const item = readItem(itemRow.data);
            photos.push(...item.photos);
            if (item.bannerPhotoUri)
              photos.push({ localUri: item.bannerPhotoUri });
          }
          await transaction.runAsync(
            "DELETE FROM walkthroughs WHERE owner_id = ? AND id = ?",
            ownerId,
            walkthrough.id,
          );
        }
        await transaction.runAsync(
          "DELETE FROM projects WHERE owner_id = ? AND id = ?",
          ownerId,
          id,
        );
      });

      return photos;
    },

    async moveWalkthroughs(
      ids: string[],
      projectId: string | null,
    ): Promise<void> {
      const database = await getDatabase();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        if (projectId) {
          const project = await transaction.getFirstAsync(
            "SELECT id FROM projects WHERE owner_id = ? AND id = ?",
            ownerId,
            projectId,
          );
          if (!project) throw new Error("Project not found");
        }
        for (const id of ids) {
          const row = await transaction.getFirstAsync<{ data: string }>(
            "SELECT data FROM walkthroughs WHERE owner_id = ? AND id = ?",
            ownerId,
            id,
          );
          if (!row) throw new Error("Walkthrough not found");
          const walkthrough = readWalkthrough(row.data);
          const updatedAt = Date.now();
          await transaction.runAsync(
            "UPDATE walkthroughs SET data = ?, updated_at = ? WHERE owner_id = ? AND id = ?",
            JSON.stringify({
              ...walkthrough,
              projectId: projectId ?? undefined,
              updatedAt,
            }),
            updatedAt,
            ownerId,
            id,
          );
        }
      });
    },

    async listWalkthroughs(): Promise<Walkthrough[]> {
      const database = await getDatabase();
      const rows = await database.getAllAsync<{ data: string }>(
        "SELECT data FROM walkthroughs WHERE owner_id = ? ORDER BY updated_at DESC, id ASC",
        ownerId,
      );

      return rows.map((row) => readWalkthrough(row.data));
    },

    async getWalkthrough(id: string): Promise<Walkthrough | null> {
      requireId(id, "Walkthrough ID");
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ data: string }>(
        "SELECT data FROM walkthroughs WHERE owner_id = ? AND id = ?",
        ownerId,
        id,
      );

      return row ? readWalkthrough(row.data) : null;
    },

    async saveWalkthrough(walkthrough: Walkthrough): Promise<void> {
      requireId(walkthrough.id, "Walkthrough ID");
      const database = await getDatabase();
      await database.runAsync(
        `INSERT INTO walkthroughs (owner_id, id, updated_at, data)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (owner_id, id) DO UPDATE SET
           updated_at = excluded.updated_at, data = excluded.data`,
        ownerId,
        walkthrough.id,
        walkthrough.updatedAt,
        JSON.stringify(walkthrough),
      );
    },

    async deleteWalkthrough(id: string): Promise<void> {
      requireId(id, "Walkthrough ID");
      const database = await getDatabase();
      await database.runAsync(
        "DELETE FROM walkthroughs WHERE owner_id = ? AND id = ?",
        ownerId,
        id,
      );
    },

    async listItems(walkthroughId: string): Promise<PunchItem[]> {
      requireId(walkthroughId, "Walkthrough ID");
      const database = await getDatabase();
      const rows = await database.getAllAsync<{ data: string }>(
        `SELECT data FROM punch_items WHERE owner_id = ? AND walkthrough_id = ?
         ORDER BY created_at ASC, id ASC`,
        ownerId,
        walkthroughId,
      );

      return rows.map((row) => readItem(row.data));
    },

    async saveItem(item: PunchItem): Promise<void> {
      requireId(item.id, "Item ID");
      requireId(item.walkthroughId, "Walkthrough ID");
      const database = await getDatabase();
      await database.runAsync(
        `INSERT INTO punch_items (owner_id, id, walkthrough_id, created_at, data)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (owner_id, id) DO UPDATE SET
           walkthrough_id = excluded.walkthrough_id,
           created_at = excluded.created_at, data = excluded.data`,
        ownerId,
        item.id,
        item.walkthroughId,
        item.createdAt,
        JSON.stringify(item),
      );
    },

    async createItems(items: PunchItem[]): Promise<void> {
      for (const item of items) {
        requireId(item.id, "Item ID");
        requireId(item.walkthroughId, "Walkthrough ID");
      }

      const database = await getDatabase();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (const item of items) {
          await transaction.runAsync(
            "INSERT INTO punch_items (owner_id, id, walkthrough_id, created_at, data) VALUES (?, ?, ?, ?, ?)",
            ownerId,
            item.id,
            item.walkthroughId,
            item.createdAt,
            JSON.stringify(item),
          );
        }
      });
    },

    async updateItems(items: PunchItem[]): Promise<void> {
      const database = await getDatabase();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (const item of items) {
          requireId(item.id, "Item ID");
          await transaction.runAsync(
            "UPDATE punch_items SET data = ? WHERE owner_id = ? AND id = ?",
            JSON.stringify(item),
            ownerId,
            item.id,
          );
        }
      });
    },

    async deleteItems(ids: string[]): Promise<void> {
      const database = await getDatabase();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        for (const id of ids) {
          requireId(id, "Item ID");
          await transaction.runAsync(
            "DELETE FROM punch_items WHERE owner_id = ? AND id = ?",
            ownerId,
            id,
          );
        }
      });
    },

    async deleteItem(id: string): Promise<void> {
      requireId(id, "Item ID");
      const database = await getDatabase();
      await database.runAsync(
        "DELETE FROM punch_items WHERE owner_id = ? AND id = ?",
        ownerId,
        id,
      );
    },
  };
}
