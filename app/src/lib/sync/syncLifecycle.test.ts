import type { Session } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalUserStore } from "@/auth/localUserStore.ts";
import { createSyncLifecycle } from "./syncLifecycle.ts";

const sessionFor = (id: string) => ({ user: { id } }) as Session;

function createFakeUserStore(
  initial: string | null = null,
): LocalUserStore & { value: string | null } {
  const store = {
    value: initial,
    get: vi.fn(() => store.value),
    set: vi.fn((userId: string | null) => {
      store.value = userId;
    }),
  };
  return store;
}

describe("createSyncLifecycle", () => {
  const sync = { connect: vi.fn(), reset: vi.fn() };

  beforeEach(() => {
    sync.connect.mockReset().mockResolvedValue(undefined);
    sync.reset.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("connects for an existing session on start and persists the user id", async () => {
    const userStore = createFakeUserStore();
    await createSyncLifecycle({ ...sync, userStore }).start(sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledOnce();
    expect(userStore.value).toBe("a");
  });

  it("does not connect or reset on start without a session when no user is stored", async () => {
    const userStore = createFakeUserStore();
    await createSyncLifecycle({ ...sync, userStore }).start(null);

    expect(sync.connect).not.toHaveBeenCalled();
    expect(sync.reset).not.toHaveBeenCalled();
  });

  it("resets on start when there is no session but a stored user id exists", async () => {
    const userStore = createFakeUserStore("a");
    await createSyncLifecycle({ ...sync, userStore }).start(null);

    expect(sync.reset).toHaveBeenCalledOnce();
    expect(sync.connect).not.toHaveBeenCalled();
    expect(userStore.value).toBeNull();
  });

  it("keeps local data on start when offline with a fallback user", async () => {
    const userStore = createFakeUserStore("a");
    await createSyncLifecycle({ ...sync, userStore }).start(null, { hasFallbackUser: true });

    expect(sync.reset).not.toHaveBeenCalled();
    expect(sync.connect).not.toHaveBeenCalled();
    expect(userStore.value).toBe("a");
  });

  it("connects once per user across repeated SIGNED_IN events", async () => {
    const userStore = createFakeUserStore();
    const lifecycle = createSyncLifecycle({ ...sync, userStore });

    await lifecycle.start(sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledOnce();
    expect(sync.reset).not.toHaveBeenCalled();
  });

  it("resets before connecting when a different user signs in", async () => {
    const userStore = createFakeUserStore("a");
    const lifecycle = createSyncLifecycle({ ...sync, userStore });

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("b"));

    expect(sync.reset).toHaveBeenCalledOnce();
    expect(sync.connect).toHaveBeenCalledOnce();
    expect(sync.reset.mock.invocationCallOrder[0]).toBeLessThan(
      sync.connect.mock.invocationCallOrder[0],
    );
    expect(userStore.value).toBe("b");
  });

  it("resets on sign-out, clears stored user id, and reconnects on the next sign-in", async () => {
    const userStore = createFakeUserStore();
    const lifecycle = createSyncLifecycle({ ...sync, userStore });

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    expect(userStore.value).toBe("a");

    await lifecycle.handleAuthEvent("SIGNED_OUT", null);
    expect(userStore.value).toBeNull();

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.reset).toHaveBeenCalledOnce();
    expect(sync.connect).toHaveBeenCalledTimes(2);
    expect(userStore.value).toBe("a");
  });

  it("retries the connection after a failure", async () => {
    sync.connect.mockRejectedValueOnce(new Error("offline"));
    const userStore = createFakeUserStore();
    const lifecycle = createSyncLifecycle({ ...sync, userStore });

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
    expect(userStore.value).toBeNull();

    await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

    expect(sync.connect).toHaveBeenCalledTimes(2);
    expect(userStore.value).toBe("a");
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
