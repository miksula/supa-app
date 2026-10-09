create or replace function public.process_powersync_crud(ops jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item jsonb;
  table_name text;
  operation text;
  row_id text;
  op_data jsonb;
  row_data jsonb;
  insert_columns text;
  select_columns text;
  update_columns text;
  update_assignments text;
begin
  if jsonb_typeof(ops) is distinct from 'array' then
    raise exception 'PowerSync CRUD operations must be an array'
      using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(ops)
  loop
    table_name := item ->> 'table';
    operation := item ->> 'op';
    row_id := item ->> 'id';
    op_data := coalesce(item -> 'opData', '{}'::jsonb);

    if jsonb_typeof(item) is distinct from 'object'
      or table_name not in ('lists', 'todos')
      or row_id is null
      or jsonb_typeof(op_data) is distinct from 'object'
    then
      raise exception 'Invalid PowerSync CRUD operation'
        using errcode = '22023';
    end if;

    case operation
      when 'PUT' then
        row_data := op_data || jsonb_build_object('id', row_id);

        select
          string_agg(format('%I', key), ', ' order by key),
          string_agg(format('payload.%I', key), ', ' order by key),
          string_agg(
            format('%I = excluded.%I', key, key),
            ', ' order by key
          ) filter (where key <> 'id')
        into insert_columns, select_columns, update_columns
        from jsonb_object_keys(row_data) as fields(key);

        execute format(
          'insert into public.%I (%s)
           select %s
           from jsonb_populate_record(null::public.%I, $1) as payload
           on conflict (id) do update set %s',
          table_name,
          insert_columns,
          select_columns,
          table_name,
          coalesce(update_columns, 'id = excluded.id')
        )
        using row_data;

      when 'PATCH' then
        select string_agg(
          format('%I = payload.%I', key, key),
          ', ' order by key
        )
        into update_assignments
        from jsonb_object_keys(op_data) as fields(key);

        if update_assignments is not null then
          execute format(
            'update public.%I as target
             set %s
             from jsonb_populate_record(null::public.%I, $1) as payload
             where target.id = $2::uuid',
            table_name,
            update_assignments,
            table_name
          )
          using op_data, row_id;
        end if;

      when 'DELETE' then
        execute format(
          'delete from public.%I where id = $1::uuid',
          table_name
        )
        using row_id;

      else
        raise exception 'Unsupported PowerSync CRUD operation: %', operation
          using errcode = '22023';
    end case;
  end loop;
end;
$$;

revoke all on function public.process_powersync_crud(jsonb) from public, anon;
grant execute on function public.process_powersync_crud(jsonb) to authenticated, service_role;
