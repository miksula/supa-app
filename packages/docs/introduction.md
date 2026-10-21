# Introduction

Welcome to Supa App. This page is a guided tour of the code base for
developers who are new to the project. It explains what the app does, how the
pieces fit together, and where to look when you need to change something.
Every code snippet is taken from the real source files; `// …` marks places
where lines were left out to keep the example short.

## What the app is

Supa App is an offline-capable todo app. A signed-in user owns todo _lists_,
and every list contains _todos_. The feature set is deliberately small. The
interesting part is the architecture: the app is **local-first**.

In a classic web app every click becomes an HTTP request, and the UI waits for
the server to answer. Here the browser has its own SQLite database. The UI
reads from and writes to that local database only, so it responds instantly
and keeps working without a network connection. A sync engine (PowerSync)
keeps the local database and the server database (Supabase Postgres) in step
in the background.

If you remember one thing from this page, make it this:

> Pages never fetch todo data from the server. They query the local database,
> and sync happens behind their back.

## The stack at a glance

| Layer           | Technology                                      | Role in this project                                                         |
| --------------- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| UI              | TypeScript, Lit (`html` / `render`), Tailwind 4 | Renders templates into DOM elements. No React or Vue, no global state store. |
| Build           | Vite, npm workspaces                            | Dev server, bundling, WASM and web worker support.                           |
| Routing         | `@packages/router` (lives in this repo)         | Small router built on the browser Navigation API and `URLPattern`.           |
| Local database  | PowerSync Web SDK + wa-sqlite                   | SQLite in the browser, persisted in the Origin Private File System (OPFS).   |
| Auth            | Supabase Auth (`@supabase/supabase-js`)         | Email and password sign-in. Issues the JWT that every other layer trusts.    |
| Server database | Supabase Postgres                               | The system of record, protected by row-level security (RLS).                 |
| Sync            | Self-hosted PowerSync service (Docker)          | Streams each user's rows to the browser and receives the app's local writes. |
| Docs            | `@packages/docs`                                | The Markdown pages you are reading now, rendered inside the app.             |

## How data flows

```text
 BROWSER                          BACKEND

 Pages (Lit)
   │ SQL reads and writes
   ▼
 Local SQLite ── upload queue ──▶ Supabase RPC
 (PowerSync SDK)                  process_powersync_crud
   ▲                              (runs as the user, RLS)
   │                                 │
   │                                 ▼
   │                              Postgres: lists, todos
   │                                 │ logical replication
   │                                 ▼
   └──── user's rows (sync) ◀──── PowerSync service
```

There are two directions to keep apart in your head:

- **Writes go up.** A page runs an `INSERT` or `UPDATE` against local SQLite.
  PowerSync records the change in an _upload queue_. When the network is
  available, the app's connector sends queued changes to Supabase through a
  single Postgres function, `process_powersync_crud`. That function runs with
  the user's own permissions, so RLS decides whether the write is allowed.
- **Reads come down.** PowerSync follows every committed change in Postgres
  through logical replication. Its _sync config_ decides which rows belong to
  which user, and streams those rows to each signed-in browser. Local queries
  that watch the affected tables re-run automatically.

Supabase Auth ties both directions together. The same JWT (the user's access
token) is sent to Supabase for uploads and to PowerSync for downloads.

## Repository tour

```text
supa-app/
├── app/                 Browser app (Vite's root is app/src)
│   └── src/
│       ├── index.html   Entry point
│       ├── lib/         Shared code: composition root, auth, sync, shell, UI
│       ├── pages/       Route-level screens: auth, my-todos, docs, not-found
│       └── css/         Tailwind, design tokens and base styles
├── packages/
│   ├── router/          Client-side router (workspace package)
│   ├── docs/            These Markdown docs (workspace package)
│   └── oxlint-plugin/   Project-specific oxlint rules (workspace package)
├── stack/
│   ├── supabase/        Supabase config, SQL migrations and seed data
│   └── powersync/       PowerSync service config and sync streams
└── package.json         Workspaces and all top-level scripts
```

Inside `app/src/lib/` code is grouped by concern:

- `main.ts`: the composition root. It creates the router, Supabase, auth,
  PowerSync, sync lifecycle, stores, layouts and pages, and wires them together.
- `AppRoot.ts`, `layoutManager.ts`: route registration and page swapping.
- `auth/`: sign-in state, the route guard and the startup sequence.
- `sync/`: the local database, its schema, the backend connector and sync
  status.
- `shell/`: layouts and app chrome (sidebar, page header, theme switcher, sync
  status indicator).
- `ui/`, `theme/`, `nav/`: small reusable elements, theming and navigation
  data.
- `types.ts`: the mount contract and shared router and layout types.

