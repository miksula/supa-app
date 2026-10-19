import { html, render } from "lit";
import type { LayoutFactory, LayoutInstance } from "../types.ts";
import { Sidebar } from "./Sidebar.ts";

const SIDEBAR_STORAGE_KEY = "sidebar_state";
const SIDEBAR_COOKIE_NAME = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function getInitialOpenState(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      return stored === "true";
    }
    const match = document.cookie.match(new RegExp(`(^|;\\s*)${SIDEBAR_COOKIE_NAME}=([^;]*)`));
    if (match) {
      return match[2] === "true";
    }
  } catch {
    // ignore
  }
  return true;
}

function saveOpenState(open: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open));
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
  } catch {
    // ignore
  }
}

export const SidebarLayout: LayoutFactory = (container: HTMLElement): LayoutInstance => {
  let isOpen = getInitialOpenState();
  const state = isOpen ? "expanded" : "collapsed";
  const collapsible = isOpen ? "" : "offcanvas";

  render(
    html`
      <div
        class="sidebar-layout group/sidebar-wrapper"
        data-component="sidebar-layout"
        data-slot="sidebar-wrapper"
        data-state="${state}"
      >
        <div
          class="group peer"
          data-slot="sidebar"
          data-state="${state}"
          data-collapsible="${collapsible}"
          data-variant="inset"
          data-side="left"
        >
          <div data-slot="sidebar-gap"></div>
          <div data-slot="sidebar-container">
            <aside data-slot="sidebar-inner"></aside>
          </div>
        </div>
        <main data-slot="page"></main>
      </div>
    `,
    container,
  );

  const wrapperEl = container.querySelector<HTMLElement>(".sidebar-layout")!;
  const sidebarEl = container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
  const asideEl = container.querySelector<HTMLElement>("aside")!;
  const slot = container.querySelector<HTMLElement>('[data-slot="page"]')!;

  Sidebar(asideEl);

  const updateState = (open: boolean) => {
    isOpen = open;
    const nextState = open ? "expanded" : "collapsed";
    wrapperEl.setAttribute("data-state", nextState);
    sidebarEl.setAttribute("data-state", nextState);
    sidebarEl.setAttribute("data-collapsible", open ? "" : "offcanvas");
    saveOpenState(open);
  };

  const toggleSidebar = () => {
    updateState(!isOpen);
  };

  const handleClick = (e: MouseEvent) => {
    const trigger = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      'button[data-slot="sidebar-trigger"], .sidebar-trigger',
    );
    if (trigger) {
      e.preventDefault();
      toggleSidebar();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleSidebar();
    }
  };

  container.addEventListener("click", handleClick);
  window.addEventListener("keydown", handleKeyDown);

  return {
    element: container.firstElementChild as HTMLElement,
    contentSlot: slot,
    dispose: () => {
      container.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);

      const el = asideEl as HTMLElement & {
        disposeSidebar?: () => void;
        disposeAppBar?: () => void;
      };
      el.disposeSidebar?.();
      el.disposeAppBar?.();
    },
  };
};
