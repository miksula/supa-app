import type { PowerSyncDatabase } from "@powersync/web";
import type { Database } from "@/sync/schema.ts";
import { parseTodoBackup, type TodoBackupPayload } from "./todoBackup.ts";

export type Todo = Database["todos"];
type List = Database["lists"];
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

export type TodoListData = Pick<ListWithTodoRow, "id" | "created_at" | "name" | "owner_id"> & {
  items: Todo[];
};

export type NewTodo = {
  description: string;
  listId: string;
  /** Signed-in user id (`OFFLINE_USER_ID` in Local-Only Mode). */
  createdBy: string | null;
};

export type NewList = {
  name: string;
  ownerId: string;
};

export const mapTodoLists = (rows: ListWithTodoRow[]): TodoListData[] => {
  const lists = new Map<string, TodoListData>();

  for (const row of rows) {
    let list = lists.get(row.id);

    if (!list) {
      list = {
        id: row.id,
        created_at: row.created_at,
        name: row.name,
        owner_id: row.owner_id,
        items: [],
      };
      lists.set(row.id, list);
    }

    if (row.item_id) {
      list.items.push({
        id: row.item_id,
        created_at: row.item_created_at,
        completed_at: row.item_completed_at,
        description: row.item_description,
        completed: row.item_completed,
        created_by: row.item_created_by,
        completed_by: row.item_completed_by,
        list_id: row.item_list_id,
      });
    }
  }

  return [...lists.values()];
};

export class TodoStore {
  private readonly localOnly: boolean;

  constructor(
    private readonly db: PowerSyncDatabase,
    options?: { localOnly?: boolean },
  ) {
    this.localOnly = options?.localOnly ?? false;
  }

  watchUserLists(options?: { signal?: AbortSignal }) {
    return this.db.watch(
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
      ORDER BY
        lists.created_at ASC,
        lists.id ASC,
        todos.created_at ASC,
        todos.id ASC`,
      [],
      options,
    );
  }

  async createTodo(todo: NewTodo) {
    return await this.db.execute(
      "INSERT INTO todos (id, description, list_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        todo.description,
        todo.listId,
        todo.createdBy,
        new Date().toISOString(),
      ],
    );
  }

  async createList(list: NewList) {
    return await this.db.execute(
      "INSERT INTO lists (id, name, owner_id, created_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), list.name, list.ownerId, new Date().toISOString()],
    );
  }

  async updateListName(listId: string, name: string) {
    return await this.db.execute("UPDATE lists SET name = ? WHERE id = ?", [name, listId]);
  }

  async deleteList(listId: string) {
    await this.db.execute("DELETE FROM todos WHERE list_id = ?", [listId]);
    return await this.db.execute("DELETE FROM lists WHERE id = ?", [listId]);
  }

  async setTodoCompleted(todoId: string, completed: boolean, userId: string | null) {
    return await this.db.execute(
      "UPDATE todos SET completed = ?, completed_at = ?, completed_by = ? WHERE id = ?",
      [
        completed ? 1 : 0,
        completed ? new Date().toISOString() : null,
        completed ? userId : null,
        todoId,
      ],
    );
  }

  async exportData(): Promise<TodoBackupPayload> {
    const lists = await this.db.getAll<TodoBackupPayload["lists"][number]>(
      "SELECT id, name, owner_id, created_at FROM lists ORDER BY created_at ASC, id ASC",
    );
    const todos = await this.db.getAll<TodoBackupPayload["todos"][number]>(
      "SELECT id, list_id, description, COALESCE(completed, 0) AS completed, created_at, completed_at, created_by, completed_by FROM todos ORDER BY created_at ASC, id ASC",
    );
    return { version: 1, exportedAt: new Date().toISOString(), lists, todos };
  }

  async importData(input: unknown, { userId }: { userId: string }) {
    if (!this.localOnly) {
      throw new Error("Import is only available in Local-Only Mode");
    }
    const backup = parseTodoBackup(input);

    await this.db.writeTransaction(async (tx) => {
      const ids = async (table: "lists" | "todos") =>
        new Set((await tx.getAll<{ id: string }>(`SELECT id FROM ${table}`)).map((row) => row.id));
      const existingLists = await ids("lists");
      const existingTodos = await ids("todos");

      for (const list of backup.lists) {
        if (existingLists.has(list.id)) {
          await tx.execute("UPDATE lists SET name = ?, owner_id = ?, created_at = ? WHERE id = ?", [
            list.name,
            userId,
            list.created_at,
            list.id,
          ]);
        } else {
          await tx.execute(
            "INSERT INTO lists (name, owner_id, created_at, id) VALUES (?, ?, ?, ?)",
            [list.name, userId, list.created_at, list.id],
          );
        }
      }

      for (const todo of backup.todos) {
        const values = [
          todo.list_id,
          todo.description,
          todo.completed,
          todo.created_at,
          todo.completed_at,
          userId,
          todo.completed ? userId : null,
          todo.id,
        ];
        if (existingTodos.has(todo.id)) {
          await tx.execute(
            `UPDATE todos SET list_id = ?, description = ?, completed = ?, created_at = ?,
               completed_at = ?, created_by = ?, completed_by = ? WHERE id = ?`,
            values,
          );
        } else {
          await tx.execute(
            `INSERT INTO todos (list_id, description, completed, created_at, completed_at,
               created_by, completed_by, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            values,
          );
        }
      }
    });

    return { lists: backup.lists.length, todos: backup.todos.length };
  }
}
