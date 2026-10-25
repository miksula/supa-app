export type TodoBackupPayload = {
  version: 1;
  exportedAt: string;
  lists: Array<{
    id: string;
    name: string;
    owner_id: string;
    created_at: string;
  }>;
  todos: Array<{
    id: string;
    list_id: string;
    description: string;
    completed: number;
    created_at: string;
    completed_at: string | null;
    created_by: string | null;
    completed_by: string | null;
  }>;
};

const MAX_ISSUES = 10;

export class TodoBackupError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    const shown = issues.slice(0, MAX_ISSUES);
    super(shown.join("; ") || "Invalid backup file");
    this.name = "TodoBackupError";
    this.issues = shown;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isValidDateString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && !Number.isNaN(Date.parse(value));

const normalizeCompleted = (value: unknown): 0 | 1 | null => {
  if (value === 0 || value === false) return 0;
  if (value === 1 || value === true) return 1;
  return null;
};

export function parseTodoBackup(input: unknown): TodoBackupPayload {
  if (!isRecord(input)) {
    throw new TodoBackupError(["Backup payload must be a JSON object"]);
  }

  if (input.version !== 1) {
    throw new TodoBackupError(["Unsupported backup version"]);
  }

  const issues: string[] = [];

  if (!Array.isArray(input.lists)) {
    issues.push("`lists` must be an array");
  }
  if (!Array.isArray(input.todos)) {
    issues.push("`todos` must be an array");
  }
  if (issues.length > 0) {
    throw new TodoBackupError(issues);
  }

  const rawLists = input.lists as unknown[];
  const rawTodos = input.todos as unknown[];

  const lists: TodoBackupPayload["lists"] = [];
  const listIds = new Set<string>();

  rawLists.forEach((entry, index) => {
    const prefix = `lists[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${prefix} must be an object`);
      return;
    }

    const { id, name, owner_id, created_at } = entry;
    let valid = true;

    if (!isNonEmptyString(id)) {
      issues.push(`${prefix}.id must be a non-empty string`);
      valid = false;
    } else if (listIds.has(id)) {
      issues.push(`${prefix}.id "${id}" is duplicated`);
      valid = false;
    } else {
      listIds.add(id);
    }

    if (typeof name !== "string") {
      issues.push(`${prefix}.name must be a string`);
      valid = false;
    }

    if (!isValidDateString(created_at)) {
      issues.push(`${prefix}.created_at must be a valid date string`);
      valid = false;
    }

    if (valid) {
      lists.push({
        id: id as string,
        name: name as string,
        owner_id: typeof owner_id === "string" ? owner_id : "",
        created_at: created_at as string,
      });
    }
  });

  const todos: TodoBackupPayload["todos"] = [];
  const todoIds = new Set<string>();

  rawTodos.forEach((entry, index) => {
    const prefix = `todos[${index}]`;
    if (!isRecord(entry)) {
      issues.push(`${prefix} must be an object`);
      return;
    }

    const {
      id,
      list_id,
      description,
      completed,
      created_at,
      completed_at,
      created_by,
      completed_by,
    } = entry;
    let valid = true;

    if (!isNonEmptyString(id)) {
      issues.push(`${prefix}.id must be a non-empty string`);
      valid = false;
    } else if (todoIds.has(id)) {
      issues.push(`${prefix}.id "${id}" is duplicated`);
      valid = false;
    } else {
      todoIds.add(id);
    }

    if (!isNonEmptyString(list_id)) {
      issues.push(`${prefix}.list_id must be a non-empty string`);
      valid = false;
    } else if (!listIds.has(list_id)) {
      issues.push(`${prefix}.list_id "${list_id}" does not match any list in the backup`);
      valid = false;
    }

    if (typeof description !== "string") {
      issues.push(`${prefix}.description must be a string`);
      valid = false;
    }

    const normalizedCompleted = normalizeCompleted(completed);
    if (normalizedCompleted === null) {
      issues.push(`${prefix}.completed must be 0, 1, true or false`);
      valid = false;
    }

    if (!isValidDateString(created_at)) {
      issues.push(`${prefix}.created_at must be a valid date string`);
      valid = false;
    }

    if (completed_at !== null && completed_at !== undefined && !isValidDateString(completed_at)) {
      issues.push(`${prefix}.completed_at must be a valid date string or null`);
      valid = false;
    }

    if (valid && normalizedCompleted !== null) {
      todos.push({
        id: id as string,
        list_id: list_id as string,
        description: description as string,
        completed: normalizedCompleted,
        created_at: created_at as string,
        completed_at: typeof completed_at === "string" ? completed_at : null,
        created_by: typeof created_by === "string" ? created_by : null,
        completed_by: typeof completed_by === "string" ? completed_by : null,
      });
    }
  });

  if (issues.length > 0) {
    throw new TodoBackupError(issues);
  }

  return {
    version: 1,
    exportedAt: isValidDateString(input.exportedAt) ? input.exportedAt : new Date().toISOString(),
    lists,
    todos,
  };
}
