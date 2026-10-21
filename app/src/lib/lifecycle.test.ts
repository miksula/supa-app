/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { html, nothing, render } from "lit";
import { getDocContent } from "@packages/docs";
import { LoginPage } from "../pages/auth/LoginPage.ts";
import { DocsPage } from "../pages/docs/DocsPage.ts";
import { AppRoot } from "./AppRoot.ts";
import { createLayoutManager } from "./layoutManager.ts";
import { SidebarLayout } from "./shell/SidebarLayout.ts";
import { Sidebar } from "./shell/Sidebar.ts";
import { ThemeSwitcher } from "./shell/ThemeSwitcher.ts";
import { SyncStatusIndicator } from "./shell/SyncStatusIndicator.ts";
import { getInitialOpenState, saveOpenState } from "./shell/sidebarState.ts";
import { initializeTheme, resolveColorScheme } from "./theme/theme.ts";
import type { SyncStatus, SyncStatusSource } from "./sync/syncStatus.ts";
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

const connectedStatus: SyncStatus = {
  connected: true,
  connecting: false,
  uploading: false,
  downloading: false,
};

function createSyncStatusSource(initial = connectedStatus) {
  const listeners = new Set<(status: SyncStatus) => void>();
  const unsubscribe = vi.fn();
  const source: SyncStatusSource = {
    current: () => initial,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        unsubscribe();
        listeners.delete(listener);
      };
    },
  };
  const emit = (status: SyncStatus) => listeners.forEach((listener) => listener(status));
  return { source, emit, unsubscribe };
}

afterEach(() => {
  for (const dispose of disposers.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
  document.documentElement.removeAttribute("style");
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-light-theme");
  document.documentElement.removeAttribute("data-dark-theme");
  vi.restoreAllMocks();
});

describe("page disposal", () => {
  it("guards direct route handlers and redirects without remounting a stale page", () => {
    const target = createTarget();
    const router = { get: vi.fn().mockReturnThis(), navigate: vi.fn() };
    const guard = vi.fn(() => true);
    const page = vi.fn();
    const docs = vi.fn();
    const layout = (element: HTMLElement) => ({ contentSlot: element });
    const dispose = AppRoot(target, {
      router,
      guardRoute: guard,
      layouts: { app: layout, login: layout },
      pages: { todos: page, login: page, docs, notFound: page },
    });
    disposers.push(dispose);
    const routes = new Map(router.get.mock.calls.map(([path, handler]) => [path, handler]));
    routes.get("/my-todos")({ path: "/my-todos?filter=all" });
    expect(guard).toHaveBeenLastCalledWith("/my-todos");
    expect(page).not.toHaveBeenCalled();
    guard.mockReturnValue(false);
    routes.get("/my-todos")({ path: "/my-todos" });
    routes.get("/")({ path: "/" });
    routes.get("/docs")({ path: "/docs" });
    expect(router.navigate.mock.calls).toEqual([["/my-todos"], ["/docs/introduction"]]);
    expect(page).toHaveBeenCalledOnce();
    routes.get("/docs/:id")({ path: "/docs/tutorials", param: () => "tutorials" });
    expect(docs).toHaveBeenCalledWith(target, "tutorials");
    routes.get("/*")({ path: "/missing" });
    expect(page).toHaveBeenCalledTimes(2);
    dispose();
    routes.get("/my-todos")({ path: "/my-todos" });
    expect(page).toHaveBeenCalledTimes(2);
  });

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
    const layout = vi.fn((element: HTMLElement) => ({ contentSlot: element }));
    const router = {
      get: vi.fn().mockReturnThis(),
      navigate: vi.fn(),
      addRouteListener: vi.fn<RouteSource["addRouteListener"]>(),
    };
    const dispose = AppRoot(target, {
      router,
      guardRoute: () => false,
      layouts: { app: layout, login: layout },
      pages: {
        login: mountPage("login"),
        todos: mountPage("todos"),
        docs: mountPage("docs"),
        notFound: mountPage("notFound"),
      },
    });
    const routes = new Map(router.get.mock.calls.map(([path, handler]) => [path, handler]));
    disposers.push(dispose);
    routes.get("/my-todos")({ path: "/my-todos" });
    routes.get("/docs/:id")({ path: "/docs/introduction", param: () => "introduction" });

    expect(order).toEqual(["mount todos", "dispose todos", "mount docs"]);
    expect(layout).toHaveBeenCalledTimes(1);
    expect(target.textContent).toBe("docs");
  });
});

