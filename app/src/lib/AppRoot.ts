import type { AppRouter, Dispose, LayoutFactory, LayoutInstance, Mount } from "@/types.ts";

type LayoutName = "app" | "login";

type AppDependencies = {
  router: Pick<AppRouter, "get" | "navigate" | "addRouteListener">;
  auth: { bootstrap: () => Promise<void> };
  enforceAuthRoute: (path: string) => boolean;
  mountSync: Mount;
  layouts: Record<LayoutName, LayoutFactory>;
  pages: {
    login: Mount;
    todos: Mount;
    docs: Mount<string>;
    notFound: Mount;
  };
};

type RouteConfig = {
  page: Mount;
  layout: LayoutName | LayoutFactory;
};

export function AppRoot(el: HTMLElement, dependencies: AppDependencies) {
  const { router, auth, enforceAuthRoute, mountSync, layouts, pages } = dependencies;
  let route: RouteConfig;

  // Observe synchronization state
  mountSync(el);

  // Track active layout instance to prevent unnecessary re-rendering
  let currentLayoutKey: unknown = null;
  let activeLayoutInstance: LayoutInstance | null = null;
  let disposeActivePage: Dispose | null = null;

  // Navigation helper
  const redirect = (to: string) => {
    router.navigate(to);
  };

  router
    .get("/", () => {
      redirect("/my-todos");
    })
    .get("/my-todos", () => {
      route = { page: pages.todos, layout: "app" };
    })
    .get("/docs", () => {
      redirect("/docs/introduction");
    })
    .get("/docs/:id", (context) => {
      const id = context.param("id") as string;
      route = {
        page: (target) => pages.docs(target, id),
        layout: "app",
      };
    })
    .get("/auth", () => {
      route = { page: pages.login, layout: "login" };
    })
    .get("/*", () => {
      route = { page: pages.notFound, layout: "app" };
    });

  router.addRouteListener(function renderRoute(path) {
    if (enforceAuthRoute(path)) {
      return;
    }

    const { page, layout } = route;
    const layoutFactory = typeof layout === "function" ? layout : layouts[layout];

    function updateDOM() {
      disposeActivePage?.();
      disposeActivePage = null;

      // Layout persistence: only rebuild layout if it actually changed
      if (currentLayoutKey !== layout || !activeLayoutInstance) {
        activeLayoutInstance?.dispose?.();
        activeLayoutInstance = layoutFactory(el);
        currentLayoutKey = layout;
      }

      // Render page into the layout's declared outlet slot
      disposeActivePage = page(activeLayoutInstance.contentSlot) ?? null;
    }

    // View Transitions API support: trigger only on login/logout
    const isLogin = currentLayoutKey === "login" && layout === "app";
    const isLogout = currentLayoutKey === "app" && layout === "login";
    const isAuthTransition = isLogin || isLogout;

    if (!document.startViewTransition || !el.hasChildNodes() || !isAuthTransition) {
      updateDOM();
      return;
    }

    document.startViewTransition(updateDOM);
  });

  void auth.bootstrap();
}