Imports use the `@/` alias for `app/src/lib`, for example
`import type { Dispose } from "@/types.ts"`. The alias is configured in
`app/tsconfig.json` and `vitest.config.ts`.

## Running it locally

The root `README.md` has the full instructions. The short version is:

```sh
npm install
cp app/.env.local.template app/.env.local
cp stack/powersync/docker/.env.template stack/powersync/docker/.env
npm run stack:up    # starts Supabase and PowerSync in Docker
# Paste the sb_publishable_... key printed by Supabase into app/.env.local
npm run app:start
```

The seed data creates the user `dev@example.com` with the password
`password123`, plus a few sample lists. Local Supabase Studio runs at
<http://127.0.0.1:54323>.

If you only want to work on the UI, run `npm run app:start:offline`. It sets
`VITE_OFFLINE_MODE=true`, which disables authentication and sync while keeping
the local database available, so no Docker stack is needed.

## Code walkthrough

This section follows the app from the moment the browser loads the page until
a todo appears on screen.

### 1. Entry point: `index.html`

`app/src/index.html` contains two module scripts. The first one runs before
the page renders (`blocking="render"`) and applies the saved colour theme, so
the user never sees a flash of the wrong colours. The second one starts the
app:

```html
<body>
  <div class="app"></div>

  <script type="module">
    import { startApp } from "/lib/main.ts";

    startApp(document.querySelector("body > .app"));
  </script>
</body>
```

### 2. Composition root: `main.ts`

Long-lived objects are created in one place, and everything else receives
what it needs as arguments. This is dependency injection without a framework,
and it is the most important convention in the code base.

`startApp` in `app/src/lib/main.ts` is the **composition root**. It is the only
place that creates concrete services (router, Supabase client, `AuthService`,
PowerSync, the sync-status source and the data stores) and wires them into
layouts and pages:

```ts
export function startApp(el: HTMLElement) {
  const offline = config.isOfflineMode;

  const router = new Router();
  const navigate = (path: string) => {
    router.navigate(path);
  };
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: !offline, autoRefreshToken: !offline, detectSessionInUrl: !offline },
  });
  const authService = new AuthService(supabase);
  const powersync = createPowerSync();
  const syncStatus = createSyncStatusSource(powersync);
  const todoStore = new TodoStore(powersync);

  // Offline mode has no backend: every route is open and sync never starts.
  const guardRoute = offline ? () => false : createAuthGuard(authService, router);

  const dispose = AppRoot(el, {
    router,
    guardRoute,
    layouts: {
      app: (target) =>
        SidebarLayout(target, { router, navItems: NAV_ITEMS, authService, syncStatus }),
      login: LoginLayout,
    },
    pages: {
      login: (target) =>
        LoginPage(target, {
          login: (email, password) => authService.login(email, password),
          initialEmail: config.devEmail,
          initialPassword: config.devPassword,
        }),
      todos: (target) =>
        MyTodosPage(target, {
          store: todoStore,
          getUserId: () => authService.session?.user.id ?? null,
        }),
      docs: (target, docId) => DocsPage(target, { docId, navigate }),
      notFound: NotFoundPage,
    },
  });
  // …
}
```

Look at what each page receives. `LoginPage` gets a `login` callback, not the
Supabase client. `MyTodosPage` gets the store and a `getUserId` function, not
the whole auth service. The Supabase client never leaves `main.ts`.

Offline mode is decided once, here. The guard above lets every route through,
and the end of `startApp` either renders the current route straight away or,
online, creates the connector and sync lifecycle and starts the auth bootstrap:

```ts
// Routes are registered above; now render the current one.
if (offline) {
  router.check();
} else {
  const connector = new SupabasePowerSyncConnector(supabase, config.powersyncUrl);
  const syncLifecycle = createSyncLifecycle({
    connect: () => powersync.connect(connector),
    reset: () => powersync.disconnectAndClear({ clearLocal: true }),
  });
  void bootstrapAuth({ authService, router, syncLifecycle, guardRoute });
}

return dispose;
```

Why go to this trouble?

- **Testability.** A test can pass a fake `login` function or a fake store.
  No module mocking is needed.
- **No hidden singletons.** Pages and components never import the router,
  the Supabase client or the PowerSync database directly. If a component
  needs something, you can see it in its parameter list.
- **One short file to read.** `main.ts` shows every service the app creates
  and how features are wired to them. Adding a feature normally means editing
  only this file and `AppRoot.ts`.
- **Not a container.** `startApp` is a plain function. There is no registry or
  runtime lookup, so everything stays type-checked.

All environment variables are read in one small module,
`app/src/lib/config.ts`. Do not read `import.meta.env` anywhere else:

