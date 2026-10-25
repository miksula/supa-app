# Local-Only Mode Plan (Dual-Mode with JSON Import/Export)

This document outlines the plan to turn `VITE_OFFLINE_MODE=true` into a first-class, installable **Local-Only Mode** while keeping `stack/` (Supabase Auth + Postgres + PowerSync Service) intact for deployments that want cloud sync.

## Choosing a Mode & Development Flow

You should treat **Local-Only Mode** and **Synced Mode** as a **project-level (or build-level) choice**, or keep their local database files strictly separated. Mixing the two against the same SQLite file causes subtle data inconsistencies:

1. **Different underlying SQLite tables (`ps_data__*` vs. `ps_data_local__*`):**
   - When `localOnly: false` (Synced Mode), PowerSync creates the `lists` and `todos` views over `ps_data__lists` and `ps_data__todos` and records writes in `ps_crud`.
   - When `localOnly: true` (Local-Only Mode), PowerSync creates the `lists` and `todos` views over `ps_data_local__lists` and `ps_data_local__todos` and skips `ps_crud`.
   - Switching `VITE_OFFLINE_MODE` against the same `.db` file makes previously created rows appear to "vanish" because the views switch which underlying `ps_data*` table they read from.
2. **Owner ID mismatches (`OFFLINE_USER_ID` vs. real `auth.uid()`):**
   - Rows created in Local-Only Mode use `OFFLINE_USER_ID` (`00000000-0000-4000-8000-000000000000`).
   - If those rows were ever queued into `ps_crud` and later uploaded under a real Supabase session, Postgres RLS (`owner_id = auth.uid()` and `created_by = auth.uid()`) would immediately reject and discard them.
3. **First-sync overwrite:**
   - Connecting a Local-Only database to a synced PowerSync stream reconciles `ps_data__*` with the server's checkpoint, wiping any local rows that are not on the server or in `ps_crud`.

### How to Avoid Troubleshooting Headaches During Development

- **Use separate OPFS database filenames per mode** in [app/src/lib/sync/client.ts](../../app/src/lib/sync/client.ts):
  ```ts
  dbFilename: localOnly ? "supa-app-local.db" : "supa-app.db",
  ```
  This guarantees `npm run dev:offline` and `npm run app:start` never touch each other's SQLite tables or upload queues.
