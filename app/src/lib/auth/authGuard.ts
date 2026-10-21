export type GuardAuth = { ready: boolean; isAuthenticated: boolean };
export type GuardNavigator = { navigate: (path: string) => void };

/** Returns true when the route must not render: auth is not ready yet, or it redirected. */
export type RouteGuard = (path: string) => boolean;

/**
 * Sends signed-out users to `/auth` and signed-in users away from it.
 * Depends only on auth state and a navigator.
 */
export function createAuthGuard(auth: GuardAuth, nav: GuardNavigator): RouteGuard {
  return function guardRoute(path) {
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
