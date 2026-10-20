import { html, nothing, render } from "lit";
import "./sidebar-layout.css";
import type { LayoutInstance } from "../types.ts";
import { Sidebar } from "./Sidebar.ts";
import { PageHeader } from "./PageHeader.ts";
import { getInitialOpenState, saveOpenState } from "./sidebarState.ts";

export const SidebarLayout = (
  container: HTMLElement,
  dependencies: Parameters<typeof Sidebar>[1],
): LayoutInstance => {
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
        <main data-slot="page">
          <div data-slot="header"></div>
          <div data-slot="content"></div>
        </main>
      </div>
    `,
    container,
  );

  const wrapperEl = container.querySelector<HTMLElement>(".sidebar-layout")!;
  const sidebarEl = container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
  const asideEl = container.querySelector<HTMLElement>("aside")!;
  const headerEl = container.querySelector<HTMLElement>('[data-slot="header"]')!;
  const slot = container.querySelector<HTMLElement>('[data-slot="content"]')!;

  const disposeSidebar = Sidebar(asideEl, dependencies);
  const disposePageHeader = PageHeader(headerEl, dependencies.router);

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

      disposePageHeader();
      disposeSidebar();
      render(nothing, container);
    },
  };
};
