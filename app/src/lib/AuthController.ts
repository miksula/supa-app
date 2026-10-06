import { router } from "@packages/router";
import {
  connectPowersync,
  resetPowersyncForSessionChange,
  supabase,
} from "@/lib/client.ts";

export class AuthController {
  isBootstrapping = true;

  async bootstrap() {
    try {
      await supabase.init();

      if (supabase.currentSession?.user.is_anonymous) {
        await supabase.logout();
      }

      supabase.client.auth.onAuthStateChange(async (event, session) => {
        supabase.updateSession(session);

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

      if (supabase.currentSession) {
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
    if (!supabase.ready) {
      return true;
    }

    if (!supabase.currentSession && path !== "/login") {
      router.navigate("/login");
      return true;
    }

    if (supabase.currentSession && path === "/login") {
      router.navigate("/");
      return true;
    }

    return false;
  }
}
