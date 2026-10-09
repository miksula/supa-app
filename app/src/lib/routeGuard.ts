import { router } from "@packages/router";
import { isOfflineMode } from "@/lib/client.ts";
import { authService } from "@/lib/auth.ts";
import { createAuthGuard } from "@/lib/authGuard.ts";

export const enforceAuthRoute = createAuthGuard(authService, router, {
  disabled: isOfflineMode,
});
