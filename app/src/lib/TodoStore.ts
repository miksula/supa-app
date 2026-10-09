import type { PowerSyncDatabase } from "@powersync/web";

export type Todo = {
  id: string;
  description: string;
  list_id: string;
  created_at: string;
  completed: number;
  completed_at: string | null;
  created_by: string | null;
  completed_by: string | null;
};

export type NewTodo = {
  description: string;
  listId: string;
};

export class TodoStore {
  constructor(private readonly ps: PowerSyncDatabase) {}

  watchUserTodos(listId: string, options?: { signal?: AbortSignal }) {
    return this.ps.watch(
      "SELECT * FROM todos WHERE list_id = ? ORDER BY created_at DESC",
      [listId],
      options,
    );
  }

  async createTodo(todo: NewTodo) {
    return this.ps.execute(
      "INSERT INTO todos (id, description, list_id, created_at) VALUES (?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        todo.description,
        todo.listId,
        new Date().toISOString(),
      ],
    );
  }
}
