SELECT
  lists.*,
  todos.id AS item_id,
  todos.created_at AS item_created_at,
  todos.completed_at AS item_completed_at,
  todos.description AS item_description,
  todos.completed AS item_completed,
  todos.created_by AS item_created_by,
  todos.completed_by AS item_completed_by,
  todos.list_id AS item_list_id
FROM lists
LEFT JOIN todos ON todos.list_id = lists.id
ORDER BY lists.created_at DESC, todos.created_at DESC