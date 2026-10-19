import { router } from "@packages/router";
import { isOfflineMode } from "@/sync/client.ts";
import { authService } from "@/auth/auth.ts";
import { createAuthGuard } from "@/auth/authGuard.ts";

export const enforceAuthRoute = createAuthGuard(authService, router, {
  disabled: isOfflineMode,
});
