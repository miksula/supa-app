import { html, render } from "lit";
import "./AppIcon.ts";

type NavItem = {
  title: string;
  url?: string;
  icon: string;
  items?: { title: string; url: string }[];
};

const items: NavItem[] = [
  { title: "MyTodos", icon: "command" },
  {
    title: "Documentation",
    icon: "bookOpenText",
    items: [
      { title: "Introduction", url: "#" },
      { title: "Get Started", url: "#" },
      { title: "Tutorials", url: "#" },
      { title: "Changelog", url: "#" },
    ],
  },
  {
    title: "Settings",
    icon: "cog",
    items: [
      { title: "General", url: "#" },
      { title: "Team", url: "#" },
      { title: "Billing", url: "#" },
      { title: "Limits", url: "#" },
    ],
  },
];

function NavMain(openItems: Set<string>, toggleItem: (title: string) => void) {
  return html`
    <div class="group">
      <div class="label flex items-center h-8 text-xs font-medium">Application</div>
      <ul class="menu flex min-w-0 flex-col gap-1">
        ${items.map(
          (item) => html`
            <li class="-ml-2 ${item.items ? "relative" : ""}">
              <a href="${item.url ?? "#"}" class="flex w-full items-center gap-2 px-2 py-1.5">
                <app-icon name="${item.icon}" size="16"></app-icon>
                <span class="font-normal text-sm">${item.title}</span>
              </a>
              ${
                item.items &&
                html`
                  <button
                    class="absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground ring-sidebar-ring outline-hidden transition-transform peer-hover/menu-button:text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&amp;&gt;svg]:size-4 [&amp;&gt;svg]:shrink-0 after:absolute after:-inset-2 md:after:hidden peer-data-[size=sm]/menu-button:top-1 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[collapsible=icon]:hidden data-[state=open]:rotate-90"
                    type="button"
                    aria-expanded="${openItems.has(item.title)}"
                    data-state="${openItems.has(item.title) ? "open" : "closed"}"
                    aria-label="Toggle ${item.title}"
                    @click=${() => toggleItem(item.title)}
                  >
                    <app-icon name="next" size="16"></app-icon>
                  </button>
                  ${
                    openItems.has(item.title) &&
                    html`
                      <div class="collapsible ml-8">
                        <ul class="menu flex min-w-0 flex-col gap-1">
                          ${item.items.map(
                            (subItem) => html`
                              <li>
                                <a href="${subItem.url}" class="flex py-1.5">
                                  <span class="font-normal text-sm">${subItem.title}</span>
                                </a>
                              </li>
                            `,
                          )}
                        </ul>
                      </div>
                    `
                  }
                `
              }
            </li>
          `,
        )}
      </ul>
    </div>
  `;
}

export function Sidebar(target: HTMLElement) {
  const openItems = new Set(items.filter((item) => item.items).map((item) => item.title));

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
            ${NavMain(openItems, (title) => {
              if (openItems.has(title)) {
                openItems.delete(title);
              } else {
                openItems.add(title);
              }
              renderComponent();
            })}
          </nav>
        </div>
      `,
      target,
    );
  };

  renderComponent();
}