- **Decide the primary deployment mode early:**
  - If building a **local-only desktop/mobile PWA**, run exclusively in Local-Only mode (and optionally remove `stack/` once decided).
  - If building a **cloud-synced app**, use `npm run app:start` as your primary workflow and use `npm run dev:offline` only as a sandboxed UI-development mode (with its own `supa-app-local.db` file).
  - If moving data between the two modes, always go through **JSON Export → JSON Import** (which rewrites `owner_id` and `created_by` to the target user and writes to the active mode's tables).

---

## Goals

1. **Dual-mode architecture:**
   - **Synced Mode (default):** Uses Supabase Auth, Postgres, and PowerSync Sync Streams (`supa-app.db`).
   - **Local-Only Mode (`VITE_OFFLINE_MODE=true`):** Runs entirely on the user's computer using OPFS-backed SQLite (`supa-app-local.db`), with no backend or credentials required.
2. **Installable PWA:** Works offline and can be installed as a standalone desktop/mobile app via `manifest.webmanifest` and a service worker.
3. **Portable Data (JSON Export/Import):** Because PowerSync stores local tables as JSON blobs in `ps_data__*` / `ps_data_local__*` behind SQLite views (which rely on PowerSync's WASM extension for `INSTEAD OF` write triggers), backups use a clean, portable JSON export/import format rather than raw `.db` file copying.

---

## Why JSON Import/Export Instead of Raw `.db` Download?

PowerSync's default client schema creates:
- `ps_data__<table>` (or `ps_data_local__<table>` when `localOnly: true`): A table with `(id TEXT PRIMARY KEY, data TEXT)` where all columns are stored as a schemaless JSON string.
- `<table>`: A SQLite `VIEW` that extracts columns from `data` using `CAST(data ->> '$.column' AS ...)`.
- `INSTEAD OF` triggers on those views that call custom PowerSync WASM functions (`powersync_diff`, etc.) and write to `ps_crud` / `ps_oplog`.

While a downloaded `.db` file can be queried with `SELECT` in external SQLite tools, standard SQLite tools cannot `INSERT`/`UPDATE`/`DELETE` through the views without the PowerSync WASM extension loaded, and overwriting an active OPFS file requires tearing down the worker connection. Exporting/importing structured JSON through `TodoStore` works identically in both **Local-Only** and **Synced** modes.

---

## Implementation Steps

### 1. Isolate the Database File and Use `localOnly: true` Tables in Local-Only Mode

**Files:**
- [app/src/lib/sync/schema.ts](../../app/src/lib/sync/schema.ts)
- [app/src/lib/sync/client.ts](../../app/src/lib/sync/client.ts)

When `new Table(...)` is created without `localOnly: true`, every `INSERT`, `UPDATE`, and `DELETE` appends an entry to PowerSync's `ps_crud` upload queue table. In Local-Only mode (`powersync.connect()` is never called), `ps_crud` would grow indefinitely.

Add a schema factory (keeping `AppSchema` as the default export for `npm run schema:generate`) and select both `dbFilename` and `localOnly` based on the mode:

```ts
// app/src/lib/sync/schema.ts
import { column, Schema, Table } from "@powersync/web";

export function createAppSchema(options?: { localOnly?: boolean }) {
  const tableOptions = {
    indexes: {},
    localOnly: options?.localOnly ?? false,
  };

  const lists = new Table(
    {
      created_at: column.text,
      name: column.text,
      owner_id: column.text,
    },
    tableOptions,
  );

  const todos = new Table(
    {
      created_at: column.text,
      completed_at: column.text,
      description: column.text,
      completed: column.integer,
      created_by: column.text,
      completed_by: column.text,
      list_id: column.text,
    },
    tableOptions,
  );

  return new Schema({ lists, todos });
}

export const AppSchema = createAppSchema();
export type Database = (typeof AppSchema)["types"];
```

```ts
// app/src/lib/sync/client.ts
import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { createAppSchema } from "./schema.ts";

export function createPowerSync(options?: { localOnly?: boolean }) {
  const localOnly = options?.localOnly ?? false;
  return new PowerSyncDatabase({
    database: {
      dbFilename: localOnly ? "supa-app-local.db" : "supa-app.db",
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    },
    schema: createAppSchema({ localOnly }),
  });
}
```

---

### 2. Decouple `main.ts` from Supabase When `offline` is `true`

**File:** [app/src/lib/main.ts](../../app/src/lib/main.ts)

Currently, `createClient(config.supabaseUrl, config.supabaseKey)` runs unconditionally in `startApp()`, which throws if `VITE_SUPABASE_URL` or `VITE_SUPABASE_PUBLISHABLE_KEY` are unset in `.env.local`.

In Local-Only mode:
1. Pass `{ localOnly: offline }` to `createPowerSync({ localOnly: offline })`.
2. Skip `createClient(...)` and provide a lightweight local-only `authService` stub when `offline` is `true`:
   ```ts
   const localAuthService = {
     session: null,
     userId: OFFLINE_USER_ID,
     ready: true,
     isAuthenticated: true,
     onAuthStateChange: () => () => {},
     login: async () => {},
     logout: async () => {},
   };
   ```
3. Request persistent browser storage so the browser never evicts the OPFS SQLite database under storage pressure:
   ```ts
   void navigator.storage?.persist?.();
   ```
4. Adapt `Sidebar`:
   - In Local-Only mode, hide the "Sign out" action and either hide `SyncStatusIndicator` or display a `"Local storage"` badge instead of `"Offline"`.

---

### 3. Add JSON Export & Import to `TodoStore`

**File:** [app/src/pages/my-todos/TodoStore.ts](../../app/src/pages/my-todos/TodoStore.ts)

Define a versioned backup schema and add `exportData()` and `importData()` methods to `TodoStore`:

```ts
export type TodoBackupPayload = {
  version: 1;
  exportedAt: string;
  lists: Array<{
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
  }>;
  todos: Array<{
    id: string;
    list_id: string;
    description: string;
    completed: number;
    created_at: string;
    completed_at: string | null;
    created_by: string | null;
    completed_by: string | null;
  }>;
};
```

#### Export (`TodoStore.exportData`)
Query all lists and todos from the local SQLite database:

```ts
async exportData(): Promise<TodoBackupPayload> {
  const lists = await this.db.getAll<TodoBackupPayload["lists"][number]>(
    "SELECT id, name, owner_id, created_at FROM lists ORDER BY created_at ASC, id ASC",
  );
  const todos = await this.db.getAll<TodoBackupPayload["todos"][number]>(
    "SELECT id, list_id, description, completed, created_at, completed_at, created_by, completed_by FROM todos ORDER BY created_at ASC, id ASC",
  );

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    lists,
    todos,
  };
}
```

#### Import (`TodoStore.importData`)
Validate the JSON structure and apply it atomically inside `this.db.writeTransaction(...)`, rewriting `owner_id` / `created_by` to the current local/authenticated user ID so imported rows work seamlessly in both Local-Only and Synced modes:

```ts
async importData(
  payload: TodoBackupPayload,
  options: { userId: string; mode?: "merge" | "replace" },
): Promise<void> {
  if (payload.version !== 1 || !Array.isArray(payload.lists) || !Array.isArray(payload.todos)) {
    throw new Error("Invalid backup file format");
  }

  await this.db.writeTransaction(async (tx) => {
    if (options.mode === "replace") {
      await tx.execute("DELETE FROM todos");
      await tx.execute("DELETE FROM lists");
    }

    for (const list of payload.lists) {
      await tx.execute(
        "INSERT OR REPLACE INTO lists (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)",
        [list.id, list.name, options.userId, list.created_at],
      );
    }

    for (const todo of payload.todos) {
      await tx.execute(
        `INSERT OR REPLACE INTO todos
          (id, list_id, description, completed, created_at, completed_at, created_by, completed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          todo.id,
          todo.list_id,
          todo.description,
          todo.completed ? 1 : 0,
          todo.created_at,
          todo.completed_at ?? null,
          options.userId,
          todo.completed ? options.userId : null,
        ],
      );
    }
  });
}
```

#### Browser Download / Upload Helpers
- **Export button:** Serializes `await store.exportData()` with `JSON.stringify(data, null, 2)`, wraps it in a `Blob(["..."], { type: "application/json" })`, and triggers download via a temporary `<a download="supa-todos-backup-YYYY-MM-DD.json">` element.
- **Import button:** Opens a hidden `<input type="file" accept="application/json">`, reads the file via `await file.text()`, parses JSON, and calls `await store.importData(parsed, { userId, mode: "merge" })`. Because `MyTodosPage` uses `store.watchUserLists()`, the UI updates automatically as soon as the transaction commits.

---

### 4. Make the App Installable (`manifest.webmanifest` + Service Worker)

**Files:**
- `app/public/manifest.webmanifest`
- [app/src/index.html](../../app/src/index.html)
- [app/vite.config.ts](../../app/vite.config.ts)

1. **Web App Manifest (`app/public/manifest.webmanifest`):**
   ```json
   {
     "name": "Local First Todos",
     "short_name": "Todos",
     "description": "Local-first todo list app",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#09090b",
     "theme_color": "#09090b",
     "icons": [
       {
         "src": "/favicon.svg",
         "sizes": "any",
         "type": "image/svg+xml",
         "purpose": "any"
       }
     ]
   }
   ```
2. **Link Manifest in `app/src/index.html`:**
   ```html
   <link rel="manifest" href="/manifest.webmanifest" />
   ```
3. **Service Worker (`vite-plugin-pwa` in `app/vite.config.ts`):**
   - Precache built JS, CSS, HTML, SVG, WOFF2 fonts, the `wa-sqlite` `.wasm` binary, and PowerSync web worker bundles (`globPatterns: ["**/*.{js,css,html,svg,woff2,wasm}"]`).
   - Configure `navigateFallback: "/index.html"` so deep links like `/my-todos` and `/docs/introduction` load offline.
   - Exclude `/auth/v1/*` and `/rest/v1/*` from runtime caching so Synced Mode never caches auth or RPC calls.

---

## Verification Checklist

- [ ] Starting with `npm run dev:offline --workspace=app` (with no `.env.local` or backend running) boots directly into `/my-todos` without console errors and uses `supa-app-local.db`.
- [ ] Creating, renaming, and deleting lists/todos persists across page reloads in OPFS (`supa-app-local.db`) without adding rows to `ps_crud` or affecting `supa-app.db`.
- [ ] Exporting data downloads a `.json` file containing all lists and todos.
- [ ] Importing that `.json` file into a fresh browser profile (or into Synced Mode) restores all lists and todos with the active user's `owner_id` and immediately updates `MyTodosPage`.
- [ ] Building (`npm run build --workspace=app`) and previewing (`npm run preview --workspace=app`) allows installing the app from the browser address bar and reloading `/my-todos` while DevTools is set to _Offline_.
