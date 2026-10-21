import type { AppRouter, LayoutFactory, Mount } from "@/types.ts";
import type { RouteGuard } from "./auth/authGuard.ts";
import { createLayoutManager } from "./layoutManager.ts";

type LayoutName = "app" | "login";
type RouteContext = Parameters<Parameters<AppRouter["get"]>[1]>[0];

type AppPages = {
  login: Mount;
  todos: Mount;
  docs: Mount<string>;
  notFound: Mount;
};

type AppRootDependencies = {
  router: Pick<AppRouter, "get" | "navigate">;
  guardRoute: RouteGuard;
  layouts: Record<LayoutName, LayoutFactory>;
  pages: AppPages;
};

/** Registers the app routes and mounts each page inside its layout. */
export function AppRoot(
  el: HTMLElement,
  { router, guardRoute, layouts, pages }: AppRootDependencies,
) {
  const layoutManager = createLayoutManager(el);
  let disposed = false;

  const route = (path: string, handler: (ctx: RouteContext) => void) => {
    router.get(path, (ctx) => {
      if (!disposed && !guardRoute(ctx.path.split("?")[0])) handler(ctx);
    });
  };
  const showPage = (layout: LayoutName, page: Mount, transition?: boolean) => {
    layoutManager.show({ page, layout: layouts[layout], transition });
  };

  route("/", () => router.navigate("/my-todos"));
  route("/my-todos", () => showPage("app", pages.todos));
  route("/docs", () => router.navigate("/docs/introduction"));
  route("/docs/:id", (ctx) => {
    const id = ctx.param("id") as string;
    showPage("app", (target) => pages.docs(target, id));
  });
  route("/auth", () => showPage("login", pages.login, true));
  route("/*", () => showPage("app", pages.notFound));

  return () => {
    if (disposed) return;
    disposed = true;
    layoutManager.dispose();
  };
}
