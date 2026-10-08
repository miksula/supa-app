import { html, render } from "lit";
import { router } from "@packages/router";
import { AuthController } from "@/lib/AuthController.ts";
import { AppLayout } from "@/lib/AppLayout.ts";
import { LoginLayout } from "@/lib/LoginLayout.ts";
import { Home } from "@/pages/Home.ts";
import { Login } from "@/pages/Login.ts";
import type { LayoutFactory, LayoutInstance, MountFunction } from "@/lib/types.ts";

// Extensible registry: add new layouts here or pass custom factories directly
const layouts: Record<string, LayoutFactory> = {
  app: AppLayout,
  login: LoginLayout,
};

type RouteConfig = {
  page: MountFunction;
  layout: keyof typeof layouts | LayoutFactory;
};

export function AppShell(el) {
  let route: RouteConfig;
  const auth = new AuthController();

  // Track active layout instance to prevent unnecessary re-rendering
  let currentLayoutKey: unknown = null;
  let activeLayoutInstance: LayoutInstance | null = null;

  router
    .get("/", () => {
      route = { page: Home, layout: "app" };
    })
    .get("/login", () => {
      route = { page: Login, layout: "login" };
    })
    .get("/*", () => {
      route = {
        page: (target) => render(html`<h1>Page not found</h1>`, target),
        layout: "app",
      };
    });

  router.addRouteListener(function renderRoute(path) {
    if (auth.enforceAuthRoute(path)) {
      return;
    }

    const { page, layout } = route;
    const layoutFactory = typeof layout === "function" ? layout : layouts[layout];

    function updateDOM() {
      // Layout persistence: only rebuild layout if it actually changed
      if (currentLayoutKey !== layout || !activeLayoutInstance) {
        activeLayoutInstance?.dispose?.();
        activeLayoutInstance = layoutFactory(el);
        currentLayoutKey = layout;
      }

      // Render page into the layout's declared outlet slot
      activeLayoutInstance.contentSlot.replaceChildren();
      page(activeLayoutInstance.contentSlot);
    }

    // View Transitions API support
    if (!document.startViewTransition || !el.hasChildNodes()) {
      updateDOM();
      return;
    }

    document.startViewTransition(updateDOM);
  });

  void auth.bootstrap();
}
