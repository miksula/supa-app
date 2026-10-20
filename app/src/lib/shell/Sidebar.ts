import { html, render, nothing } from "lit";
import { router } from "@packages/router";
import { NAV_ITEMS, type NavItem } from "@/nav/navConfig.ts";
import "@/ui/AppIcon.ts";

type SidebarTarget = HTMLElement & {
  disposeSidebar?: () => void;
  disposeAppBar?: () => void;
};

const normalizePath = (path: string): string => path.replace(/\/+$/, "") || "/";

const isItemActive = (url?: string): boolean => {
  if (!url) return false;
  const currentPath = normalizePath(router.path);
  const targetPath = normalizePath(url);

  if (targetPath === "/") {
    return currentPath === "/" || currentPath === "/my-todos";
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
};

const isGroupActive = (item: NavItem) =>
  item.items?.some((sub) => router.path.startsWith(sub.url)) ?? false;

export function Sidebar(target: HTMLElement) {
  const disposableTarget = target as SidebarTarget;
  disposableTarget.disposeSidebar?.();
  disposableTarget.disposeAppBar?.();

  const openItems = new Set<string>(NAV_ITEMS.filter(isGroupActive).map((item) => item.title));

  const syncOpenItems = () => {
    for (const item of NAV_ITEMS) {
      if (isGroupActive(item)) {
        openItems.add(item.title);
      }
    }
  };

  const toggleMenu = (title: string) => {
    if (openItems.has(title)) {
      openItems.delete(title);
    } else {
      openItems.add(title);
    }
    renderComponent();
  };

  const renderComponent = () => {
    render(
      html`
        <div class="sidebar" data-component="sidebar">
          <div class="sidebar-header">
            <a href="/" class="sidebar-brand">
              <div class="sidebar-brand-icon">
                <app-icon name="listTodo" size="16"></app-icon>
              </div>
            </a>
            <div class="sidebar-brand-text">
              <span class="truncate text-sm font-medium">Local First</span>
              <span class="truncate text-xs text-(--muted-foreground)">Supabase</span>
            </div>
          </div>

          <nav class="sidebar-content">${NavMain(openItems, toggleMenu)}</nav>
        </div>
      `,
      target,
    );
  };

  const handleRouteChange = () => {
    syncOpenItems();
    renderComponent();
  };

  router.addRouteListener(handleRouteChange);

  const cleanup = () => {
    router.removeRouteListener(handleRouteChange);
    delete disposableTarget.disposeSidebar;
    delete disposableTarget.disposeAppBar;
  };

  disposableTarget.disposeSidebar = cleanup;
  disposableTarget.disposeAppBar = cleanup;

  renderComponent();
}

function NavMain(openItems: Set<string>, toggleItem: (title: string) => void) {
  return html`
    <div class="sidebar-group">
      <div class="sidebar-label">Application</div>
      <ul class="sidebar-menu">
        ${NAV_ITEMS.map((item) => MenuItem(item, openItems, toggleItem))}
      </ul>
    </div>
  `;
}

function MenuItem(item: NavItem, openItems: Set<string>, toggleItem: (title: string) => void) {
  const isOpen = openItems.has(item.title);
  const active = isItemActive(item.url);

  return html`
    <li class="menu-item ${isOpen ? "-is-open" : ""}">
      <a
        href="${item.url ?? "#"}"
        class="menu-link ${active ? "-is-active" : ""}"
        aria-current="${active ? "page" : nothing}"
        @click=${
          item.items && !item.url
            ? (e: Event) => {
                e.preventDefault();
                toggleItem(item.title);
              }
            : nothing
        }
      >
        ${item.icon ? html`<app-icon name="${item.icon}" size="16"></app-icon>` : nothing}
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
        ${items.map((item) => {
          const active = isItemActive(item.url);
          return html`
            <li>
              <a
                href="${item.url}"
                class="sub-menu-link ${active ? "-is-active" : ""}"
                aria-current="${active ? "page" : nothing}"
              >
                <span class="truncate text-sm">${item.title}</span>
              </a>
            </li>
          `;
        })}
      </ul>
    </div>
  `;
}
