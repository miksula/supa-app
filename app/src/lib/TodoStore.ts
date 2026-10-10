import type { PowerSyncDatabase } from "@powersync/web";
import type { Database } from "@/lib/schema.ts";

export type Todo = Database["todos"];
export type List = Database["lists"];
export type ListWithTodoRow = List & {
  item_id: string | null;
  item_created_at: string | null;
  item_completed_at: string | null;
  item_description: string | null;
  item_completed: number | null;
  item_created_by: string | null;
  item_completed_by: string | null;
  item_list_id: string | null;
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
      ORDER BY lists.created_at DESC, todos.created_at DESC`,
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
