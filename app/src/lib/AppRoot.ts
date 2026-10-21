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

  const route = (path: string, handler: (context: RouteContext) => void) => {
    router.get(path, function handlePath(context) {
      if (!disposed && !guardRoute(context.path.split("?")[0])) handler(context);
    });
  };
  const showPage = (page: Mount, options?: { layout?: LayoutName; transition?: boolean }) => {
    layoutManager.show({
      page,
      layout: layouts[options?.layout ?? "app"],
      transition: options?.transition,
    });
  };
  const redirectTo = (path: string) => {
    router.navigate(path);
  };

  // Define app routes here
  route("/", function () {
    redirectTo("/my-todos");
  });
  route("/my-todos", function () {
    showPage(pages.todos);
  });
  route("/docs", function () {
    redirectTo("/docs/introduction");
  });
  route("/docs/:id", function (context) {
    const id = context.param("id") as string;
    showPage((target) => pages.docs(target, id));
  });
  route("/auth", function () {
    showPage(pages.login, { layout: "login", transition: true });
  });
  route("/*", function () {
    showPage(pages.notFound);
  });

  return () => {
    if (disposed) return;
    disposed = true;
    layoutManager.dispose();
  };
}
