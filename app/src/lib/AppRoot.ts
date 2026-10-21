import type { AppRouter, LayoutFactory, Mount } from "@/types.ts";
import { createLayoutManager } from "./layoutManager.ts";

type LayoutName = "app" | "login";

type AppPages = {
  login: Mount;
  todos: Mount;
  docs: Mount<string>;
  notFound: Mount;
};

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

  const canActivate = (path: string) => !disposed && !enforceAuthRoute(path.split("?")[0]);
  const show = (layout: LayoutName, page: Mount, transition?: boolean) => {
    layoutManager.show({ page, layout: layouts[layout], transition });
  };

  router.get("/", (ctx) => {
    if (canActivate(ctx.path)) router.navigate("/my-todos");
  });
  router.get("/my-todos", (ctx) => {
    if (canActivate(ctx.path)) show("app", pages.todos);
  });
  router.get("/docs", (ctx) => {
    if (canActivate(ctx.path)) router.navigate("/docs/introduction");
  });
  router.get("/docs/:id", (ctx) => {
    if (!canActivate(ctx.path)) return;
    const id = ctx.param("id") as string;
    show("app", (target) => pages.docs(target, id));
  });
  router.get("/auth", (ctx) => {
    if (canActivate(ctx.path)) show("login", pages.login, true);
  });
  router.get("/*", (ctx) => {
    if (canActivate(ctx.path)) show("app", pages.notFound);
  });

  void auth.bootstrap();

  return () => {
    if (disposed) return;
    disposed = true;
    layoutManager.dispose();
    disposeSync?.();
  };
}
