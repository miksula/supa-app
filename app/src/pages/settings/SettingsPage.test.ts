/** @vitest-environment happy-dom */
import type { PowerSyncDatabase } from "@powersync/web";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TodoBackupError, type TodoBackupPayload } from "../my-todos/todoBackup.ts";
import { TodoStore } from "../my-todos/TodoStore.ts";
import { SettingsPage } from "./SettingsPage.ts";

const samplePayload: TodoBackupPayload = {
  version: 1,
  exportedAt: "2026-10-25T12:00:00.000Z",
  lists: [
    {
      id: "list-1",
      name: "Groceries",
      owner_id: "user-1",
      created_at: "2026-10-25T10:00:00.000Z",
    },
  ],
  todos: [
    {
      id: "todo-1",
      list_id: "list-1",
      description: "Buy milk",
      completed: 0,
      created_at: "2026-10-25T10:05:00.000Z",
      completed_at: null,
      created_by: "user-1",
      completed_by: null,
    },
  ],
};

function createTarget() {
  const el = document.createElement("div");
  document.body.append(el);
  return el;
}

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("SettingsPage", () => {
  it("exports data and triggers a JSON download", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-backup");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const backup = {
      exportData: vi.fn().mockResolvedValue(samplePayload),
      importData: vi.fn(),
    };
    const target = createTarget();
    const dispose = SettingsPage(target, {
      backup,
      getUserId: () => "user-1",
      canImport: true,
    });

    target.querySelector<HTMLButtonElement>('[data-action="export"]')!.click();
    await vi.waitFor(() => {
      expect(backup.exportData).toHaveBeenCalledOnce();
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(clickSpy).toHaveBeenCalledOnce();
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-backup");
    });

    const status = target.querySelector('[role="status"]');
    expect(status?.textContent).toMatch(/Exported supa-todos-backup-\d{4}-\d{2}-\d{2}\.json\./);
    dispose();
  });

  it("hides import controls when canImport is false", () => {
    const backup = {
      exportData: vi.fn(),
      importData: vi.fn(),
    };
    const target = createTarget();
    const dispose = SettingsPage(target, {
      backup,
      getUserId: () => "user-1",
      canImport: false,
    });

    expect(target.querySelector('[data-action="import"]')).toBeNull();
    expect(target.querySelector('input[type="file"]')).toBeNull();
    expect(target.textContent).toContain("Import is available in Local-Only Mode.");
    dispose();
  });

  it("imports a valid backup file and shows the imported counts", async () => {
    const backup = {
      exportData: vi.fn(),
      importData: vi.fn().mockResolvedValue({ lists: 1, todos: 2 }),
    };
    const target = createTarget();
    const dispose = SettingsPage(target, {
      backup,
      getUserId: () => "local-user",
      canImport: true,
    });

    const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([JSON.stringify(samplePayload)], "backup.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));

    await vi.waitFor(() => {
      expect(backup.importData).toHaveBeenCalledExactlyOnceWith(samplePayload, {
        userId: "local-user",
      });
    });

    expect(target.querySelector('[role="status"]')?.textContent).toContain(
      "Imported 1 lists and 2 todos.",
    );
    dispose();
  });

  it("shows an alert on invalid JSON without calling importData", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const backup = {
      exportData: vi.fn(),
      importData: vi.fn(),
    };
    const target = createTarget();
    const dispose = SettingsPage(target, {
      backup,
      getUserId: () => "local-user",
      canImport: true,
    });

    const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["{not valid json"], "broken.json", { type: "application/json" });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));

    await vi.waitFor(() => {
      expect(target.querySelector('[role="alert"]')?.textContent).toContain("Invalid JSON file.");
    });
    expect(backup.importData).not.toHaveBeenCalled();
    dispose();
  });

  it("shows an alert listing issues when importData throws TodoBackupError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const backup = {
      exportData: vi.fn(),
      importData: vi
        .fn()
        .mockRejectedValue(new TodoBackupError(["lists[0].id must be a non-empty string"])),
    };
    const target = createTarget();
    const dispose = SettingsPage(target, {
      backup,
      getUserId: () => "local-user",
      canImport: true,
    });

    const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File([JSON.stringify(samplePayload)], "invalid.json", {
      type: "application/json",
    });
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    input.dispatchEvent(new Event("change"));

    await vi.waitFor(() => {
      expect(target.querySelector('[role="alert"]')?.textContent).toContain(
        "lists[0].id must be a non-empty string",
      );
    });
    dispose();
  });
});

describe("TodoStore backup and import", () => {
  it("throws when importData is called with localOnly: false and never opens a transaction", async () => {
    const writeTransaction = vi.fn();
    const store = new TodoStore({ writeTransaction } as unknown as PowerSyncDatabase, {
      localOnly: false,
    });

    await expect(store.importData(samplePayload, { userId: "user-1" })).rejects.toThrow(
      "Import is only available in Local-Only Mode",
    );
    expect(writeTransaction).not.toHaveBeenCalled();
  });

  it("merges existing and new rows and rewrites ownership on import in Local-Only Mode", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const getAll = vi.fn(async (sql: string) => {
      if (sql.includes("FROM lists")) return [{ id: "list-1" }];
      return [];
    });
    const writeTransaction = vi.fn(
      async (cb: (tx: { getAll: typeof getAll; execute: typeof execute }) => Promise<void>) => {
        await cb({ getAll, execute });
      },
    );
    const store = new TodoStore({ writeTransaction } as unknown as PowerSyncDatabase, {
      localOnly: true,
    });

    const result = await store.importData(samplePayload, { userId: "local-owner" });
    expect(result).toEqual({ lists: 1, todos: 1 });
    expect(execute).toHaveBeenCalledWith(
      "UPDATE lists SET name = ?, owner_id = ?, created_at = ? WHERE id = ?",
      ["Groceries", "local-owner", "2026-10-25T10:00:00.000Z", "list-1"],
    );
    expect(execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO todos"), [
      "list-1",
      "Buy milk",
      0,
      "2026-10-25T10:05:00.000Z",
      null,
      "local-owner",
      null,
      "todo-1",
    ]);
  });
});
