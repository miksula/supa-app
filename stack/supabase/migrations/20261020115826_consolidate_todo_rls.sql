-- One ownership policy per table instead of one per command, plus restrictive
-- policies that stop users from writing someone else's id into author fields.

drop policy if exists "Users can view their own lists" on public.lists;
drop policy if exists "Users can create their own lists" on public.lists;
drop policy if exists "Users can update their own lists" on public.lists;
drop policy if exists "Users can delete their own lists" on public.lists;

drop policy if exists "Users can view todos in their own lists" on public.todos;
drop policy if exists "Users can create todos in their own lists" on public.todos;
drop policy if exists "Users can update todos in their own lists" on public.todos;
drop policy if exists "Users can delete todos in their own lists" on public.todos;

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
alter table public.todos alter column created_by set default auth.uid();

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
