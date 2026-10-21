/**
 * The Composition Root File
 * Implements the Dependency Inversion Principle (DIP):
 *
 * High-level modules should not depend on low-level modules; both should depend
 * on abstractions. Details should depend on abstractions, not vice versa.
 *
 * Key benefits in this application:
 * 1. Loose coupling: UI components, layouts, and pages do not instantiate concrete
 *    SDKs or databases directly. They receive contracts, services, or stores from above.
 * 2. Testability & mockability: Business logic and UI can be tested in isolation by
 *    swapping implementations with mocks or test doubles without touching component code.
 * 3. Flexibility & maintainability: Environment-specific variations (such as offline mode
 *    disabling auth persistence and sync) are configured centrally in the platform
 *    (`platform.ts`) rather than leaking across page implementations.
 *
 * This file only wires the actively developed parts (data stores, pages, navigation).
 * Stable infrastructure (router, Supabase, auth, PowerSync, sync lifecycle, layouts)
 * lives behind `createPlatform()`.
 */

import { AppRoot } from "./AppRoot.ts";
import { createPlatform } from "./platform.ts";
import { NAV_ITEMS } from "./nav/navConfig.ts";
import { LoginPage } from "../pages/auth/index.ts";
import { MyTodosPage } from "../pages/my-todos/index.ts";
import { TodoStore } from "../pages/my-todos/TodoStore.ts";
import { DocsPage } from "../pages/docs/index.ts";
import { NotFoundPage } from "../pages/not-found/index.ts";

export function startApp(el: HTMLElement) {
  const platform = createPlatform({ navItems: NAV_ITEMS });
  const { config, db, navigate, session } = platform;

  // Data stores
  const todoStore = new TodoStore(db);

  // Inject platform shell and page factories into AppRoot
  return AppRoot(el, {
    router: platform.router,
    ...platform.shell,
    pages: {
      login: (target) =>
        LoginPage(target, {
          login: session.login,
          initialEmail: config.devEmail,
          initialPassword: config.devPassword,
        }),
      todos: (target) => MyTodosPage(target, { store: todoStore, getUserId: session.userId }),
      docs: (target, docId) => DocsPage(target, { docId, navigate }),
      notFound: NotFoundPage,
    },
  });
}
