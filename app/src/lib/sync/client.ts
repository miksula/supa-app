import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { AppSchema } from "./schema.ts";

/**
 * OPFSCoopSyncVFS supports multiple tabs across browsers, including Safari.
 * Use WASQLiteVFS.AccessHandlePoolVFS for single-tab apps with the best performance.
 * https://docs.powersync.com/client-sdk-references/javascript-web#sqlite-virtual-file-systems
 */
export function createPowerSync() {
  return new PowerSyncDatabase({
    database: {
      dbFilename: "supa-app.db",
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    },
    schema: AppSchema,
  });
}
