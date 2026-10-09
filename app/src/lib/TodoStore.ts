import type { PowerSyncDatabase } from "@powersync/web";
import type { Database } from "@/lib/schema.ts";

export type Todo = Database["todos"];

export type NewTodo = {
  description: string;
  listId: string;
};

export class TodoStore {
  constructor(private readonly ps: PowerSyncDatabase) {}

  watchUserTodos(options?: { signal?: AbortSignal }) {
    return this.ps.watch(
      "SELECT * FROM todos ORDER BY created_at DESC",
      [],
      options,
    );
  }

  async createTodo(todo: NewTodo) {
    return await this.ps.execute(
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
