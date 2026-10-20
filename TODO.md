# TODO — Code-base maintainability review

Findings from an SRP / IoC / OCP review. Items are ordered by payoff vs. effort:
phases 1–4 are mostly deletions and one-liners; later phases are structural.

Legend: **S** = small (< 30 min), **M** = medium (a few hours), **L** = large.
Principles: **SRP** single responsibility · **IoC** inversion of control · **OCP** open/closed.

_Last re-checked against the code base: 2026-10-20._

---

## Phase 1 — Remove dead code & placeholders (S)

Goal: a reader should only see code that is actually in use.

- [x] **Delete unused TS modules**
  - `pages/my-todos/Todos.ts` was already gone; `lib/ui/Accordion.ts` deleted.

- [x] **Resolve empty page files**
  - Docs pages are implemented; the `/docs/:id` `console.log` is gone.
  - [pages/not-found/index.ts](./app/src/pages/not-found/index.ts) now exports `NotFoundPage`, used by [AppRoot.ts](./app/src/lib/AppRoot.ts).

- [x] **Decide on `SidebarFooter` + `SyncController`** — Option A taken
  - [SidebarFooter.ts](./app/src/lib/shell/SidebarFooter.ts) is mounted inside the account menu in [Sidebar.ts](./app/src/lib/shell/Sidebar.ts); [SyncController.ts](./app/src/lib/sync/SyncController.ts) is mounted in `AppRoot`.

- [x] **Remove unused members**
  - `AuthController.isBootstrapping`, the `disposeAppBar` alias, and the commented-out PowerSync config in [client.ts](./app/src/lib/sync/client.ts) removed.
  - `AuthService.session$` kept (used by `Sidebar.ts`).

- [x] **Remove orphaned CSS** — `app-layout.css`, `app-bar.css`, `app-button.css`, `accordion.css` deleted and dropped from [index.css](./app/src/styles/index.css).

- [x] **Clean up assets** — replaced hand-copied SVGs in `app/src/lib/assets/` with the `lucide` package; icons are registered in [icons.ts](./app/src/lib/ui/icons.ts)
  - Drop unused icons from the `appIcons` map once features are settled. Currently unused: `addList`, `check`, `chessRook`, `colorScheme`, `command`, `logo`

---

## Phase 2 — Fix outdated docs & scripts (S)

- [x] **Rewrite [app/README.md](./app/README.md) “Basic architecture”** — now describes `lib/auth`, `lib/sync`, `lib/shell`, `lib/nav`, `lib/ui` and `pages/`.
  - Still references non-existent `AppLayout`/`AppBar`, `src/lib/AuthService.ts`, `src/lib/client.ts`, `src/lib/schema.ts`.
  - (`TodoStore.ts`, `TodoList`, `TodoListCard` now exist in `pages/my-todos/`, so the “Component patterns” examples are valid again.)
  - Describe the real folders: `lib/auth/`, `lib/sync/`, `lib/shell/`, `lib/nav/`, `lib/ui/`, `pages/`.

- [x] **Fix `schema:generate` output path** in [package.json](./package.json)
  - Currently `app/src/lib/schema.ts`; actual file is `app/src/lib/sync/schema.ts`.

- [x] **Document `roles.sql`** — “PowerSync database role” section in [stack/README.md](./stack/README.md).

- [x] **Fix `type-check` script** — `bun check` did not exist; now `tsc --noEmit -p app/tsconfig.json` with `typescript` as a dev dependency, and [app/tsconfig.json](./app/tsconfig.json) sets `target`/`module`/`moduleResolution: bundler`/`allowImportingTsExtensions`/`noEmit`, plus `useDefineForClassFields: false` so ES2022 class fields don't shadow Lit reactive properties.

---

## Phase 3 — Correctness & security fixes (S)

- [x] **Wrong redirect path on bootstrap failure** — now navigates to `/auth`.
  - [AuthController.ts](./app/src/lib/auth/AuthController.ts) still navigates to `/login`; the route is `/auth`.

- [x] **`route` is undefined when landing on `/`**
  - Fixed by the router's `navigationRevision` guard: the `/` handler's `navigate()` bumps the revision, so `check()` skips the stale listener call.
  - Remaining edge: the Navigation-API intercept path (`matchSyncRoute`/`matchAsyncRoute`) has no revision guard, so a link to `/` briefly re-renders the previous route before redirecting — see Phase 10.

