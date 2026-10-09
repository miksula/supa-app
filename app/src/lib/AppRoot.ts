import { html, render } from "lit";
import { router } from "@packages/router";
import { AuthController } from "@/lib/AuthController.ts";
import { SyncController } from "@/lib/SyncController.ts";
import { forward } from "@/lib/events.ts";
import { enforceAuthRoute } from "@/lib/routeGuard.ts";
import { AppLayout } from "@/lib/AppLayout.ts";
import { LoginLayout } from "@/lib/LoginLayout.ts";
import { Home } from "@/pages/Home.ts";
import { Login } from "@/pages/Login.ts";
import type {
  LayoutFactory,
  LayoutInstance,
  MountFunction,
} from "@/lib/types.ts";

// Extensible registry: add new layouts here or pass custom factories directly
const layouts = {
  app: AppLayout,
  login: LoginLayout,
} satisfies Record<string, LayoutFactory>;

type LayoutName = keyof typeof layouts;

type RouteConfig = {
  page: MountFunction;
  layout: LayoutName | LayoutFactory;
};

export function AppRoot(el) {
  let route: RouteConfig;
  const auth = new AuthController();
  SyncController(el);

  // Track active layout instance to prevent unnecessary re-rendering
  let currentLayoutKey: unknown = null;
  let activeLayoutInstance: LayoutInstance | null = null;

  // Data flows down: root -> active layout -> (layout forwards to its parts)
  forward(el, () => activeLayoutInstance?.element, "syncStatus");

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
    if (enforceAuthRoute(path)) {
      return;
    }

    const { page, layout } = route;
    const layoutFactory = typeof layout === "function"
      ? layout
      : layouts[layout];

    function updateDOM() {
      // Layout persistence: only rebuild layout if it actually changed
      if (currentLayoutKey !== layout || !activeLayoutInstance) {
        activeLayoutInstance?.dispose?.();
        activeLayoutInstance = layoutFactory(el);
        currentLayoutKey = layout;
      }

      // Render page into the layout's declared outlet slot
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
