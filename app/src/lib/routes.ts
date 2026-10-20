import type { AppRouter, Mount } from "./types.ts";

export type AppPages = {
  login: Mount;
  todos: Mount;
  docs: Mount<string>;
  notFound: Mount;
};

type RouteContext = Parameters<Parameters<AppRouter["get"]>[1]>[0];
type AppRoute =
  | { path: string; redirect: string }
  | {
      path: string;
      layout: "app" | "login";
      transition?: boolean;
      resolve: (context: RouteContext) => Mount;
    };

export function createRoutes(pages: AppPages): AppRoute[] {
  return [
    { path: "/", redirect: "/my-todos" },
    { path: "/my-todos", layout: "app", resolve: () => pages.todos },
    { path: "/docs", redirect: "/docs/introduction" },
    {
      path: "/docs/:id",
      layout: "app",
      resolve: (context) => {
        const id = context.param("id") as string;
        return (target) => pages.docs(target, id);
      },
    },
    { path: "/auth", layout: "login", transition: true, resolve: () => pages.login },
    { path: "/*", layout: "app", resolve: () => pages.notFound },
  ];
}
