import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type { AuthService } from "./AuthService.ts";
import { createAuthController } from "./AuthController.ts";

function setup(isOfflineMode = false) {
  const authService = {
    ready: false,
    session: { user: { id: "user-1" } } as Session,
    init: vi.fn().mockResolvedValue(undefined),
    onAuthStateChange: vi.fn<AuthService["onAuthStateChange"]>(),
  };
  const router = { path: "/my-todos", check: vi.fn(), navigate: vi.fn() };
  const syncLifecycle = {
    start: vi.fn().mockResolvedValue(undefined),
    handle: vi.fn().mockResolvedValue(undefined),
  };
  const enforceAuthRoute = vi.fn().mockReturnValue(false);
  const controller = createAuthController({
    authService,
    router,
    syncLifecycle,
    enforceAuthRoute,
    isOfflineMode,
  });
  return { controller, authService, router, syncLifecycle, enforceAuthRoute };
}

afterEach(() => vi.restoreAllMocks());

describe("AuthController injected dependencies", () => {
  it("renders offline without initializing auth or sync", async () => {
    const { controller, authService, router, syncLifecycle, enforceAuthRoute } = setup(true);
    await controller.bootstrap();
    expect(authService.ready).toBe(true);
    expect(router.check).toHaveBeenCalledOnce();
    expect(authService.init).not.toHaveBeenCalled();
    expect(authService.onAuthStateChange).not.toHaveBeenCalled();
    expect(syncLifecycle.start).not.toHaveBeenCalled();
    expect(enforceAuthRoute).not.toHaveBeenCalled();
  });

  it("initializes auth and sync before rendering the current route", async () => {
    const { controller, authService, router, syncLifecycle, enforceAuthRoute } = setup();
    await controller.bootstrap();
    expect(authService.init).toHaveBeenCalledOnce();
    expect(authService.onAuthStateChange).toHaveBeenCalledOnce();
    expect(syncLifecycle.start).toHaveBeenCalledExactlyOnceWith(authService.session);
    expect(enforceAuthRoute).toHaveBeenCalledExactlyOnceWith(router.path);
    expect(router.check).toHaveBeenCalledOnce();
    expect(authService.init.mock.invocationCallOrder[0]).toBeLessThan(
      syncLifecycle.start.mock.invocationCallOrder[0],
    );
    expect(syncLifecycle.start.mock.invocationCallOrder[0]).toBeLessThan(
      router.check.mock.invocationCallOrder[0],
    );
  });

  it("passes auth events to the injected lifecycle before enforcing the route", async () => {
    const { controller, authService, syncLifecycle, enforceAuthRoute, router } = setup();
    await controller.bootstrap();
    enforceAuthRoute.mockClear();
    router.path = "/auth";
    const callback = authService.onAuthStateChange.mock.calls[0][0];
    await callback("SIGNED_OUT", null);
    expect(syncLifecycle.handle).toHaveBeenCalledExactlyOnceWith("SIGNED_OUT", null);
    expect(enforceAuthRoute).toHaveBeenCalledExactlyOnceWith("/auth");
    expect(syncLifecycle.handle.mock.invocationCallOrder[0]).toBeLessThan(
      enforceAuthRoute.mock.invocationCallOrder[0],
    );
  });

  it("does not render the previous route when the guard redirects", async () => {
    const { controller, router, enforceAuthRoute } = setup();
    enforceAuthRoute.mockReturnValue(true);
    await controller.bootstrap();
    expect(router.check).not.toHaveBeenCalled();
  });

  it("navigates to auth when bootstrap fails", async () => {
    const { controller, authService, router, syncLifecycle } = setup();
    vi.spyOn(console, "error").mockImplementation(() => {});
    authService.init.mockRejectedValue(new Error("Session unavailable"));
    await controller.bootstrap();
    expect(router.navigate).toHaveBeenCalledExactlyOnceWith("/auth");
    expect(syncLifecycle.start).not.toHaveBeenCalled();
  });
});
