import { html, render } from "lit";
import { router } from "@packages/router";
import { AuthController } from "@/auth/AuthController.ts";
import { enforceAuthRoute } from "@/auth/routeGuard.ts";
import { SyncController } from "@/sync/SyncController.ts";
import { SidebarLayout } from "@/shell/SidebarLayout.ts";
import { LoginLayout } from "@/shell/LoginLayout.ts";
import { LoginPage } from "../pages/auth/index.ts";
import { MyTodosPage } from "../pages/my-todos/index.ts";
import type { LayoutFactory, LayoutInstance, MountFunction } from "@/types.ts";

// Extensible registry: add new layouts here or pass custom factories directly
const layouts = {
  app: SidebarLayout,
  login: LoginLayout,
} satisfies Record<string, LayoutFactory>;

type LayoutName = keyof typeof layouts;

type RouteConfig = {
  page: MountFunction;
  layout: LayoutName | LayoutFactory;
};

const redirect = (to: string) => {
  router.navigate(to);
};

export function AppRoot(el: HTMLElement) {
  let route: RouteConfig;
  const auth = new AuthController();

  // Observe synchronization state
  SyncController(el);

  // Track active layout instance to prevent unnecessary re-rendering
  let currentLayoutKey: unknown = null;
  let activeLayoutInstance: LayoutInstance | null = null;

  router
    .get("/", () => {
      redirect("/my-todos");
    })
    .get("/my-todos", () => {
      route = { page: MyTodosPage, layout: "app" };
    })
    .get("/docs/:id", (context) => {
      const id = context.param("id") as string;
      console.log(`Docs page for ID: ${id}`);
      route = {
        page: (target) => render(html`<h1>Documentation Page - ${id}</h1>`, target),
        layout: "app",
      };
    })
    .get("/auth", () => {
      route = { page: LoginPage, layout: "login" };
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
    const layoutFactory = typeof layout === "function" ? layout : layouts[layout];

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
