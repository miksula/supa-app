create table if not exists public.lists (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  name text not null,
  owner_id uuid not null,
  constraint lists_pkey primary key (id),
  constraint lists_owner_id_fkey foreign key (owner_id) references auth.users (id) on delete cascade
) tablespace pg_default;

create table if not exists public.todos (
  id uuid not null default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone null,
  description text not null,
  completed boolean not null default false,
  created_by uuid null default auth.uid(),
  completed_by uuid null,
  list_id uuid not null,
  constraint todos_pkey primary key (id),
  constraint todos_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null,
  constraint todos_completed_by_fkey foreign key (completed_by) references auth.users (id) on delete set null,
  constraint todos_list_id_fkey foreign key (list_id) references public.lists (id) on delete cascade
) tablespace pg_default;

-- Foreign-key columns used by RLS policies, sync queries and cascades.
create index if not exists lists_owner_id_idx on public.lists (owner_id);
create index if not exists todos_list_id_idx on public.todos (list_id);

-- Row-level security: one ownership policy per table, plus restrictive
-- policies that stop users from writing someone else's id into author fields.
alter table public.lists enable row level security;
alter table public.todos enable row level security;

create policy "Users can manage their own lists"
on public.lists
for all
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can manage todos in their own lists"
on public.todos
for all
to authenticated
using (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
);

-- Author fields: new todos are created by the caller (defaulted when omitted);
-- updates may only record the caller as author/completer.
create policy "Todos are created by the current user"
on public.todos
as restrictive
for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "Todo authors can only be the current user"
on public.todos
as restrictive
for update
to authenticated
with check (
  (created_by is null or created_by = (select auth.uid()))
  and (completed_by is null or completed_by = (select auth.uid()))
);