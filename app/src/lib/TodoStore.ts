import type { PowerSyncDatabase } from "@powersync/web";
import type { Database } from "@/lib/schema.ts";

export type Todo = Database["todos"];
export type List = Database["lists"];
export type ListWithTodos = List & {
  items: string;
};

export type NewTodo = {
  description: string;
  listId: string;
};

export class TodoStore {
  constructor(private readonly ps: PowerSyncDatabase) {}

  watchUserLists(options?: { signal?: AbortSignal }) {
    return this.ps.watch(
      `SELECT
        lists.*,
        COALESCE(
          (
            SELECT json_group_array(
              json_object(
                'id', todos.id,
                'created_at', todos.created_at,
                'completed_at', todos.completed_at,
                'description', todos.description,
                'completed', todos.completed,
                'created_by', todos.created_by,
                'completed_by', todos.completed_by,
                'list_id', todos.list_id
              )
            )
            FROM todos
            WHERE todos.list_id = lists.id
          ),
          json('[]')
        ) AS items
      FROM lists
      ORDER BY lists.created_at DESC`,
      [],
      options,
    );
  }

  watchUserTodos(options?: { signal?: AbortSignal }) {
    return this.ps.watch("SELECT * FROM todos ORDER BY created_at DESC", [], options);
  }

  async createTodo(todo: NewTodo) {
    return await this.ps.execute(
      "INSERT INTO todos (id, description, list_id, created_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), todo.description, todo.listId, new Date().toISOString()],
    );
  }
}
