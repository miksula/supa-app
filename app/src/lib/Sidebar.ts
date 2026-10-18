import { html, render, nothing } from "lit";
import "./AppIcon.ts";

type NavItem = {
  title: string;
  icon: string;
  url?: string;
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

export function Sidebar(target: HTMLElement) {
  const openItems = new Set(items.filter((item) => item.items).map((item) => item.title));

  const renderComponent = () => {
    render(
      html`
        <div class="sidebar" data-component="sidebar">
          <div class="sidebar-header">
            <a href="#" class="sidebar-brand">
              <div class="sidebar-brand-icon">
                <app-icon name="command" size="16"></app-icon>
              </div>
            </a>
            <div class="sidebar-brand-text">
              <span class="truncate text-sm font-medium">Local First</span>
              <span class="truncate text-xs text-(--muted-foreground)">Supabase</span>
            </div>
          </div>

          <nav class="sidebar-content">
            ${NavMain(openItems, function toggleMenu(title) {
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

function NavMain(openItems: Set<string>, toggleItem: (title: string) => void) {
  return html`
    <div class="sidebar-group">
      <div class="sidebar-label">Application</div>
      <ul class="sidebar-menu">
        ${items.map((item) => MenuItem(item, openItems, toggleItem))}
      </ul>
    </div>
  `;
}

function MenuItem(item: NavItem, openItems: Set<string>, toggleItem: (title: string) => void) {
  const isOpen = openItems.has(item.title);

  return html`
    <li class="menu-item ${isOpen ? "-is-open" : ""}">
      <a href="${item.url ?? "#"}" class="menu-link">
        <app-icon name="${item.icon}" size="16"></app-icon>
        <span class="truncate text-sm">${item.title}</span>
      </a>
      ${
        item.items
          ? html`
              ${MenuButton(item.title, isOpen, toggleItem)}
              ${isOpen ? SubMenu(item.items) : nothing}
            `
          : nothing
      }
    </li>
  `;
}

function MenuButton(title: string, isOpen: boolean, toggleItem: (title: string) => void) {
  return html`
    <button
      class="menu-toggle ${isOpen ? "-is-open" : ""}"
      type="button"
      aria-label="Toggle submenu"
      aria-expanded="${isOpen}"
      @click=${() => toggleItem(title)}
    >
      <app-icon name="next" size="16"></app-icon>
    </button>
  `;
}

function SubMenu(items: NonNullable<NavItem["items"]>) {
  return html`
    <div class="sub-menu">
      <ul>
        ${items.map(
          (item) => html`
            <li>
              <a href="${item.url}" class="sub-menu-link">
                <span class="truncate text-sm">${item.title}</span>
              </a>
            </li>
          `,
        )}
      </ul>
    </div>
  `;
}
