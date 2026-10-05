# Supabase + PowerSync Backend

This is a self-hosted backend setup that syncs data between Supabase and
PowerSync.

Useful links:

- https://docs.powersync.com/intro/powersync-philosophy
- https://supabase.com/docs/guides/local-development
- https://docs.powersync.com/tools/cli#docker-local-development
- https://github.com/powersync-ja/powersync-cli/blob/main/examples/self-hosted/local-basic-supabase/README.md

## Getting started

Start services:

```bash
supabase start
powersync docker start
```

Stop services:

```bash
supabase stop
powersync docker stop
```

The `supabase/` folder holds the local Supabase configuration (database
migrations, config) used when running `supabase start`.

## Steps to Run This Backend

Install `powersync` globally:

```bash
npm install -g powersync
```

Install Supabase CLI (use beta version for latest features):

```bash
brew install supabase/tap/supabase-beta
```

## Initialization (done only the first time)

```bash
powersync init self-hosted
```

Since we use Supabase for the databases, configure external modules:

```bash
powersync docker configure --database=external --storage=external
```

Initialize and start Supabase

```bash
supabase init
supabase start
```

## Apply Supabase DB credentials to PowerSync

Edit `powersync/docker/.env` with connection strings. Use `host.docker.internal`
so the PowerSync service (running in Docker) can reach Supabase on the host:

```env
# external Database Config
PS_DATA_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres

# external Storage Config
PS_STORAGE_SOURCE_URI=postgresql://postgres:postgres@host.docker.internal:54322/postgres
```

## Add schema and publication to Supabase

Create `supabase/migrations/202615031420_init.sql`:

```sql
CREATE TABLE IF NOT EXISTS
  public.lists (
    id UUID NOT NULL DEFAULT gen_random_uuid (),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL,
    CONSTRAINT lists_pkey PRIMARY KEY (id),
    CONSTRAINT lists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users (id) ON DELETE CASCADE
  ) TABLESPACE pg_default;

CREATE TABLE IF NOT EXISTS
  public.todos (
    id UUID NOT NULL DEFAULT gen_random_uuid (),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    description TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NULL,
    completed_by UUID NULL,
    list_id UUID NOT NULL,
    CONSTRAINT todos_pkey PRIMARY KEY (id),
    CONSTRAINT todos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT todos_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES auth.users (id) ON DELETE SET NULL,
    CONSTRAINT todos_list_id_fkey FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE
  ) TABLESPACE pg_default;

CREATE PUBLICATION powersync FOR ALL TABLES;
```

If the supabase stack is already running and you want to apply pending
migrations:

```bash
supabase migration up --local
```

## Update sync config

Ensure `powersync/sync-config.yaml` includes rules for the `todos` table (e.g.
`SELECT * FROM todos` in a bucket).

## Start the PowerSync stack

```bash
powersync docker start
```

## Usage

This project can be used with any self-hosted CLI commands:

```bash
powersync status
powersync generate schema --output-path=../app/src/shared/schema.ts --output=ts
```

## Supabase signup

Create user via Supabase auth API:

```bash
curl -X POST 'http://127.0.0.1:54321/auth/v1/signup' -H "Content-Type: application/json" -d '{"email":"user@example.com","password":"SuperSecret123!"}'
```

## Backup before updating Supabase CLI:

If you have any Supabase containers running locally, stop them and delete their
Docker data volumes before proceeding with the upgrade.

```
supabase db diff -f my_schema
supabase db dump --local --data-only > supabase/seed.sql
supabase stop --no-backup
```

## Low-noise migration workflow

If you want clean migration history, do not rely on `supabase db diff` as the
default workflow. In this project, the better approach is to write focused
migration files by hand for app-owned schema changes.

Recommended workflow:

1. Make the schema change intentionally.
   - Add a new file under `supabase/migrations/` with a timestamped name.
   - **Tip**: Use command `supabase migration new <name>` to create empty
     migration file.
   - Keep the file limited to the specific change you are making.

2. Prefer hand-written DDL for normal app changes.
   - Tables, columns, indexes, functions, and publications are usually easier to
     review when written manually.
   - This avoids generated noise such as grants, roles, auth/storage changes,
     and extension side effects.

3. Use `supabase db diff` only as a helper, not as the source of truth.
   - Generate a draft diff when needed.
   - Copy only the relevant statements into a clean migration file.
   - Do not commit the raw diff blindly.

4. Apply and verify locally.
   - Run `supabase db reset` when you want to rebuild from migrations and seed.
   - Or run `supabase migration up --local` to apply pending migrations.

5. Keep schema ownership clear.
   - App-owned database objects should live in `supabase/migrations/`.
   - Treat `auth`, `storage`, generated grants, and role churn as platform noise
     unless you explicitly mean to manage them.

Practical rule:

- If you understand the schema change, write the migration manually.
- If you use `supabase db diff`, treat the output as a draft and trim it down.

Example migration flow:

```bash
# 1. Create a timestamped migration file manually
supabase migration new add_example_table
# -> supabase/migrations/20260412093000_add_example_table.sql

# 2. Apply it locally
supabase migration up --local

# 3. Rebuild from scratch when needed
supabase db reset
```

## Restoration guide

To restore your database from the Supabase platform see:

- https://supabase.com/docs/guides/self-hosting/restore-from-platform
