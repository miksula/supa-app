/// <reference lib="dom" />

// Navigation API types for TypeScript support
type NavigateEvent = Event & {
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: { filename: string } | null;
  destination: { url: string };
  navigationType?: "push" | "reload" | "replace" | "traverse";
  intercept(
    options: {
      handler?: () => Promise<void>;
      focus?: string;
      scroll?: { x: number; y: number };
    },
  ): void;
};

declare global {
  interface Window {
    navigation: {
      addEventListener(event: string, handler: (event: Event) => void): void;
      navigate(
        url: string,
        options?: { state?: unknown },
      ): { finished: Promise<void>; committed: Promise<void> };
      currentEntry: {
        url: string;
        getState(): unknown;
        key: string;
        index: number;
      } | null;
    };
  }
  var navigation: Window["navigation"];
}

class RouteContext {
  public params: Record<string, string>;
  public path: string;
  private searchParams: URLSearchParams;

  constructor(path: string, params: Record<string, string | undefined> = {}) {
    this.path = path;
    // Filter out undefined values and convert to Record<string, string>
    this.params = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined),
    ) as Record<string, string>;
    this.searchParams = new URLSearchParams(location.search);
  }

  param(key?: string): string | Record<string, string> | undefined {
    if (key) {
      return this.params[key];
    }
    return this.params;
  }

  search(key?: string): string | Record<string, string> {
    if (key) {
      return this.searchParams.get(key) || "";
    }
    const result: Record<string, string> = {};
    this.searchParams.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

type RouterOptions = {
  root?: string;
};

type RouteHandler = (context: RouteContext) => void | Promise<void>;

type AsyncRouteHandler = (context: RouteContext) => Promise<void>;

type RouteItem = {
  pattern: URLPattern;
  handler: RouteHandler;
};

type AsyncRouteItem = {
  pattern: URLPattern;
  handler: AsyncRouteHandler;
};

const SPA_NAVIGATION_TYPES = new Set(["push", "replace", "traverse"]);

export class Router {
  private routes: RouteItem[] = [];
  private asyncRoutes: AsyncRouteItem[] = [];
  private root = "/";
  private routeCheckHandlers: ((path: string) => void)[] = [];

  constructor(options: RouterOptions = {}) {
    if (options.root) {
      this.root = this.clearSlashes(options.root);
    }

    // Listen for all navigation events
    const navListener = (event: Event) => {
      const navEvent = event as NavigateEvent;
      const url = new URL(navEvent.destination.url);

      // Skip non-interception cases
      if (
        !navEvent.canIntercept || navEvent.hashChange ||
        navEvent.downloadRequest !== null ||
        url.origin !== globalThis.location.origin ||
        (navEvent.navigationType !== undefined &&
          !SPA_NAVIGATION_TYPES.has(navEvent.navigationType))
      ) {
        return;
      }

      const pathname = url.pathname + url.search;

      // Check async routes first, then sync routes
      if (
        this.matchAsyncRoute(pathname, navEvent) ||
        this.matchSyncRoute(pathname, navEvent)
      ) {
        // Route matched and handled
      }
    };

    (globalThis as unknown as Window).navigation.addEventListener(
      "navigate",
      navListener,
    );
  }

  clearSlashes(path: string) {
    return path.replace(/\/$/, "").replace(/^\//, "");
  }

  getPath() {
    // Use Navigation API's current entry as source of truth
    const nav = (globalThis as unknown as Window).navigation;
    if (nav && nav.currentEntry) {
      const url = new URL(nav.currentEntry.url ?? globalThis.location.href);
      let pathname = url.pathname + url.search;

      // Remove query string for return value
      pathname = pathname.replace(/\?(.*)$/, "");

      // Handle root path
      if (this.root && this.root !== "/") {
        const rootPattern = new RegExp(`^\\/${this.clearSlashes(this.root)}`);
        if (rootPattern.test(pathname)) {
          pathname = pathname.replace(rootPattern, "");
        }
      }

      return (pathname || "/").replace(/\/$/, "") || "/";
    }

    // Fallback for initial load
    const pathname = decodeURI(globalThis.location?.pathname || "/");
    const search = globalThis.location?.search || "";
    let fragment = this.clearSlashes(pathname + search);
    fragment = fragment.replace(/\?(.*)$/, "");
    return this.root + this.clearSlashes(fragment);
  }

  get path() {
    return this.getPath();
  }

  private matchAsyncRoute(pathname: string, event: NavigateEvent): boolean {
    const pathWithRoot = pathname.startsWith("/") ? pathname : "/" + pathname;

    for (const route of this.asyncRoutes) {
      const testUrl = `${location.protocol}//${location.host}${pathWithRoot}`;
      const result = route.pattern.exec(testUrl);

      if (result) {
        const params = result.pathname.groups;
        const context = new RouteContext(pathWithRoot, params);

        event.intercept({
          handler: async () => {
            await route.handler(context);

            for (const handler of this.routeCheckHandlers) {
              handler(this.path);
            }
          },
        });
        return true;
      }
    }
    return false;
  }

  private matchSyncRoute(pathname: string, event: NavigateEvent): boolean {
    const pathWithRoot = pathname.startsWith("/") ? pathname : "/" + pathname;

    for (const route of this.routes) {
      const testUrl = `${location.protocol}//${location.host}${pathWithRoot}`;
      const result = route.pattern.exec(testUrl);

      if (result) {
        const params = result.pathname.groups;
        const context = new RouteContext(pathWithRoot, params);

        event.intercept({
          handler: () => {
            return Promise.resolve(route.handler(context)).then(() => {
              for (const handler of this.routeCheckHandlers) {
                handler(this.path);
              }
            });
          },
        });

        return true;
      }
    }
    return false;
  }

  add(path: string, handler: RouteHandler) {
    if (!handler) {
      throw new Error("Handler is required");
    }

    // Append automatic trailing slash handling
    const patternPath = path.endsWith("/") ? path : `${path}{/}?`;

    try {
      // Create URLPattern with pathname only
      const pattern = new URLPattern({ pathname: patternPath });
      this.routes.push({ pattern, handler });
    } catch (error) {
      throw new Error(
        `Invalid URLPattern syntax for path "${path}": ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this;
  }

  // alias for `add()`
  get(path: string, handler: RouteHandler) {
    return this.add(path, handler);
  }

  check(f?: string) {
    const fragment = f || this.getPath();

    // Try async routes first
    for (const route of this.asyncRoutes) {
      const testUrl = `${location.protocol}//${location.host}${fragment}`;
      const result = route.pattern.exec(testUrl);

      if (result) {
        const params = result.pathname.groups;
        const context = new RouteContext(fragment, params);
        const promise = route.handler(context);

        promise.then(() => {
          for (const handler of this.routeCheckHandlers) {
            handler(this.path);
          }
        });

        return promise;
      }
    }

    // Fall back to sync routes
    for (const route of this.routes) {
      const testUrl = `${location.protocol}//${location.host}${fragment}`;
      const result = route.pattern.exec(testUrl);

      if (result) {
        const params = result.pathname.groups;
        const context = new RouteContext(fragment, params);
        const handlerResult = route.handler(context);

        for (const handler of this.routeCheckHandlers) {
          handler(this.path);
        }

        return handlerResult;
      }
    }

    return null;
  }

  addRouteListener(callback: (path: string) => void) {
    this.routeCheckHandlers.push(callback);
    return this;
  }

  /**
   * The removeRouteListener removes given callback from the internal handler list. Used to prevent
   * memory leaks and duplicate listeners when components are added/removed from the DOM.
   * @param callback The callback function to remove
   * @returns The router instance for chaining
   */
  removeRouteListener(callback: (path: string) => void) {
    this.routeCheckHandlers = this.routeCheckHandlers.filter((handler) =>
      handler !== callback
    );
    return this;
  }

  removeAllRouteListeners() {
    this.routeCheckHandlers = [];
    return this;
  }

  navigate(path: string = "", options?: { state?: unknown }) {
    const page = this.root + this.clearSlashes(path);
    const nav = (globalThis as unknown as Window).navigation;
    nav.navigate(page, options).finished.then(() => {
      // Navigation completed
    }).catch((err: unknown) => {
      console.error("Navigation failed:", err);
    });
    return this;
  }

  addAsync(path: string, handler: AsyncRouteHandler) {
    if (!handler) {
      throw new Error("Handler is required");
    }

    const patternPath = path.endsWith("/") ? path : `${path}{/}?`;

    try {
      const pattern = new URLPattern({ pathname: patternPath });
      this.asyncRoutes.push({ pattern, handler });
    } catch (error) {
      throw new Error(
        `Invalid URLPattern syntax for path "${path}": ${error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    return this;
  }
}

export type RouterType = typeof Router;

const router = new Router();
export default router;
