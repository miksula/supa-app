import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSyncLifecycle } from "./syncLifecycle.ts";

const sessionFor = (id: string) => ({ user: { id } }) as Session;

describe("createSyncLifecycle", () => {
  const sync = { connect: vi.fn(), reset: vi.fn() };

  beforeEach(() => {
    sync.connect.mockReset().mockResolvedValue(undefined);
    sync.reset.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("connects for an existing session on start", async () => {
    await createSyncLifecycle(sync).start(sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledOnce();
  });

  it("does not connect on start without a session", async () => {
    await createSyncLifecycle(sync).start(null);

    expect(sync.connect).not.toHaveBeenCalled();
  });

  it("connects once per user across repeated SIGNED_IN events", async () => {
    const lifecycle = createSyncLifecycle(sync);

    await lifecycle.start(sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledOnce();
  });

  it("connects again when a different user signs in", async () => {
    const lifecycle = createSyncLifecycle(sync);

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("b"));

    expect(sync.connect).toHaveBeenCalledTimes(2);
  });

  it("resets on sign-out and reconnects on the next sign-in", async () => {
    const lifecycle = createSyncLifecycle(sync);

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_OUT", null);
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.reset).toHaveBeenCalledOnce();
    expect(sync.connect).toHaveBeenCalledTimes(2);
  });

  it("retries the connection after a failure", async () => {
    sync.connect.mockRejectedValueOnce(new Error("offline"));
    const lifecycle = createSyncLifecycle(sync);

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("swallows reset failures", async () => {
    sync.reset.mockRejectedValueOnce(new Error("boom"));

    await expect(
      createSyncLifecycle(sync).handleAuthEvent("SIGNED_OUT", null),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("ignores other auth events", async () => {
    const lifecycle = createSyncLifecycle(sync);

    await lifecycle.handleAuthEvent("TOKEN_REFRESHED", sessionFor("a"));
    await lifecycle.handleAuthEvent("USER_UPDATED", sessionFor("a"));

    expect(sync.connect).not.toHaveBeenCalled();
    expect(sync.reset).not.toHaveBeenCalled();
  });
});
