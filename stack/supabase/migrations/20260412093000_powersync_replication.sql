-- Least-privilege role for the PowerSync service (replaces supabase/roles.sql).
-- REPLICATION reads the WAL; BYPASSRLS lets PowerSync replicate every row and
-- leave per-user filtering to the sync config.
--
-- The role is created without LOGIN so no password is stored in migrations.
-- Local dev enables login in seed.sql. On a hosted project run once:
--   alter role powersync_role with login password '<strong-random-password>';
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls;
  end if;
end $$;

-- Read-only access, limited to the synced tables (same list as the
-- `powersync` publication). Grant new synced tables explicitly.
grant usage on schema public to powersync_role;
grant select on public.lists, public.todos to powersync_role;

-- Replicate only the synced tables. Add new synced tables here
-- (`alter publication powersync add table public.<table>;`) and grant select
-- to powersync_role.
do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'powersync'
  ) then
    create publication powersync for table public.lists, public.todos;
  end if;
end $$;
