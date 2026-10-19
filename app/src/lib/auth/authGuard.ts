export type GuardAuth = { ready: boolean; isAuthenticated: boolean };
export type GuardNavigator = { navigate: (path: string) => void };

/**
 * Route guard: depends only on auth state and a navigator.
 * Returns true when it redirected (or auth is not ready) and rendering should stop.
 */
export function createAuthGuard(
  auth: GuardAuth,
  nav: GuardNavigator,
  options: { disabled?: boolean } = {},
) {
  return function enforceAuthRoute(path: string): boolean {
    if (options.disabled) {
      return false;
    }

    if (!auth.ready) {
      return true;
    }

    if (!auth.isAuthenticated && path !== "/auth") {
      nav.navigate("/auth");
      return true;
    }

    if (auth.isAuthenticated && path === "/auth") {
      nav.navigate("/");
      return true;
    }

    return false;
  };
}
