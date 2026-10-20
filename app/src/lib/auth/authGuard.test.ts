import { describe, expect, it, vi } from "vitest";
import { createAuthGuard, type GuardAuth } from "./authGuard.ts";

function setup(auth: GuardAuth, options?: { disabled?: boolean }) {
  const nav = { navigate: vi.fn() };
  return { nav, guard: createAuthGuard(auth, nav, options) };
}

describe("createAuthGuard", () => {
  it.each([
    // ready, authenticated, path, stops rendering, redirect
    [false, false, "/", true, null],
    [false, true, "/auth", true, null],
    [true, false, "/", true, "/auth"],
    [true, false, "/my-todos", true, "/auth"],
    [true, false, "/auth", false, null],
    [true, true, "/auth", true, "/"],
    [true, true, "/my-todos", false, null],
  ])(
    "ready=%s authenticated=%s path=%s → stop=%s redirect=%s",
    (ready, isAuthenticated, path, stop, redirect) => {
      const { nav, guard } = setup({ ready, isAuthenticated });

      expect(guard(path)).toBe(stop);
      if (redirect) {
        expect(nav.navigate).toHaveBeenCalledExactlyOnceWith(redirect);
      } else {
        expect(nav.navigate).not.toHaveBeenCalled();
      }
    },
  );

  it("does nothing when disabled (offline mode)", () => {
    const { nav, guard } = setup({ ready: false, isAuthenticated: false }, { disabled: true });

    expect(guard("/my-todos")).toBe(false);
    expect(nav.navigate).not.toHaveBeenCalled();
  });

  it("reads auth state on every call", () => {
    const auth = { ready: true, isAuthenticated: false };
    const { nav, guard } = setup(auth);

    auth.isAuthenticated = true;

    expect(guard("/my-todos")).toBe(false);
    expect(nav.navigate).not.toHaveBeenCalled();
  });
});
