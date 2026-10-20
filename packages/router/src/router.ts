/// <reference lib="dom" />

type AppNavigation = {
  addEventListener(event: string, handler: (event: Event) => void): void;
  removeEventListener(event: string, handler: (event: Event) => void): void;
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

type NavigateEvent = Event & {
  signal?: AbortSignal;
  canIntercept: boolean;
  hashChange: boolean;
  downloadRequest: { filename: string } | null;
  destination: { url: string };
  navigationType?: "push" | "reload" | "replace" | "traverse";
  intercept(options: {
    handler?: () => Promise<void>;
    focus?: string;
    scroll?: { x: number; y: number };
  }): void;
};

const getNavigation = () =>
  (globalThis as typeof globalThis & { navigation?: AppNavigation }).navigation;

export class RouteContext {
  public params: Record<string, string>;
  public path: string;
  private searchParams: URLSearchParams;

  constructor(path: string, params: Record<string, string | undefined> = {}, search = "") {
    this.path = path;
    // Filter out undefined values and convert to Record<string, string>
    this.params = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined),
    ) as Record<string, string>;
    this.searchParams = new URLSearchParams(search);
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

const SPA_NAVIGATION_TYPES = new Set(["push", "replace", "traverse"]);

export class Router {
  private routes: RouteItem[] = [];
  private asyncRoutes: RouteItem[] = [];
  private root = "/";
  private routeCheckHandlers: ((path: string) => void)[] = [];
  private navigationRevision = 0;
  private navigation = getNavigation();
  private navListener: (event: Event) => void;
  private disposed = false;

  constructor(options: RouterOptions = {}) {
    if (options.root) {
      const root = this.clearSlashes(options.root);
      this.root = root ? `/${root}/` : "/";
    }

    // Listen for all navigation events
    this.navListener = (event: Event) => {
      const navEvent = event as NavigateEvent;
      const url = new URL(navEvent.destination.url);
      const revision = ++this.navigationRevision;

      // Skip non-interception cases
      if (
        !navEvent.canIntercept ||
        navEvent.hashChange ||
        navEvent.downloadRequest !== null ||
        url.origin !== globalThis.location.origin ||
        (navEvent.navigationType !== undefined &&
          !SPA_NAVIGATION_TYPES.has(navEvent.navigationType))
      ) {
        return;
      }

      const pathname = this.relativePath(url.pathname);
      if (pathname === null) return;
      const match = this.match(pathname + url.search);
      if (!match) return;

      navEvent.intercept({
        handler: async () => {
          if (revision !== this.navigationRevision || navEvent.signal?.aborted) return;
          await this.runMatch(match, revision, navEvent.signal);
        },
      });
    };

    this.navigation?.addEventListener("navigate", this.navListener);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.navigationRevision++;
    this.navigation?.removeEventListener("navigate", this.navListener);
    this.routes = [];
    this.asyncRoutes = [];
    this.routeCheckHandlers = [];
  }

  clearSlashes(path: string) {
    return path.replace(/^\/+|\/+$/g, "");
  }

  private currentURL() {
    return new URL(this.navigation?.currentEntry?.url ?? globalThis.location.href);
  }

  private relativePath(pathname: string) {
    if (this.root === "/") return pathname;
    if (pathname === this.root.slice(0, -1)) return "/";
    return pathname.startsWith(this.root) ? "/" + pathname.slice(this.root.length) : null;
  }

  getPath() {
    const pathname = this.currentURL().pathname;
    return (this.relativePath(pathname) ?? pathname).replace(/\/+$/, "") || "/";
  }

  get path() {
    return this.getPath();
  }

  private match(pathname: string) {
    const pathWithRoot = pathname.startsWith("/") ? pathname : "/" + pathname;
    const url = new URL(pathWithRoot, globalThis.location.origin);

    for (const route of [...this.asyncRoutes, ...this.routes]) {
      const result = route.pattern.exec(url.href);

      if (result) {
        return {
          handler: route.handler,
          context: new RouteContext(url.pathname + url.search, result.pathname.groups, url.search),
        };
      }
    }
    return null;
  }

  private runMatch(
    match: NonNullable<ReturnType<Router["match"]>>,
    revision: number,
    signal?: AbortSignal,
  ) {
    const result = match.handler(match.context);
    if (result) {
      return Promise.resolve(result).then(() => this.notifyRouteListeners(revision, signal));
    }
    this.notifyRouteListeners(revision, signal);
  }

  private createRoute(path: string, handler: RouteHandler): RouteItem {
    if (!handler) {
      throw new Error("Handler is required");
    }

    const normalizedPath = path.replace(/\/+$/, "") || "/";
    const patternPath = normalizedPath === "/" ? "/" : `${normalizedPath}{/}?`;

    try {
      // Create URLPattern with pathname only
      const pattern = new URLPattern({ pathname: patternPath });
      return { pattern, handler };
    } catch (error) {
      throw new Error(
        `Invalid URLPattern syntax for path "${path}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  add(path: string, handler: RouteHandler) {
    this.routes.push(this.createRoute(path, handler));
    return this;
  }

  // alias for `add()`
  get(path: string, handler: RouteHandler) {
    return this.add(path, handler);
  }

  private notifyRouteListeners(revision: number, signal?: AbortSignal) {
    for (const handler of this.routeCheckHandlers) {
      if (revision !== this.navigationRevision || signal?.aborted) return;
      handler(this.path);
    }
  }

  check(path?: string) {
    if (this.disposed) return null;
    const url = this.currentURL();
    const revision = ++this.navigationRevision;
    const pathname = this.relativePath(url.pathname);
    const fragment = path ?? (pathname === null ? null : pathname + url.search);
    const match = fragment === null ? null : this.match(fragment);
    return match ? this.runMatch(match, revision) : null;
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
    this.routeCheckHandlers = this.routeCheckHandlers.filter((handler) => handler !== callback);
    return this;
  }

  removeAllRouteListeners() {
    this.routeCheckHandlers = [];
    return this;
  }

  navigate(path: string = "", options?: { state?: unknown }) {
    if (this.disposed) return this;
    this.navigationRevision++;

    const page = this.root + path.replace(/^\/+/, "");
    const nav = this.navigation;
    if (!nav) {
      console.error("Navigation API is unavailable");
      return this;
    }

    const { committed, finished } = nav.navigate(page, options);
    void Promise.all([committed, finished]).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Navigation failed:", error);
    });
    return this;
  }

  addAsync(path: string, handler: AsyncRouteHandler) {
    this.asyncRoutes.push(this.createRoute(path, handler));
    return this;
  }
}

export type RouterType = Router;
