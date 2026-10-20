import { describe, expect, it, vi } from "vitest";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { AuthService } from "./AuthService.ts";

function setup() {
  const session = { user: { id: "user-id" }, access_token: "test-token" } as Session;
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn<SupabaseClient["auth"]["onAuthStateChange"]>(),
  };
  const client = { auth } as unknown as SupabaseClient;
  return { session, auth, client, service: new AuthService(client) };
}

describe("AuthService", () => {
  it("initializes once using the injected client", async () => {
    const { service, client, auth, session } = setup();
    expect(service.client).toBe(client);
    expect(service.ready).toBe(false);
    expect(service.isAuthenticated).toBe(false);
    await service.init();
    await service.init();
    expect(auth.getSession).toHaveBeenCalledOnce();
    expect(service.session).toBe(session);
    expect(service.ready).toBe(true);
    expect(service.isAuthenticated).toBe(true);
  });

  it("notifies session subscribers on login and logout, and supports unsubscribe", async () => {
    const { service, auth, session } = setup();
    const listener = vi.fn();
    const unsubscribe = service.session$.subscribe(listener);
    await service.login("user@example.com", "test-password");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "test-password",
    });
    expect(listener).toHaveBeenLastCalledWith(session);
    await service.logout();
    expect(auth.signOut).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith(null);
    expect(service.isAuthenticated).toBe(false);
    unsubscribe();
    await service.login("user@example.com", "test-password");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("updates session state before forwarding auth events", () => {
    const { service, auth, session } = setup();
    const listener = vi.fn(() => expect(service.session).toBe(session));
    service.onAuthStateChange(listener);
    auth.onAuthStateChange.mock.calls[0][0]("SIGNED_IN", session);
    expect(listener).toHaveBeenCalledWith("SIGNED_IN", session);
  });

  it("propagates initialization errors without marking auth ready", async () => {
    const { service, auth } = setup();
    const error = new Error("Session unavailable");
    auth.getSession.mockResolvedValue({ data: { session: null }, error });
    await expect(service.init()).rejects.toBe(error);
    expect(service.ready).toBe(false);
    expect(service.session).toBeNull();
  });
});
