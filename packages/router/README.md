# Router

A lightweight, TypeScript-based client-side router for single-page applications
(SPAs). This router provides essential routing functionality with support for
both intuitive string-based patterns (e.g., `/users/:id`) and powerful regular
expressions. It integrates with the browser's modern Navigation API for seamless
navigation and state management.

## Features

- **URLPattern-Based Routing** - Leverage the modern URL Pattern API with
  intuitive syntax for named parameters (e.g., `/posts/:id`).
- **Wildcard Support** - Match multiple path segments with wildcard patterns
  (e.g., `/api/*`).
- **Advanced Patterns** - Support for optional parameters (`?`), repeating
  groups (`+`, `*`), and regex constraints (`:id(\\d+)`).
- **Navigation API Support** - Modern, native browser navigation handling for
  all navigation types (link clicks, back/forward, programmatic).
- **TypeScript Support** - Full type safety and IntelliSense for a better
  developer experience.
- **Lightweight** - Minimal and dependency-free.
- **Configurable Root Path** - Ideal for applications hosted in subdirectories.
- **Sync & Async Handlers** - Support both synchronous callbacks and async route
  handlers for complex loading scenarios.
- **Route Change Callbacks** - Hook into navigation events to update your UI.
- **Automatic Trailing Slash Handling** - Routes automatically match with or
  without trailing slashes.

## Installation

Since this is a standalone module, you can import it directly into your project.

```typescript
import { Router, type RouteContext, type RouterType } from "@packages/router";
```

Importing the package has no side effects. Construct one router in the app's
composition root and pass it to its consumers. `RouterType` describes a router
instance, not the constructor; the package no longer exports a shared singleton.

## Basic Usage

### 1. Creating a Router Instance

```typescript
// Basic router
const router = new Router();

// For an app hosted at "https://example.com/my-app/"
const routerWithRoot = new Router({ root: "/my-app" });
```

### 2. Adding Routes

Routes registered with `addAsync()` are matched before routes registered with
`add()` or `get()`. Within each group, registration order decides the first match.

```typescript
// Simple string-based route
router.add("/about", (context) => {
  console.log("About page");
});

// Route with named parameters
router.add("/users/:id", (context) => {
  const { id } = context.param() as { id: string };
  // Or access a single parameter
  // const id = context.param('id') as string;
  console.log(`User page for ID: ${id}`);
});

// Route with multiple parameters
router.add("/posts/:id/comments/:comment_id", (context) => {
  const params = context.param() as { id: string; comment_id: string };
  console.log(`Post: ${params.id}, Comment: ${params.comment_id}`);
});

// Route with optional parameter
router.add("/products/:category/:id?", (context) => {
  const params = context.param() as { category: string; id?: string };
  console.log(`Category: ${params.category}, ID: ${params.id || "none"}`);
});

// Route with regex constraint (only numeric IDs)
router.add("/items/:id(\\d+)", (context) => {
  const { id } = context.param() as { id: string };
  console.log(`Item ID (numeric): ${id}`);
});

// Wildcard route for nested paths
router.add("/docs/*", (context) => {
  console.log("Documentation page");
});

// Route with search parameters
// Example URL: /users/123?tab=profile&sort=asc
router.add("/users/:id", (context) => {
  const { id } = context.param() as { id: string };
  const { tab, sort } = context.search() as { tab: string; sort: string };
  // Or access a single search parameter
  // const sort = context.search('sort') as string;
  console.log(`User: ${id}, Tab: ${tab}, Sort: ${sort}`);
});

// Catch-all route for 404 pages (must be added last)
router.add("/*", () => {
  console.log("404 - Page not found");
});
```

### 3. Navigation

```typescript
// Navigate to a route
router.navigate("/users/123");

// Navigate with state persistence
router.navigate("/users/123", { state: { scrollPos: 0, tab: "profile" } });

// Navigate to the root
router.navigate("/");
```

The router automatically listens for all browser navigation events including
back/forward button clicks and programmatic navigations.

### 4. Handling Route Changes

You can execute code whenever a route changes, which is useful for updating your
application's main view.

```typescript
router.addRouteListener(() => {
  console.log("Route changed to:", router.path);
  // e.g., renderAppView();
});
```

## API Reference

### `RouteContext`

The `RouteContext` object is passed to every route handler and provides access
to route parameters and search parameters.

#### `param(key?: string): string | Record<string, string> | undefined`

