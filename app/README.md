# About the App

Browser-based todo app built with TypeScript, Lit, Vite, Supabase Auth, and
PowerSync. The UI uses small functions that mount Lit templates into DOM
elements; it does not use a component framework or a central state store.

## Getting started

This repository is designed to use **Deno** as its package manager. Deno is
npm-compatible, so Deno and npm/Node tools can be mixed when needed.

```sh
deno install
cp app/.env.local.template app/.env.local
```

Set the Supabase and PowerSync values in `app/.env.local`, then start the app
from the `app/` directory:

```sh
cd app
deno task dev
```

Vite serves the app locally and opens it in a browser. To work on the UI without
a running backend, use `deno task dev:offline`; this disables authentication and
remote sync while keeping the local database available. Build with
`deno task build`.

**Using npm:** Some packages use the `workspace:*` version specifier (for
example, `@packages/router`), which Deno supports but npm does not. Before
installing with npm, replace each `workspace:*` entry in `package.json` with an
explicit version (for example, `"@packages/router": "^0.0.0"`), then run
`npm install`.

## Basic architecture

- `src/index.html` is the browser entry point. It loads styles and calls
  `AppRoot`.
- `src/lib/AppRoot.ts` registers routes, chooses a layout and page, and starts
  auth and sync-status controllers. Shared navigation lives in
  `AppLayout`/`AppBar`; login has its own layout.
- `src/pages/` contains route-level screens. `src/lib/` contains UI mount
  functions, auth and routing guards, and data/sync services. UI is rendered
  with Lit; styles are in `src/styles/`.
- `src/lib/AuthService.ts` wraps Supabase Auth. `AuthController` bootstraps the
  session, while `syncLifecycle.ts` connects PowerSync for a signed-in user and
  clears local sync data on sign-out.
- `src/lib/client.ts` configures the PowerSync database and Kysely adapter. The
  schema is in `src/lib/schema.ts`; `TodoStore.ts` reads and writes local todo
  data, and `SupabasePowerSyncConnector.ts` supplies credentials and uploads
  local changes to Supabase.
- `@packages/router` is a workspace package in `../packages/`; the root
  `package.json` defines the npm workspaces and convenience scripts.

When adding a screen, register its route and layout in `AppRoot`, put the page
in `src/pages/`, and keep reusable behavior in `src/lib/`. When changing synced
tables, update the PowerSync schema and keep it aligned with the backend schema
and sync configuration.
