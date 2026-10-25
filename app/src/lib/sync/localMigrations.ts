import type { PowerSyncDatabase, Transaction } from "@powersync/web";

export type LocalMigration = {
  version: number;
  up: (tx: Transaction) => Promise<void>;
};

/** Data migrations for Local-Only Mode. Versions are consecutive integers starting at 1. */
const LOCAL_MIGRATIONS: LocalMigration[] = [];

export async function runMigrations(
  db: Pick<PowerSyncDatabase, "writeTransaction">,
  migrations: LocalMigration[],
) {
  await db.writeTransaction(async (tx) => {
    const row = await tx.getOptional<{ user_version: number }>("PRAGMA user_version");
    const currentVersion = row?.user_version ?? 0;

    for (const migration of migrations) {
      if (migration.version <= currentVersion) continue;
      await migration.up(tx);
      await tx.execute(`PRAGMA user_version = ${migration.version}`);
    }
  });
}

export function runLocalMigrations(db: Pick<PowerSyncDatabase, "writeTransaction">) {
  return runMigrations(db, LOCAL_MIGRATIONS);
}
