import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { wrapPowerSyncWithKysely } from "@powersync/kysely-driver";
import { AppSchema, Database } from "./schema.ts";
import { SupabaseConnector } from "./SupabaseConnector.ts";

/**
 * Default configuration AccessHandlePoolVFS - uses IndexedDB
 * ✅ Use this for: Simple setup, most browsers
 * ❌ Avoid if: You need Safari support or have stability issues
 */
// export const powerSync = new PowerSyncDatabase({
//   schema: AppSchema,
//   database: {
//     dbFilename: 'example.db'
//   },
//   logger: logger
// });

/**
 * Alternative configuration with OPFS storage (Origin Private File System)
 *
 * 🚀 RECOMMENDED: Use OPFSCoopSyncVFS for production apps
 *
 * ✅ When to use:
 * - You need multi-tab support across ALL browsers (including Safari)
 * - Better performance than IndexedDB
 * - Safari/iOS compatibility is important
 *
 * ❌ When NOT to use:
 * - Safari incognito mode (known issues)
 * - You prefer simpler setup
 *
 * Alternative: Change to WASQLiteVFS.AccessHandlePoolVFS for single-tab apps with best performance
 *
 * 📚 Learn more: https://docs.powersync.com/client-sdk-references/javascript-web#sqlite-virtual-file-systems
 */
export const powersync = new PowerSyncDatabase({
  database: {
    dbFilename: "supa-app.db",
    vfs: WASQLiteVFS.OPFSCoopSyncVFS, // Use AccessHandlePoolVFS for single-tab only
  },
  flags: {
    enableMultiTabs: typeof SharedWorker !== "undefined",
    externallyUnload: true,
  },
  schema: AppSchema,
});

export const supabase = new SupabaseConnector();

export async function connectPowersync() {
  if (import.meta.env.VITE_OFFLINE_MODE === "true") {
    return;
  }

  await powersync.connect(supabase);
}

export async function resetPowersyncForSessionChange() {
  if (import.meta.env.VITE_OFFLINE_MODE === "true") {
    return;
  }

  await powersync.disconnectAndClear({ clearLocal: true });
}

export const db = wrapPowerSyncWithKysely<Database>(powersync);
