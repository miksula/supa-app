import { router } from "@packages/router";
import {
  connectPowersync,
  isOfflineMode,
  resetPowersyncForSessionChange,
} from "@/lib/client.ts";
import { authService } from "@/lib/auth.ts";

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

      authService.onAuthStateChange(async (event) => {
        if (event === "SIGNED_OUT") {
          try {
            await resetPowersyncForSessionChange();
          } catch (error) {
            console.error("Failed to reset PowerSync after sign-out", error);
          }

          router.navigate("/login");
          return;
        }

        if (event === "SIGNED_IN") {
          try {
            await connectPowersync();
          } catch (error) {
            console.error("Failed to connect PowerSync after sign-in", error);
          }

          if (router.path === "/login") {
            router.navigate("/");
          }
        }
      });

      if (authService.session) {
        await connectPowersync();
      }

      const redirected = this.enforceAuthRoute(router.path);
      if (!redirected) {
        router.check();
      }
    } catch (error) {
      console.error("Failed to bootstrap authentication", error);
      router.navigate("/login");
    } finally {
      this.isBootstrapping = false;
    }
  }

  enforceAuthRoute(path: string) {
    if (isOfflineMode) {
      return false;
    }

    if (!authService.ready) {
      return true;
    }

    if (!authService.session && path !== "/login") {
      router.navigate("/login");
      return true;
    }

    if (authService.session && path === "/login") {
      router.navigate("/");
      return true;
    }

    return false;
  }
}