- [x] **Remove hardcoded credentials** — fields start empty; the dev server prefills from `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD` (see [.env.local.template](./app/.env.local.template)).
  - [pages/auth/index.ts](./app/src/pages/auth/index.ts) still defaults `email`/`password` to real-looking values.
  - Use `import.meta.env.DEV ? import.meta.env.VITE_DEV_EMAIL : ""`.

- [x] **Ignore env files**
  - [x] `app/.env.local` is not tracked (covered by `*.local` in [app/.gitignore](./app/.gitignore)).
  - [x] Add `.env*` (with `!.env*.template`) to the root [.gitignore](./.gitignore) as a safety net.
  - [x] `stack/powersync/docker/.env` untracked and replaced by [.env.template](./stack/powersync/docker/.env.template).

---

## Phase 4 — Backend stack cleanup (S)

- [x] **Seed a dev user + sample data** in [seed.sql](./stack/supabase/seed.sql) — `dev@example.com` / `password123`, two lists, three todos.
  - Replaces the hardcoded login credentials (Phase 3) and gives `db reset` something to show.

- [x] **Disable anonymous sign-ins** — config updated and the `is_anonymous` branch removed.
  - [config.toml](./stack/supabase/config.toml): `enable_anonymous_sign_ins = false`
  - Then remove the `is_anonymous` → `logout()` branch in [AuthController.ts](./app/src/lib/auth/AuthController.ts). (SRP: one less job for the controller.)

- [x] **Resolve `roles.sql`** — converted to the `powersync_role` migration (no `LOGIN`; seed.sql sets a local password) and `PS_DATA_SOURCE_URI` uses `powersync_role`. Note: the Supabase CLI did apply `supabase/roles.sql` as “globals” on `db reset`, but it never reached hosted projects.
  - Not applied by any migration or seed; PowerSync connects as `postgres`.
  - Either convert it into a migration and use `powersync_role` in `PS_DATA_SOURCE_URI`, or delete it.

- [x] **Add missing FK indexes** (new migration)

  ```sql
  create index lists_owner_id_idx on public.lists (owner_id);
  create index todos_list_id_idx  on public.todos (list_id);
  ```
  - Used by every RLS policy, both sync queries, and FK cascades.
  - Also consider a client index in [schema.ts](./app/src/lib/sync/schema.ts): `todos: { indexes: { list: ["list_id"] } }`.

- [x] **Consolidate RLS policies** (new migration)
  - [enable_todo_tables_rls.sql](./stack/supabase/migrations/20261010212054_enable_todo_tables_rls.sql) repeats the list-ownership subquery 5×.
  - Replace with one `for all` policy per table (as recommended in [stack/README.md](./stack/README.md)).

- [x] **Enforce author fields** — `created_by` defaults to `auth.uid()`; restrictive insert/update policies allow only the current user. The app now sends `created_by` / `completed_by`.
  - `todos.created_by` / `completed_by` accept any user id.
  - Add `with check (created_by = (select auth.uid()))`

- [x] **Use an explicit publication table list** — recreated (a `for all tables` publication cannot be altered).
  - `create publication powersync for all tables` replicates every future table.
  - `alter publication powersync set table public.lists, public.todos;`

- [x] **Pin PowerSync image version** in [docker-compose.yaml](./stack/powersync/docker/docker-compose.yaml) (`1.26.1`).

- [x] **Add an “Adding a synced table” checklist** to [stack/README.md](./stack/README.md):
  1. Migration: table + RLS + indexes + publication
  2. [sync-config.yaml](./stack/powersync/sync-config.yaml) stream query
  3. `npm run schema:generate` → [schema.ts](./app/src/lib/sync/schema.ts)
  4. Allow-list in [process_powersync_crud](./stack/supabase/migrations/20260412100000_process_powersync_crud.sql)

- [ ] **Move PowerSync API tokens to `!env`** — [service.yaml](./stack/powersync/service.yaml) `api.tokens` and [cli.yaml](./stack/powersync/cli.yaml) `api_key` still hold the dev token. The CLI reads `PS_ADMIN_TOKEN` from the shell (not `docker/.env`), so this needs a documented export.

---

## Phase 5 — Tooling guardrails (S)

- [x] **Enable `"strict": true`** in [app/tsconfig.json](./app/tsconfig.json) and fix the resulting errors.
  - No errors with TypeScript 7; the `page(...) ?? null` typing in [AppRoot.ts](./app/src/lib/AppRoot.ts) is still cleaned up by the Phase 7 mount contract.
