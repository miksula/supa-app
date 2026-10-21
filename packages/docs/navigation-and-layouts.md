# Navigation and Layouts

This guide explains how routing, layouts, and page mounting work in the application, and provides step-by-step instructions for adding new pages and layouts.

---

## Architecture Overview

Navigation in this application is intentionally lightweight and decoupled from heavy framework dependencies. It relies on three key components:

1. **Router (`@packages/router`)**: A minimal client-side hash/path router managing URL history and route patterns.
2. **Layout Manager (`app/src/lib/layoutManager.ts`)**: Controls the layout shell lifecycle, slots page content, and manages native View Transitions.
3. **App Root (`app/src/lib/AppRoot.ts`), Platform (`app/src/lib/platform.ts`) & Composition Root (`app/src/lib/main.ts`)**: `AppRoot` registers routes and guards; the platform creates stable infrastructure and layouts; `main.ts` wires data stores and page factories into `AppRoot` via Dependency Inversion.

```
URL Change
   │
   ▼
Router listener (AppRoot)
   │
   ├─► Auth Guard check (enforceAuthRoute)
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

---

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
```

Each route handler checks `canActivate(ctx.path)` (which enforces disposal state and the auth guard), then either redirects or calls `show(layout, page, transition)`:

- `path`: URL pattern, including parameters (e.g. `:id`) or wildcards (`/*`).
- `layout`: Name of the layout shell (`"app"` | `"login"`).
- `transition`: (Optional) Whether to trigger native cross-document/view transitions when navigating to this route.
- `page`: A `Mount` function for the matching page, with URL parameters passed if needed.

### 3. Layout Persistence & View Transitions

The `LayoutManager` preserves the active layout shell when moving between routes that share the same layout:

- Navigating between `/my-todos` and `/docs/introduction` retains the existing `SidebarLayout` (the sidebar and header are not destroyed or remounted). Only the inner page in `contentSlot` is replaced.
- Navigating to `/auth` transitions across layouts (`app` -> `login`). The old layout is disposed, the new layout is mounted, and the native `document.startViewTransition()` API is used if supported and not disabled by `prefers-reduced-motion`.

---

## How to Add a New Page

Adding a new page involves three steps:

### Step 1: Create the Page Component

Create your page under `app/src/pages/<your-page>/index.ts` conforming to the `Mount` contract:

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

Add the page key to `AppPages` and register its route on `router`:

```ts
type AppPages = {
  login: Mount;
  todos: Mount;
  docs: Mount<string>;
  notFound: Mount;
  settings: Mount; // <-- Add new page here
};

// Inside AppRoot:
router.get("/settings", (ctx) => {
  if (canActivate(ctx.path)) show("app", pages.settings);
});
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

---

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
    element: container.firstElementChild as HTMLElement,
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

### Step 3: Wire the Layout in `platform.ts` (`app/src/lib/platform.ts`)

Layouts are shell infrastructure, so they are provided by `createPlatform` in the `shell.layouts` map, which `main.ts` spreads into `AppRoot`:

```ts
// app/src/lib/platform.ts
return {
  // ...
  shell: {
    // ...
    layouts: {
      app: (target: HTMLElement) => SidebarLayout(target, { router, navItems, authService }),
      login: LoginLayout,
      minimal: MinimalLayout,
    },
  },
};
```

Now any route in `AppRoot` can pass `"minimal"` to `show("minimal", pages.somePage)`.

---

## Summary of Best Practices

- **Always return a cleanup function**: Ensure pages and layouts return `() => void` so subscriptions, DOM nodes, and listeners do not leak.
- **Do not import concrete pages into `AppRoot`**: Keep `AppRoot` agnostic of concrete page implementations. Wire page dependencies centrally in `main.ts` (Composition Root) and infrastructure and layouts in `platform.ts`.
- **Use `router.navigate(path)` for programmatic navigation**: For button clicks or form submissions, invoke `router.navigate("/path")` rather than mutating `window.location` directly.