```ts
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseKey:
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY,
  powersyncUrl: import.meta.env.VITE_POWERSYNC_URL,
  isOfflineMode: import.meta.env.VITE_OFFLINE_MODE === "true",
  isDevelopment: import.meta.env.DEV,
  devEmail: import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? "") : "",
  devPassword: import.meta.env.DEV ? (import.meta.env.VITE_DEV_PASSWORD ?? "") : "",
};
```

The browser only ever gets the Supabase _publishable_ key. The secret key must
never be placed in `app/.env.local`, because every `VITE_` variable ends up in
the JavaScript bundle.

### 3. The mount contract

Before looking at routing, you need to know the shape that every piece of UI
in this project shares. It is defined in `app/src/lib/types.ts`:

```ts
export type Dispose = () => void;
export type Mount<Props = void> = (el: HTMLElement, props: Props) => Dispose | void;
```

A _mount function_ receives a host element and its props, renders into the
host, and returns a cleanup function. The cleanup function removes event
listeners, cancels subscriptions and clears the rendered content. Whoever
called the mount function keeps the `Dispose` and calls it before reusing the
host element.

This replaces the component lifecycle you may know from React or Vue. If you
forget to dispose, listeners leak, or a slow network response draws into a
page the user has already left. That is why async pages such as `LoginPage`
and `DocsPage` keep a local `disposed` flag and check it before rendering.

The [Rendering patterns](./rendering-patterns.md) page explains the three
component styles built on top of this contract.

### 4. Routes, layouts and page swapping

`AppRoot` in `app/src/lib/AppRoot.ts` registers each route with the router.
It receives only `router`, `guardRoute`, `layouts` and `pages`. A small `route`
helper first asks the route guard whether the page may render, then the
handler either redirects or hands the page to the layout manager:

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

`AppRoot` only registers routes; it does not render anything by itself. Once
it returns, `main.ts` triggers the first render: directly with `router.check()`
in offline mode, or through `bootstrapAuth` online (see section 2).
Its returned `Dispose` disposes the layout manager.

The layout manager in `app/src/lib/layoutManager.ts` is where the mount
contract is enforced. It disposes the current page, replaces the layout only
when the layout actually changes, and mounts the new page into the layout's
`contentSlot`:

```ts
const updateDOM = () => {
  if (currentRevision !== revision) return;
  disposePage?.();
  disposePage = undefined;
  if (layoutFactory !== next.layout || !layoutInstance) {
    layoutInstance?.dispose?.();
    layoutInstance = next.layout(container);
    layoutFactory = next.layout;
  }
  transitionEnabled = next.transition ?? false;
  disposePage = next.page(layoutInstance.contentSlot) || undefined;
};
```

Because the layout survives page changes, moving from `/my-todos` to
`/docs/introduction` keeps the sidebar on screen. Only the content area is
replaced. When the app switches between the login layout and the main layout,
the change is animated with the View Transition API, unless the user prefers
reduced motion. The `revision` counter makes sure that a slow, superseded
transition can never mount an outdated page.

The router itself lives in `packages/router/src/router.ts`. It listens to the
browser's Navigation API `navigate` event and matches URLs with `URLPattern`.
Because it intercepts ordinary same-origin navigations, a plain
`<a href="/docs/get-started">` link works as an in-app navigation without any
click handler. For navigation from code, call `router.navigate(path)`.

### 5. Authentication

Authentication is split into three small pieces, each with one job.

**`AuthService`** (`app/src/lib/auth/AuthService.ts`) wraps the Supabase
client, which stays private. It subscribes to Supabase's `onAuthStateChange`
once, in its constructor, caches the current session so it can be read
synchronously, and fans each event out to its own listeners:

```ts
constructor(private readonly client: SupabaseClient) {
  client.auth.onAuthStateChange(async (event, session) => {
    this.currentSession = session;
    await Promise.all([...this.listeners].map((listener) => listener(event, session)));
  });
}
// …
/** Subscribe to session changes. Returns an unsubscribe function. */
onAuthStateChange(listener: AuthStateListener) {
  this.listeners.add(listener);
  return () => {
    this.listeners.delete(listener);
  };
}
```

`login()` and `logout()` do not touch the cached session themselves: Supabase
emits `SIGNED_IN` or `SIGNED_OUT`, and that single subscription updates it. The
sidebar registers a listener with `authService.onAuthStateChange` to show the
signed-in user's account menu. `ready` is a read-only getter that becomes
`true` once `init()` has read the stored session.

**`createAuthGuard`** (`app/src/lib/auth/authGuard.ts`) is a pure function
that decides whether the current path must redirect. It returns a
`RouteGuard`, which returns `true` when the route must not render:

```ts
export function createAuthGuard(auth: GuardAuth, nav: GuardNavigator): RouteGuard {
  return function guardRoute(path) {
    if (!auth.ready) {
      return true;
    }

    if (!auth.isAuthenticated && path !== "/auth") {
      nav.navigate("/auth");
      return true;
    }

    if (auth.isAuthenticated && path === "/auth") {
      nav.navigate("/");
      return true;
    }

    return false;
  };
}
```

