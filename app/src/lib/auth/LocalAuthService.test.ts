/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalSession, LocalAuthService } from "./LocalAuthService.ts";
import { OFFLINE_USER_ID } from "./localUserStore.ts";

const credentials = { email: "dev@example.com", password: "password123" };

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("LocalAuthService", () => {
  it("starts with ready false before init()", async () => {
    const service = new LocalAuthService(credentials);
    expect(service.ready).toBe(false);
    expect(service.isAuthenticated).toBe(false);
    expect(service.userId).toBeNull();
    expect(service.session).toBeNull();

    await service.init();
    await service.init();
    expect(service.ready).toBe(true);
    expect(service.isAuthenticated).toBe(false);
  });

  it("signs in with correct credentials and emits SIGNED_IN", async () => {
    const service = new LocalAuthService(credentials);
    const listener = vi.fn(() => {
      expect(service.isAuthenticated).toBe(true);
      expect(service.userId).toBe(OFFLINE_USER_ID);
    });
    service.onAuthStateChange(listener);

    await service.login("dev@example.com", "password123");

    expect(service.isAuthenticated).toBe(true);
    expect(service.userId).toBe(OFFLINE_USER_ID);
    expect(service.session).toEqual(createLocalSession("dev@example.com"));
    expect(listener).toHaveBeenCalledExactlyOnceWith("SIGNED_IN", service.session);
  });

  it("matches email case-insensitively and with surrounding whitespace", async () => {
    const service = new LocalAuthService(credentials);
    await service.login("  DEV@Example.COM ", "password123");

    expect(service.isAuthenticated).toBe(true);
    expect(service.session?.user.email).toBe("dev@example.com");
  });

  it("throws Invalid login credentials on wrong email or password and emits nothing", async () => {
    const service = new LocalAuthService(credentials);
    const listener = vi.fn();
    service.onAuthStateChange(listener);

    await expect(service.login("wrong@example.com", "password123")).rejects.toThrow(
      "Invalid login credentials",
    );
    await expect(service.login("dev@example.com", "wrong")).rejects.toThrow(
      "Invalid login credentials",
    );
    expect(service.isAuthenticated).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it("throws Local-only login is not configured when credentials are empty", async () => {
    const emptyEmail = new LocalAuthService({ email: "   ", password: "password123" });
    const emptyPassword = new LocalAuthService({ email: "dev@example.com", password: "" });

    await expect(emptyEmail.login("dev@example.com", "password123")).rejects.toThrow(
      "Local-only login is not configured",
    );
    await expect(emptyPassword.login("dev@example.com", "password123")).rejects.toThrow(
      "Local-only login is not configured",
    );
  });

  it("restores the session in a new instance after init()", async () => {
    const first = new LocalAuthService(credentials);
    await first.login("dev@example.com", "password123");

    const second = new LocalAuthService(credentials);
    expect(second.isAuthenticated).toBe(false);
    await second.init();
    expect(second.ready).toBe(true);
    expect(second.isAuthenticated).toBe(true);
    expect(second.userId).toBe(OFFLINE_USER_ID);
    expect(second.session?.user.email).toBe("dev@example.com");
  });

  it("drops a stored session when configured email changes", async () => {
    const first = new LocalAuthService(credentials);
    await first.login("dev@example.com", "password123");

    const second = new LocalAuthService({ email: "other@example.com", password: "password123" });
    await second.init();
    expect(second.ready).toBe(true);
    expect(second.isAuthenticated).toBe(false);
    expect(localStorage.getItem("supa_local_session")).toBeNull();
  });

  it("clears storage and emits SIGNED_OUT on logout()", async () => {
    const service = new LocalAuthService(credentials);
    await service.login("dev@example.com", "password123");

    const listener = vi.fn();
    const unsubscribe = service.onAuthStateChange(listener);
    await service.logout();

    expect(service.isAuthenticated).toBe(false);
    expect(service.session).toBeNull();
    expect(service.userId).toBeNull();
    expect(localStorage.getItem("supa_local_session")).toBeNull();
    expect(listener).toHaveBeenCalledExactlyOnceWith("SIGNED_OUT", null);

    unsubscribe();
    await service.login("dev@example.com", "password123");
    expect(listener).toHaveBeenCalledOnce();
  });
});