- [x] **Add [knip](https://knip.dev)** to detect unused files/exports/dependencies (would have caught all of Phase 1).
  - [knip.json](./knip.json) ignores `AppLink.ts` (kept on purpose) plus `@journeyapps/wa-sqlite` / `tailwindcss` (used outside TS). Unused exports were un-exported.
  - [ ] Decide on `db` (Kysely) in [client.ts](./app/src/lib/sync/client.ts): returned by `createPowerSync()` but unused; use it in the todo repository (Phase 9) or drop it with `@powersync/kysely-driver`.
- [x] **Strengthen [.oxlintrc.json](./.oxlintrc.json)** — `no-unused-vars: error`, `no-console: warn` (allows `error`/`warn`; off in `scripts/`).
- [x] **Add CI** ([ci.yml](./.github/workflows/ci.yml)): oxlint, oxfmt --check, tsc, knip, vitest. Same steps locally via `npm run check`.
  - [ ] `bun.lock` is git-ignored (`*.lock`), so CI installs unpinned versions; consider committing it and using `bun install --frozen-lockfile`.
- [x] **Add first unit tests** (Vitest) for already-pure, injectable modules:
  - [authGuard.ts](./app/src/lib/auth/authGuard.ts) — redirect matrix (ready/auth/path)
  - [syncLifecycle.ts](./app/src/lib/sync/syncLifecycle.ts) — connect once per user, reset on sign-out, retry after failure

---

## Phase 6 — Inversion of Control: one config & one composition root (M)

- [x] **Create [lib/config.ts](./app/src/lib/config.ts)** with all `import.meta.env` reads
  - Centralizes endpoints, keys, offline mode, development mode and dev-only login prefill.

- [x] **Inject config into `AuthService`** — `new AuthService(config)` instead of reading env in the constructor.

- [x] **Single composition root** in [lib/main.ts](./app/src/lib/main.ts), called from [index.html](./app/src/index.html)
  - Constructs `authService`, the PowerSync database, connector, guard, sync lifecycle and todo store; injects dependencies into `AppRoot` / `AuthController`.
  - Deletes `auth.ts` and `routeGuard.ts`; [client.ts](./app/src/lib/sync/client.ts) now exports a factory instead of singleton instances.
  - The router package's singleton remains for Phase 10; only the composition root imports it at runtime.

- [x] **Pass dependencies to pages/components**
  - Login gets a bound callback and prefill values; shell components get routing, navigation items and account capabilities; docs get a navigation callback.
  - [MyTodosPage](./app/src/pages/my-todos/index.ts) passes an injected store and live user-ID getter to [MyTodos.ts](./app/src/pages/my-todos/MyTodos.ts), with no singleton fallback.
  - Config, auth construction, controller bootstrap and connector behavior have focused unit tests.

- [x] **Narrow the connector's dependency**
  - [SupabasePowerSyncConnector](./app/src/lib/sync/SupabasePowerSyncConnector.ts) receives a `SupabaseClient` directly, preserving existing credentials and upload behavior without depending on `AuthService`.

---

## Phase 7 — Lifecycle & component consistency (M)

- [ ] **Define one mount contract** in [types.ts](./app/src/lib/types.ts)
  ```ts
  export type Dispose = () => void;
  export type Mount<P = void> = (el: HTMLElement, props: P) => Dispose | void;
  ```
  - `types.ts` currently has `MountFunction = (el) => void | (() => void)`; the `void` arm causes the `AppRoot.ts` type error noted in Phase 5.
- [ ] **Replace DOM expando disposers** (`disposeSidebar`, `disposeSidebarFooter`, `disposePageHeader`) with returned `Dispose` functions; `SidebarLayout` / `Sidebar` keep the references.
- [ ] **Let pages return `Dispose`** and have the router/layout manager call it on navigation.
  - [x] `AppRoot` already calls the page's returned disposer; `MyTodosPage` returns one.
  - [ ] `DocsPage` and `LoginPage` return nothing yet.
- [ ] **Update [app/README.md](./app/README.md) “Component patterns”** to match the chosen contract.
- [ ] **Co-locate CSS with components** (`import "./sidebar.css"` from `Sidebar.ts`) instead of the manual global list in [index.css](./app/src/styles/index.css). (OCP: adding a component no longer edits a global file.)
- [x] **Simplify [AppIcon.ts](./app/src/lib/ui/AppIcon.ts)**: sizes the host only, CSS sizes the inner `<svg>`, `aria-hidden="true"` set on every icon (done in the Lucide migration).
- [x] **Add a sign-out UI** — “Kirjaudu ulos” in the [Sidebar.ts](./app/src/lib/shell/Sidebar.ts) account menu calls `authService.logout()`.
- [ ] **Pick one UI language** — Finnish and English are still mixed:
  - [SidebarFooter.ts](./app/src/lib/shell/SidebarFooter.ts): Finnish aria-labels/sync labels, English “Theme:” / “Light” / “Dark”.
  - [Sidebar.ts](./app/src/lib/shell/Sidebar.ts): Finnish account menu (“Kirjaudu ulos”, “Tili”), English nav and “Toggle submenu”.

---

## Phase 8 — Single Responsibility splits (M)

- [ ] **Split [AppRoot.ts](./app/src/lib/AppRoot.ts)**
  - `routes.ts` — route table as data:
    ```ts
    export const routes: RouteDef[] = [
      { path: "/my-todos", page: MyTodosPage, layout: "app" },
      { path: "/docs/:id", page: DocsPage, layout: "app" },
      { path: "/auth", page: LoginPage, layout: "login", transition: true },
      { path: "/*", page: NotFoundPage, layout: "app" },
    ];
    ```
  - `layoutManager.ts` — mount/dispose layouts + view transitions (driven by a `transition` flag, not hardcoded `"login"`/`"app"` names).
  - Remove the shared mutable `let route` that route handlers set and the listener reads.

- [ ] **Split [SidebarFooter.ts](./app/src/lib/shell/SidebarFooter.ts)**
  - `lib/theme/theme.ts` (pure helpers; reuse from the inline script in [index.html](./app/src/index.html))
  - `ThemeSwitcher.ts`, `SyncStatusIndicator.ts`

- [ ] **Slim down [AuthService.ts](./app/src/lib/auth/AuthService.ts)** — client creation moves to the composition root; service only manages session state.

- [ ] **Extract sidebar persistence** from [SidebarLayout.ts](./app/src/lib/shell/SidebarLayout.ts) (localStorage + cookie) into a small `sidebarState.ts`; consider dropping the cookie (no SSR).

- [ ] **Fix nav active-state special case**
  - [Sidebar.ts](./app/src/lib/shell/Sidebar.ts) `isItemActive` maps `/` → `/my-todos`. Point [navConfig.ts](./app/src/lib/nav/navConfig.ts) at `/my-todos` directly and drop the special case.

- [ ] **Single upload path in connector**
  - Route all uploads through the `process_powersync_crud` RPC (it is `security invoker`, so RLS applies).
  - Removes the PostgREST `switch`; extract `isFatalError()`.

---

## Phase 9 — Rebuild the todo feature with clean boundaries (M–L)

- [x] **Create a todo repository** (SRP: data access only, IoC: DB passed in)
  - Implemented as [TodoStore.ts](./app/src/pages/my-todos/TodoStore.ts) taking a `PowerSyncDatabase`: `watchUserLists()`, `createList()`, `createTodo()`, `updateListName()`, `setTodoCompleted()`, `deleteList()`, plus pure `mapTodoLists()`.
  - Optional: move it to `lib/todos/` if other pages will use it.
- [x] **Inject the repository into [MyTodosPage](./app/src/pages/my-todos/index.ts)**
  - [x] Placeholder boxes replaced by [MyTodos.ts](./app/src/pages/my-todos/MyTodos.ts), [TodoList.ts](./app/src/pages/my-todos/TodoList.ts), [TodoListCard.ts](./app/src/pages/my-todos/TodoListCard.ts).
  - [x] The composition root creates `TodoStore` and passes it through `MyTodosPage`; `MyTodos` has no singleton fallback (Phase 6).
- [ ] **Unit-test the repository** against an in-memory PowerSync / SQLite DB (start with the pure `mapTodoLists()`).

---

## Phase 10 — Router cleanup (M)

- [ ] **Deduplicate matching** in [router.ts](./packages/router/src/router.ts) — the “build URL → exec → RouteContext → notify listeners” block appears 4×; extract a private `match(path)` + `notify()`.
  - While doing so, route the intercept path through `notifyRouteListeners(revision)` too, so in-handler redirects don't notify listeners with a stale route (see Phase 3).
- [ ] **Fix `RouterType`** — currently `typeof Router` (constructor type); likely intended `Router` (instance type).
- [ ] **Consider explicit construction** instead of a module-level singleton whose constructor registers a global `navigate` listener on import.
- [ ] **Add router tests** (pattern matching, trailing slashes, params, search).
