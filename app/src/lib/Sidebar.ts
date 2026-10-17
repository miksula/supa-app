import { html, render } from "lit";
import "./AppIcon.ts";

export function Sidebar(target: HTMLElement) {
  const renderComponent = () => {
    render(
      html`
        <div class="sidebar">
          <div class="header">
            <a href="#" class="flex items-center">
              <div class="icon-container">
                <app-icon name="command" size="16"></app-icon>
              </div>
            </a>
            <div class="text-container font-normal">
              <span class="truncate text-sm">Local First</span>
              <span class="truncate text-xs">Supabase</span>
            </div>
          </div>
          <nav class="content">
            <div class="group">
              <div class="label flex items-center  h-8 text-xs font-medium">Application</div>
              <ul class="menu flex min-w-0 flex-col gap-1">
                <li class="-ml-2">
                  <a class="flex w-full items-center gap-2 px-2 py-1.5">
                    <app-icon name="listTodo" size="16"></app-icon>
                    <span class="font-normal text-sm">My todos</span>
                  </a>
                </li>
                <li class="-ml-2 relative">
                  <a class="flex w-full items-center gap-2 px-2 py-1.5">
                    <app-icon name="bookOpenText" size="16"></app-icon>
                    <span class="font-normal text-sm">Documentation</span>
                  </a>
                  <button
                    class="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0 after:absolute after:-inset-2 md:after:hidden peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[collapsible=icon]:hidden data-[state=open]:rotate-90"
                    type="button"
                  >
                    <app-icon name="next" size="16"></app-icon>
                  </button>
                  <div class="collapsible ml-8">
                    <ul class="menu flex min-w-0 flex-col gap-1">
                      <li>
                        <a href="#" class="flex py-1.5">
                          <span class="font-normal text-sm">Introduction</span>
                        </a>
                      </li>
                      <li>
                        <a href="#" class="flex py-1.5">
                          <span class="font-normal text-sm">Get Started</span>
                        </a>
                      </li>
                      <li>
                        <a href="#" class="flex py-1.5">
                          <span class="font-normal text-sm">Tutorials</span>
                        </a>
                      </li>
                      <li>
                        <a href="#" class="flex py-1.5">
                          <span class="font-normal text-sm">Changelog</span>
                        </a>
                      </li>
                    </ul>
                  </div>
                </li>
                <li class="-ml-2">
                  <a class="flex w-full items-center gap-2 px-2 py-1.5">
                    <app-icon name="cog" size="16"></app-icon>
                    <span class="font-normal text-sm">Settings</span>
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
      `,
      target,
    );
  };

  renderComponent();
}
