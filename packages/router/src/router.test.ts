import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "./router.ts";

let navigationEvents: EventTarget;
let navigate: ReturnType<typeof vi.fn>;
let routers: Router[];
let currentEntry: { url: string };

beforeEach(() => {
  vi.resetModules();
  routers = [];
  navigationEvents = new EventTarget();
  currentEntry = { url: "https://example.test/current?query=old" };
  navigate = vi.fn(() => ({
    committed: Promise.resolve(),
    finished: Promise.resolve(),
  }));
  vi.stubGlobal("location", new URL("https://example.test/current?query=old"));
  vi.stubGlobal("navigation", {
    addEventListener: (event: string, handler: EventListener) =>
      navigationEvents.addEventListener(event, handler),
    removeEventListener: (event: string, handler: EventListener) =>
      navigationEvents.removeEventListener(event, handler),
    navigate,
    currentEntry,
  });
});

afterEach(() => {
  for (const router of routers) router.dispose();
  vi.unstubAllGlobals();
});

function createRouter(options?: ConstructorParameters<typeof Router>[0]) {
  const router = new Router(options);
  routers.push(router);
  return router;
}

function intercept(path: string, overrides: Record<string, unknown> = {}) {
  let handler: (() => Promise<void>) | undefined;
  const event = Object.assign(new Event("navigate"), {
    canIntercept: true,
    hashChange: false,
    downloadRequest: null,
    navigationType: "push",
    destination: { url: new URL(path, "https://example.test").href },
    intercept: (options: { handler: () => Promise<void> }) => {
      handler = options.handler;
    },
    ...overrides,
  });
  navigationEvents.dispatchEvent(event);
  return handler;
}

describe("router redirects", () => {
  it("does not notify listeners for an intercepted route superseded by a redirect", async () => {
    const router = createRouter();
    const listener = vi.fn();
    router.get("/", () => {
      router.navigate("/my-todos");
    });
    router.addRouteListener(listener);

    const handler = intercept("/");
    expect(handler).toBeDefined();
    await handler!();

    expect(navigate).toHaveBeenCalledWith("/my-todos", undefined);
    expect(listener).not.toHaveBeenCalled();
  });

  it("reads params and search from the matched destination", async () => {
    const router = createRouter();
    const handler = vi.fn();
    router.get("/docs/:id", handler);

    router.check("/docs/intro?query=new");

    const context = handler.mock.calls[0][0];
    expect(context.param("id")).toBe("intro");
    expect(context.search("query")).toBe("new");
  });

  it("does not report a superseded navigation as an application error", async () => {
    const router = createRouter();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    navigate.mockImplementationOnce(() => ({
      committed: Promise.resolve(),
      finished: Promise.reject(new DOMException("Navigation was aborted", "AbortError")),
    }));

    router.navigate("/old");
    router.navigate("/new");
    await Promise.resolve();
    await Promise.resolve();

    expect(report).not.toHaveBeenCalled();
  });

  it("handles rejection of both navigation promises", async () => {
    const router = createRouter();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new DOMException("Navigation was aborted", "AbortError");
    navigate.mockImplementationOnce(() => ({
      committed: Promise.reject(error),
      finished: Promise.reject(error),
    }));

    router.navigate("/cancelled");
    await Promise.resolve();
    await Promise.resolve();

    expect(report).not.toHaveBeenCalled();
  });

  it("reports real navigation failures once", async () => {
    const router = createRouter();
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("Route failed");
    navigate.mockImplementationOnce(() => ({
      committed: Promise.reject(error),
      finished: Promise.reject(error),
    }));

    router.navigate("/failed");
    await Promise.resolve();
    await Promise.resolve();

    expect(report).toHaveBeenCalledExactlyOnceWith("Navigation failed:", error);
  });
});

