-- Replicate only the synced tables instead of `for all tables`. A FOR ALL
-- TABLES publication cannot be altered, so recreate it in one transaction.
-- Add new synced tables here (and grant select to powersync_role).
drop publication if exists powersync;
create publication powersync for table public.lists, public.todos;
