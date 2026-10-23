# ISSUES — Gaps for an offline-first / local-first starter template

Findings from reviewing whether this code base is suitable as a **starter template for
offline-first / local-first web projects**.

**Verdict: partly.** The sync and backend layers (PowerSync Sync Streams, the
transactional upload RPC, RLS, least-privilege replication role) are solid and worth
copying. The gaps are in the parts that make an app _usable_ offline and safe to
ship: the app shell does not load offline, auth fails closed when the network is gone,
and several paths can lose local writes without telling the user.

Legend:

- Severity: **High** = data loss or app unusable offline · **Medium** = blocks production use or a group of users · **Low** = papercut, or a pattern people will copy.
- Effort: **S** = small (< 30 min) · **M** = medium (a few hours) · **L** = large.

How this was verified: reading the source, plus the installed library code
(`@supabase/auth-js` 2.117.2 `GoTrueClient.ts`, `@powersync/common` 2.3.1), the
PowerSync docs and [webstatus.dev](https://webstatus.dev) for browser support.

_Last checked against the code base: 2026-10-23._

---

## Summary

| #    | Severity | Effort | Area      | Title                                                               |
| ---- | -------- | ------ | --------- | ------------------------------------------------------------------- |
| [1]  | High     | M      | PWA       | The app shell does not load offline                                 |
| [2]  | ~~High~~ | S–M    | Auth      | ~~Offline cold start with an expired token renders a blank app~~ ✅ |
| [3]  | High     | S      | Sync      | Sign-out can silently discard unsynced writes                       |
| [4]  | High     | M      | Sync      | Rejected uploads are dropped silently                               |
| [5]  | ~~Med~~  | S      | Sync/Auth | ~~The local database is not bound to a user~~ ✅                    |
| [6]  | Medium   | M      | Deploy    | The backend is not deployable as-is                                 |
| [7]  | Medium   | S–M    | Router    | The router needs very new browsers and has no fallback              |
| [8]  | Low      | S      | Data      | `deleteList` is not atomic                                          |
| [9]  | Low      | S      | UX        | No first-sync state                                                 |
| [10] | Low      | S      | UX        | The sync indicator treats offline as an error                       |
| [11] | Low      | M      | DX        | Adding a synced table needs five coordinated edits                  |
| [12] | Low      | M      | Testing   | The offline round trip is not tested                                |

Template cleanup items (not offline-specific) are listed in [Template cleanup](#template-cleanup).

[1]: #1--the-app-shell-does-not-load-offline
[2]: #2--offline-cold-start-with-an-expired-token-renders-a-blank-app
[3]: #3--sign-out-can-silently-discard-unsynced-writes
[4]: #4--rejected-uploads-are-dropped-silently
[5]: #5--the-local-database-is-not-bound-to-a-user
[6]: #6--the-backend-is-not-deployable-as-is
[7]: #7--the-router-needs-very-new-browsers-and-has-no-fallback
[8]: #8--deletelist-is-not-atomic
[9]: #9--no-first-sync-state
[10]: #10--the-sync-indicator-treats-offline-as-an-error
[11]: #11--adding-a-synced-table-needs-five-coordinated-edits
[12]: #12--the-offline-round-trip-is-not-tested

---

## 1 — The app shell does not load offline

**Severity:** High · **Effort:** M · **Area:** PWA

**Where:** [app/src/index.html](./app/src/index.html#L13-L18), [app/vite.config.ts](./app/vite.config.ts)

**Problem.** The data is offline-capable (PowerSync keeps it in IndexedDB-backed
SQLite), but the _app_ is not. There is no service worker and no web app manifest, so
the HTML, JS chunks, CSS, the wa-sqlite WASM file and the PowerSync worker scripts are
only ever fetched from the network.

The page also loads the Geist font from Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
  rel="stylesheet"
/>
```

This fails offline. It also sends every visitor's IP address to Google, which is a
known GDPR problem in the EU.

**Impact.** Reloading the page, or opening the app from a closed tab while offline,
shows the browser's "No internet" page. Offline only works while the tab that was
opened online stays open.

**Suggested fix.**

- Add a service worker (for example `vite-plugin-pwa` with Workbox):
  - precache the build output, including `*.wasm`, the PowerSync/wa-sqlite worker files and the lazily loaded docs chunks from `import.meta.glob` in [packages/docs/index.ts](./packages/docs/index.ts);
  - serve `index.html` for navigation requests (SPA fallback), so deep links like `/my-todos` work offline;
  - do **not** cache Supabase Auth (`/auth/v1/*`), the RPC endpoint or the PowerSync stream;
  - add an "update available, reload" prompt, because a cached shell otherwise stays stale.
- Add a web app manifest so the app can be installed.
- ~~Self-host the font (for example `@fontsource-variable/geist`) and remove the Google Fonts links.~~ ✅ Fixed: `@fontsource/geist` is imported for weights 400, 500, 600 and 700 in [index.css](./app/src/css/index.css), and the Google Fonts links are removed from [index.html](./app/src/index.html). The static package is used instead of the variable one so that only the weights the app uses are bundled.

**Done when.** After `vite build && vite preview`: load the app once online, switch
DevTools to _Offline_, then hard-reload `/`, `/my-todos` and `/docs/introduction`. All
three render, and My Todos shows the local data. This also depends on [#2][2].

---

## 2 — Offline cold start with an expired token renders a blank app

**Status:** ✅ Fixed · **Severity:** High · **Effort:** S–M · **Area:** Auth

**Where:** [AuthService.ts](./app/src/lib/auth/AuthService.ts), [bootstrapAuth.ts](./app/src/lib/auth/bootstrapAuth.ts), [localUserStore.ts](./app/src/lib/auth/localUserStore.ts)

**Resolution.** `AuthService.init()` checks `isAuthRetryableFetchError(error)` when a
stored local user id exists in `localUserStore`: it falls back to that user id, marks
auth `ready = true`, and lets `bootstrapAuth` render the local database without clearing
it. For non-retryable errors, `AuthService.init()` still marks `ready = true` before
throwing so navigating to `/auth` renders the login form. In `VITE_OFFLINE_MODE=true`,
`getUserId` falls back to `OFFLINE_USER_ID` so lists and todos can be created without a
session.

---

## 3 — Sign-out can silently discard unsynced writes

**Severity:** High · **Effort:** S · **Area:** Sync

**Where:** [main.ts](./app/src/lib/main.ts#L75-L78), [syncLifecycle.ts](./app/src/lib/sync/syncLifecycle.ts), [Sidebar.ts](./app/src/lib/shell/Sidebar.ts#L199-L213), [AuthService.ts](./app/src/lib/auth/AuthService.ts#L64-L69)

**Problem.** Every `SIGNED_OUT` event resets sync:

```ts
reset: () => powersync.disconnectAndClear({ clearLocal: true }),
```

`disconnectAndClear()` wipes the local database, **including the upload queue**. The
PowerSync guidance is to call it "only after the upload queue is empty. Clearing while
uploads are pending discards those mutations." Nothing checks the queue first.

How the installed auth-js (2.117.2) behaves when signing out offline:

- **Access token still valid:** `signOut()` fails to reach the server, but still removes
  the local session and emits `SIGNED_OUT`, then returns the network error. The local DB
  and every pending write are wiped. `AuthService.logout()` throws and `Sidebar` logs
  "Failed to log out", even though the user _was_ signed out.
- **Access token expired:** `signOut()` returns the refresh error without removing the
  session. The user cannot sign out at all while offline, and gets no feedback.

**Impact.** Any edits made offline (or not yet uploaded) are lost permanently, with no
warning, the moment the user signs out.

**Suggested fix.**

- Before calling `signOut()`, check the queue:

  ```ts
  const { count } = await powersync.getUploadQueueStats();
  ```

  If `count > 0`, warn the user: wait for the upload when online, or ask them to confirm
  discarding _N_ unsynced changes when offline.

- Treat a `signOut()` network error as "signed out locally" in `AuthService.logout()` /
  `Sidebar`, instead of reporting a failure.
- Decide (and document) what offline sign-out with an expired token should do. Forcing
  local sign-out with `signOut({ scope: "local" })` is one option.

**Done when.** Signing out with pending changes asks for confirmation, a confirmed
offline sign-out reports success, and a unit test covers the "pending uploads" path.

---

## 4 — Rejected uploads are dropped silently

**Severity:** High · **Effort:** M · **Area:** Sync

**Where:** [SupabasePowerSyncConnector.ts](./app/src/lib/sync/SupabasePowerSyncConnector.ts#L5-L10) (classification), [SupabasePowerSyncConnector.ts](./app/src/lib/sync/SupabasePowerSyncConnector.ts#L56-L64) (discard), [process_powersync_crud migration](./stack/supabase/migrations/20260412100000_process_powersync_crud.sql#L32-L37)

**Problem.** Postgres errors in classes `22` (data exception) and `23` (integrity
constraint), and `42501` (insufficient privilege, which includes RLS violations), are
treated as fatal. The transaction is completed and only logged:

```ts
const FATAL_RESPONSE_CODES = [new RegExp("^22...$"), new RegExp("^23...$"), new RegExp("^42501$")];
// …
} catch (error: unknown) {
  if (!isFatalError(error)) throw error;
  console.error("Data upload error - discarding:", transaction.crud, error);
}
await transaction.complete();
```

Discarding is the right way to keep the queue moving: retrying forever would block
every later write. But the user never learns about it. Their edit is shown locally,
then quietly reverts on the next sync.

**Footgun.** The upload RPC only accepts tables in a hard-coded allow-list and raises
`22023` for anything else:

```sql
or table_name not in ('lists', 'todos')
```

`22023` matches `^22...$`. So if a developer adds a new synced table and forgets the
RPC, **every write to that table is discarded silently**, and the only trace is a
`console.error`.

**Suggested fix.**

- Record rejected operations in a local-only table (for example `upload_errors` with
  table, row id, op, payload, SQLSTATE and message), and show a toast or banner through
  the events bus. Optionally offer "retry" or "dismiss".
- Make "table not allowed" loud during development: give it a dedicated SQLSTATE, and/or
  add a check that every table in the PowerSync schema is in the RPC allow-list (see [#11][11]).

**Done when.** A rejected write (for example an RLS violation or a check-constraint
failure) shows a visible message and can be inspected afterwards. Connector tests cover
the recording path.

---

## 5 — The local database is not bound to a user

**Status:** ✅ Fixed · **Severity:** Medium (High for shared-device apps) · **Effort:** S · **Area:** Sync/Auth

**Where:** [localUserStore.ts](./app/src/lib/auth/localUserStore.ts), [bootstrapAuth.ts](./app/src/lib/auth/bootstrapAuth.ts), [syncLifecycle.ts](./app/src/lib/sync/syncLifecycle.ts)

**Resolution.** `createLocalUserStore()` persists the user id that owns the local
PowerSync database in `localStorage`. `createSyncLifecycle` records the user id when
`connect()` succeeds, clears it and calls `reset()` on `SIGNED_OUT` or when booting with
no session (unless offline fallback is active), and calls `reset()` before `connect()`
when a different user signs in.

---

## 6 — The backend is not deployable as-is

**Severity:** Medium · **Effort:** M · **Area:** Deploy

**Where:** [stack/powersync/service.yaml](./stack/powersync/service.yaml#L178-L226), [stack/powersync/cli.yaml](./stack/powersync/cli.yaml), [stack/powersync/docker/.env.template](./stack/powersync/docker/.env.template), [.github/workflows/ci.yml](./.github/workflows/ci.yml)

**Problem.** The PowerSync config is local-dev only:

```yaml
jwks_uri: http://host.docker.internal:54321/auth/v1/.well-known/jwks.json
# …
tokens:
  - dev-token-do-not-use-in-production
  - use_a_better_token_in_production
```

- API tokens are hard-coded in `service.yaml`, and `cli.yaml` holds `api_key: dev-token-do-not-use-in-production`.
- The JWKS URL is hard-coded to the local Supabase stack.
- `PS_DATA_SOURCE_URI` and `PS_STORAGE_SOURCE_URI` point to the same Postgres database. PowerSync supports this on Postgres 14+, but notes it may increase CPU usage. Postgres bucket storage also cannot use storage version 4 (MongoDB only). Neither trade-off is documented.
- There is no production guide: hosted Supabase project, PowerSync Cloud vs self-hosted, static hosting with SPA fallback, environment variables.
- CI does not run `vite build`, so a broken production build is not caught.

**Suggested fix.**

- Move the tokens and `jwks_uri` to `!env` variables. The CLI reads `PS_ADMIN_TOKEN` from the shell, so document the export.
- Document the bucket-storage choice: shared database for dev, a separate database or MongoDB for production.
- Add a "Deploying" doc covering Supabase (`supabase link` / `db push`, the `powersync_role` password step from its migration), PowerSync Cloud or self-hosted, and static hosting.
- Add a `vite build` step to CI.

**Done when.** No secrets or host-specific URLs are committed in `stack/powersync/`,
and a new developer can deploy using only the docs.

---

## 7 — The router needs very new browsers and has no fallback

**Severity:** Medium · **Effort:** S–M · **Area:** Router

**Where:** [router.ts](./packages/router/src/router.ts#L203-L213) (`createRoute`), [router.ts](./packages/router/src/router.ts#L264-L280) (`navigate`)

**Problem.** The router depends on two recent platform APIs:

| API            | Baseline since | Chrome/Edge | Firefox | Safari |
| -------------- | -------------- | ----------- | ------- | ------ |
| Navigation API | 2026-01-13     | 102         | 147     | 26.2   |
| URLPattern     | 2025-09-15     | 95          | 142     | 26     |

- **No URLPattern:** `new URLPattern(...)` throws a `ReferenceError`. `createRoute` wraps
  it as `Invalid URLPattern syntax for path "…"`, which is a misleading message, and the
  app does not start.
- **No Navigation API:** `navigate()` only logs `"Navigation API is unavailable"` and
  returns. Redirects (the auth guard, post-login, `/` → `/my-todos`) do nothing, and
  links fall back to full page loads.

On iOS every browser uses WebKit, so iPhones on iOS 18 or older cannot run the app.

**Suggested fix.**

- Load `urlpattern-polyfill` when `globalThis.URLPattern` is missing.
- Fall back to `location.assign()` (or a small History API path) when the Navigation API is missing.
- Fix the misleading error message.
- Document the supported browsers in the README.
- Optionally show an "unsupported browser" message instead of a blank page.

**Done when.** The app starts and navigates in a browser without either API (for
example Safari 18, or with both globals deleted in a test).

---

## 8 — `deleteList` is not atomic

**Severity:** Low · **Effort:** S · **Area:** Data

**Where:** [TodoStore.ts](./app/src/pages/my-todos/TodoStore.ts#L118-L121)

**Problem.**

```ts
async deleteList(listId: string) {
  await this.db.execute("DELETE FROM todos WHERE list_id = ?", [listId]);
  return await this.db.execute("DELETE FROM lists WHERE id = ?", [listId]);
}
```

Two `execute` calls create two separate upload transactions, so two RPC calls. The
explicit todo delete is needed locally, because PowerSync views do not enforce
foreign keys. (Postgres also has `on delete cascade`.) But if the second transaction
is rejected, the server is left half-applied. Watch queries also fire twice.

Templates get copied, so this pattern will spread.

**Suggested fix.** Wrap both statements in `this.db.writeTransaction(async (tx) => { … })`.

---

## 9 — No first-sync state

**Severity:** Low · **Effort:** S · **Area:** UX

**Where:** [MyTodosPage.ts](./app/src/pages/my-todos/MyTodosPage.ts#L143-L155), [syncStatus.ts](./app/src/lib/sync/syncStatus.ts#L10)

**Problem.** After the first login on a device, My Todos renders an empty list
container until the first sync finishes. The page has no loading or empty state.
`hasSynced` is already exposed through `SyncStatusSource`, but nothing uses it.

**Suggested fix.** Show a loading state until `status.hasSynced` (or
`powersync.waitForFirstSync()`), then a real empty state ("No lists yet") when there
are no rows.

---

## 10 — The sync indicator treats offline as an error

**Severity:** Low · **Effort:** S · **Area:** UX

**Where:** [SyncStatusIndicator.ts](./app/src/lib/shell/SyncStatusIndicator.ts#L6-L20)

**Problem.** Being disconnected is styled exactly like a sync error (`-is-error`,
"Ei yhteyttä"). In a local-first app, offline is a normal state. The indicator also
never shows how many changes are waiting to upload. That is the one number an offline
user cares about, and it would support the sign-out warning in [#3][3].

**Suggested fix.** Give offline a neutral style, and show "_N_ unsynced changes" using
`getUploadQueueStats()`, or a watch on `SELECT count(*) FROM ps_crud`.

---

## 11 — Adding a synced table needs five coordinated edits

**Severity:** Low · **Effort:** M · **Area:** DX

**Where:** [stack/supabase/migrations/](./stack/supabase/migrations), [stack/powersync/sync-config.yaml](./stack/powersync/sync-config.yaml), [app/src/lib/sync/schema.ts](./app/src/lib/sync/schema.ts)

**Problem.** A new synced table needs all of these:

1. A migration: table, RLS policies, `grant select … to powersync_role`, and adding it to the explicit `powersync` publication.
2. A migration that replaces `process_powersync_crud` with the new table in its allow-list.
3. A stream in `sync-config.yaml`.
4. `npm run schema:generate` to regenerate the client schema.
5. A restart or redeploy of the PowerSync service.

Missing step 1 means the data never syncs and nothing reports an error. Missing step 2
means writes are silently dropped ([#4][4]).

**Suggested fix.**

- Document the checklist in the docs. The empty `tutorials.md` is a natural home.
- Add a check script, run in CI, that compares the publication, the RPC allow-list and the generated schema.
- Optionally move the allow-list into a table so step 2 becomes an `insert`.

---

## 12 — The offline round trip is not tested

**Severity:** Low · **Effort:** M · **Area:** Testing

**Problem.** There are about 100 unit tests, but none of them cover:

- `TodoStore` (the repository) or `MyTodos` (the page that renders the lists);
- the core local-first promise, end to end:
  1. edit offline;
  2. reload;
  3. reconnect;
  4. confirm the change is uploaded and visible on another client;
- sign-out with pending uploads.

**Suggested fix.**

- Unit-test `TodoStore` against an in-memory PowerSync/SQLite database, starting with the pure `mapTodoLists()`.
- Add one Playwright test using `context.setOffline(true)` against the local stack.

---

## Template cleanup

These are not offline gaps, but anyone using the repo as a template will trip over
them.

- [ ] **Finnish-only UI.** `<html lang="fi">` and hard-coded Finnish strings, with no i18n layer. Default to English, or add a small message catalog.
- [ ] **`/settings` leads to the 404 page.** The nav item at [navConfig.ts](./app/src/lib/nav/navConfig.ts#L30) has no route.
- [ ] **Empty docs pages.** [get-started.md](./packages/docs/get-started.md), [tutorials.md](./packages/docs/tutorials.md) and [changelog.md](./packages/docs/changelog.md) contain only a heading but appear in the docs nav.
- [ ] **Unused Kysely `db`.** [client.ts](./app/src/lib/sync/client.ts#L19) returns a Kysely-wrapped `db`, but [main.ts](./app/src/lib/main.ts#L38) only uses `powersync`. Either use it in `TodoStore` or drop `@powersync/kysely-driver`.
- [ ] **`VITE_OFFLINE_MODE` is misleading.** It is a "no backend" dev switch that disables auth, sync and session persistence. It is not offline support. Rename it, for example to `VITE_UI_ONLY`.
- [ ] **README claims `npm run check` matches CI.** It doesn't: [CI](./.github/workflows/ci.yml) no longer runs `oxfmt --check` ([README.md](./README.md#L61-L63)). Restore the step or fix the README.
- [ ] **Lockfile and package manager.** CI runs `bun install`, `bun.lock` is git-ignored by `*.lock` ([.gitignore](./.gitignore#L3)), and the only committed lockfile is `package-lock.json`. Pick one package manager, commit its lockfile, and use a frozen install in CI.

---

## What already works (keep these)

- **Sync:** Sync Streams (edition 3); `connect()` once per user; local database bound to the active user via `localUserStore` with automatic `disconnectAndClear()` on sign-out, revoked session at boot, or user switch (see [#3][3] for pending uploads on sign-out).
- **Offline cold start & offline mode:** `AuthService` falls back to the stored local user id when token refresh fails with a retryable network error, and `main.ts` provides `OFFLINE_USER_ID` in `VITE_OFFLINE_MODE`.
- **Upload path:** one RPC per local transaction, applied atomically; fatal vs. transient error split; `transaction.complete()` always called.
- **Database security:**
  - RLS `to authenticated` with ownership checks, `using` + `with check`, and restrictive author policies.
  - The RPC is `security invoker` with `search_path = ''`, `%I` quoting and a table allow-list, and is revoked from `anon`.
- **Replication:** least-privilege `powersync_role`, an explicit publication, and indexes on foreign keys.
- **Client architecture:** a composition root with injected dependencies, a mount/dispose contract, UI-independent auth/sync layers, and oxlint/oxfmt/tsc/knip/Vitest guardrails.

## Suitability by use case

| Use case                                                     | Verdict | Fix first |
| ------------------------------------------------------------ | ------- | --------- |
| Reference for wiring Supabase Auth + Postgres with PowerSync | Good    | —         |
| Internal tool on modern browsers                             | Good    | #3–#4     |
| General offline-first PWA starter                            | Not yet | #1, #3–#6 |
| Consumer app that must run on older iPhones / Firefox ESR    | Not yet | #1, #3–#7 |

Suggested order: **#3 → #4 → #1**, then **#6 → #7**, then the Low items and the cleanup list.
