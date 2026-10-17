import { html, render } from "lit";
import { SidebarFooter } from "@/lib/SidebarFooter.ts";

export function Sidebar08(target: HTMLElement) {
  const toggleSidebar = () => {
    const layout = target.querySelector<HTMLElement>(".sidebar-08");
    const trigger = target.querySelector<HTMLButtonElement>(".sidebar-08__toggle");

    if (!layout || !trigger) {
      throw new Error("Sidebar08 toggle controls are unavailable");
    }

    const isCollapsed = layout.dataset.sidebarState === "collapsed";
    layout.dataset.sidebarState = isCollapsed ? "expanded" : "collapsed";
    trigger.setAttribute("aria-expanded", String(isCollapsed));
  };

  render(
    html`
      <div class="sidebar-08" data-sidebar-state="expanded">
        <aside class="sidebar-08__sidebar" aria-label="Sidebar">
          <header class="sidebar-08__sidebar-header"></header>
          <nav class="sidebar-08__sidebar-content" aria-label="Primary navigation"></nav>
          <footer class="sidebar-08__sidebar-footer"></footer>
        </aside>

        <main class="sidebar-08__main">
          <header class="sidebar-08__header">
            <button
              class="sidebar-08__toggle"
              type="button"
              aria-label="Toggle sidebar"
              aria-expanded="true"
              @click=${toggleSidebar}
            >
              <span aria-hidden="true">☰</span>
            </button>
            <nav class="sidebar-08__breadcrumb" aria-label="Breadcrumb"></nav>
          </header>
          <section class="sidebar-08__content" aria-label="Page content"></section>
        </main>
      </div>
    `,
    target,
  );

  const footer = target.querySelector<HTMLElement>(".sidebar-08__sidebar-footer");
  if (!footer) {
    throw new Error("Sidebar08 footer container is unavailable");
  }
  SidebarFooter(footer);
}
