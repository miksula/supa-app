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
  `AppRoot`.
- `src/lib/AppRoot.ts` registers routes, picks a layout (`SidebarLayout` or
  `LoginLayout`) for each route, mounts the page, and starts the auth and
  sync-status controllers.
- `src/pages/` contains route-level screens (`auth/`, `docs/`, `my-todos/`,
  `not-found/`). Feature-specific modules live next to their page, e.g.
  `pages/my-todos/TodoStore.ts` reads and writes the local todo data.
- `src/lib/` contains shared code, grouped by concern:
  - `auth/`: `AuthService.ts` wraps Supabase Auth (`auth.ts` exports the
    shared instance), `AuthController.ts` bootstraps the session, and
    `authGuard.ts`/`routeGuard.ts` redirect unauthenticated routes.
  - `sync/`: `client.ts` configures the PowerSync database and Kysely
    adapter, `schema.ts` is the client schema (generated with
    `npm run schema:generate`), `SupabasePowerSyncConnector.ts` supplies
    credentials and uploads local changes, `syncLifecycle.ts` connects
    PowerSync for a signed-in user and clears local data on sign-out, and
    `SyncController.ts` publishes sync status to the UI.
  - `shell/`: layouts and app chrome (`SidebarLayout`, `Sidebar`,
    `SidebarFooter`, `PageHeader`, `LoginLayout`).
  - `nav/`: navigation items (`navConfig.ts`) and breadcrumbs.
  - `ui/`: small reusable elements (`<app-icon>` with the Lucide registry in
    `icons.ts`; `AppLink.ts` defines `<app-link>`, kept for future use).
  - `events.ts` and `types.ts`: shared event and mount-function types.
- UI is rendered with Lit; styles are in `src/styles/`.
- `@packages/router` and `@packages/docs` are workspace packages in
  `../packages/`; the root `package.json` defines the workspaces and
  convenience scripts (`lint`, `fmt`, `type-check`, `schema:generate`,
  `stack:up`/`stack:down`).

## Component patterns

The UI uses three component patterns. Choose one pattern per component
responsibility rather than mixing multiple state and lifecycle models in the
same component.

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
card.update(nextList, index);
card.destroy();
```

The component owns local interaction state, event listeners, focus behavior,
and cleanup. Use this for interaction-heavy UI such as list editing,
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

## Adding pages

When adding a screen, register its route and layout in `AppRoot`, put the page
in `src/pages/`, and keep reusable behavior in `src/lib/`. When changing synced
tables, update the PowerSync schema and keep it aligned with the backend schema
and sync configuration.
