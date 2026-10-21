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

  render(
    html`
      <div class="sidebar-layout" data-component="sidebar-layout" data-state="${state}">
        <aside
          class="layout-sidebar"
          data-slot="sidebar"
          data-state="${state}"
          ?inert="${!isOpen}"
        ></aside>
        <main class="layout-page">
          <div class="layout-header" data-slot="header"></div>
          <div class="layout-content" data-slot="content"></div>
        </main>
      </div>
    `,
    container,
  );

  const wrapperEl = container.querySelector<HTMLElement>(".sidebar-layout")!;
  const sidebarEl = container.querySelector<HTMLElement>('[data-slot="sidebar"]')!;
  const headerEl = container.querySelector<HTMLElement>('[data-slot="header"]')!;
  const slot = container.querySelector<HTMLElement>('[data-slot="content"]')!;

  const disposeSidebar = Sidebar(sidebarEl, dependencies);
  const disposePageHeader = PageHeader(headerEl, dependencies.router);

  const updateState = (open: boolean) => {
    isOpen = open;
    const nextState = open ? "expanded" : "collapsed";
    wrapperEl.setAttribute("data-state", nextState);
    sidebarEl.setAttribute("data-state", nextState);
    sidebarEl.toggleAttribute("inert", !open);
    saveOpenState(open);
  };

  const toggleSidebar = () => {
    updateState(!isOpen);
  };

  const handleClick = (e: MouseEvent) => {
    const trigger = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
      ".sidebar-trigger",
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
