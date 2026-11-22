import * as SQLite from "expo-sqlite";
import type { PunchItem, Walkthrough } from "../models/walkthrough";

const DATABASE_NAME = "walklog.db";
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

    if (!version || version.user_version > 1) {
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
    async listWalkthroughs(): Promise<Walkthrough[]> {
      const database = await getDatabase();
      const rows = await database.getAllAsync<{ data: string }>(
        "SELECT data FROM walkthroughs WHERE owner_id = ? ORDER BY updated_at DESC, id ASC",
        ownerId,
      );

      return rows.map((row) => JSON.parse(row.data) as Walkthrough);
    },

    async getWalkthrough(id: string): Promise<Walkthrough | null> {
      requireId(id, "Walkthrough ID");
      const database = await getDatabase();
      const row = await database.getFirstAsync<{ data: string }>(
        "SELECT data FROM walkthroughs WHERE owner_id = ? AND id = ?",
        ownerId,
        id,
      );

      return row ? (JSON.parse(row.data) as Walkthrough) : null;
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

      return rows.map((row) => JSON.parse(row.data) as PunchItem);
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
