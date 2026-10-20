/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { html, nothing, render } from "lit";
import { getDocContent } from "@packages/docs";
import { LoginPage } from "../pages/auth/index.ts";
import { DocsPage } from "../pages/docs/index.ts";
import { AppRoot } from "./AppRoot.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { SidebarFooter } from "./shell/SidebarFooter.ts";
import { dispatchData } from "./events.ts";
import type { Dispose, RouteSource } from "./types.ts";

vi.mock("@packages/docs", () => ({ getDocContent: vi.fn() }));
vi.mock("@/ui/AppIcon.ts", () => ({}));

const disposers: Dispose[] = [];

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createTarget() {
  const target = document.createElement("div");
  document.body.append(target);
  return target;
}

afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe("page disposal", () => {
  it.each(["resolve", "reject"] as const)(
    "does not render a disposed login page after the request %ss",
    async (outcome) => {
      const request = deferred<void>();
      const login = vi.fn(() => request.promise);
      const target = createTarget();
      const dispose = LoginPage(target, {
        login,
        initialEmail: "test@example.com",
        initialPassword: "test-password",
      });
      disposers.push(dispose);
      target.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
      expect(login).toHaveBeenCalledWith("test@example.com", "test-password");
      expect(target.querySelector("button")!.disabled).toBe(true);

      dispose();
      render(html`<p>Replacement page</p>`, target);
      if (outcome === "resolve") request.resolve();
      else request.reject(new Error("Login failed"));
      await request.promise.catch(() => undefined);

      expect(target.textContent).toBe("Replacement page");
    },
  );

  it.each(["resolve", "reject"] as const)(
    "does not render a disposed docs page after the request %ss",
    async (outcome) => {
      const request = deferred<string | null>();
      vi.mocked(getDocContent).mockReturnValueOnce(request.promise);
      const target = createTarget();
      const dispose = DocsPage(target, { navigate: vi.fn() });
      disposers.push(dispose);
      dispose();
      render(html`<p>Replacement page</p>`, target);

      if (outcome === "resolve") request.resolve("# Late document");
      else request.reject(new Error("Import failed"));
      await request.promise.catch(() => undefined);
      await Promise.resolve();

      expect(target.textContent).toBe("Replacement page");
    },
  );

  it("keeps concurrent docs mounts independent and disposes their viewers", async () => {
    const firstRequest = deferred<string | null>();
    vi.mocked(getDocContent)
      .mockReturnValueOnce(firstRequest.promise)
      .mockResolvedValueOnce("# Second document");
    const first = createTarget();
    const second = createTarget();
    const disposeFirst = DocsPage(first, { docId: "first", navigate: vi.fn() });
    const disposeSecond = DocsPage(second, { docId: "second", navigate: vi.fn() });
    disposers.push(disposeFirst, disposeSecond);
    firstRequest.resolve("# First document");
    await firstRequest.promise;

    expect(first.querySelector("h1")?.textContent).toBe("First document");
    expect(second.querySelector("h1")?.textContent).toBe("Second document");
    const viewer = first.querySelector<HTMLElement>('[data-slot="doc-viewer-outlet"]')!;
    disposeFirst();
    expect(viewer.textContent).toBe("");
    expect(first.textContent).toBe("");
    expect(second.querySelector("h1")?.textContent).toBe("Second document");
  });

  it("disposes the previous page before replacing it, retaining the shared layout", () => {
    const target = createTarget();
    const order: string[] = [];
    const mountPage = (name: string) => (outlet: HTMLElement) => {
      order.push(`mount ${name}`);
      render(html`<p>${name}</p>`, outlet);
      return () => {
        order.push(`dispose ${name}`);
        render(nothing, outlet);
      };
    };
    const layout = vi.fn((element: HTMLElement) => ({ element, contentSlot: element }));
    const router = {
      get: vi.fn().mockReturnThis(),
      navigate: vi.fn(),
      addRouteListener: vi.fn<RouteSource["addRouteListener"]>(),
    };
    AppRoot(target, {
      router,
      auth: { bootstrap: vi.fn().mockResolvedValue(undefined) },
      enforceAuthRoute: () => false,
      mountSync: () => {},
      layouts: { app: layout, login: layout },
      pages: {
        login: mountPage("login"),
        todos: mountPage("todos"),
        docs: mountPage("docs"),
        notFound: mountPage("notFound"),
      },
    });
    const routes = new Map(router.get.mock.calls.map(([path, handler]) => [path, handler]));
    const onRoute = router.addRouteListener.mock.calls[0][0];
    routes.get("/my-todos")();
    onRoute("/my-todos");
    routes.get("/docs/:id")({ param: () => "introduction" });
    onRoute("/docs/introduction");

    expect(order).toEqual(["mount todos", "dispose todos", "mount docs"]);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(target.textContent).toBe("docs");
  });
});

describe("shell disposal", () => {
  it("removes the footer's media, mutation and data listeners", () => {
    const target = createTarget();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const removeMedia = vi.spyOn(media, "removeEventListener");
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");
    const removeData = vi.spyOn(target, "removeEventListener");
    const dispose = SidebarFooter(target);
    disposers.push(dispose);
    dispose();
    dispose();
    dispatchData(target, "syncStatus", {
      connected: true,
      connecting: false,
      uploading: false,
      downloading: false,
    });
    expect(target.textContent).toBe("");
    expect(removeMedia).toHaveBeenCalledWith("change", expect.any(Function));
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(removeData).toHaveBeenCalledWith("syncStatus", expect.any(Function));
  });

  it("disposes all layout-owned listeners across repeated mounts", () => {
    const target = createTarget();
    const router = {
      path: "/my-todos",
      addRouteListener: vi.fn<RouteSource["addRouteListener"]>().mockReturnThis(),
      removeRouteListener: vi.fn<RouteSource["removeRouteListener"]>().mockReturnThis(),
    };
    const unsubscribe = vi.fn();
    const authService = {
      session: null,
      session$: { subscribe: vi.fn(() => unsubscribe) },
      logout: vi.fn(),
    };
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const disconnect = vi.spyOn(MutationObserver.prototype, "disconnect");

    for (let cycle = 0; cycle < 2; cycle++) {
      const layout = SidebarLayout(target, { router, navItems: [], authService });
      expect(router.addRouteListener).toHaveBeenCalledTimes((cycle + 1) * 2);
      expect(target.querySelector(".sidebar-footer")).not.toBeNull();
      layout.dispose!();
      expect(router.removeRouteListener).toHaveBeenCalledTimes((cycle + 1) * 2);
      expect(target.textContent).toBe("");
    }
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    for (const [listener] of router.addRouteListener.mock.calls) {
      expect(router.removeRouteListener).toHaveBeenCalledWith(listener);
    }
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(removeDocument).toHaveBeenCalledWith("click", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
