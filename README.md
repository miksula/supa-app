# Supa App

A npm-managed monorepo for an offline-capable todo app. It combines a Lit/Vite
browser client with a Supabase database and a self-hosted PowerSync service.
See [app/README.md](app/README.md) and [stack/README.md](stack/README.md) for
detailed setup instructions.

## Local development

The following binaries are required for running the application:

- `node` and `npm` (or `bun`) to install dependencies, build and run the dev server.
- `docker` (or `orbstack`) to run the local backend services.

Install dependencies with npm, create the local env files from the provided
templates, then start the local stack and app from the repository root:

```sh
npm install # or: bun install
cp app/.env.local.template app/.env.local
cp stack/powersync/docker/.env.template stack/powersync/docker/.env
npm run stack:up
npm run app:start
```

> [!INFO]
> **Missing seed data after starting the stack?** If Supabase reports
> `Starting database from backup...`, it is reusing a saved local database.
> `stack:up` does not apply pending migrations or rerun the seed in this case.
> To rebuild the local database with all migrations and seed data, run
> `npx --no-install supabase db reset --local --workdir=stack`.
> **This deletes existing local data, including auth users.** To preserve data,
> apply pending migrations and import the seed separately instead of resetting.
> View the local database in Studio at <http://127.0.0.1:54323>, not the hosted
> Supabase dashboard.

To work on the UI without a running backend, use
`npm run dev:offline --workspace=app`. See [app/README.md](app/README.md) and
[stack/README.md](stack/README.md) for more details.

Before pushing, run `npm run check`. It runs the same steps as CI
(`.github/workflows/ci.yml`): oxlint, `oxfmt --check`, `tsc` (strict), knip
(unused files, exports and dependencies) and the Vitest unit tests
(`*.test.ts` next to the code they test).

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
