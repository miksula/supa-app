import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { LocalOnlySchema } from "./localSchema.ts";
import { AppSchema } from "./schema.ts";

/**
 * OPFSCoopSyncVFS supports multiple tabs across browsers, including Safari.
 * Use WASQLiteVFS.AccessHandlePoolVFS for single-tab apps with the best performance.
 * https://docs.powersync.com/client-sdk-references/javascript-web#sqlite-virtual-file-systems
 */
export function createPowerSync(options?: { localOnly?: boolean }) {
  const localOnly = options?.localOnly ?? false;
  return new PowerSyncDatabase({
    database: {
      dbFilename: localOnly ? "supa-app-local.db" : "supa-app.db",
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    },
    schema: localOnly ? LocalOnlySchema : AppSchema,
  });
}
