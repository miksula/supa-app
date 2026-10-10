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
- `src/lib/AppRoot.ts` registers routes, chooses a layout and page, and starts
  auth and sync-status controllers. Shared navigation lives in
  `AppLayout`/`AppBar`; login has its own layout.
- `src/pages/` contains route-level screens. `src/lib/` contains UI mount
  functions, auth and routing guards, and data/sync services. UI is rendered
  with Lit; styles are in `src/styles/`.
- `src/lib/AuthService.ts` wraps Supabase Auth. `AuthController` bootstraps the
  session, while `syncLifecycle.ts` connects PowerSync for a signed-in user and
  clears local sync data on sign-out.
- `src/lib/client.ts` configures the PowerSync database and Kysely adapter. The
  schema is in `src/lib/schema.ts`; `TodoStore.ts` reads and writes local todo
  data, and `SupabasePowerSyncConnector.ts` supplies credentials and uploads
  local changes to Supabase.
- `@packages/router` is a workspace package in `../packages/`; the root
  `package.json` defines the npm workspaces and convenience scripts.

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
