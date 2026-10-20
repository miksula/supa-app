import { router } from "@packages/router";
import { connectPowersync, isOfflineMode, resetPowersyncForSessionChange } from "@/sync/client.ts";
import { createSyncLifecycle } from "@/sync/syncLifecycle.ts";
import { authService } from "@/auth/auth.ts";
import { enforceAuthRoute } from "@/auth/routeGuard.ts";

export class AuthController {
  async bootstrap() {
    if (isOfflineMode) {
      authService.ready = true;
      router.check();
      return;
    }

    try {
      await authService.init();

      if (authService.session?.user.is_anonymous) {
        await authService.logout();
      }

      const syncLifecycle = createSyncLifecycle({
        connect: connectPowersync,
        reset: resetPowersyncForSessionChange,
      });

      // Single auth subscription, fanned out to sync and the route guard.
      authService.onAuthStateChange(async (event, session) => {
        await syncLifecycle.handle(event, session);
        enforceAuthRoute(router.path);
      });

      await syncLifecycle.start(authService.session);

      if (!enforceAuthRoute(router.path)) {
        router.check();
      }
    } catch (error) {
      console.error("Failed to bootstrap authentication", error);
      router.navigate("/auth");
    }
  }
}
