# Navigation and Layouts

This guide explains how routing, layouts, and page mounting work in the application, and provides step-by-step instructions for adding new pages and layouts.

## Table of contents

- [Architecture Overview](#architecture-overview)
- [How Navigation Works](#how-navigation-works)
- [How to Add a New Page](#how-to-add-a-new-page)
- [How to Add a New Layout](#how-to-add-a-new-layout)
- [Summary of Best Practices](#summary-of-best-practices)

## Architecture Overview

Navigation in this application is intentionally lightweight and decoupled from heavy framework dependencies. It relies on three key components:

1. **Router (`@packages/router`)**: A minimal client-side hash/path router managing URL history and route patterns.
2. **Layout Manager (`app/src/lib/layoutManager.ts`)**: Controls the layout shell lifecycle, slots page content, and manages native View Transitions.
3. **App Root (`app/src/lib/AppRoot.ts`) & Composition Root (`app/src/lib/main.ts`)**: `AppRoot` registers routes and applies the route guard; `main.ts` creates the infrastructure, data stores, layouts and page factories and passes them into `AppRoot` via Dependency Inversion.

```
URL Change
   │
   ▼
Router listener (AppRoot)
   │
   ├─► Auth Guard check (guardRoute)
   │
   ▼
LayoutManager.show({ page, layout, transition })
   │
   ├─► Need new layout? ──► Dispose old layout ──► Instantiate new layout shell
   │   (else reuse existing layout shell)
   │
   ├─► Dispose previous page (disposePage?.())
   │
   └─► Mount next page into layout.contentSlot
```

## How Navigation Works

### 1. The Mount & Dispose Contract

Every page and layout follows the universal lifecycle contract defined in `app/src/lib/types.ts`:

```ts
export type Dispose = () => void;
export type Mount<Props = void> = (el: HTMLElement, props: Props) => Dispose | void;
```

- When a page mounts, it renders into an existing container element and returns a cleanup callback (`Dispose`).
- When navigating away, the `LayoutManager` invokes `dispose()` to teardown event listeners, database subscriptions, and timers.

### 2. Route Registration (`AppRoot.ts`)

Routes are registered directly on the router in `AppRoot` (`app/src/lib/AppRoot.ts`):

```ts
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
```

The `route` helper runs a handler only when `AppRoot` has not been disposed and `guardRoute` lets the path through (the auth guard returns `true` when the route must not render). Each handler then either redirects or calls `showPage(layout, page, transition)`:

- `path`: URL pattern, including parameters (e.g. `:id`) or wildcards (`/*`).
- `layout`: Name of the layout shell (`"app"` | `"login"`).
- `transition`: (Optional) Whether to trigger native cross-document/view transitions when navigating to this route.
- `page`: A `Mount` function for the matching page, with URL parameters passed if needed.

### 3. Layout Persistence & View Transitions

The `LayoutManager` preserves the active layout shell when moving between routes that share the same layout:

- Navigating between `/my-todos` and `/docs/introduction` retains the existing `SidebarLayout` (the sidebar and header are not destroyed or remounted). Only the inner page in `contentSlot` is replaced.
- Navigating to `/auth` transitions across layouts (`app` -> `login`). The old layout is disposed, the new layout is mounted, and the native `document.startViewTransition()` API is used if supported and not disabled by `prefers-reduced-motion`.

## How to Add a New Page

Adding a new page involves three steps:

### Step 1: Create the Page Component

Create your page under `app/src/pages/<your-page>/<YourPage>.ts` (for example `SettingsPage.ts`) conforming to the `Mount` contract:

```ts
import { html, nothing, render } from "lit";
import type { Dispose } from "@/types.ts";

export type SettingsPageProps = {
  onSave?: () => void;
};

export function SettingsPage(el: HTMLElement, props?: SettingsPageProps): Dispose {
  render(
    html`
      <div class="settings-page p-6 max-w-4xl mx-auto">
        <h1 class="text-2xl font-bold">Settings</h1>
        <p class="text-(--text-muted) mt-2">Manage your preferences.</p>
      </div>
    `,
    el,
  );

  return () => {
    // Cleanup listeners or subscriptions
    render(nothing, el);
  };
}
```

### Step 2: Register the Page and Route in `AppRoot` (`app/src/lib/AppRoot.ts`)

Add the page key to `AppPages` and register its route with the `route` helper:

```ts
type AppPages = {
  login: Mount;
  todos: Mount;
  docs: Mount<string>;
  notFound: Mount;
  settings: Mount; // <-- Add new page here
};

// Inside AppRoot:
route("/settings", () => showPage("app", pages.settings));
```

### Step 3: Inject the Page Factory in `main.ts` (`app/src/lib/main.ts`)

In `startApp`, provide the page factory inside the `pages` object:

```ts
AppRoot(el, {
  // ...
  pages: {
    // ...
    settings: (target) => SettingsPage(target),
  },
});
```

_(Optional)_ If the page should appear in navigation, add an entry to `NAV_ITEMS` in `app/src/lib/nav/navConfig.ts` and configure breadcrumbs in `app/src/lib/nav/breadcrumb.ts`.

## How to Add a New Layout

Layouts provide surrounding chrome (e.g. navigation, footers, toolbars) and define a `contentSlot` element where the active page will be mounted.

### Step 1: Implement the Layout Factory

Create `app/src/lib/shell/<YourLayout>.ts` implementing `LayoutFactory`:

```ts
import { html, nothing, render } from "lit";
import type { LayoutFactory, LayoutInstance } from "../types.ts";

export const MinimalLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  render(
    html`
      <div class="minimal-layout min-h-screen flex flex-col">
        <header class="p-4 border-b">Minimal App Header</header>
        <main class="flex-1" data-slot="page"></main>
      </div>
    `,
    container,
  );

  const contentSlot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  return {
    contentSlot,
    dispose: () => {
      // Teardown layout-level event listeners or render cleanup
      render(nothing, container);
    },
  };
};
```

### Step 2: Register the Layout Name

Update the `LayoutName` type in `app/src/lib/AppRoot.ts`:

```ts
// app/src/lib/AppRoot.ts
type LayoutName = "app" | "login" | "minimal";
```

### Step 3: Wire the Layout in `main.ts` (`app/src/lib/main.ts`)

In `startApp`, add the layout factory to the `layouts` map passed to `AppRoot`:

```ts
// app/src/lib/main.ts
const dispose = AppRoot(el, {
  // ...
  layouts: {
    app: (target) =>
      SidebarLayout(target, { router, navItems: NAV_ITEMS, authService, syncStatus }),
    login: LoginLayout,
    minimal: MinimalLayout,
  },
  // ...
});
```

Now any route in `AppRoot` can pass `"minimal"` to `showPage("minimal", pages.somePage)`.

## Summary of Best Practices

- **Always return a cleanup function**: Ensure pages and layouts return `() => void` so subscriptions, DOM nodes, and listeners do not leak.
- **Do not import concrete pages into `AppRoot`**: Keep `AppRoot` agnostic of concrete page implementations. Wire infrastructure, layouts and page dependencies centrally in `main.ts` (Composition Root).
- **Use `router.navigate(path)` for programmatic navigation**: For button clicks or form submissions, invoke `router.navigate("/path")` rather than mutating `window.location` directly.
