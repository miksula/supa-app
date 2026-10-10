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
migrations create the `lists` and `todos` tables and the `powersync` publication
used for logical replication. Apply pending migrations to a running local database with:

```bash
npx --no-install supabase db push --local --workdir=stack
```

The PowerSync sync configuration is in `powersync/sync-config.yaml`. It defines
user-scoped streams for lists and their todos. Update it when changing which
rows are synchronized.

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
The migration
`20261010212054_enable_todo_tables_rls.sql` enables RLS and adds ownership
policies for the existing `lists` and `todos` tables.

## Common commands

Check the PowerSync service and generate the app's TypeScript schema from the
PowerSync configuration:

```bash
powersync status --directory=stack/powersync
npm run schema:generate
```

Create a local Supabase user through the Auth API:

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
`powersync/docker/.env`. When PowerSync runs in Docker and Supabase runs on the
host, use `host.docker.internal` to reach the host:

```env
PS_DATA_SOURCE_URI=postgres:postgres@host.docker.internal:54322/postgres
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
