select
  lists.*,
  todos.*
from
  lists
  left join todos on todos.list_id = lists.id
order by
  lists.created_at desc,
  todos.created_at desc