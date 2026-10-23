import {
  AuthRetryableFetchError,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./AuthService.ts";

function setup(storedUserId: string | null = null) {
  const session = { user: { id: "user-id" }, access_token: "test-token" } as Session;
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn<SupabaseClient["auth"]["onAuthStateChange"]>(),
  };
  const userStore = { get: vi.fn(() => storedUserId) };
  const service = new AuthService({ auth } as unknown as SupabaseClient, userStore);
  const emit = (event: AuthChangeEvent, next: Session | null) =>
    auth.onAuthStateChange.mock.calls[0][0](event, next);
  return { session, auth, userStore, service, emit };
}

describe("AuthService", () => {
  it("initializes once using the injected client", async () => {
    const { service, auth, session } = setup();
    expect(service.ready).toBe(false);
    expect(service.isAuthenticated).toBe(false);
    expect(service.userId).toBeNull();
    await service.init();
    await service.init();
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(service.session).toBe(session);
    expect(service.userId).toBe("user-id");
    expect(service.ready).toBe(true);
    expect(service.isAuthenticated).toBe(true);
  });

  it("subscribes to Supabase once and updates the session before notifying listeners", async () => {
    const { service, auth, session, emit } = setup();
    const listener = vi.fn(() => expect(service.session).toBe(session));
    service.onAuthStateChange(listener);
    await emit("SIGNED_IN", session);
    expect(auth.onAuthStateChange).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledExactlyOnceWith("SIGNED_IN", session);
  });

  it("waits for async listeners so Supabase awaits them too", async () => {
    const { service, session, emit } = setup();
    let finished = false;
    service.onAuthStateChange(async () => {
      await Promise.resolve();
      finished = true;
    });
    await emit("SIGNED_IN", session);
    expect(finished).toBe(true);
  });

  it("supports unsubscribe", async () => {
    const { service, session, emit } = setup();
    const listener = vi.fn();
    const unsubscribe = service.onAuthStateChange(listener);
    await emit("SIGNED_IN", session);
    unsubscribe();
    await emit("SIGNED_OUT", null);
    expect(listener).toHaveBeenCalledOnce();
    expect(service.isAuthenticated).toBe(false);
  });

  it("delegates login and logout to Supabase and rethrows its errors", async () => {
    const { service, auth } = setup();
    await service.login("user@example.com", "test-password");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "test-password",
    });
    await service.logout();
    expect(auth.signOut).toHaveBeenCalledOnce();

    const error = new Error("Invalid login");
    auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error });
    await expect(service.login("user@example.com", "wrong")).rejects.toBe(error);
  });

  it("falls back to the stored user id on a retryable fetch error during init", async () => {
    const { service, auth, emit } = setup("offline-user-1");
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });

    await expect(service.init()).resolves.toBeUndefined();
    expect(service.ready).toBe(true);
    expect(service.session).toBeNull();
    expect(service.userId).toBe("offline-user-1");
    expect(service.isAuthenticated).toBe(true);

    await emit("SIGNED_OUT", null);
    expect(service.userId).toBeNull();
    expect(service.isAuthenticated).toBe(false);
  });

  it("marks auth ready and rethrows non-retryable or unauthenticated init errors", async () => {
    const { service, auth } = setup();
    const error = new Error("Session unavailable");
    auth.getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(service.init()).rejects.toBe(error);
    expect(service.ready).toBe(true);
    expect(service.session).toBeNull();
    expect(service.isAuthenticated).toBe(false);
  });
});