Notice that it returns `true` ("stop rendering") while auth is not ready yet.
Nothing is drawn until the app knows whether a user is signed in, so the login
page never flashes on screen for a user who is already signed in.

**`bootstrapAuth`** (`app/src/lib/auth/bootstrapAuth.ts`) runs the startup
sequence in online mode and connects auth events to the rest of the app.
`main.ts` calls it after `AppRoot` has registered the routes:

```ts
try {
  await authService.init();

  authService.onAuthStateChange(async (event, session) => {
    await syncLifecycle.handleAuthEvent(event, session);
    guardRoute(router.path);
  });

  await syncLifecycle.start(authService.session);

  if (!guardRoute(router.path)) {
    router.check();
  }
} catch (error) {
  console.error("Failed to bootstrap authentication", error);
  router.navigate("/auth");
}
```

Read it in order: restore the saved session from browser storage, subscribe
to future auth changes, start sync if a user is already signed in, and finally
re-run the current route now that auth is ready. If anything fails, the user
is sent to the login page.

Signing in and out then works like this:

- **Sign in.** `LoginPage` calls its `login` callback, which calls
  `authService.login()` and Supabase's `signInWithPassword()`. Supabase fires
  a `SIGNED_IN` event. The handler above connects sync, and the guard sees an
  authenticated user on `/auth` and redirects to `/`.
- **Sign out.** The sidebar's account menu calls `authService.logout()`.
  Supabase fires `SIGNED_OUT`. Sync is reset, which wipes the local database,
  and the guard redirects to `/auth`.

### 6. The local database and sync

This is the heart of the app. The code lives in `app/src/lib/sync/`.

#### The client schema

PowerSync needs to know which tables exist locally. The schema in
`app/src/lib/sync/schema.ts` is **generated** from the sync config with
`npm run schema:generate`. Do not edit it by hand.

```ts
const todos = new Table(
  {
    // id column (text) is automatically included
    created_at: column.text,
    completed_at: column.text,
    description: column.text,
    completed: column.integer,
    created_by: column.text,
    completed_by: column.text,
    list_id: column.text,
  },
  { indexes: {} },
);
```

SQLite has fewer data types than Postgres, so values are mapped:

- The `id` column is added automatically as text. Never declare it yourself.
- Booleans are stored as integers, `0` or `1`.
- Timestamps and UUIDs are stored as text.

#### Creating the database

`createPowerSync()` in `app/src/lib/sync/client.ts` opens the database file in
the browser:

```ts
export function createPowerSync() {
  return new PowerSyncDatabase({
    database: {
      dbFilename: "supa-app.db",
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    },
    schema: AppSchema,
  });
}
```

`OPFSCoopSyncVFS` stores the database in the Origin Private File System and
lets several browser tabs share it. Queries use SQL strings through the
`PowerSyncDatabase` instance.

#### When to connect: `syncLifecycle`

`createSyncLifecycle()` in `app/src/lib/sync/syncLifecycle.ts` decides when to
connect and when to clear. It knows nothing about routing; `bootstrapAuth`
feeds it auth events through `handleAuthEvent(event, session)`:

```ts
export function createSyncLifecycle(sync: SyncControls) {
  let connectedUserId: string | null = null;

  async function connectFor(session: Session) {
    if (connectedUserId === session.user.id) {
      return;
    }

    connectedUserId = session.user.id;
    try {
      await sync.connect();
    } catch (error) {
      connectedUserId = null;
      console.error("Failed to connect sync", error);
    }
  }
  // …
```

The `connectedUserId` check matters. Supabase fires `SIGNED_IN` often, for
example when the tab regains focus. Calling `powersync.connect()` every time
would open extra sync connections, so the lifecycle connects once per user.
On `SIGNED_OUT` it calls `reset`, which `main.ts` maps to
`powersync.disconnectAndClear()`. That wipes the local database, so the next
person who signs in on the same browser cannot see the previous user's data.

#### Talking to the backend: `SupabasePowerSyncConnector`

The PowerSync SDK expects a _connector_ with two methods. The implementation
is in `app/src/lib/sync/SupabasePowerSyncConnector.ts`.

`fetchCredentials()` tells PowerSync where the service is and which token to
present. The Supabase access token doubles as the PowerSync token:

```ts
  async fetchCredentials() {
    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }

    if (!session) {
      throw new Error("Could not fetch Supabase credentials: no active session");
    }

    return {
      endpoint: this.powersyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }
```

`uploadData()` is called by the SDK whenever the upload queue has pending
changes. It takes the next local transaction and sends all of its operations
to Supabase in a single RPC call:

