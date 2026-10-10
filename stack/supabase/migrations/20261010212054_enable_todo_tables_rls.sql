alter table public.lists enable row level security;
alter table public.todos enable row level security;

create policy "Users can view their own lists"
on public.lists
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own lists"
on public.lists
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own lists"
on public.lists
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own lists"
on public.lists
for delete
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can view todos in their own lists"
on public.todos
for select
to authenticated
using (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
);

create policy "Users can create todos in their own lists"
on public.todos
for insert
to authenticated
with check (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
);

create policy "Users can update todos in their own lists"
on public.todos
for update
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

create policy "Users can delete todos in their own lists"
on public.todos
for delete
to authenticated
using (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
);