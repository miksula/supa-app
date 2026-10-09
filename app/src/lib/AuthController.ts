import { router } from "@packages/router";
import {
  connectPowersync,
  isOfflineMode,
  resetPowersyncForSessionChange,
} from "@/lib/client.ts";
import { authService } from "@/lib/auth.ts";
import { enforceAuthRoute } from "@/lib/routeGuard.ts";
import { startSyncLifecycle } from "@/lib/syncLifecycle.ts";

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

      startSyncLifecycle(authService, {
        connect: connectPowersync,
        reset: resetPowersyncForSessionChange,
      });

      // Redirects are the guard's job, independent of sync.
      authService.onAuthStateChange(() => {
        enforceAuthRoute(router.path);
      });

      if (authService.isAuthenticated) {
        await connectPowersync();
      }

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