```ts
  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    try {
      const { error } = await this.client.rpc("process_powersync_crud", {
        ops: transaction.crud.map((entry) => ({
          op: entry.op,
          table: entry.table,
          id: entry.id,
          opData: entry.opData,
        })),
      });
      if (error) {
        error.message = `Could not update Supabase. Received error: ${error.message}`;
        throw error;
      }
    } catch (error: unknown) {
      if (!isFatalError(error)) throw error;
      console.error("Data upload error - discarding:", transaction.crud, error);
    }
    await transaction.complete();
  }
```

The error handling is the subtle part, so read it carefully:

- **Transient errors** (the network is down, the server returned a 5xx) are
  re-thrown. The transaction stays in the queue and the SDK retries later.
  This is how writes made offline survive until the connection returns.
- **Fatal errors** can never succeed on retry. These are Postgres codes
  `22xxx` (invalid data), `23xxx` (constraint violation) and `42501`
  (permission denied, which is what an RLS rejection looks like). Because the
  queue is processed strictly in order, one stuck transaction would block
  every later write forever. So the connector logs the transaction, calls
  `transaction.complete()` to drop it, and lets the server's version of the
  data win on the next sync.

`transaction.complete()` is what removes a transaction from the queue. If it
is never called, the queue stalls.

### 7. A feature end to end: My Todos

The todo feature lives in `app/src/pages/my-todos/`.

#### `TodoStore`: the data access layer

`TodoStore` is the only code that knows the SQL for lists and todos. Reads use
`watch()`, which returns an async iterable that yields a new result every time
the underlying tables change:

```ts
  watchUserLists(options?: { signal?: AbortSignal }) {
    return this.db.watch(
      `SELECT
        lists.*,
        todos.id AS item_id,
        -- … the remaining todo columns, each aliased as item_<column>
      FROM lists
      LEFT JOIN todos ON todos.list_id = lists.id
      ORDER BY
        lists.created_at ASC,
        lists.id ASC,
        todos.created_at ASC,
        todos.id ASC`,
      [],
      options,
    );
  }
```

It does not matter whether the change came from the user's own click or from
a sync download: the watch fires either way. That is how the screen stays up
to date without any extra event plumbing. The query returns one flat row per
todo, and `mapTodoLists()` groups those rows back into lists with `items`.

Writes are plain SQL against the local database:

```ts
  async createTodo(todo: NewTodo) {
    return await this.db.execute(
      "INSERT INTO todos (id, description, list_id, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        todo.description,
        todo.listId,
        todo.createdBy,
        new Date().toISOString(),
      ],
    );
  }

  // …

  async deleteList(listId: string) {
    await this.db.execute("DELETE FROM todos WHERE list_id = ?", [listId]);
    return await this.db.execute("DELETE FROM lists WHERE id = ?", [listId]);
  }
```

Three details here are typical of local-first code:

- **IDs are created in the browser** with `crypto.randomUUID()`. A row must
  have an ID before the server has ever seen it, otherwise offline creation
  would be impossible.
- **Timestamps are ISO strings**, and `setTodoCompleted()` writes
  `completed ? 1 : 0` because booleans are integers locally.
- **Children are deleted explicitly.** Postgres has `on delete cascade` on
  `todos.list_id`, but PowerSync's local tables have no foreign keys. Deleting
  the todos first keeps the local data correct immediately, even offline.

#### `MyTodosPage`: consuming the watch

`MyTodosPage` (`app/src/pages/my-todos/index.ts`) reads the watch with a
`for await` loop. An `AbortController` ties the query's lifetime to the
page's lifetime:

```ts
void (async () => {
  try {
    for await (const result of store.watchUserLists({ signal: abortController.signal })) {
      if (!abortController.signal.aborted) {
        syncCards(result.array as ListWithTodoRow[]);
      }
    }
  } catch (error) {
    if (!abortController.signal.aborted) {
      console.error("Failed to watch todos", error);
    }
  }
})();

return () => {
  if (abortController.signal.aborted) return;
  abortController.abort();
  // … remove listeners and destroy the cards
  render(nothing, el);
};
```

#### Reconciling cards without losing focus

You might expect `syncCards()` to simply re-render every list with Lit. It
does not, and the reason is worth understanding. A sync update can arrive
while the user is typing a new list name. If the card were recreated, the
input would lose focus and the user would lose their edit.

Instead, `MyTodos` keeps one controller per list ID. Existing cards receive an
`update()` call, new cards are created, and cards for deleted lists are
destroyed:

```ts
lists.forEach((list, index) => {
  let card = cardsByListId.get(list.id);

  if (card) {
    card.update(list);
  } else {
    card = TodoListCard(document.createElement("article"), list, cardOptions);
    cardsByListId.set(list.id, card);
    if (hasRenderedLists) addedCard ??= card.element;
  }

  const elementAtIndex = track.children[index] ?? null;
  if (elementAtIndex !== card.element) track.insertBefore(card.element, elementAtIndex);
});
```