describe("route matching", () => {
  it.each([
    ["/docs/:id", "/docs/intro", { id: "intro" }],
    ["/docs/:id", "/docs/intro/", { id: "intro" }],
    ["/about/", "/about", {}],
    ["/about/", "/about/", {}],
    ["/items/:id(\\d+)", "/items/42", { id: "42" }],
    ["/docs/:id?", "/docs", {}],
    ["/docs/*", "/docs/nested/page", { "0": "nested/page" }],
    ["/", "/", {}],
  ])("matches %s against %s", (pattern, path, params) => {
    const router = createRouter();
    const handler = vi.fn();
    router.get(pattern, handler).check(path);
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0].param()).toEqual(params);
  });

  it("uses first-match order, with async routes taking priority", async () => {
    const router = createRouter();
    const sync = vi.fn();
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    router.get("/*", sync).addAsync("/docs/:id", first).addAsync("/*", second);
    await router.check("/docs/intro");
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it("reads current search on startup and preserves query values when navigating", () => {
    const router = createRouter();
    const handler = vi.fn();
    router.get("/current", handler).check();
    expect(handler.mock.calls[0][0].search()).toEqual({ query: "old" });
    expect(handler.mock.calls[0][0].search("missing")).toBe("");
    const options = { state: { selected: true } };
    router.navigate("/docs?return=/", options);
    expect(navigate).toHaveBeenCalledWith("/docs?return=/", options);
  });

  it("decodes query values from an intercepted destination", async () => {
    const router = createRouter();
    const handler = vi.fn();
    router.get("/docs/:id", handler);
    await intercept("/docs/intro?query=new+value&tag=one&tag=two")!();
    const context = handler.mock.calls[0][0];
    expect(context.path).toBe("/docs/intro?query=new+value&tag=one&tag=two");
    expect(context.search("query")).toBe("new value");
    expect(context.search()).toEqual({ query: "new value", tag: "two" });
  });

  it.each(["/app", "/app/", "app"])("handles root %s consistently", async (root) => {
    currentEntry.url = "https://example.test/app/docs/intro/?query=new";
    const router = createRouter({ root });
    const handler = vi.fn();
    router.get("/docs/:id", handler);
    expect(router.path).toBe("/docs/intro");
    router.check();
    expect(handler.mock.calls[0][0].search("query")).toBe("new");
    await intercept("/app/docs/intro")!();
    expect(handler).toHaveBeenCalledTimes(2);
    expect(intercept("/application/docs/intro")).toBeUndefined();
    router.navigate("/docs/intro");
    expect(navigate).toHaveBeenCalledWith("/app/docs/intro", undefined);
  });

  it("supports explicit checks without the Navigation API", () => {
    vi.stubGlobal("navigation", undefined);
    vi.stubGlobal("location", new URL("https://example.test/app/docs/intro/?query=new"));
    const router = createRouter({ root: "/app" });
    const handler = vi.fn();
    router.get("/docs/:id", handler).check();
    expect(router.path).toBe("/docs/intro");
    expect(handler.mock.calls[0][0].search("query")).toBe("new");
  });

  it("returns null for unmatched routes and rejects invalid patterns", () => {
    const router = createRouter();
    expect(router.check("/missing")).toBeNull();
    expect(() => router.get("/(", () => {})).toThrow("Invalid URLPattern syntax");
  });
});

describe("router lifecycle", () => {
  it("does not register a listener when the package is imported", async () => {
    const add = vi.spyOn(navigationEvents, "addEventListener");
    await import("../main.ts");
    expect(add).not.toHaveBeenCalled();
  });

  it("ignores callbacks queued before a newer link navigation", async () => {
    const router = createRouter();
    const old = vi.fn();
    const next = vi.fn();
    router.get("/old", old).get("/new", next);
    const previous = intercept("/old");
    const latest = intercept("/new");
    await previous!();
    await latest!();
    expect(old).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it.each(["check", "intercept"])(
    "suppresses stale async notifications through %s",
    async (method) => {
      const router = createRouter();
      const listener = vi.fn();
      const pending = Promise.withResolvers<void>();
      router.addAsync("/old", () => pending.promise).get("/new", () => {});
      router.addRouteListener(listener);
      const previous = method === "check" ? router.check("/old") : intercept("/old")!();
      currentEntry.url = "https://example.test/new";
      await intercept("/new")!();
      pending.resolve();
      await previous;
      expect(listener).toHaveBeenCalledExactlyOnceWith("/new");
    },
  );

  it("waits for a promise returned through get and propagates rejection", async () => {
    const router = createRouter();
    const listener = vi.fn();
    const pending = Promise.withResolvers<void>();
    router.get("/pending", () => pending.promise).addRouteListener(listener);
    const check = router.check("/pending");
    expect(listener).not.toHaveBeenCalled();
    pending.reject(new Error("Handler failed"));
    await expect(check).rejects.toThrow("Handler failed");
    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying when a listener redirects", () => {
    const router = createRouter();
    const stale = vi.fn();
    router.get("/old", () => {});
    router.addRouteListener(() => {
      router.navigate("/new");
    });
    router.addRouteListener(stale);
    router.check("/old");
    expect(stale).not.toHaveBeenCalled();
  });

  it("honors the browser abort signal", async () => {
    const router = createRouter();
    const listener = vi.fn();
    const pending = Promise.withResolvers<void>();
    const controller = new AbortController();
    router.addAsync("/old", () => pending.promise).addRouteListener(listener);
    const previous = intercept("/old", { signal: controller.signal })!();
    controller.abort();
    pending.resolve();
    await previous;
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    { canIntercept: false },
    { hashChange: true },
    { downloadRequest: { filename: "file" } },
    { navigationType: "reload" },
    { destination: { url: "https://other.test/docs" } },
  ])("leaves non-SPA navigations alone: %j", (overrides) => {
    createRouter().get("/*", () => {});
    expect(intercept("/docs", overrides)).toBeUndefined();
  });

  it("unregisters its listener and invalidates pending callbacks on disposal", async () => {
    const remove = vi.spyOn(navigationEvents, "removeEventListener");
    const router = createRouter();
    const handler = vi.fn();
    router.get("/*", handler);
    const pending = intercept("/docs");
    router.dispose();
    router.dispose();
    await pending!();
    expect(handler).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
    expect(intercept("/new")).toBeUndefined();
    expect(router.check("/new")).toBeNull();
    router.navigate("/new");
    expect(navigate).not.toHaveBeenCalled();
  });
});
