import { html, render, nothing } from "lit";
import "./sidebar.css";
import type { Dispose, RouteSource } from "@/types.ts";
import type { NavItem } from "@/nav/navConfig.ts";
import "@/ui/AppIcon.ts";
import type { AuthService } from "@/auth/AuthService.ts";
import { SidebarFooter } from "./SidebarFooter.ts";
import type { Session } from "@supabase/supabase-js";

const normalizePath = (path: string): string => path.replace(/\/+$/, "") || "/";

const isItemActive = (path: string, url?: string): boolean => {
  if (!url) return false;
  const currentPath = normalizePath(path);
  const targetPath = normalizePath(url);

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
};

const isGroupActive = (path: string, item: NavItem) =>
  item.items?.some((sub) => path.startsWith(sub.url)) ?? false;

function getAvatarName(session: Session | null) {
  return session?.user.email ?? session?.user.id ?? "User";
}

function getUserInitials(session: Session | null) {
  const parts = getAvatarName(session)
    .split(/[\s@._-]+/)
    .filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (parts[0] ?? "U").slice(0, 2).toUpperCase();
}

export function Sidebar(
  target: HTMLElement,
  {
    router,
    navItems,
    authService,
  }: {
    router: RouteSource;
    navItems: NavItem[];
    authService: Pick<AuthService, "session" | "session$" | "logout">;
  },
): Dispose {
  let disposed = false;

  const openItems = new Set<string>(
    navItems.filter((item) => isGroupActive(router.path, item)).map((item) => item.title),
  );

  const syncOpenItems = () => {
    for (const item of navItems) {
      if (isGroupActive(router.path, item)) {
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
    renderNavigation();
  };

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

        <nav class="sidebar-content"></nav>
        <div class="sidebar-account"></div>
      </div>
    `,
    target,
  );

  const sidebar = target.querySelector<HTMLElement>('[data-component="sidebar"]');
  const navigation = sidebar?.querySelector<HTMLElement>(".sidebar-content");
  const account = sidebar?.querySelector<HTMLElement>(".sidebar-account");

  if (!sidebar || !navigation || !account) {
    throw new Error("Unable to mount sidebar: required element is missing");
  }

  const renderNavigation = () => {
    if (disposed) return;
    render(NavMain(navItems, router.path, openItems, toggleMenu), navigation);
  };

  let currentSession = authService.session;
  let isMenuOpen = false;
  let isLoggingOut = false;
  let disposeAccountFooter: Dispose | null = null;

  const renderAccount = () => {
    if (disposed) return;
    const userLabel = currentSession?.user.email ?? "User";
    disposeAccountFooter?.();
    disposeAccountFooter = null;

    render(
      html`
        <button
          type="button"
          class="account-trigger"
          aria-label="Open user menu"
          aria-expanded="${isMenuOpen}"
          aria-controls="sidebar-account-menu"
          @click=${toggleAccountMenu}
        >
          <span class="account-avatar" aria-hidden="true">${getUserInitials(currentSession)}</span>
          <span class="account-details">
            <span class="account-name">${userLabel}</span>
            <span class="account-caption">Account</span>
          </span>
          <app-icon name="upDown" size="16"></app-icon>
        </button>

        <div
          id="sidebar-account-menu"
          class="account-menu ${isMenuOpen ? "-is-open" : ""}"
          role="menu"
          ?inert=${!isMenuOpen}
          aria-hidden="${!isMenuOpen}"
        >
          <div class="account-menu-info">
            <strong>Signed in</strong>
            <span>${userLabel}</span>
          </div>
          <button
            class="account-menu-item"
            type="button"
            role="menuitem"
            ?disabled=${isLoggingOut}
            @click=${logout}
          >
            <app-icon name="logout" size="16"></app-icon>
            ${isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
          <div class="account-menu-footer"></div>
        </div>
      `,
      account,
    );

    const accountFooter = account.querySelector<HTMLElement>(".account-menu-footer");
    if (!accountFooter) {
      throw new Error("Unable to mount sidebar account menu: footer container is missing");
    }

    disposeAccountFooter = SidebarFooter(accountFooter);
  };

  const toggleAccountMenu = () => {
    if (isMenuOpen) {
      closeAccountMenu(true);
      return;
    }
    isMenuOpen = true;
    renderAccount();
  };

  const closeAccountMenu = (restoreFocus = false) => {
    if (!isMenuOpen) return;
    const menu = account.querySelector<HTMLElement>(".account-menu");
    if (restoreFocus || menu?.contains(document.activeElement)) {
      account.querySelector<HTMLButtonElement>(".account-trigger")?.focus();
    }
    isMenuOpen = false;
    renderAccount();
  };

  const logout = async () => {
    if (isLoggingOut) return;

    isLoggingOut = true;
    closeAccountMenu();
    renderAccount();

    try {
      await authService.logout();
    } catch (error) {
      console.error("Failed to log out", error);
      isLoggingOut = false;
      renderAccount();
    }
  };

  const onDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest(".sidebar-account")) {
      closeAccountMenu();
    }
  };

  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isMenuOpen) {
      closeAccountMenu(true);
    }
  };

  const disposeSessionListener = authService.session$.subscribe((session) => {
    currentSession = session;
    closeAccountMenu();
    renderAccount();
  });

  const handleRouteChange = () => {
    syncOpenItems();
    renderNavigation();
  };

  router.addRouteListener(handleRouteChange);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  renderNavigation();
  renderAccount();

  return () => {
    if (disposed) return;
    disposed = true;
    disposeAccountFooter?.();
    disposeAccountFooter = null;
    disposeSessionListener();
    router.removeRouteListener(handleRouteChange);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onDocumentKeydown);
    render(nothing, target);
  };
}

function NavMain(
  navItems: NavItem[],
  path: string,
  openItems: Set<string>,
  toggleItem: (title: string) => void,
) {
  return html`
    <div class="sidebar-group">
      <div class="sidebar-label">Application</div>
      <ul class="sidebar-menu">
        ${navItems.map((item) => MenuItem(item, path, openItems, toggleItem))}
      </ul>
    </div>
  `;
}

function MenuItem(
  item: NavItem,
  path: string,
  openItems: Set<string>,
  toggleItem: (title: string) => void,
) {
  const isOpen = openItems.has(item.title);
  const active = isItemActive(path, item.url);

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
              ${isOpen ? SubMenu(item.items, path) : nothing}
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

function SubMenu(items: NonNullable<NavItem["items"]>, path: string) {
  return html`
    <div class="sub-menu">
      <ul>
        ${items.map((item) => {
          const active = isItemActive(path, item.url);
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