Each `TodoListCard` is an _imperative functional component_: it owns its DOM,
its editing state and its focus handling, and it exposes `update()` and
`destroy()`. The todo items inside a card are rendered by `TodoList`, a
_mounted Lit template_ that uses Lit's `repeat()` directive keyed by todo ID.
See [Rendering patterns](./rendering-patterns.md) for when to choose which
style.

### 8. Component communication with a status source

Sometimes a component deep in the tree needs live data that lives near the
root. The sync status indicator in the sidebar footer is the example here: it
needs the PowerSync status, but the PowerSync database is created in
`main.ts`. Passing `powersync` itself down through the layout and the sidebar
would couple all of them to an SDK they do not use.

Instead, `app/src/lib/sync/syncStatus.ts` defines a small read-only interface
and a factory that adapts PowerSync to it:

```ts
/** Read-only view of the PowerSync connection state for UI components. */
export type SyncStatusSource = {
  current: () => SyncStatus;
  subscribe: (listener: (status: SyncStatus) => void) => Dispose;
};
```

`main.ts` creates it once with `createSyncStatusSource(powersync)` and passes it
as the `syncStatus` dependency to `SidebarLayout`, which hands it to `Sidebar`,
which passes it to `SyncStatusIndicator(el, syncStatus)`. The indicator
renders the current value, subscribes to changes, and unsubscribes when it is
disposed:

```ts
const unsubscribe = syncStatus.subscribe(renderComponent);
renderComponent(syncStatus.current());

return () => {
  if (disposed) return;
  disposed = true;
  unsubscribe();
  render(nothing, el);
};
```

The shell only imports the `SyncStatusSource` and `SyncStatus` types, so it
never touches the PowerSync SDK at runtime, and a test can pass a plain fake
object with `current` and `subscribe`.

## Backend walkthrough

Everything on the server side lives in `stack/`. Schema changes are made with
SQL migrations in `stack/supabase/migrations/`.

### Tables and row-level security

There are two tables. `lists` has an `owner_id` that references
`auth.users`. `todos` belongs to a list through `list_id` and records who
created and who completed it.

Tables in the `public` schema are reachable through Supabase's Data API, so
both tables have RLS enabled. The current policies come from
`20261020115826_consolidate_todo_rls.sql`:

```sql
create policy "Users can manage todos in their own lists"
on public.todos
for all
to authenticated
using (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.lists
    where public.lists.id = public.todos.list_id
      and public.lists.owner_id = (select auth.uid())
  )
);

-- …

create policy "Todos are created by the current user"
on public.todos
as restrictive
for insert
to authenticated
with check (created_by = (select auth.uid()));
```

Normal (permissive) policies are combined with OR. Policies marked
`as restrictive` are combined with AND on top of them. So a new todo must be
in one of the user's own lists **and** name the user as its creator. Nobody
can sign someone else's name on a todo.

### The upload endpoint: `process_powersync_crud`

The connector does not call a separate REST endpoint for each table. It sends
the whole transaction to one Postgres function, defined in
`20260412100000_process_powersync_crud.sql`:

```sql
create or replace function public.process_powersync_crud(ops jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
-- …
  for item in select value from jsonb_array_elements(ops)
  loop
    table_name := item ->> 'table';
    operation := item ->> 'op';
    row_id := item ->> 'id';
    op_data := coalesce(item -> 'opData', '{}'::jsonb);

    if jsonb_typeof(item) is distinct from 'object'
      or table_name not in ('lists', 'todos')
      or row_id is null
      or jsonb_typeof(op_data) is distinct from 'object'
    then
      raise exception 'Invalid PowerSync CRUD operation'
        using errcode = '22023';
    end if;

    case operation
      when 'PUT' then
        -- insert … on conflict (id) do update (an upsert)
      when 'PATCH' then
        -- update only the columns present in opData
      when 'DELETE' then
        execute format(
          'delete from public.%I where id = $1::uuid',
          table_name
        )
        using row_id;
-- …
$$;

revoke all on function public.process_powersync_crud(jsonb) from public, anon;
grant execute on function public.process_powersync_crud(jsonb) to authenticated, service_role;
```

Points worth knowing:

- **`security invoker`** means the function runs as the calling user, so the
  RLS policies above apply to every statement inside it. Never change this to
  `security definer`; that would bypass RLS for every upload.
- **The table allow-list** `('lists', 'todos')` rejects writes to any other
  table. A new synced table has to be added here, or its uploads will fail.
- **Safe dynamic SQL.** Table and column names are quoted with `format('%I')`
  and values are passed with `using`, never concatenated into the SQL string.
