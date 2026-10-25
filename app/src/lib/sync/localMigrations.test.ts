import type { PowerSyncDatabase, Transaction } from "@powersync/web";
import { describe, expect, it, vi } from "vitest";
import { runLocalMigrations, runMigrations, type LocalMigration } from "./localMigrations.ts";

function createFakeDb(initialVersion = 0) {
  let userVersion = initialVersion;
  const executed: string[] = [];

  const tx = {
    getOptional: vi.fn(async (sql: string) => {
      if (sql === "PRAGMA user_version") {
        return { user_version: userVersion };
      }
      return null;
    }),
    execute: vi.fn(async (sql: string) => {
      executed.push(sql);
      const match = /^PRAGMA user_version = (\d+)$/.exec(sql);
      if (match) {
        userVersion = Number(match[1]);
      }
    }),
  } as unknown as Transaction;

  const db = {
    writeTransaction: vi.fn(async <T>(callback: (tx: Transaction) => Promise<T>): Promise<T> => {
      return await callback(tx);
    }),
  } as unknown as Pick<PowerSyncDatabase, "writeTransaction">;

  return {
    db,
    tx,
    executed,
    getUserVersion: () => userVersion,
  };
}

describe("localMigrations", () => {
  it("runs pending migrations in order and updates user_version after each", async () => {
    const { db, executed, getUserVersion } = createFakeDb(0);
    const migrations: LocalMigration[] = [
      {
        version: 1,
        up: async (tx) => {
          await tx.execute("UPDATE todos SET completed = 0 WHERE completed IS NULL");
        },
      },
      {
        version: 2,
        up: async (tx) => {
          await tx.execute("UPDATE lists SET name = 'Untitled' WHERE name = ''");
        },
      },
    ];

    await runMigrations(db, migrations);

    expect(getUserVersion()).toBe(2);
    expect(executed).toEqual([
      "UPDATE todos SET completed = 0 WHERE completed IS NULL",
      "PRAGMA user_version = 1",
      "UPDATE lists SET name = 'Untitled' WHERE name = ''",
      "PRAGMA user_version = 2",
    ]);
  });

  it("skips already-applied migrations", async () => {
    const { db, executed, getUserVersion } = createFakeDb(1);
    const firstUp = vi.fn();
    const secondUp = vi.fn(async (tx: Transaction) => {
      await tx.execute("UPDATE lists SET name = 'Migrated'");
    });

    await runMigrations(db, [
      { version: 1, up: firstUp },
      { version: 2, up: secondUp },
    ]);

    expect(firstUp).not.toHaveBeenCalled();
    expect(secondUp).toHaveBeenCalledOnce();
    expect(getUserVersion()).toBe(2);
    expect(executed).toEqual(["UPDATE lists SET name = 'Migrated'", "PRAGMA user_version = 2"]);
  });

  it("rethrows when a migration fails and does not run later migrations", async () => {
    const { db, executed, getUserVersion } = createFakeDb(0);
    const secondUp = vi.fn();

    await expect(
      runMigrations(db, [
        {
          version: 1,
          up: async () => {
            throw new Error("Migration 1 failed");
          },
        },
        {
          version: 2,
          up: secondUp,
        },
      ]),
    ).rejects.toThrow("Migration 1 failed");

    expect(secondUp).not.toHaveBeenCalled();
    expect(getUserVersion()).toBe(0);
    expect(executed).toEqual([]);
  });

  it("does not change user_version when there are no migrations", async () => {
    const { db, executed, getUserVersion } = createFakeDb(0);
    await runLocalMigrations(db);
    expect(getUserVersion()).toBe(0);
    expect(executed).toEqual([]);
  });
});
