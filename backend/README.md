# Supabase and PowerSync Backend

This directory contains the local Supabase and self-hosted PowerSync setup.
Supabase provides Auth and Postgres; PowerSync replicates authorized Postgres
data to the app's local database and uploads local writes.

Unless noted otherwise, run commands from `backend/`.

## Prerequisites

- Supabase CLI (the beta release is used for the latest features)
- PowerSync CLI (`npm install -g powersync`)
- Docker

## Start and stop services

Start both local services:

```bash
supabase start
powersync docker start
```

Stop them when finished:

```bash
powersync docker stop
supabase stop
```

Supabase configuration, migrations, and seed data are in `supabase/`.
PowerSync service and sync configuration are in `powersync/`.

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
supabase init
supabase start
```

Configure the external database and storage connection strings in
`powersync/docker/.env`. When PowerSync runs in Docker and Supabase runs on the
host, use `host.docker.internal` to reach the host:

```env
PS_DATA_SOURCE_URI=******host.docker.internal:54322/postgres
PS_STORAGE_SOURCE_URI=******host.docker.internal:54322/postgres
```

## Database and sync configuration

App-owned database schema changes belong in `supabase/migrations/`. The
migrations create the `lists` and `todos` tables and the `powersync` publication
used for logical replication. Apply pending migrations to a running local
database with:

```bash
supabase migration up --local
```

The PowerSync sync configuration is in `powersync/sync-config.yaml`. It defines
user-scoped streams for lists and their todos. Update it when changing which
rows are synchronized.

## Common commands

Check the PowerSync service and generate the app's TypeScript schema from the
PowerSync configuration:

```bash
powersync status
powersync generate schema --output=ts --output-path=../app/src/lib/schema.ts --directory=./powersync
```

Create a local Supabase user through the Auth API:

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"replace-with-a-strong-password"}'
```

## Migration workflow

Keep migration history focused and readable:

1. Create a timestamped migration with `supabase migration new <name>`.
2. Write only the intended app-owned DDL in the new file under
   `supabase/migrations/`.
3. Apply and verify locally with `supabase migration up --local`. Use
   `supabase db reset` when you need to rebuild the local database from
   migrations and seed data.
4. Treat `supabase db diff` as a draft: keep only relevant statements rather
   than committing generated schema, grant, role, or platform changes blindly.

Prefer hand-written migrations for app-owned tables, columns, indexes,
functions, and publications. Manage Supabase platform objects such as `auth`
and `storage` only when the change specifically requires it.

## Backup and restore

Before upgrading the Supabase CLI when local Supabase data matters, back up the
database and stop the stack without a backup:

```bash
supabase db diff -f my_schema
supabase db dump --local --data-only > supabase/seed.sql
supabase stop --no-backup
```

To restore a database from a hosted Supabase project, follow the
[Supabase self-hosting restore guide][supabase-restore].

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
