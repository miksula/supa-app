import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type { AuthService } from "./AuthService.ts";
import { bootstrapAuth } from "./bootstrapAuth.ts";

function setup() {
  const authService = {
    session: { user: { id: "user-1" } } as Session | null,
    isAuthenticated: true,
    init: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn<AuthService["onAuthStateChange"]>(),
  };
  const router = { path: "/my-todos", check: vi.fn(), navigate: vi.fn() };
  const syncLifecycle = {
    start: vi.fn().mockResolvedValue(undefined),
    handleAuthEvent: vi.fn().mockResolvedValue(undefined),
  };
  const guardRoute = vi.fn().mockReturnValue(false);
  const run = () => bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
  return { run, authService, router, syncLifecycle, guardRoute };
}

afterEach(() => vi.restoreAllMocks());

describe("bootstrapAuth", () => {
  it("initializes auth and sync before rendering the current route", async () => {
    const { run, authService, router, syncLifecycle, guardRoute } = setup();
    await run();
    expect(authService.init).toHaveBeenCalledOnce();
    expect(authService.onAuthStateChange).toHaveBeenCalledOnce();
    expect(syncLifecycle.start).toHaveBeenCalledExactlyOnceWith(authService.session, {
      hasFallbackUser: true,
    });
    expect(guardRoute).toHaveBeenCalledExactlyOnceWith(router.path);
    expect(router.check).toHaveBeenCalledOnce();
    expect(authService.init.mock.invocationCallOrder[0]).toBeLessThan(
      syncLifecycle.start.mock.invocationCallOrder[0],
    );
    expect(syncLifecycle.start.mock.invocationCallOrder[0]).toBeLessThan(
      router.check.mock.invocationCallOrder[0],
    );
  });

  it("renders local data without connecting when offline with a fallback user", async () => {
    const { run, authService, router, syncLifecycle, guardRoute } = setup();
    authService.session = null;
    authService.isAuthenticated = true;
    await run();
    expect(syncLifecycle.start).toHaveBeenCalledExactlyOnceWith(null, {
      hasFallbackUser: true,
    });
    expect(guardRoute).toHaveBeenCalledExactlyOnceWith("/my-todos");
    expect(router.check).toHaveBeenCalledOnce();
  });

  it("passes auth events to the sync lifecycle before re-checking the route", async () => {
    const { run, authService, syncLifecycle, guardRoute, router } = setup();
    await run();
    guardRoute.mockClear();
    router.path = "/auth";
    const listener = authService.onAuthStateChange.mock.calls[0][0];
    await listener("SIGNED_OUT", null);
    expect(syncLifecycle.handleAuthEvent).toHaveBeenCalledExactlyOnceWith("SIGNED_OUT", null);
    expect(guardRoute).toHaveBeenCalledExactlyOnceWith("/auth");
    expect(syncLifecycle.handleAuthEvent.mock.invocationCallOrder[0]).toBeLessThan(
      guardRoute.mock.invocationCallOrder[0],
    );
  });

  it("does not render the previous route when the guard redirects", async () => {
    const { run, router, guardRoute } = setup();
    guardRoute.mockReturnValue(true);
    await run();
    expect(router.check).not.toHaveBeenCalled();
  });

  it("navigates to auth when bootstrap fails", async () => {
    const { run, authService, router, syncLifecycle } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    authService.init.mockRejectedValue(new Error("Session unavailable"));
    await run();
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith("/auth");
    expect(syncLifecycle.start).not.toHaveBeenCalled();
  });

  it("works with a no-op sync lifecycle in Local-Only Mode", async () => {
    const { authService, router, guardRoute } = setup();
    const noopLifecycle = { start: async () => {}, handleAuthEvent: async () => {} };
    let registeredListener!: Parameters<AuthService["onAuthStateChange"]>[0];
    authService.onAuthStateChange.mockImplementation((listener) => {
      registeredListener = listener;
      return () => {};
    });

    await bootstrapAuth({ authService, router, syncLifecycle: noopLifecycle, guardRoute });
    expect(guardRoute).toHaveBeenCalledExactlyOnceWith("/my-todos");
    expect(router.check).toHaveBeenCalledOnce();

    guardRoute.mockClear();
    router.check.mockClear();
    authService.isAuthenticated = false;
    authService.session = null;
    guardRoute.mockImplementation((path) => {
      if (path !== "/auth") {
        router.navigate("/auth");
        return true;
      }
      return false;
    });

    await bootstrapAuth({ authService, router, syncLifecycle: noopLifecycle, guardRoute });
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith("/auth");
    expect(router.check).not.toHaveBeenCalled();

    guardRoute.mockClear();
    router.path = "/my-todos";
    await registeredListener("SIGNED_OUT", null);
    expect(guardRoute).toHaveBeenCalledExactlyOnceWith("/my-todos");
  });
});
