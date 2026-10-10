# Supa App

A npm-managed monorepo for an offline-capable todo app. It combines a Lit/Vite
browser client with a local Supabase database and a self-hosted PowerSync service.
See [app/README.md](app/README.md) and [stack/README.md](stack/README.md) for
detailed setup instructions.

## Local development

The following executables are required for local development:

- `node` and `npm` (or `bun`) to install dependencies and run the app.
- `supabase` to manage the local Supabase backend.
- `powersync` to generate the sync schema and run the PowerSync service.
- `docker` to run the local backend services.

Install dependencies with npm, configure `app/.env.local` from the provided
template, then start the local stack and app from the repository root:

```sh
npm install # or: bun install
npm run stack:up
npm run app:start
```

To work on the UI without a running backend, use
`npm run dev:offline --workspace=app`. See [app/README.md](app/README.md) and
[stack/README.md](stack/README.md) for more details.

## Repository map

- `app/` — browser app, routing, Supabase Auth, local database and sync client.
- `stack/supabase/` — local Supabase configuration, migrations, and seed data.
- `stack/powersync/` — PowerSync service, Docker setup, and user-scoped sync
  configuration.
- `packages/router/` — shared client-side router workspace package.

## How the pieces work together

Supabase is the system of record: it provides authentication and the Postgres
database containing users, lists, and todos. PowerSync reads database changes
through Postgres logical replication and the `powersync` publication, then
streams each signed-in user's authorized rows to a local SQLite database in the
browser. The app reads and writes that local database, so previously synced
data is available offline and local changes can queue until connectivity returns.
The app's Supabase connector uploads queued writes to Postgres, and those changes
are then replicated back to connected clients.

The app signs users in with Supabase Auth and uses the session token to connect
to PowerSync. The PowerSync sync configuration scopes list and todo data to the
authenticated user. On sign-out, the app disconnects and clears synced local
data so it is not left available to another user.

![Supa App architecture diagram](architecture-diagram.png)