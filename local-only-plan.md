# Local-Only Mode Plan

This plan turns `VITE_OFFLINE_MODE=true` into a first-class, installable **Local-Only Mode**, while keeping **Synced Mode** (Supabase Auth + Postgres + PowerSync Service in `stack/`) unchanged.

## How to Use This Plan

- Implement the phases in order, one commit or PR per phase:
  1. [Database isolation](#phase-1-database-isolation)
  2. [Local auth and wiring](#phase-2-local-auth-and-wiring)
  3. [Export and import](#phase-3-export-and-import-settings-page)
  4. [Installable app](#phase-4-installable-app-pwa)
  5. [Migrations and data-loss policy](#phase-5-migrations-and-data-loss-policy)
- A phase is done when its tests exist and pass, `npm run check` is green, its acceptance checklist is ticked, and its rows in [Documentation Updates](#documentation-updates) are done.
- Never hand-edit [app/src/lib/sync/schema.ts](app/src/lib/sync/schema.ts). `npm run schema:generate` overwrites it from `stack/powersync/sync-config.yaml`.
- Don't change `stack/` (Postgres schema, RLS, sync config). Synced Mode must behave exactly as before.

## Decisions

| Topic            | Decision                                                                                                                                                                                     |
| :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local schema     | Derived from the generated `AppSchema` in a new file, `localSchema.ts`. `schema.ts` stays generator-owned.                                                                                   |
| Database file    | `supa-app-local.db` in Local-Only Mode, `supa-app.db` in Synced Mode.                                                                                                                        |
| Login            | Cosmetic login screen that mocks Supabase auth. It accepts one pre-defined email/password pair from `VITE_LOCAL_AUTH_EMAIL` / `VITE_LOCAL_AUTH_PASSWORD`. It is **not** a security boundary. |
| Sign-out         | Local-Only: clears the session only; data stays. Synced: unchanged (wipes local data).                                                                                                       |
| Sync status      | Shows **Local only** in Local-Only Mode.                                                                                                                                                     |
| Export           | Available in both modes.                                                                                                                                                                     |
| Import           | **Local-Only Mode only.** Merges by `id` (update or insert). No replace mode.                                                                                                                |
| Export/import UI | New Settings page in `app/src/pages/settings/`, served at `/settings`.                                                                                                                       |
| Builds           | New `build:offline` script. The build fails if the local login credentials are missing.                                                                                                      |
| Installable app  | `vite-plugin-pwa@^2`, service worker in both builds, automatic updates.                                                                                                                      |
| Migrations       | `PRAGMA user_version` runner for data transformations, plus a written data-loss policy for removed or renamed tables.                                                                        |

---

## Background

### Never Open One Database File in Both Modes

1. **Different underlying tables.** Synced tables store rows in `ps_data__<table>`, and every write is queued for upload. Local-only tables store rows in `ps_data_local__<table>` and never queue anything. Opening a file with the other mode's schema doesn't just hide rows: when a table changes from local-only to synced, PowerSync **permanently deletes** the local-only data.
2. **Owner IDs.** Local-Only rows are owned by `OFFLINE_USER_ID` (`00000000-0000-4000-8000-000000000000`). Uploaded under a real Supabase session, they would fail RLS (`owner_id = auth.uid()`, `created_by = auth.uid()`), and the connector discards transactions that fail with RLS or constraint errors.
3. **First-sync overwrite.** Connecting a database to the sync service reconciles synced tables with the server. Local rows that are neither on the server nor in the upload queue are removed.

Phase 1 gives each mode its own database file, and the side-by-side workflow below gives each its own browser origin. Data moves between modes in one direction only: **export in Synced Mode → import in Local-Only Mode** (import rewrites ownership to the local user). Moving Local-Only data into a synced account is out of scope.

### Side-by-Side Development

About 95% of the code (UI, routing, `TodoStore`, styles, tests) is shared, so **don't split the modes into separate repositories**. Browsers scope `localStorage`, OPFS (SQLite files), IndexedDB and service workers by origin (`scheme + host + port`), so running the modes on different ports keeps their data apart. `VITE_DEV_PORT` is already supported in [app/vite.config.ts](app/vite.config.ts).

**Option 1: one checkout, two ports (recommended).** UI and store edits hot-reload in both tabs:

- Terminal 1, Synced Mode at `http://localhost:5173`:
  ```sh
  npm run app:start
  ```
- Terminal 2, Local-Only Mode at `http://localhost:5174`:
  ```sh
  VITE_DEV_PORT=5174 npm run dev:offline --workspace=app
  ```

**Option 2: Git worktree.** Use this for branch-specific experiments, or to keep two persistent `.env.local` files in separate editor windows:

```sh
git worktree add ../supa-app-local -b feat/local-only
```

- Main checkout `app/.env.local`: `VITE_OFFLINE_MODE=false`, `VITE_DEV_PORT=5173`
- Local-only worktree `app/.env.local`: `VITE_OFFLINE_MODE=true`, `VITE_DEV_PORT=5174`

**Option 3: separate repository.** Avoid this during active development. Every CSS, component, router and `TodoStore` change would have to be ported twice. Only consider it for publishing a stripped-down template at the end.

### Why JSON Export/Import Instead of Copying the `.db` File

PowerSync's client schema creates:

- `ps_data__<table>` / `ps_data_local__<table>`: `(id TEXT PRIMARY KEY, data TEXT)`, with all columns in a schemaless JSON string.
- `<table>`: a SQLite `VIEW` that extracts columns with `CAST(data ->> '$.column' AS ...)`.
- `INSTEAD OF` triggers on those views that call PowerSync's SQLite extension functions (for example `powersync_diff`) and, for synced tables, write to the upload queue.

External SQLite tools can read a downloaded `.db` file, but they can't write through the views without the PowerSync extension. Replacing an open OPFS file would also mean tearing down the database worker. A versioned JSON format, read and written through `TodoStore`, avoids both problems.

---

## Phase 1: Database Isolation

**Goal:** Local-Only Mode stores data in local-only tables in its own database file. Auth is unchanged in this phase: offline mode still opens every route, as it does today.

**Files**

- New: `app/src/lib/sync/localSchema.ts`, `app/src/lib/sync/localSchema.test.ts`, `app/src/lib/sync/storagePersistence.ts`
- Change: [client.ts](app/src/lib/sync/client.ts), [main.ts](app/src/lib/main.ts)

### 1.1 Local-Only Schema

Build the local-only schema from the generated one. Don't touch `schema.ts`:

```ts
// app/src/lib/sync/localSchema.ts
import { ResolvedTable, Schema } from "@powersync/web";
import { AppSchema } from "./schema.ts";

/**
 * The generated AppSchema with every table marked local-only: same tables and
 * columns, stored in `ps_data_local__*` and never written to the upload queue.
 */
export const LocalOnlySchema = new Schema(
  AppSchema.tables.map((table) => new ResolvedTable({ ...table.options, localOnly: true })),
);
```

- `AppSchema.tables` are `ResolvedTable`s whose `options` already include `name`, `columns` and `indexes`. The spread copies them and doesn't modify `AppSchema`.
- Row types are identical, so `Database` from `schema.ts` stays the type source for `TodoStore`.
- After `npm run schema:generate`, new tables and columns appear in Local-Only Mode automatically. Removed or renamed tables lose their data; see [Phase 5](#phase-5-migrations-and-data-loss-policy).

### 1.2 Database Factory

```ts
// app/src/lib/sync/client.ts
import { PowerSyncDatabase, WASQLiteVFS } from "@powersync/web";
import { LocalOnlySchema } from "./localSchema.ts";
import { AppSchema } from "./schema.ts";

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
```

Keep the existing VFS comment in `client.ts`.

### 1.3 Persistent Storage

In Local-Only Mode the device holds the only copy of the data, so ask the browser not to evict it under storage pressure:

```ts
// app/src/lib/sync/storagePersistence.ts
/** Asks the browser not to evict this origin's storage (OPFS database included). */
export async function requestPersistentStorage() {
  try {
    if (await navigator.storage?.persisted?.()) return;
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn("Persistent storage request failed", error);
  }
}
```

Firefox may show a one-time permission prompt. Chromium decides silently and grants it more readily for installed apps.

### 1.4 Wiring

In `main.ts`:

- `createPowerSync({ localOnly: offline })`
- `if (offline) void requestPersistentStorage();`

### Tests

- `localSchema.test.ts`: every `LocalOnlySchema` table has `localOnly === true`; table names, column names and types, and index names match `AppSchema`; `AppSchema` tables are still not local-only.
- No existing test imports `@powersync/web` at runtime. If it can't be loaded under Vitest, drop this test and rely on the manual checks below.

### Acceptance

- [x] `npm run app:start:offline` with no backend running: lists and todos can be created and survive a reload.
- [x] OPFS contains `supa-app-local.db` (DevTools → Application → Storage, or `navigator.storage.getDirectory()`). Synced Mode still uses only `supa-app.db`.
- [x] After writes in Local-Only Mode, `await powersync.getUploadQueueStats()` reports `count: 0` (check with a temporary log; don't commit it).
- [x] `npm run app:start` (Synced Mode) behaves exactly as before.

Data created by the old offline mode lives in `supa-app.db` and isn't carried over. It's development data, so no migration is needed.

---

## Phase 2: Local Auth and Wiring

**Goal:** Local-Only Mode gets a login screen backed by a mock of Supabase auth. Routes are guarded in both modes, the app runs without any backend configuration, the sync status shows **Local only**, and Local-Only production builds are possible.

**Files**

- New: `app/src/lib/auth/LocalAuthService.ts`, `app/src/lib/auth/LocalAuthService.test.ts`
- Change: [config.ts](app/src/lib/config.ts), [vite-env.d.ts](app/src/vite-env.d.ts), [AuthService.ts](app/src/lib/auth/AuthService.ts), [main.ts](app/src/lib/main.ts), [syncStatus.ts](app/src/lib/sync/syncStatus.ts), [SyncStatusIndicator.ts](app/src/lib/shell/SyncStatusIndicator.ts), [localUserStore.ts](app/src/lib/auth/localUserStore.ts) (doc comment), [TodoStore.ts](app/src/pages/my-todos/TodoStore.ts) (doc comment), [vite.config.ts](app/vite.config.ts), [app/package.json](app/package.json), [package.json](package.json), [bootstrapAuth.test.ts](app/src/lib/auth/bootstrapAuth.test.ts), [lifecycle.test.ts](app/src/lib/lifecycle.test.ts)

### 2.1 Login Credentials

> **The Local-Only login is cosmetic.** The accepted email and password are build-time values compiled into the JavaScript bundle, so anyone can read them. They keep casual visitors out of the UI. They do **not** protect the data, which is stored unencrypted in the browser's OPFS storage. Say this wherever the variables are documented.

- `vite-env.d.ts`: add `readonly VITE_LOCAL_AUTH_EMAIL?: string;` and `readonly VITE_LOCAL_AUTH_PASSWORD?: string;`.
- `config.ts`: add the values below. Unlike `devEmail` / `devPassword`, they are **not** gated by `import.meta.env.DEV`, because production Local-Only builds need them.
  ```ts
  localAuthEmail: import.meta.env.VITE_LOCAL_AUTH_EMAIL ?? "",
  localAuthPassword: import.meta.env.VITE_LOCAL_AUTH_PASSWORD ?? "",
  ```
- Login prefill doesn't change: `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD`, dev server only. `.env.local.template` sets the local credentials to the same values as the prefill, so `npm run app:start:offline` works out of the box.

### 2.2 Shared Auth Contract

Add to `AuthService.ts`:

```ts
/** The auth surface the rest of the app uses; implemented by AuthService and LocalAuthService. */
export type AppAuthService = Pick<
  AuthService,
  | "session"
  | "userId"
  | "isAuthenticated"
  | "ready"
  | "init"
  | "login"
  | "logout"
  | "onAuthStateChange"
>;
```

`createAuthGuard`, `bootstrapAuth`, `Sidebar` and `LoginPage` already depend on subsets of this surface and need no changes.

### 2.3 `LocalAuthService`

Behavior:

- **Mimics Supabase auth.** It has the same methods and events (`SIGNED_IN` after login, `SIGNED_OUT` after logout), returns a Supabase-shaped `Session` without type casts, and uses Supabase's `"Invalid login credentials"` message for a wrong email or password.
- **Matching.** The email comparison is trimmed and case-insensitive; the password must match exactly.
- **Not configured.** If either credential is empty, `login()` throws `"Local-only login is not configured"`. `LoginPage` shows its generic error and the console shows the reason.
- **Persistence.** It stores `{ email }` under `localStorage["supa_local_session"]`. `init()` restores the session only if the stored email still matches the configured one, so changing the credentials in a new build signs everyone out.
- **User ID.** `userId` is always `OFFLINE_USER_ID` while signed in.
- **Sign-out.** `logout()` clears the stored session and never touches the database.

```ts
// app/src/lib/auth/LocalAuthService.ts
import type { Session } from "@supabase/supabase-js";
import type { AppAuthService, AuthStateListener } from "./AuthService.ts";
import { OFFLINE_USER_ID } from "./localUserStore.ts";

const LOCAL_SESSION_KEY = "supa_local_session";

export type LocalCredentials = { email: string; password: string };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A Supabase-shaped session, so the rest of the app can't tell the modes apart. */
export function createLocalSession(email: string): Session {
  return {
    access_token: "local-only",
    refresh_token: "local-only",
    token_type: "bearer",
    // Placeholder: Local-Only Mode never refreshes or sends tokens.
    expires_in: 3600,
    user: {
      id: OFFLINE_USER_ID,
      email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "local" },
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
}

/**
 * Cosmetic sign-in for Local-Only Mode. Accepts one email/password pair that is
 * compiled into the build: it hides the UI from casual visitors but does not
 * protect the data stored on the device.
 */
export class LocalAuthService implements AppAuthService {
  private currentSession: Session | null = null;
  private initialized = false;
  private readonly listeners = new Set<AuthStateListener>();

  constructor(private readonly credentials: LocalCredentials) {}

  get session() {
    return this.currentSession;
  }

  get userId(): string | null {
    return this.currentSession?.user.id ?? null;
  }

  get isAuthenticated() {
    return this.currentSession !== null;
  }

  get ready() {
    return this.initialized;
  }

  async init() {
    if (this.initialized) return;
    const storedEmail = readStoredEmail();
    if (
      storedEmail !== null &&
      this.isConfigured() &&
      normalizeEmail(storedEmail) === normalizeEmail(this.credentials.email)
    ) {
      this.currentSession = createLocalSession(this.credentials.email);
    } else if (storedEmail !== null) {
      writeStoredEmail(null);
    }
    this.initialized = true;
  }

  async login(email: string, password: string) {
    if (!this.isConfigured()) {
      throw new Error("Local-only login is not configured");
    }
    if (
      normalizeEmail(email) !== normalizeEmail(this.credentials.email) ||
      password !== this.credentials.password
    ) {
      throw new Error("Invalid login credentials");
    }

    const session = createLocalSession(this.credentials.email);
    this.currentSession = session;
    writeStoredEmail(this.credentials.email);
    await this.emit("SIGNED_IN", session);
  }

  async logout() {
    this.currentSession = null;
    writeStoredEmail(null);
    await this.emit("SIGNED_OUT", null);
  }

  onAuthStateChange(listener: AuthStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private isConfigured() {
    return this.credentials.email.trim() !== "" && this.credentials.password !== "";
  }

  private async emit(event: "SIGNED_IN" | "SIGNED_OUT", session: Session | null) {
    await Promise.all([...this.listeners].map((listener) => listener(event, session)));
  }
}

function readStoredEmail(): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      typeof parsed.email === "string"
      ? parsed.email
      : null;
  } catch {
    return null;
  }
}

function writeStoredEmail(email: string | null) {
  try {
    if (email === null) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } else {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ email }));
    }
  } catch {}
}
```

### 2.4 Composition Root (`main.ts`)

`createClient` throws when `VITE_SUPABASE_URL` is missing, so Local-Only Mode must not call it. Create the Supabase client, `AuthService`, the user store, the connector and the real sync lifecycle only in Synced Mode:

```ts
export function startApp(el: HTMLElement) {
  const offline = config.isOfflineMode;
  const router = new Router();
  const navigate = (path: string) => {
    router.navigate(path);
  };

  const powersync = createPowerSync({ localOnly: offline });
  const todoStore = new TodoStore(powersync);

  let authService: AppAuthService;
  let syncLifecycle: SyncLifecycle;
  let syncStatus: SyncStatusSource;

  if (offline) {
    authService = new LocalAuthService({
      email: config.localAuthEmail,
      password: config.localAuthPassword,
    });
    // Sign-out must never reset the database in Local-Only Mode.
    syncLifecycle = { start: async () => {}, handleAuthEvent: async () => {} };
    syncStatus = createLocalOnlyStatusSource();
    void requestPersistentStorage();
  } else {
    const supabase = createClient(config.supabaseUrl, config.supabaseKey);
    const userStore = createLocalUserStore();
    const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);
    authService = new AuthService(supabase, userStore);
    syncLifecycle = createSyncLifecycle({
      connect: () => powersync.connect(connector),
      reset: () => powersync.disconnectAndClear({ clearLocal: true }),
      userStore,
    });
    syncStatus = createSyncStatusSource(powersync);
  }

  const guardRoute = createAuthGuard(authService, router);
  const getUserId = () => authService.userId;

  const dispose = AppRoot(el, {
    /* router, guardRoute, layouts and pages as today, using the values above */
  });

  void bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
  return dispose;
}
```

- The Synced Mode `createClient` call drops the `!offline` auth options; in that branch they always equal Supabase's defaults.
- `createAuthGuard` now runs in both modes, replacing the "every route is open" guard.
- `getUserId` no longer falls back to `userStore.get() ?? OFFLINE_USER_ID`.
- `bootstrapAuth` renders the first route in both modes. The `if (offline) router.check()` branch goes away.
- Update the comments that describe offline mode as open routes: `main.ts`, the `OFFLINE_USER_ID` doc in `localUserStore.ts`, and the `NewTodo.createdBy` doc in `TodoStore.ts`.
- `@supabase/supabase-js` stays in the Local-Only bundle because `main.ts` imports `createClient` statically. That's acceptable; see [Out of Scope](#out-of-scope).

### 2.5 "Local only" Sync Status

- `syncStatus.ts`: add `localOnly?: boolean` to `SyncStatus`, plus a constant source:
  ```ts
  const LOCAL_ONLY_STATUS: SyncStatus = {
    connected: false,
    connecting: false,
    downloading: false,
    uploading: false,
    localOnly: true,
  };

  /** Status source for Local-Only Mode: never connects and never changes. */
  export function createLocalOnlyStatusSource(): SyncStatusSource {
    return { current: () => LOCAL_ONLY_STATUS, subscribe: () => () => {} };
  }
  ```
- `SyncStatusIndicator.ts`: check `localOnly` first. The label is **Local only** and the class is `-is-local` (not `-is-error`):
  ```ts
  if (status.localOnly) return "Local only";
  ```
- `sync-status-indicator.css`: `-is-local` keeps the default neutral dot (`--text-muted`). If you add a dedicated rule, follow the `@scope` conventions in [styling.md](./styling.md) and run `npm run lint:styles`.

### 2.6 `build:offline` Script

- [app/package.json](app/package.json): `"build:offline": "VITE_OFFLINE_MODE=true vite build"`.
- Root [package.json](../../package.json): `"app:build:offline": "npm run build:offline -w app"`, next to `app:start:offline`.
- [vite.config.ts](app/vite.config.ts): fail Local-Only builds that have no login credentials. `loadEnv` includes `VITE_*` variables from the shell, so it sees `VITE_OFFLINE_MODE=true` from the script:
  ```ts
  export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, new URL(".", import.meta.url).pathname, "VITE_");
    if (
      command === "build" &&
      env.VITE_OFFLINE_MODE === "true" &&
      (!env.VITE_LOCAL_AUTH_EMAIL || !env.VITE_LOCAL_AUTH_PASSWORD)
    ) {
      throw new Error(
        "Local-Only builds need VITE_LOCAL_AUTH_EMAIL and VITE_LOCAL_AUTH_PASSWORD (see app/.env.local.template).",
      );
    }
    // ...existing config
  });
  ```
- Both builds write to `app/dist/`, and the output is mode-specific. `npm run preview -w app` serves whichever was built last.

### Tests

- `LocalAuthService.test.ts` (mirror [AuthService.test.ts](app/src/lib/auth/AuthService.test.ts)):
  - correct credentials sign in and emit `SIGNED_IN`;
  - a wrong email or password throws `"Invalid login credentials"` and emits nothing;
  - the email match is case-insensitive;
  - empty credentials throw `"Local-only login is not configured"`;
  - a new instance restores the session after `init()`;
  - a stored session for a different configured email is dropped;
  - `logout()` clears storage and emits `SIGNED_OUT`;
  - `ready` is `false` before `init()`.
- `bootstrapAuth.test.ts`: with a no-op sync lifecycle, an authenticated user gets the current route rendered, an unauthenticated user goes to `/auth`, and `SIGNED_OUT` re-runs the guard.
- `lifecycle.test.ts`: `SyncStatusIndicator` with `createLocalOnlyStatusSource()` renders **Local only** with `-is-local`.

### Acceptance

- [x] With only `VITE_OFFLINE_MODE`, `VITE_LOCAL_AUTH_*` and the optional dev prefill set (no Supabase or PowerSync variables, no backend), `npm run app:start:offline` starts without errors and redirects `/my-todos` to `/auth`.
- [x] Wrong credentials show the sign-in error. Correct ones open My Todos, a reload keeps the session, and the sidebar shows the configured email and **Local only**.
- [x] Sign-out returns to `/auth`. Signing in again shows all previous lists and todos.
- [x] DevTools → Network shows no requests to Supabase or PowerSync.
- [x] `npm run app:build:offline` fails with the message above when a local credential is missing, and succeeds when both are set.
- [x] Synced Mode is unchanged: login, sync, and sign-out (which wipes local data) work as before.

---

## Phase 3: Export and Import (Settings Page)

**Goal:** A Settings page exports data as JSON in both modes and imports it in Local-Only Mode only.

**Files**

- New: `app/src/pages/my-todos/todoBackup.ts`, `app/src/pages/my-todos/todoBackup.test.ts`, `app/src/pages/settings/SettingsPage.ts`, `app/src/pages/settings/settings.css`, `app/src/pages/settings/backupFile.ts`, `app/src/pages/settings/SettingsPage.test.ts`
- Change: [TodoStore.ts](app/src/pages/my-todos/TodoStore.ts), [AppRoot.ts](app/src/lib/AppRoot.ts), [main.ts](app/src/lib/main.ts)

[navConfig.ts](app/src/lib/nav/navConfig.ts) already links **Settings** to `/settings`, but `AppRoot` has no route for it, so today it shows Not Found.

### 3.1 Backup Format and Validation (`todoBackup.ts`)

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

`parseTodoBackup(input: unknown): TodoBackupPayload` is a pure function. It throws `TodoBackupError` (with `issues: string[]`) on any problem, so nothing is written for an invalid file. Rules:

- **Top level:** an object with `version === 1`, a `lists` array and a `todos` array. Any other version is rejected with `"Unsupported backup version"`.
- **Lists:** `id` is a non-empty, unique string; `name` is a string (empty is allowed, since new lists start empty); `created_at` is a string that `Date.parse` accepts.
- **Todos:**
  - `id` is a non-empty, unique string;
  - `list_id` matches a list in the same file;
  - `description` is a string;
  - `completed` is `0`, `1`, `true` or `false` (normalized to `0`/`1`);
  - `created_at` is a valid date string;
  - `completed_at` is a valid date string or `null`.
- **Ownership fields:** `owner_id`, `created_by` and `completed_by` are ignored, because import rewrites them to the current user.
- **Error message:** shows at most the first 10 issues.

### 3.2 `TodoStore`

- Constructor: `new TodoStore(db, { localOnly })`. In `main.ts`: `new TodoStore(powersync, { localOnly: offline })`.
- `exportData()` works in both modes:
  ```ts
  async exportData(): Promise<TodoBackupPayload> {
    const lists = await this.db.getAll<TodoBackupPayload["lists"][number]>(
      "SELECT id, name, owner_id, created_at FROM lists ORDER BY created_at ASC, id ASC",
    );
    const todos = await this.db.getAll<TodoBackupPayload["todos"][number]>(
      "SELECT id, list_id, description, completed, created_at, completed_at, created_by, completed_by FROM todos ORDER BY created_at ASC, id ASC",
    );
    return { version: 1, exportedAt: new Date().toISOString(), lists, todos };
  }
  ```
- `importData()` works in Local-Only Mode only. It is the second guard behind the UI. It validates, then updates rows whose ID exists and inserts the rest, all in one transaction. It doesn't use `INSERT OR REPLACE`: writes go through PowerSync's views and `INSTEAD OF` triggers, so don't rely on conflict clauses reaching them. Re-importing the same file overwrites rows with the same ID and duplicates nothing.
  ```ts
  async importData(input: unknown, { userId }: { userId: string }) {
    if (!this.localOnly) {
      throw new Error("Import is only available in Local-Only Mode");
    }
    const backup = parseTodoBackup(input);

    await this.db.writeTransaction(async (tx) => {
      const ids = async (table: "lists" | "todos") =>
        new Set((await tx.getAll<{ id: string }>(`SELECT id FROM ${table}`)).map((row) => row.id));
      const existingLists = await ids("lists");
      const existingTodos = await ids("todos");

      for (const list of backup.lists) {
        if (existingLists.has(list.id)) {
          await tx.execute("UPDATE lists SET name = ?, owner_id = ?, created_at = ? WHERE id = ?", [
            list.name, userId, list.created_at, list.id,
          ]);
        } else {
          await tx.execute("INSERT INTO lists (name, owner_id, created_at, id) VALUES (?, ?, ?, ?)", [
            list.name, userId, list.created_at, list.id,
          ]);
        }
      }

      for (const todo of backup.todos) {
        const values = [
          todo.list_id, todo.description, todo.completed, todo.created_at, todo.completed_at,
          userId, todo.completed ? userId : null, todo.id,
        ];
        if (existingTodos.has(todo.id)) {
          await tx.execute(
            `UPDATE todos SET list_id = ?, description = ?, completed = ?, created_at = ?,
               completed_at = ?, created_by = ?, completed_by = ? WHERE id = ?`,
            values,
          );
        } else {
          await tx.execute(
            `INSERT INTO todos (list_id, description, completed, created_at, completed_at,
               created_by, completed_by, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            values,
          );
        }
      }
    });

    return { lists: backup.lists.length, todos: backup.todos.length };
  }
  ```

### 3.3 Settings Page (`app/src/pages/settings/`)

- `SettingsPage(el, deps): Dispose` follows the mount contract and the patterns of the existing pages: lit `render`, `data-component="settings-page"`, and scoped CSS in `settings.css`.
- Dependencies:
  ```ts
  export type SettingsDependencies = {
    backup: Pick<TodoStore, "exportData" | "importData">;
    getUserId: () => string | null;
    canImport: boolean;
  };
  ```
- **Backup** section:
  - **Export data** (both modes): `downloadJson(await backup.exportData(), "supa-todos-backup-YYYY-MM-DD.json")`. Copy: "Exports the lists and todos stored on this device."
  - **Import data** (only when `canImport`): a button opens a hidden `<input type="file" accept="application/json,.json">`. Reject files over 10 MB. Then `readJsonFile`, then `backup.importData(parsed, { userId })`, then "Imported N lists and M todos." Copy: "Rows with the same ID are overwritten." Reset the input afterwards so the same file can be picked again.
  - **Synced Mode:** show "Import is available in Local-Only Mode." instead of the import controls.
  - **Messages:** success in a `role="status"` region; errors (invalid JSON, validation issues, no user) in `role="alert"`. Disable both buttons while an operation runs.
- `backupFile.ts` contains:
  - `downloadJson(data, filename)`: a `Blob`, `URL.createObjectURL` and a temporary `<a download>`, then `URL.revokeObjectURL`;
  - `readJsonFile(file, maxBytes)`.
- **Routing:**
  - `AppRoot.ts`: add `settings: Mount` to `AppPages` and `route("/settings", () => showPage(pages.settings))`.
  - `main.ts`: `settings: (target) => SettingsPage(target, { backup: todoStore, getUserId, canImport: offline })`.
- `MyTodosPage` needs no changes. Its `watchUserLists()` subscription updates when the import transaction commits.

### Tests

- `todoBackup.test.ts`:
  - a valid payload passes and `completed` is normalized;
  - each rule above rejects;
  - duplicate IDs and a `list_id` that matches no list in the file reject;
  - `version: 2` rejects.
- `SettingsPage.test.ts` (happy-dom, fake `backup`):
  - export calls `exportData` and triggers a download (stub `URL.createObjectURL`);
  - import controls are absent when `canImport` is `false`;
  - a successful import shows the counts;
  - invalid JSON shows an alert without calling `importData`;
  - a `TodoBackupError` from `importData` shows an alert listing the issues.
- `TodoStore` import guard: with `localOnly: false`, `importData` throws and never opens a transaction (fake db).

### Acceptance

- [x] `/settings` opens from the sidebar in both modes.
- [x] Local-Only: export downloads `supa-todos-backup-YYYY-MM-DD.json` containing all lists and todos.
- [x] Importing that file into a fresh Local-Only instance (another port or browser profile) restores everything, and My Todos updates without a reload.
- [x] Importing the same file twice duplicates nothing.
- [x] An invalid or edited-to-be-invalid file shows an error and changes nothing.
- [x] Synced Mode: export works and there are no import controls.
- [x] A Synced Mode export imports into Local-Only Mode, with ownership rewritten to the local user.

---

## Phase 4: Installable App (PWA)

**Goal:** Both builds can be installed, and their app shell loads offline.

**Files**

- Change: [app/package.json](app/package.json) (devDependency), [vite.config.ts](app/vite.config.ts), [index.html](app/src/index.html)
- New: PNG icons in `app/public/`

### 4.1 Dependency

```sh
npm install -D vite-plugin-pwa@^2 --workspace=app
```

Version 2 supports Vite 8. Check that npm installed its `workbox-build` / `workbox-window` peers, and add them as devDependencies if it didn't.

### 4.2 Icons

Generate these from `app/public/favicon.svg` and commit them to `app/public/`: `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` and `apple-touch-icon-180x180.png`. For example, run `npx @vite-pwa/assets-generator --preset minimal-2023 public/favicon.svg` in `app/`.

Add this to `index.html` (the plugin only injects the manifest link):

```html
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

### 4.3 Plugin Configuration

Define the manifest in the plugin config. The plugin generates `manifest.webmanifest` and injects both the `<link rel="manifest">` and the service worker registration into `index.html`. Don't add a static manifest file or a manual manifest link.

```ts
import { VitePWA } from "vite-plugin-pwa";

// plugins: [...existing, VitePWA({...})]
VitePWA({
  registerType: "autoUpdate",
  manifest: {
    name: "Local First Todos",
    short_name: "Todos",
    description: "Local-first todo list app",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/maskable-icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
    // OPFSCoopSyncVFS only loads the synchronous wa-sqlite build. The async builds
    // (IndexedDB VFS) and mc-* builds (encryption) are never loaded, and the async
    // .wasm files exceed Workbox's 2 MiB precache limit.
    globIgnores: ["**/*wa-sqlite-async*", "**/mc-wa-sqlite*"],
    navigateFallback: "/index.html",
    cleanupOutdatedCaches: true,
  },
  devOptions: { enabled: false },
});
```

### 4.4 Behavior Notes

- **Both builds** get the service worker. Supabase and PowerSync run on other origins, which Workbox's precache and navigation fallback don't touch. Don't add runtime caching for them.
- **Deep links:** `navigateFallback` makes `/my-todos`, `/settings` and `/docs/*` load offline. The Markdown docs are JS chunks, so they're precached.
- **Updates:** with `autoUpdate`, a new version activates on the next load. There's no in-app "update available" prompt (out of scope).
- **Dev server:** no service worker (`devOptions.enabled: false`), so development never serves stale assets.
- **Verify the `.wasm`:** if DevTools → Network shows a different `.wasm` being loaded than the one precached, adjust `globIgnores`. The build must not log Workbox "will not be precached" warnings.

### Acceptance

- [x] `npm run app:build:offline && npm run preview -w app`: DevTools → Application → Manifest shows no errors, and the browser offers to install the app.
- [x] The service worker is active. Cache Storage contains the `wa-sqlite-*.wasm` build and no `*-async*` or `mc-*` builds.
- [x] With DevTools set to Offline, reloading `/my-todos`, `/settings` and `/docs/introduction` works, and the data is there.
- [x] The installed app opens in its own window and works offline.
- [x] Synced build (`npm run build -w app`, then preview): the app shell loads offline, and sync resumes when back online.
- [x] `npm run app:start` and `npm run app:start:offline` register no service worker.

---

## Phase 5: Migrations and Data-Loss Policy

**Goal:** Local-Only data survives schema changes, and the rules for changes that can destroy it are written down.

**Files**

- New: `app/src/lib/sync/localMigrations.ts`, `app/src/lib/sync/localMigrations.test.ts`
- Change: [main.ts](app/src/lib/main.ts)

### 5.1 Structural Changes (Automatic)

`ps_data_local__<table>` stores schemaless JSON, and PowerSync recreates the views whenever the database opens with a new schema. These changes need no migration files:

| Change (via `schema:generate`)                           | What happens on the next app start                                                                            |
| :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| Add a table                                              | Creates `ps_data_local__<table>` and its view.                                                                |
| Add a column                                             | Recreates the view with the new column. Existing rows return `NULL` for it.                                   |
| Remove a column                                          | Recreates the view without it. The old JSON key stays in `data`, harmlessly, unless a migration removes it.   |
| Add or remove an index                                   | Creates or drops the expression index on `ps_data_local__<table>`.                                            |
| **Remove or rename a table**                             | **`ps_data_local__<table>` is dropped. Data is permanently deleted; copy it in a migration first** (see 5.2). |
| Switch a table between synced and local-only in one file | Local-only data is permanently deleted. The separate database files from Phase 1 prevent this.                |

`LocalOnlySchema` is derived from the generated `schema.ts`. So removing or renaming a table in `sync-config.yaml` and running `npm run schema:generate` removes it from Local-Only Mode too.

### 5.2 Data-Loss Policy

**Remove/rename table → data permanently deleted; copy it in a migration first.**

PowerSync applies the schema when the database opens, before `runLocalMigrations` runs. The copy and the removal therefore can't ship in the same release:

1. **Release A:** add the new table and keep the old one. Add a migration that copies rows from the old table to the new one.
2. **Release B (later):** remove the old table. If it's already gone from the generated schema, keep it in Local-Only Mode until release B by adding it to `LocalOnlySchema` explicitly as a legacy table.
3. **Defensive copies:** a copy migration must do nothing when its source table no longer exists (check `sqlite_master` for `ps_data_local__<old>`), so that clients still start.
4. **Skipped releases:** a client that skips release A (for example, an installed app not opened in between) loses the old table's data in release B. Keep old tables around as long as practical.

### 5.3 Migration Runner

```ts
// app/src/lib/sync/localMigrations.ts
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
```

- **`user_version` is free.** PowerSync tracks its own migrations in its own table and doesn't use `PRAGMA user_version`.
- **One transaction.** All pending migrations and version bumps run in a single transaction. On failure everything rolls back and the database stays at its previous version.
- **Multiple tabs are safe.** Write transactions are serialized, and the version is re-read inside the transaction.
- **What migrations write:** either through the views (`UPDATE todos ...`) or the underlying `ps_data_local__<table>` JSON (for example, to rename a key). Never edit or reorder a migration that has shipped.
- **Local-Only Mode only.** Synced Mode data changes belong in `stack/supabase/migrations/`.

Example migrations (documentation only, not shipped; `priority` and `title` are hypothetical columns):

```ts
{
  version: 1,
  // Backfill a default for a newly added `priority` column.
  up: async (tx) => {
    await tx.execute("UPDATE todos SET priority = 0 WHERE priority IS NULL");
  },
},
{
  version: 2,
  // Rename `description` -> `title` in the underlying JSON.
  up: async (tx) => {
    await tx.execute(
      `UPDATE ps_data_local__todos
       SET data = json_remove(json_set(data, '$.title', json_extract(data, '$.description')), '$.description')
       WHERE json_extract(data, '$.description') IS NOT NULL`,
    );
  },
},
```

### 5.4 Startup Wiring

In Local-Only Mode, run migrations before `bootstrapAuth`, which renders the first route:

```ts
const start = async () => {
  if (offline) await runLocalMigrations(powersync);
  await bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
};

void start().catch((error) => {
  console.error("Failed to upgrade the local database", error);
  // Render a minimal role="alert" message into `el` instead of the app.
});
```

`bootstrapAuth` handles its own errors, so the `catch` only sees migration failures. Show "The local database couldn't be upgraded. Your data hasn't changed. Reload to try again." and render no route.

### 5.5 Backup Format Versioning

When a schema change affects the backup (for example, a renamed column or a new required field):

- Bump `TodoBackupPayload["version"]` (for example, to `2`).
- `parseTodoBackup()` keeps accepting older versions and normalizes them (for example, `todo.priority ?? 0`) before `importData()` writes anything.

### 5.6 Synced vs. Local-Only Changes

| Scenario                             | Synced Mode (Supabase + PowerSync)                                                                         | Local-Only Mode                                                                             |
| :----------------------------------- | :--------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ |
| Add table / column / index           | 1. SQL migration in `stack/supabase/migrations/` 2. Update `sync-config.yaml` 3. `npm run schema:generate` | Nothing extra: `LocalOnlySchema` follows the generated schema.                              |
| Backfill a default / rename a column | SQL `ALTER TABLE` / `UPDATE` in `stack/supabase/migrations/` (replicated to clients)                       | Add a numbered migration to `LOCAL_MIGRATIONS`.                                             |
| Remove or rename a table             | SQL migration; clients' copies are replaced by synced data                                                 | Follow the [data-loss policy](#52-data-loss-policy): copy first, remove in a later release. |

### Tests

`localMigrations.test.ts`, using a fake transaction:

- pending migrations run in order, and `user_version` is set after each;
- already-applied migrations are skipped;
- a failing migration rethrows, and later migrations don't run;
- with no migrations, `user_version` doesn't change.

### Acceptance

- [x] With the empty migration list, startup is unchanged and `PRAGMA user_version` stays `0`.
- [x] With a temporary test migration (not committed), `user_version` goes up once and stays there across reloads and with two tabs open.
- [x] A temporary failing migration shows the blocking message and leaves the data unchanged. The app starts normally once the migration is removed.

---

## Documentation Updates

| File                                               | What to change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Phase      |
| :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| [app/.env.local.template](app/.env.local.template) | Rewrite the `VITE_OFFLINE_MODE` comment: Local-Only Mode, no backend, data stays on this device in `supa-app-local.db`, the login is cosmetic. Add `VITE_LOCAL_AUTH_EMAIL=dev@example.com` and `VITE_LOCAL_AUTH_PASSWORD=password123`, noting that they're compiled into the bundle (not secret) and required by `build:offline`.                                                                                                                                                                                                                                                                                                          | 2          |
| [app/README.md](app/README.md)                     | Rewrite the `dev:offline` paragraph to describe Local-Only Mode (login, local database, no sync) instead of "disables authentication"; add `build:offline` and `preview`. `config.ts` bullet: the local login variables. `main.ts` bullet: the mode now selects the database, auth service, sync lifecycle and status source, and the guard applies in both modes. Mention the Settings page (Phase 3) and the installable app (Phase 4).                                                                                                                                                                                                  | 2, 3, 4    |
| [README.md](README.md)                       | Replace the "work on the UI without a running backend" sentence with a short description of both modes, `npm run app:start:offline` and `npm run app:build:offline`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 2          |
| [introduction.md](packages/docs/introduction.md)               | "Running it locally": `app:start:offline` now runs Local-Only Mode with a login, not an open UI mode. §2 composition root: update the `startApp` excerpt (`guardRoute`, the `if (offline)` block, `getUserId`), the paragraph after it, and the `config` excerpt. §4: the first render always goes through `bootstrapAuth`. §5 Authentication: add `LocalAuthService` and the cosmetic-login caveat. §6 "Creating the database": the two database files and `LocalOnlySchema`. §8 status source: the "Local only" source. "Adding a synced table": the local-only data-loss policy. "Gotchas": never open one database file in both modes. | 1, 2, 3, 5 |

---

## Out of Scope

- Real protection for Local-Only data, such as per-user passwords or database encryption with `@powersync/web`'s `encryptionKey`. This is a possible follow-up.
- Import in Synced Mode, and moving Local-Only data into a synced account.
- A replace-mode import that deletes everything before importing.
- An in-app "update available" prompt.
- Removing `@supabase/supabase-js` from the Local-Only bundle.

## Final Check (All Phases)

- [x] `npm run check` passes.
- [x] Synced Mode on `:5173` and Local-Only Mode on `:5174` run side by side without affecting each other's data.
- [x] Synced export → Local-Only import → Local-Only export round-trips the same lists and todos (ownership fields aside).