describe("layout transitions", () => {
  function mockTransitions() {
    const original = Object.getOwnPropertyDescriptor(document, "startViewTransition");
    const updates: (() => void)[] = [];
    const skip = vi.fn();
    const start = vi.fn((update: () => void) => {
      updates.push(update);
      return { ready: Promise.resolve(), finished: Promise.resolve(), skipTransition: skip };
    });
    Object.defineProperty(document, "startViewTransition", { configurable: true, value: start });
    disposers.push(() => {
      if (original) Object.defineProperty(document, "startViewTransition", original);
      else Reflect.deleteProperty(document, "startViewTransition");
    });
    return { start, updates, skip };
  }

  it.each(["navigation", "disposal"])("ignores delayed transitions superseded by %s", (action) => {
    const { updates, skip } = mockTransitions();
    const target = createTarget();
    const manager = createLayoutManager(target);
    disposers.push(() => manager.dispose());
    const layout = (element: HTMLElement) => ({ contentSlot: element });
    const otherLayout = (element: HTMLElement) => ({ contentSlot: element });
    const pendingPage = vi.fn();
    manager.show({
      page: (element) => {
        element.textContent = "initial";
      },
      layout,
    });
    manager.show({ page: pendingPage, layout: otherLayout, transition: true });
    if (action === "navigation") {
      manager.show({
        page: (element) => {
          element.textContent = "latest";
        },
        layout,
      });
    } else {
      manager.dispose();
    }
    updates[0]();
    expect(pendingPage).not.toHaveBeenCalled();
    expect(skip).toHaveBeenCalled();
    if (action === "navigation") expect(target.textContent).toBe("latest");
  });

  it("uses transition flags on layout changes and disposes page before layout", () => {
    const { start, updates } = mockTransitions();
    const order: string[] = [];
    const target = createTarget();
    const manager = createLayoutManager(target);
    disposers.push(() => manager.dispose());
    const layout = (element: HTMLElement) => ({
      contentSlot: element,
      dispose: () => {
        order.push("layout");
      },
    });
    const otherLayout = (element: HTMLElement) => ({ contentSlot: element });
    manager.show({
      page: (element) => {
        element.textContent = "initial";
        return () => {
          order.push("page");
        };
      },
      layout,
      transition: true,
    });
    expect(start).not.toHaveBeenCalled();
    const nextPage = vi.fn();
    manager.show({ page: nextPage, layout: otherLayout });
    expect(start).toHaveBeenCalledOnce();
    expect(nextPage).not.toHaveBeenCalled();
    updates[0]();
    expect(order).toEqual(["page", "layout"]);
    expect(nextPage).toHaveBeenCalledOnce();
    manager.show({ page: nextPage, layout: otherLayout, transition: true });
    expect(start).toHaveBeenCalledOnce();
  });

  it("mounts immediately when reduced motion is requested", () => {
    const { start } = mockTransitions();
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    vi.spyOn(media, "matches", "get").mockReturnValue(true);
    vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const manager = createLayoutManager(createTarget());
    disposers.push(() => manager.dispose());
    manager.show({
      page: (element) => {
        element.textContent = "initial";
      },
      layout: (element) => ({ contentSlot: element }),
    });
    const page = vi.fn();
    manager.show({
      page,
      transition: true,
      layout: (element) => ({ contentSlot: element }),
    });
    expect(page).toHaveBeenCalledOnce();
    expect(start).not.toHaveBeenCalled();
  });
});

