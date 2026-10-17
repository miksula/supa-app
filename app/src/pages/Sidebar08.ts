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
          <header class="sidebar-08__sidebar-header">
            <a href="#">
              <div>Acme Inc</div>
              <div>Enterprise</div>
            </a>
          </header>
          <nav class="sidebar-08__sidebar-content" aria-label="Primary navigation">
            <div>
              <div>Platform</div>
              <ul>
                <li>
                  <a href="#">Playground</a>
                  <button type="button">Toggle</button>
                  <ul>
                    <li><a href="#">History</a></li>
                    <li><a href="#">Starred</a></li>
                    <li><a href="#">Settings</a></li>
                  </ul>
                </li>
                <li>
                  <a href="#">Models</a>
                  <button type="button">Toggle</button>
                </li>
                <li>
                  <a href="#">Documentation</a>
                  <button type="button">Toggle</button>
                </li>
                <li>
                  <a href="#">Settings</a>
                  <button type="button">Toggle</button>
                </li>
              </ul>
            </div>

            <div>
              <div>Projects</div>
              <ul>
                <li>
                  <a href="#">Design Engineering</a>
                  <button type="button">More</button>
                </li>
                <li>
                  <a href="#">Sales &amp; Marketing</a>
                  <button type="button">More</button>
                </li>
                <li>
                  <a href="#">Travel</a>
                  <button type="button">More</button>
                </li>
                <li><button type="button">More</button></li>
              </ul>
            </div>

            <div>
              <ul>
                <li><a href="#">Support</a></li>
                <li><a href="#">Feedback</a></li>
              </ul>
            </div>
          </nav>
          <footer class="sidebar-08__sidebar-footer"></footer>
        </aside>

        <main class="sidebar-08__main" data-slot="sidebar-inset">
          <header class="sidebar-08__header">
            <div>
              <button
                class="sidebar-08__toggle"
                type="button"
                aria-label="Toggle sidebar"
                aria-expanded="true"
                @click=${toggleSidebar}
              >
                <span aria-hidden="true">☰</span>
              </button>
              <div role="separator" aria-orientation="vertical"></div>
              <nav class="sidebar-08__breadcrumb" aria-label="Breadcrumb">
                <ol>
                  <li><a href="#">Build Your Application</a></li>
                  <li aria-hidden="true">›</li>
                  <li><span aria-current="page">Data Fetching</span></li>
                </ol>
              </nav>
            </div>
          </header>
          <section class="sidebar-08__content" aria-label="Page content">
            <div>
              <div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div></div>
            </div>
          </section>
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
