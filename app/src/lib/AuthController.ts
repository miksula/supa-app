import { router } from "@packages/router";
import {
  connectPowersync,
  isOfflineMode,
  resetPowersyncForSessionChange,
} from "@/lib/client.ts";
import { authService } from "@/lib/auth.ts";
import { enforceAuthRoute } from "@/lib/routeGuard.ts";
import { createSyncLifecycle } from "@/lib/syncLifecycle.ts";

export class AuthController {
  isBootstrapping = true;

  async bootstrap() {
    if (isOfflineMode) {
      authService.ready = true;
      this.isBootstrapping = false;
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
      router.navigate("/login");
    } finally {
      this.isBootstrapping = false;
    }
  }
}