Access URL path parameters from URLPattern routes (e.g., `/users/:id`).

- **With key**: Returns the value of the specified parameter (or `undefined` if
  not found)
  - Example: `context.param('id')` returns `"123"` for URL `/users/123`
- **Without key**: Returns an object with all parameters
  - Example: `context.param()` returns `{ id: "123" }`
  - For unnamed capturing groups, access by index: `context.param()["0"]`

#### `search(key?: string): string | Record<string, string>`

Access URL search/query parameters (e.g., `?tab=profile&sort=asc`).

- **With key**: Returns the value of the specified search parameter (or empty
  string if not found)
  - Example: `context.search('tab')` returns `"profile"` for URL
    `/users/123?tab=profile`
- **Without key**: Returns an object with all search parameters
  - Example: `context.search()` returns `{ tab: "profile", sort: "asc" }`

#### `path: string`

The matched application-relative path, including its search parameters.
`param()` and `search()` both read from that matched destination, not from the
previous page's `location`.

#### `params: Record<string, string>`

Direct access to the parameters object.

### `Router`

#### `new Router(options?: { root?: string })`

Creates a new router instance.

- `options.root`: Base path for the application (defaults to `/`). Routes and
  `navigate()` paths are relative to this root. Native navigation outside the
  root is left to the browser.

#### `add(path: string, handler: RouteHandler): Router`

Adds a new route using URLPattern syntax. Returns the router instance for method
chaining. Throws an error if the pattern syntax is invalid.

- `path`: URLPattern string (e.g., `/users/:id`, `/api/*`, `/items/:id(\\d+)`)
- `handler`: Function that receives a `RouteContext` object
  - Can be synchronous `void` or return `Promise<void>` for async operations

**Pattern Syntax:**

- Named parameters: `:id` captures a path segment
- Optional parameters: `:id?` makes a parameter optional
- Repeating parameters: `:id+` (one or more), `:id*` (zero or more)
- Regex constraints: `:id(\\d+)` only matches digits
- Wildcards: `*` matches any remaining path segments
- Unnamed groups: `/(foo|bar)` captures without a name (access via index)

#### `navigate(path: string, options?: { state?: unknown }): Router`

Programmatically navigates to a path and triggers the route handler.

- `path`: The URL path to navigate to
- `options.state`: Optional state object to persist in the history entry
  - Retrieve with `navigation.currentEntry.getState()` after navigation
  - Useful for preserving UI state when returning to a route

Calling `navigate()` from inside a route handler invalidates notification for
the original route, both through `check()` and through intercepted navigations.
Browser link clicks and history traversal also invalidate stale callbacks.
The destination route still runs and notifies listeners normally. Listeners
that redirect stop the remaining notifications for the old route.

Both Navigation API promises (`committed` and `finished`) are observed.
Expected `AbortError` cancellations are ignored; other failures are reported.

#### `addAsync(path: string, handler: AsyncRouteHandler): Router`

Adds an async route handler using URLPattern syntax. Best for routes that need
to load content asynchronously. Returns the router instance for method chaining.

- `path`: URLPattern string (e.g., `/users/:id`, `/api/*`)
- `handler`: Async function that receives a `RouteContext` object and returns
  `Promise<void>`
  - Automatically integrated with Navigation API's intercept mechanism
  - The navigation won't complete until the promise resolves

```typescript
// Example: Load data before rendering
router.addAsync("/users/:id", async (context) => {
  const id = context.param("id");
  const userData = await fetch(`/api/users/${id}`).then((r) => r.json());
  renderUserPage(userData);
});
```

#### `check(fragment?: string): void | Promise<void> | null`

Manually checks and executes the matching route handler. Required for initial
page load since the route change event doesn't fire on app startup.

If the route handler redirects by calling `navigate()`, the router skips
notifying route listeners for the original route check. This prevents a
redirecting route from rendering with incomplete route state before the
destination route is processed.

Without a fragment, the current URL supplies the path and query. A supplied
fragment is application-relative and does not change the browser URL. Async
handlers are awaited before notifying listeners, including promises returned
through `get()`; their failures propagate to the caller without an extra
unhandled promise. An unmatched route returns `null`.

#### `addRouteListener(callback: (path: string) => void): Router`

Registers a callback that fires after a route change is complete.

- `callback`: Function that receives the current path

#### `removeRouteListener(callback: (path: string) => void): Router`

