-- Foreign-key columns used by RLS policies, sync queries and cascades.
create index if not exists lists_owner_id_idx on public.lists (owner_id);
create index if not exists todos_list_id_idx on public.todos (list_id);