describe("shell disposal", () => {
  it("initializes, changes and restores the selected color scheme", () => {
    expect(resolveColorScheme(null, true)).toBe("dark");
    expect(resolveColorScheme("invalid", false)).toBe("light");
    expect(resolveColorScheme("light", true)).toBe("light");
    localStorage.setItem("color-scheme", "dark");
    initializeTheme();
    const target = createTarget();
    const dispose = ThemeSwitcher(target);
    disposers.push(dispose);
    expect(target.querySelector('[aria-pressed="true"]')?.textContent?.trim()).toBe("Dark");
    target.querySelector<HTMLButtonElement>(".theme-btn")!.click();
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem("color-scheme")).toBe("light");
    dispose();
    document.documentElement.style.colorScheme = "";
    initializeTheme();
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("renders the current sync status and follows updates", () => {
    const target = createTarget();
    const { source, emit } = createSyncStatusSource();
    disposers.push(SyncStatusIndicator(target, source));
    expect(target.querySelector('[role="status"]')?.textContent).toContain("Synced");
    emit({ ...connectedStatus, uploading: true });
    expect(target.querySelector('[role="status"]')?.textContent).toContain("Syncing...");
  });

  it("persists sidebar state without cookies and tolerates unavailable storage", () => {
    expect(getInitialOpenState()).toBe(true);
    saveOpenState(false);
    expect(getInitialOpenState()).toBe(false);
    saveOpenState(true);
    expect(getInitialOpenState()).toBe(true);
    expect(document.cookie).not.toContain("sidebar_state");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    expect(getInitialOpenState()).toBe(true);
    expect(() => saveOpenState(false)).not.toThrow();
  });

  it("removes the theme media and sync status listeners on dispose", () => {
    const themeTarget = createTarget();
    const syncTarget = createTarget();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    vi.spyOn(window, "matchMedia").mockReturnValue(media);
    const removeMedia = vi.spyOn(media, "removeEventListener");
    const disposeTheme = ThemeSwitcher(themeTarget);
    const syncStatus = createSyncStatusSource();
    const disposeSync = SyncStatusIndicator(syncTarget, syncStatus.source);
    disposers.push(disposeTheme, disposeSync);
    disposeTheme();
    disposeTheme();
    disposeSync();
    disposeSync();
    syncStatus.emit(connectedStatus);
    expect(themeTarget.textContent).toBe("");
    expect(syncTarget.textContent).toBe("");
    expect(removeMedia).toHaveBeenCalledWith("change", expect.any(Function));
    expect(syncStatus.unsubscribe).toHaveBeenCalledOnce();
  });

  it.each(["logout", "escape", "outside", "session"])(
    "moves focus out before hiding the account menu on %s",
    (action) => {
      const target = createTarget();
      const router = {
        path: "/my-todos",
        addRouteListener: vi.fn<RouteSource["addRouteListener"]>().mockReturnThis(),
        removeRouteListener: vi.fn<RouteSource["removeRouteListener"]>().mockReturnThis(),
      };
      let notifySession!: () => void;
      const authService: Parameters<typeof Sidebar>[1]["authService"] = {
        session: null,
        onAuthStateChange: (listener) => {
          notifySession = () => void listener("SIGNED_OUT", null);
          return vi.fn();
        },
        logout: vi.fn().mockResolvedValue(undefined),
      };
      const { source: syncStatus } = createSyncStatusSource();
      disposers.push(Sidebar(target, { router, navItems: [], authService, syncStatus }));
      const trigger = target.querySelector<HTMLButtonElement>(".account-trigger")!;
      const menu = target.querySelector<HTMLElement>(".account-menu")!;
      expect(menu.hasAttribute("inert")).toBe(true);
      trigger.click();
      expect(menu.hasAttribute("inert")).toBe(false);
      const logout = menu.querySelector<HTMLButtonElement>(".account-menu-item")!;
      logout.focus();
      const focusWhileOpen = vi.fn(() => {
        expect(menu.getAttribute("aria-hidden")).toBe("false");
      });
      trigger.addEventListener("focus", focusWhileOpen);

      if (action === "logout") logout.click();
      else if (action === "escape")
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      else if (action === "session") notifySession();
      else document.body.click();

      expect(focusWhileOpen).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(trigger);
      expect(menu.hasAttribute("inert")).toBe(true);
      expect(menu.getAttribute("aria-hidden")).toBe("true");
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(authService.logout).toHaveBeenCalledTimes(action === "logout" ? 1 : 0);
    },
  );

  it("does not steal focus from an outside control when dismissing the account menu", () => {
    const target = createTarget();
    const router = {
      path: "/my-todos",
      addRouteListener: vi.fn<RouteSource["addRouteListener"]>().mockReturnThis(),
      removeRouteListener: vi.fn<RouteSource["removeRouteListener"]>().mockReturnThis(),
    };
    const authService = {
      session: null,
      onAuthStateChange: vi.fn(() => vi.fn()),
      logout: vi.fn(),
    };
    const { source: syncStatus } = createSyncStatusSource();
    disposers.push(Sidebar(target, { router, navItems: [], authService, syncStatus }));
    target.querySelector<HTMLButtonElement>(".account-trigger")!.click();
    target.querySelector<HTMLButtonElement>(".account-menu-item")!.focus();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    outside.click();
    expect(document.activeElement).toBe(outside);
    expect(target.querySelector(".account-menu")!.hasAttribute("inert")).toBe(true);
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
      onAuthStateChange: vi.fn(() => unsubscribe),
      logout: vi.fn(),
    };
    const { source: syncStatus } = createSyncStatusSource();
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");

    for (let cycle = 0; cycle < 2; cycle++) {
      const layout = SidebarLayout(target, { router, navItems: [], authService, syncStatus });
      expect(router.addRouteListener).toHaveBeenCalledTimes((cycle + 1) * 2);
      expect(target.querySelector(".account-menu-footer")).not.toBeNull();
      layout.dispose!();
      expect(router.removeRouteListener).toHaveBeenCalledTimes((cycle + 1) * 2);
      expect(target.textContent).toBe("");
    }
    expect(unsubscribe).toHaveBeenCalledTimes(2);
    for (const [listener] of router.addRouteListener.mock.calls) {
      expect(router.removeRouteListener).toHaveBeenCalledWith(listener);
    }
    expect(removeDocument).toHaveBeenCalledWith("click", expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
