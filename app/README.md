# About the App

Browser-based todo app built with TypeScript, Lit, Vite, Supabase Auth, and
PowerSync. The UI uses small functions that mount Lit templates into DOM
elements; it does not use a component framework or a central state store.

## Getting started

This repository uses **npm** and npm workspaces. Install dependencies from the
repository root and then:

```sh
cp app/.env.local.template app/.env.local
```

Set the Supabase and PowerSync values in `app/.env.local`, then start the app
from the repository root:

```sh
npm run app:start
```

Vite serves the app locally and opens it in a browser. To work on the UI without
a running stack, use `npm run dev:offline --workspace=app`; this disables
authentication and remote sync while keeping the local database available.

## Basic architecture

- `src/index.html` is the browser entry point. It loads styles and calls
  `startApp` in [src/lib/main.ts](src/lib/main.ts).
- [src/lib/config.ts](src/lib/config.ts) contains all app environment reads,
  including offline mode and development-only login prefill.
- [src/lib/main.ts](src/lib/main.ts) is the composition root. It constructs an
  explicit `Router` instance, auth,
  the local database, connector, route guard, sync lifecycle and todo store, then
  binds their dependencies to pages, layouts and controllers.
- [src/lib/AppRoot.ts](src/lib/AppRoot.ts) registers the injected route table from
  [src/lib/routes.ts](src/lib/routes.ts), applies the auth guard, and starts the
  auth and sync-status controllers. [src/lib/layoutManager.ts](src/lib/layoutManager.ts)
  owns page/layout replacement, disposal and view transitions.
- `src/pages/` contains route-level screens (`auth/`, `docs/`, `my-todos/`,
  `not-found/`). Feature-specific modules live next to their page, e.g.
  `pages/my-todos/TodoStore.ts` reads and writes the local todo data.
- `src/lib/` contains shared code, grouped by concern:
  - `auth/`: `AuthService.ts` wraps an injected Supabase client created in `main.ts`,
    `AuthController.ts` bootstraps the session with injected dependencies, and
    `authGuard.ts` creates the route guard. There are no auth service singletons.
  - `sync/`: `client.ts` provides a factory for the PowerSync database and Kysely
    adapter, `schema.ts` is the client schema (generated with
    `npm run schema:generate`), `SupabasePowerSyncConnector.ts` supplies
    credentials and uploads every transaction through the `process_powersync_crud`
    RPC using an injected Supabase client. The RPC runs with the caller's RLS
    permissions. Successful uploads and fatal data/permission failures complete
    the queued transaction; transient failures leave it pending for retry.
    `syncLifecycle.ts` connects
    PowerSync for a signed-in user and clears local data on sign-out, and
    `SyncController.ts` publishes sync status to the UI.
  - `shell/`: layouts and app chrome (`SidebarLayout`, `Sidebar`,
    `SidebarFooter`, `PageHeader`, `LoginLayout`). `SidebarFooter` composes
    `ThemeSwitcher` and `SyncStatusIndicator`, each owning its listeners and
    cleanup. `sidebarState.ts` stores sidebar visibility in localStorage only;
    blocked storage falls back to an open sidebar.
  - `theme/`: shared theme resolution and persistence helpers, also used by the
    theme initialization script in `src/index.html`.
  - `nav/`: navigation items (`navConfig.ts`) and breadcrumbs.
  - `ui/`: small reusable elements (`<app-icon>` with the Lucide registry in
    `icons.ts`; `AppLink.ts` defines `<app-link>`, kept for future use).
  - `events.ts` and `types.ts`: shared event and mount-function types.
- UI is rendered with Lit. Component CSS lives beside its component module;
  `src/styles/` contains shared tokens, Tailwind and base styles.
- `@packages/router` and `@packages/docs` are workspace packages in
  `../packages/`; the root `package.json` defines the workspaces and
  convenience scripts (`lint`, `fmt`, `type-check`, `test`, `knip`, `check`, `schema:generate`,
  `stack:up`/`stack:down`).

The router package has no import-time listener or shared instance. It uses one
matching and notification path for initial checks and intercepted navigations;
redirects and newer navigations suppress stale notifications. Expected browser
cancellations are handled without hiding genuine navigation errors.

## Component patterns

The UI uses three component patterns. Choose one pattern per component
responsibility rather than mixing multiple state and lifecycle models in the
same component.

### Shared mount contract

[src/lib/types.ts](src/lib/types.ts) defines the common contract:

```ts
export type Dispose = () => void;
export type Mount<Props = void> = (
  el: HTMLElement,
  props: Props,
) => Dispose | void;
```

Mounts that own listeners, subscriptions, observers or asynchronous work return
`Dispose`. All route pages return it. A stateless render-only fragment such as
`TodoList` may return `void` because its parent owns the lifecycle.