- **Type conversion.** The PUT and PATCH branches read values through
  `jsonb_populate_record`, which converts JSON values into the table's column
  types. For example, SQLite's `1` becomes Postgres `true`.
- **All or nothing.** The function runs in a single database transaction, so
  one bad operation rolls back the whole upload. Its own validation errors use
  code `22023`, which the connector treats as fatal.

### Replication: role and publication

PowerSync reads changes from Postgres's write-ahead log through logical
replication. It connects as a dedicated, least-privilege role
(`20261020115822_powersync_role.sql`):

```sql
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'powersync_role') then
    create role powersync_role with replication bypassrls;
  end if;
end $$;

grant usage on schema public to powersync_role;
grant select on public.lists, public.todos to powersync_role;
```

`bypassrls` lets PowerSync see every row it replicates. That is safe because
per-user filtering happens in the sync config instead (see the next section).
The publication (`20261020115827_explicit_powersync_publication.sql`) lists
exactly which tables are replicated:

```sql
drop publication if exists powersync;
create publication powersync for table public.lists, public.todos;
```

### Who gets which rows: `sync-config.yaml`

`stack/powersync/sync-config.yaml` decides which rows each user downloads:

```yaml
config:
  edition: 3
streams:
  user_data:
    auto_subscribe: true
    queries:
      - SELECT * FROM lists WHERE owner_id = auth.user_id()
      - SELECT todos.* FROM todos INNER JOIN lists ON todos.list_id = lists.id WHERE lists.owner_id = auth.user_id()
```

`auth.user_id()` is the `sub` claim of the user's JWT, which is the Supabase
user ID. Todos have no owner column, so the second query reaches the owner
through the list.

Think of this file as RLS for the download direction. Keep it consistent with
the database policies: if the two disagree, users either see rows they cannot
edit or can edit rows they cannot see.

### Trusting the JWT: `service.yaml`

The PowerSync service has to verify the token that the app sends from
`fetchCredentials()`. It fetches Supabase's public signing keys (JWKS) and
only accepts tokens issued for the `authenticated` audience:

```yaml
client_auth:
  # Local Supabase runs on the host machine, so the containerized PowerSync
  # service must reach its JWKS via host.docker.internal.
  jwks_uri: http://host.docker.internal:54321/auth/v1/.well-known/jwks.json
  # …
  audience: ["authenticated"]
```

## The life of a todo

Here is everything above in one story. A signed-in user types "Buy milk" into
a list and presses Enter.

1. The form in `TodoList` is submitted. `TodoList` trims the text and calls
   the `onAddTodo(listId, description)` callback that `MyTodos` passed down.
2. `MyTodos` calls `store.createTodo()`, which runs an `INSERT` against local
   SQLite. It completes almost instantly, with or without a network.
3. PowerSync records a `PUT` operation in the upload queue. At the same time
   the `watch()` query notices that `todos` changed and yields new rows.
   `syncCards()` calls `update()` on the existing card, and the new item
   appears on screen.
4. When the device is online, the SDK calls `uploadData()`. The connector
   sends the operation to `process_powersync_crud`, which runs as the user.
   RLS checks that the list belongs to the user and that `created_by` is the
   user.
5. Postgres commits the row. The change appears in the write-ahead log, and
   the PowerSync service picks it up through the `powersync` publication.
6. The `user_data` stream matches the row to its owner. PowerSync sends it to
   every device where that user is signed in, and their watch queries fire.
7. On the original device the server's copy confirms the local one, and the
   sync indicator in the sidebar returns from "Syncing..." to
   "Synced".

## Conventions to follow

- **Wire dependencies in `main.ts`.** Pass callbacks or narrow interfaces
  (often written as `Pick<Service, "method">`) to pages and components. Do not
  import runtime singletons. Concrete services are created only in `main.ts`;
  pass narrow handles from there rather than raw services.
- **Return a `Dispose`** from every mount that owns listeners, subscriptions
  or async work. Dispose children before their parent. In async code, check a
  `disposed` flag before rendering.
- **Give each piece of DOM one owner.** Do not mutate DOM by hand that a
  parent Lit `render()` may recreate.
- **Keep CSS next to its component**, for example `import "./sidebar.css"` in
  `Sidebar.ts`. Component styles use `@scope` and semantic design tokens. Only
  Tailwind, tokens and base styles belong in `app/src/css/index.css`.
- **Write UI text in Finnish.** This covers buttons, labels, `aria-label`s and
  status messages. Documentation and user-entered content keep their original
  language.
- **Read environment variables only in `config.ts`**, and never put the
  Supabase secret key in the browser app.

Some of these conventions are enforced by oxlint. The rules live in the
`packages/oxlint-plugin` workspace package (`recommended.json`), which the root
`.oxlintrc.json` extends:

