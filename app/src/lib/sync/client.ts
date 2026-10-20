import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { wrapPowerSyncWithKysely } from "@powersync/kysely-driver";
import { AppSchema, Database } from "./schema.ts";
import { authService } from "../auth/auth.ts";
import { SupabasePowerSyncConnector } from "./SupabasePowerSyncConnector.ts";

export const isOfflineMode = import.meta.env.VITE_OFFLINE_MODE === "true";

/**
 * OPFSCoopSyncVFS supports multiple tabs across browsers, including Safari.
 * Use WASQLiteVFS.AccessHandlePoolVFS for single-tab apps with the best performance.
 * https://docs.powersync.com/client-sdk-references/javascript-web#sqlite-virtual-file-systems
 */
export const powersync = new PowerSyncDatabase({
  database: {
    dbFilename: "supa-app.db",
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
  },
  schema: AppSchema,
});

const powersyncConnector = new SupabasePowerSyncConnector(
  authService,
  import.meta.env.VITE_POWERSYNC_URL,
);

export async function connectPowersync() {
  if (isOfflineMode) {
    return;
  }

  await powersync.connect(powersyncConnector);
}

export async function resetPowersyncForSessionChange() {
  if (isOfflineMode) {
    return;
  }

  await powersync.disconnectAndClear({ clearLocal: true });
}

/**
 * Typed Kysely query builder over the local database. Not used yet (TodoStore uses
 * raw SQL); kept for the todo repository work.
 * @public
 */
export const db = wrapPowerSyncWithKysely<Database>(powersync);