The caller retains the cleanup function and calls it before replacing the mount
or removing its host. Do not attach disposer properties to DOM elements or mount
a second instance into a live host without disposing the first.

```ts
const disposeSidebar = Sidebar(element, dependencies);
disposeSidebar();
```

`layoutManager` disposes the active page before mounting the next page and
disposes a layout only when changing layouts. Route `transition` flags control
layout-change animation, with immediate updates when reduced motion is enabled
or the View Transition API is unavailable. Superseded transition callbacks cannot
mount stale pages. `AppRoot` retains the manager and sync-controller disposers.
`SidebarLayout` owns the `Sidebar` and
`PageHeader` disposers; `Sidebar` owns its current `SidebarFooter` disposer.
Cleanup removes external listeners and subscriptions before clearing owned Lit
content with `render(nothing, element)`. Children are disposed before parents.

The account menu moves focus back to its trigger before hiding a focused child.
Closed menu contents are `inert`; dismissing the menu does not steal focus from
an outside control. On narrow screens the menu opens above the account trigger
instead of outside the sidebar's right edge.

Async mounts keep per-instance disposal state. `LoginPage` and `DocsPage` ignore
responses received after disposal, including rejected requests. Disposing does
not cancel an already-sent login request or dynamic import; it prevents the old
page from writing into a host now owned by another page. `DocsPage` also disposes
its `DocViewer`. `MyTodos` aborts its query watch and destroys its card controllers.

### Mounted Lit template function

A function renders a Lit template into an element supplied by its caller:

```ts
TodoList(element, list, options);
```

The caller owns the element, decides when it is rendered again, and controls
the surrounding lifecycle. Use this for data-driven fragments whose state is
owned by a parent component.

Advantages:

- Very little framework structure.
- Easy to mount into an existing DOM element.
- Good for rendering database-backed data.

### Imperative functional component

A function creates and manages DOM behavior directly:

```ts
const card = TodoListCard(element, list, options);
card.update(nextList);
card.destroy();
```

The component owns local interaction state, event listeners, focus behavior,
and cleanup. Its `destroy` method has type `Dispose`; the controller API is kept
for components that also need `update`. Use this for interaction-heavy UI such as list editing,
keyboard navigation, and confirmation flows.

Advantages:

- Precise focus and blur handling.
- Natural for editing, keyboard navigation, and confirmation flows.
- Explicit lifecycle through update() and destroy().

### Reactive `LitElement`

A class-based custom element owns reactive properties and renders when those
properties change:

```ts
class ExampleComponent extends LitElement {
  render() {
    return html`...`;
  }
}
```

Use this for reusable, self-contained widgets with substantial internal
reactive state. It introduces a custom-element lifecycle, so it should not be
used merely to wrap a small template fragment.

Advantages:

- State changes automatically trigger rendering.
- Template and state remain declaratively connected.
- Lifecycle hooks provide structured setup and cleanup.
- Good for reusable components with substantial internal state.

The current todo UI uses mounted Lit templates for data-driven content and
imperative functional components for focus-sensitive card interactions. Keep
DOM state owned by one model: do not manually mutate DOM state that a parent
Lit render may recreate.

### Component styles and language

Import scoped CSS from the component that owns it, for example
`import "./sidebar.css"` in `Sidebar.ts`. Keep the existing `@scope` boundaries
and semantic design tokens. Shared style consumers import the shared stylesheet
directly, as `DocsPage` does for `app-link.css`.

Only Tailwind, tokens and base styles belong in `src/styles/index.css`. Adding
a component must not require adding its CSS to that global list.

Controls, status messages, accessibility labels and page metadata are Finnish.
Documentation content and user-entered list items retain their original language.

### Lifecycle tests

Run `npm test -- app/src/lib/lifecycle.test.ts` from the repository root. These
tests use Happy DOM for late async responses, page replacement order, guarded
routes, stale transitions, theme/sidebar persistence, independent document mounts
and repeated shell listener cleanup. Account-menu tests check focus before
hiding on sign-out, Escape, outside click and session changes. Other unit tests continue
to run in Node. Verify responsive layouts and CSS in a real browser as well.

## Adding pages

When adding a screen, register its route and layout in `routes.ts`, put the page
in `src/pages/`, and bind its dependencies in [src/lib/main.ts](src/lib/main.ts).
Pass callbacks, a store, or a narrow service interface to pages and components;
do not import runtime auth, sync or router singletons into them. The composition
root creates and injects the router instance.
Keep reusable behavior in `src/lib/`. When changing synced
tables, update the PowerSync schema and keep it aligned with the backend schema
and sync configuration.