Removes a previously registered route listener callback.

- `callback`: The same function reference that was passed to `addRouteListener`

#### `path: string` (getter)

Returns the current application-relative pathname, without query or trailing
slashes (except `/`). Falls back to `location` when no Navigation API entry is
available.

#### `dispose(): void`

Removes the global navigation listener, clears registered routes and route
listeners, and invalidates queued callbacks. Repeated calls are safe. Dispose
the router when its owner is removed; create a new instance to mount it again.
Disposal and newer navigations do not cancel work already started inside a
handler: handlers remain responsible for their own late asynchronous side effects.

## Advanced Pattern Examples

URLPattern provides powerful syntax for complex routing scenarios:

```typescript
// Optional segments - matches /products or /products/electronics
router.add("/products/:category?", (context) => {
  const { category } = context.param() as { category?: string };
  console.log(`Category: ${category || "all"}`);
});

// Repeating segments - matches /tags/a or /tags/a/b/c
router.add("/tags/:tag+", (context) => {
  // Note: URLPattern returns the last matched segment for repeating groups
  console.log("Tag route matched");
});

// Regex constraints - only numeric IDs
router.add("/api/v:version(\\d+)/*", (context) => {
  const { version } = context.param() as { version: string };
  console.log(`API version ${version}`);
});

// Unnamed capturing groups
router.add("/(blog|news)/:slug", (context) => {
  const params = context.param() as Record<string, string>;
  console.log(`Type: ${params["0"]}, Slug: ${params.slug}`);
});

// Complex wildcard patterns
router.add("/files/*.{jpg,png,gif}", (context) => {
  console.log("Image file requested");
});
```

## Browser Compatibility

The router uses the native **Navigation API** and **URL Pattern API**, both part
of the web platform baseline (newly available as of 2025):

**Navigation API:**

- **Chrome/Edge**: 102+
- **Firefox**: 147+
- **Safari**: 26+

**URLPattern API:**

- **Chrome/Edge**: 95+
- **Firefox**: 142+
- **Safari**: 26+

### Polyfill for URLPattern (if needed)

If supporting older browsers with the Navigation API, use the
[urlpattern-polyfill](https://github.com/kenchris/urlpattern-polyfill):

```bash
npm install urlpattern-polyfill
```

```typescript
import "urlpattern-polyfill";
```

**Note:** The Navigation API itself has no polyfill. This router requires
browsers with native Navigation API support.

## Integration with Web Components (Lit Example)

Here's a simple example showing how to use the router in a Lit component:

```typescript
import { html, LitElement } from "lit";
import { Router, type RouteContext } from "@packages/router";

export class MyApp extends LitElement {
  private router = new Router();
  private currentView = html` <div>Loading...</div> `;

  constructor() {
    super();

    // Setup routes
    this.router
      .add("/", () => {
        this.currentView = html` <h1>Home</h1> `;
      })
      .add("/about", () => {
        this.currentView = html` <h1>About</h1> `;
      })
      // Sync route handler
      .add("/users/:id", (context: RouteContext) => {
        const id = context.param("id");
        this.currentView = html` <h1>User ${id}</h1> `;
      })
      // Async route handler for complex loading
      .addAsync("/posts/:id", async (context: RouteContext) => {
        const id = context.param("id");
        const post = await fetch(`/api/posts/${id}`).then((r) => r.json());
        this.currentView = html`
          <h1>${post.title}</h1>
          <p>${post.content}</p>
        `;
      })
      .addRouteListener(() => this.requestUpdate());

    // Call check() to handle initial page load
    this.router.check();
  }

  render() {
    return html`
      <nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <a href="/users/123">User 123</a>
      </nav>
      <main>${this.currentView}</main>
    `;
  }
}

customElements.define("my-app", MyApp);
```

**Key concepts:**

- Store a `currentView` property that gets updated by route handlers
- Call `this.requestUpdate()` in the `addRouteListener()` callback to trigger
  re-renders
- Let the router intercept eligible native navigations; no link click listener is needed
- Use `addAsync()` for routes that need to load data before rendering
- Always call `router.check()` on app startup to handle the initial route

## Tests

Run `npm test -- packages/router/src/router.test.ts` from the repository root
with Node 24 or newer for native `URLPattern` support. CI explicitly selects
Node 24. Tests cover matching, params/search, trailing slashes, root paths,
redirects, async supersession, browser cancellation and listener disposal.
