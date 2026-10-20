import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommonPowerSyncDatabase } from "@powersync/web";
import { SupabasePowerSyncConnector } from "./SupabasePowerSyncConnector.ts";

function setup(session: { access_token: string; expires_at?: number } | null = null) {
  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const client = { auth: { getSession }, rpc } as unknown as SupabaseClient;
  return {
    getSession,
    rpc,
    connector: new SupabasePowerSyncConnector(client, "http://localhost:8080"),
  };
}

describe("SupabasePowerSyncConnector", () => {
  afterEach(() => vi.restoreAllMocks());

  it("does not call the backend with an empty upload queue", async () => {
    const { connector, rpc } = setup();
    const database = {
      getNextCrudTransaction: vi.fn().mockResolvedValue(null),
    } as unknown as CommonPowerSyncDatabase;
    await connector.uploadData(database);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { op: "PUT", table: "todos", id: "todo-id", opData: { description: "New", completed: 0 } },
    { op: "PATCH", table: "todos", id: "todo-id", opData: { completed: 1 } },
    { op: "DELETE", table: "todos", id: "todo-id" },
  ])("uploads a single $op through RPC", async (entry) => {
    const { connector, rpc } = setup();
    const complete = vi.fn();
    const database = {
      getNextCrudTransaction: vi.fn().mockResolvedValue({ crud: [entry], complete }),
    } as unknown as CommonPowerSyncDatabase;
    await connector.uploadData(database);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("process_powersync_crud", { ops: [entry] });
    expect(complete).toHaveBeenCalledOnce();
  });

  it.each(["22P02", "23503", "42501"])(
    "discards rejected transactions for fatal code %s",
    async (code) => {
      const { connector, rpc } = setup();
      const error = { code, message: "Rejected" };
      rpc.mockResolvedValue({ error });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const complete = vi.fn();
      const crud = [{ op: "DELETE", table: "todos", id: "todo-id" }];
      const database = {
        getNextCrudTransaction: vi.fn().mockResolvedValue({ crud, complete }),
      } as unknown as CommonPowerSyncDatabase;
      await connector.uploadData(database);
      expect(complete).toHaveBeenCalledOnce();
      expect(log).toHaveBeenCalledWith("Data upload error - discarding:", crud, error);
    },
  );

  it.each([{ code: "40001" }, { code: "PGRST301" }, new Error("Network"), null])(
    "retains the transaction for retry on %j",
    async (error) => {
      const { connector, rpc } = setup();
      rpc.mockRejectedValue(error);
      const complete = vi.fn();
      const database = {
        getNextCrudTransaction: vi.fn().mockResolvedValue({
          crud: [{ op: "DELETE", table: "todos", id: "todo-id" }],
          complete,
        }),
      } as unknown as CommonPowerSyncDatabase;
      await expect(connector.uploadData(database)).rejects.toBe(error);
      expect(complete).not.toHaveBeenCalled();
    },
  );

  it("reads credentials from the injected client", async () => {
    const { connector } = setup({ access_token: "test-token", expires_at: 1234 });
    await expect(connector.fetchCredentials()).resolves.toEqual({
      endpoint: "http://localhost:8080",
      token: "test-token",
      expiresAt: new Date(1234000),
    });
  });

  it("rejects credentials without a session", async () => {
    await expect(setup().connector.fetchCredentials()).rejects.toThrow("no active session");
  });

  it("propagates session errors", async () => {
    const { connector, getSession } = setup();
    const error = new Error("Session unavailable");
    getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(connector.fetchCredentials()).rejects.toBe(error);
  });

  it("uploads a batch through the injected client before completing it", async () => {
    const { connector, rpc } = setup();
    const complete = vi.fn();
    const crud = [
      { op: "DELETE", table: "todos", id: "todo-id" },
      { op: "DELETE", table: "lists", id: "list-id" },
    ];
    const database = {
      getNextCrudTransaction: vi.fn().mockResolvedValue({ crud, complete }),
    } as unknown as CommonPowerSyncDatabase;

    await connector.uploadData(database);

    expect(rpc).toHaveBeenCalledExactlyOnceWith("process_powersync_crud", { ops: crud });
    expect(complete).toHaveBeenCalledOnce();
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(complete.mock.invocationCallOrder[0]);
  });
});
