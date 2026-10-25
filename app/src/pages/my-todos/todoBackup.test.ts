import { describe, expect, it } from "vitest";
import { parseTodoBackup, TodoBackupError } from "./todoBackup.ts";

const validPayload = {
  version: 1 as const,
  exportedAt: "2026-10-25T12:00:00.000Z",
  lists: [
    {
      id: "list-1",
      name: "",
      owner_id: "user-1",
      created_at: "2026-10-25T10:00:00.000Z",
    },
  ],
  todos: [
    {
      id: "todo-1",
      list_id: "list-1",
      description: "Buy milk",
      completed: true,
      created_at: "2026-10-25T10:05:00.000Z",
      completed_at: "2026-10-25T10:10:00.000Z",
      created_by: "user-1",
      completed_by: "user-1",
    },
    {
      id: "todo-2",
      list_id: "list-1",
      description: "Walk dog",
      completed: 0,
      created_at: "2026-10-25T10:06:00.000Z",
      completed_at: null,
      created_by: null,
      completed_by: null,
    },
  ],
};

describe("parseTodoBackup", () => {
  it("parses a valid payload and normalizes completed booleans to 0/1", () => {
    const parsed = parseTodoBackup(validPayload);
    expect(parsed.version).toBe(1);
    expect(parsed.lists).toHaveLength(1);
    expect(parsed.lists[0].name).toBe("");
    expect(parsed.todos).toHaveLength(2);
    expect(parsed.todos[0].completed).toBe(1);
    expect(parsed.todos[1].completed).toBe(0);
  });

  it("ignores missing or non-string ownership fields because import rewrites them", () => {
    const parsed = parseTodoBackup({
      version: 1,
      lists: [{ id: "list-1", name: "Tasks", created_at: "2026-10-25T10:00:00.000Z" }],
      todos: [
        {
          id: "todo-1",
          list_id: "list-1",
          description: "Task",
          completed: false,
          created_at: "2026-10-25T10:05:00.000Z",
          completed_at: null,
        },
      ],
    });
    expect(parsed.lists[0].owner_id).toBe("");
    expect(parsed.todos[0].created_by).toBeNull();
    expect(parsed.todos[0].completed_by).toBeNull();
  });

  it("rejects non-objects and unsupported versions", () => {
    expect(() => parseTodoBackup(null)).toThrowError(TodoBackupError);
    expect(() => parseTodoBackup("not-an-object")).toThrowError(TodoBackupError);
    expect(() => parseTodoBackup({ ...validPayload, version: 2 })).toThrow(
      "Unsupported backup version",
    );
  });

  it("rejects missing lists or todos arrays", () => {
    expect(() => parseTodoBackup({ version: 1, lists: "nope", todos: [] })).toThrow(
      "`lists` must be an array",
    );
    expect(() => parseTodoBackup({ version: 1, lists: [], todos: null })).toThrow(
      "`todos` must be an array",
    );
  });

  it("rejects invalid list fields and duplicate list IDs", () => {
    expect(() =>
      parseTodoBackup({
        ...validPayload,
        lists: [{ id: "", name: 123, created_at: "not-a-date" }],
        todos: [],
      }),
    ).toThrow(/lists\[0\]\.id.*lists\[0\]\.name.*lists\[0\]\.created_at/);

    expect(() =>
      parseTodoBackup({
        ...validPayload,
        lists: [validPayload.lists[0], validPayload.lists[0]],
        todos: [],
      }),
    ).toThrow(/duplicated/);
  });

  it("rejects invalid todo fields, duplicate todo IDs, and orphan list_id", () => {
    expect(() =>
      parseTodoBackup({
        ...validPayload,
        todos: [
          {
            id: "",
            list_id: "missing-list",
            description: 42,
            completed: 2,
            created_at: "bad-date",
            completed_at: "bad-date",
          },
        ],
      }),
    ).toThrow(TodoBackupError);

    expect(() =>
      parseTodoBackup({
        ...validPayload,
        todos: [validPayload.todos[0], validPayload.todos[0]],
      }),
    ).toThrow(/duplicated/);

    expect(() =>
      parseTodoBackup({
        ...validPayload,
        todos: [{ ...validPayload.todos[0], list_id: "unknown-list" }],
      }),
    ).toThrow(/does not match any list/);
  });

  it("caps reported issues at 10", () => {
    const badLists = Array.from({ length: 15 }, () => "not-an-object");
    try {
      parseTodoBackup({ version: 1, lists: badLists, todos: [] });
      expect.unreachable("Expected TodoBackupError");
    } catch (error) {
      expect(error).toBeInstanceOf(TodoBackupError);
      expect((error as TodoBackupError).issues).toHaveLength(10);
    }
  });
});
