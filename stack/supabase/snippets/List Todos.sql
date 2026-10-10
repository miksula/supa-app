select
  lists.*,
  todos.id as item_id,
  todos.created_at as item_created_at,
  todos.completed_at as item_completed_at,
  todos.description as item_description,
  todos.completed as item_completed,
  todos.created_by as item_created_by,
  todos.completed_by as item_completed_by,
  todos.list_id as item_list_id
from
  lists
  left join todos on todos.list_id = lists.id
order by
  lists.created_at desc,
  todos.created_at desc