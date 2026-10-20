import type { AppRouter, LayoutFactory, Mount } from "@/types.ts";
import { createLayoutManager } from "./layoutManager.ts";
import { createRoutes, type AppPages } from "./routes.ts";

type LayoutName = "app" | "login";

type AppDependencies = {
  router: Pick<AppRouter, "get" | "navigate">;
  auth: { bootstrap: () => Promise<void> };
  enforceAuthRoute: (path: string) => boolean;
  mountSync: Mount;
  layouts: Record<LayoutName, LayoutFactory>;
  pages: AppPages;
};

export function AppRoot(el: HTMLElement, dependencies: AppDependencies) {
  const { router, auth, enforceAuthRoute, mountSync, layouts, pages } = dependencies;
  const disposeSync = mountSync(el);
  const layoutManager = createLayoutManager(el);
  let disposed = false;

  for (const route of createRoutes(pages)) {
    router.get(route.path, (context) => {
      if (disposed || enforceAuthRoute(context.path.split("?")[0])) return;
      if ("redirect" in route) {
        router.navigate(route.redirect);
        return;
      }
      layoutManager.show({
        page: route.resolve(context),
        layout: layouts[route.layout],
        transition: route.transition,
      });
    });
  }

  void auth.bootstrap();
  return () => {
    if (disposed) return;
    disposed = true;
    layoutManager.dispose();
    disposeSync?.();
  };
}