- `no-restricted-imports` blocks runtime imports of the Supabase, PowerSync and
  router packages from `src/pages/` and `src/lib/shell/`. It also blocks
  importing the infrastructure modules (`AuthService`, `bootstrapAuth`,
  `authGuard`, the connector, `syncLifecycle`, `syncStatus`, `sync/client.ts`)
  anywhere except `app/src/lib/main.ts` and tests. Type-only imports are
  allowed.
- `supa/no-import-meta-env-outside-config` is a custom rule in the same package.
  JS plugins are an alpha oxlint feature, so keep the plugin small.

## Testing and quality checks

Run `npm run check` before you push. It runs oxlint, the style convention
checker (`npm run lint:styles`, see `packages/docs/styling.md`), the `oxfmt`
format check, strict TypeScript, knip (unused files, exports and dependencies)
and the Vitest unit tests. CI runs the same steps except the format check.

Tests sit next to the code they test, as `*.test.ts` files. Because
dependencies are injected, most tests are small Node tests that pass in fakes.
This one, from `app/src/lib/sync/syncLifecycle.test.ts`, checks the "connect
once per user" rule:

```ts
it("connects once per user across repeated SIGNED_IN events", async () => {
  const lifecycle = createSyncLifecycle(sync);

  await lifecycle.start(sessionFor("a"));
  await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));
  await lifecycle.handleAuthEvent("SIGNED_IN", sessionFor("a"));

  expect(sync.connect).toHaveBeenCalledOnce();
});
```

`app/src/lib/lifecycle.test.ts` uses Happy DOM to test mount and dispose
ordering, late async responses and stale transitions. To run a single file,
pass its path: `npm test -- app/src/lib/sync/syncLifecycle.test.ts`. Unit
tests do not cover CSS or responsive layout, so check those in a real browser.

## Common tasks

### Adding a page

1. Create `app/src/pages/<name>/index.ts` that exports a mount function
   returning `Dispose`.
2. Add the page to `AppPages` and register its route with the `route` helper in
   `app/src/lib/AppRoot.ts`.
3. Bind its dependencies in the `pages` object in `main.ts`.
4. If it needs a sidebar entry, add one to `app/src/lib/nav/navConfig.ts`.

### Adding a synced table

The full checklist is in `stack/README.md`. In short:

1. Create a migration with
   `npx --no-install supabase migration new <name> --workdir=stack`. In it,
   create the table, enable RLS with policies, index the foreign keys, run
   `grant select on public.<table> to powersync_role;` and add the table to
   the `powersync` publication.
2. In a new migration, replace `process_powersync_crud` with a version whose
   allow-list includes the new table.
3. Add a query for the table to `stack/powersync/sync-config.yaml`, then check
   it with `npx --no-install powersync validate --directory=stack/powersync`.
4. Regenerate the client schema with `npm run schema:generate`.
5. Apply the migrations with
   `npx --no-install supabase db push --local --workdir=stack`, and restart
   PowerSync with
   `npx --no-install powersync docker reset --directory=stack/powersync` so it
   loads the new sync config.

## Gotchas

- **Seed data is missing after `npm run stack:up`.** If Supabase prints
  `Starting database from backup...`, it reused an old local database. Run
  `npx --no-install supabase db reset --local --workdir=stack`. This deletes
  local data, including users.
- **PowerSync returns HTTP 500 after a database reset.** PowerSync keeps its
  own storage in the same local Postgres, and the reset removed it. Run
  `npx --no-install powersync docker reset --directory=stack/powersync`.
- **A change "reverts itself".** The server probably rejected the upload as
  fatal, and the server's data won on the next sync. Look for
  `Data upload error - discarding` in the browser console.
- **Only call `powersync.connect()` from the sync lifecycle.** Calling it
  elsewhere opens duplicate sync connections.
- **Never edit `schema.ts` by hand.** It is overwritten by
  `npm run schema:generate`.
- **Use a current browser.** The router depends on the Navigation API and
  `URLPattern`, and the database depends on OPFS.

## Where to go next

- [Rendering patterns](./rendering-patterns.md) explains the three component
  styles in depth, with real code examples from the app.
- [Styling and CSS](./styling.md) covers the design token system, native
  `@scope` encapsulation, and the 3-level component styling hierarchy.
- [Cheatsheets](./cheatsheets.md) provides a quick-reference table for semantic
  design tokens, `@theme` scales, and CSS helper scripts.
- `README.md`, `app/README.md` and `stack/README.md` in the repository cover
  setup, architecture notes and backend workflows in more detail.
- `TODO.md` describes the ongoing maintainability work and the reasoning
  behind many of the current conventions.
- External documentation: [PowerSync](https://docs.powersync.com),
  [Supabase](https://supabase.com/docs) and [Lit](https://lit.dev/docs/).
