# Local Supabase and PowerSync Stack

This directory contains the local Supabase and self-hosted PowerSync stack.
Supabase provides Auth and Postgres; PowerSync replicates authorized Postgres
data to the app's local database and uploads local writes.

The root `package.json` provides commands for starting and stopping the stack.
Unless noted otherwise, run commands from the repository root.

## Prerequisites

- Supabase CLI
- PowerSync CLI
- Docker

The repository pins the Supabase CLI as a development dependency. Prefer
`npx --no-install supabase ...` for direct CLI commands so the local version is
used and no package is downloaded implicitly. The existing `npm run` scripts
resolve the local CLI automatically. If using Bun for CLI commands, the
equivalent is `bunx --no-install supabase ...`.

## Start and stop services

PowerSync reads its connection strings from `powersync/docker/.env`, which is
git-ignored. Create it from the template once:

```bash
cp stack/powersync/docker/.env.template stack/powersync/docker/.env
```

Start both local services at project root:

```bash
npm run stack:up
```

Stop them when finished:

```bash
npm run stack:down
```

Supabase configuration, migrations, and seed data are in `supabase/`.
PowerSync service and sync configuration are in `powersync/`.

## Database and sync configuration

App-owned database schema changes belong in `supabase/migrations/`. The
migrations create the `lists` and `todos` tables, the `powersync_role`
replication role, and the `powersync` publication (an explicit table list) used
for logical replication. Apply pending migrations to a running local database with:

```bash
npx --no-install supabase db push --local --workdir=stack
```

The PowerSync sync configuration is in `powersync/sync-config.yaml`. It defines
user-scoped streams for lists and their todos. Update it when changing which
rows are synchronized.

### PowerSync database role

PowerSync replicates as `powersync_role`, created by the
`*_powersync_role.sql` migration: `REPLICATION` for logical replication,
`BYPASSRLS` so it can read every row it replicates, and `SELECT` on the synced
tables only. The migration creates the role without `LOGIN`, so no password is
stored in migrations:

- Locally, `supabase/seed.sql` enables login with the dev password used in
  `PS_DATA_SOURCE_URI` (`powersync/docker/.env.template`).
- On a hosted project, run once:
  `alter role powersync_role with login password '<strong-random-password>';`

### Adding a synced table

1. Migration: create the table with RLS policies, index the foreign-key
   columns used by policies and sync queries,
   `grant select on public.<table> to powersync_role;`, and add the table to
   the publication (`alter publication powersync add table public.<table>;`).
2. Add a stream query for the table to `powersync/sync-config.yaml`.
3. Regenerate the client schema with `npm run schema:generate`
   (writes `app/src/lib/sync/schema.ts`).
4. Add the table name to the allow-list in
   `supabase/migrations/20260412100000_process_powersync_crud.sql` (in a new
   migration that replaces the function) so uploads are accepted.

## Migration workflow

Keep migration history focused and readable:

1. Create a timestamped migration with
   `npx --no-install supabase migration new <name> --workdir=stack`.
2. Write only the intended app-owned DDL in the new file under
   `stack/supabase/migrations/`.
3. Apply and verify locally with
   `npx --no-install supabase db push --local --workdir=stack`. Use
   `npx --no-install supabase db reset --workdir=stack` when you need to rebuild the local
   database from migrations and seed data.
4. Preview migrations before applying them to a linked project with:

   ```bash
   npx --no-install supabase db push --linked --dry-run --workdir=stack
   ```

   Apply them to the linked project with:

   ```bash
   npx --no-install supabase db push --linked --workdir=stack
   ```

   The project must be linked first with `npx --no-install supabase link`, and the database
   password may be requested by the CLI.

5. Treat `supabase db diff` as a draft: keep only relevant statements rather
   than committing generated schema, grant, role, or platform changes blindly.

Prefer hand-written migrations for app-owned tables, columns, indexes,
functions, and publications. Manage Supabase platform objects such as `auth`
and `storage` only when the change specifically requires it.

Tables in exposed schemas such as `public` must use row-level security when
they are accessed through the Supabase Data API. For every new exposed table,
enable RLS in the same migration that creates the table and add policies for
the intended roles and ownership rules:

```sql
create table public.example (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id)
);

alter table public.example enable row level security;

create policy "Users can manage their own rows"
on public.example
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);
```

Enabling RLS without policies denies access to `anon` and `authenticated`.
`20261010212054_enable_todo_tables_rls.sql` enables RLS on `lists` and `todos`;
`20261020115826_consolidate_todo_rls.sql` replaces the per-command policies with
one ownership policy per table, plus restrictive policies that only allow the
current user in `todos.created_by` / `completed_by`.

## Common commands

Check the PowerSync service and generate the app's TypeScript schema from the
PowerSync configuration:

```bash
powersync status --directory=stack/powersync
npm run schema:generate
```

`supabase db reset` seeds a dev user (`dev@example.com` / `password123`) with
sample lists and todos from `supabase/seed.sql`. Set `VITE_DEV_EMAIL` /
`VITE_DEV_PASSWORD` in `app/.env.local` to prefill the login form.

Create additional local users through the Auth API:

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"replace-with-a-strong-password"}'
```

The local PostgreSQL connection URI is:

```bash
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Backup and restore

Before upgrading the Supabase CLI when local Supabase data matters, back up the
database and stop the stack without a backup:

```bash
supabase db diff -f my_schema --workdir=stack
supabase db dump --local --data-only --workdir=stack > stack/supabase/seed.sql
supabase stop --no-backup --workdir=stack
```

To restore a database from a hosted Supabase project, follow the
[Supabase self-hosting restore guide][supabase-restore].

## One-time setup

The following setup steps are only needed when initializing a new local
environment. The repository already contains the Supabase and PowerSync
configuration.

Initialize a self-hosted PowerSync setup and configure it to use Supabase for
the database and storage:

```bash
powersync init self-hosted
powersync docker configure --database=external --storage=external
```

Initialize and start Supabase if it has not already been initialized:

```bash
supabase init --workdir=stack
supabase start --workdir=stack
```

Configure the external database and storage connection strings in
`powersync/docker/.env` (copied from `.env.template`, see above). When PowerSync runs in Docker and Supabase runs on the
host, use `host.docker.internal` to reach the host. Replication uses
`powersync_role`; PowerSync's own storage uses `postgres`:

```env
PS_DATA_SOURCE_URI=postgresql://powersync_role:powersync_local@host.docker.internal:54322/postgres
PS_STORAGE_SOURCE_URI=postgres:postgres@host.docker.internal:54322/postgres
```

## References

- [PowerSync philosophy][powersync-philosophy]
- [Supabase local development][supabase-local]
- [PowerSync CLI: local Docker development][powersync-docker]
- [PowerSync self-hosted Supabase example][powersync-example]
- [Supabase self-hosting restore guide][supabase-restore]

[powersync-philosophy]: https://docs.powersync.com/intro/powersync-philosophy
[supabase-local]: https://supabase.com/docs/guides/local-development
[powersync-docker]: https://docs.powersync.com/tools/cli#docker-local-development
[powersync-example]: https://github.com/powersync-ja/powersync-cli/blob/main/examples/self-hosted/local-basic-supabase/README.md
[supabase-restore]: https://supabase.com/docs/guides/self-hosting/restore-from-platform
