import { html, render } from "lit";
import "@/lib/AppLink.ts";
import { router } from "@packages/router";
import { authService } from "@/lib/auth.ts";
import { dispatchAction, onData, type SyncStatusData } from "@/lib/events.ts";
import appLogo from "@/assets/logo.svg";
import logoutIcon from "@/assets/logout-icon.svg";
import moonIcon from "@/assets/moon-icon.svg";
import sunIcon from "@/assets/sun-icon.svg";
import type { Session } from "@supabase/supabase-js";

type AppBarElement = HTMLElement & { disposeAppBar?: () => void };

const navItems = [{ text: "Työpöytä", to: "/" }];

function getAvatarName(session: Session | null) {
  return session?.user.email ?? session?.user.id ?? "Käyttäjä";
}

function getUserInitials(session: Session | null) {
  const parts = getAvatarName(session)
    .split(/[\s@._-]+/)
    .filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (parts[0] ?? "K").slice(0, 2).toUpperCase();
}

function getSyncLabel(status: SyncStatusData | null) {
  if (!status) return "";
  if (status.error) return "Synkronointivirhe";
  if (status.connecting) return "Yhdistetään...";
  if (!status.connected) return "Ei yhteyttä";
  return status.downloading || status.uploading ? "Synkronoidaan..." : "Synkronoitu";
}

export function AppBar(el: AppBarElement, initialPath = router.path) {
  el.disposeAppBar?.();

  let currentPath = initialPath;
  let currentSession = authService.session;
  let isMenuOpen = false;
  let isLoggingOut = false;
  let isDarkMode = document.documentElement.classList.contains("-invertcolorscheme");
  let syncStatus: SyncStatusData | null = null;

  const renderComponent = () => {
    const userLabel = currentSession?.user.email ?? "Käyttäjä";

    render(
      html`
        <nav class="app-bar" aria-label="Päänavigaatio">
          <div class="flex gap-2 items-center">
            <img src="${appLogo}" class="size-5" alt="Supa App" />
            <span class="text-base font-medium">Supa App</span>
          </div>

          <div class="links">
            ${navItems.map(
              (item) => html`
                <app-link
                  text="${item.text}"
                  to="${item.to}"
                  ?active="${item.to === currentPath}"
                ></app-link>
              `,
            )}
          </div>

          <span class="sync-status" role="status"> ${getSyncLabel(syncStatus)} </span>

          <button
            type="button"
            class="app-button theme-toggle"
            aria-label="${isDarkMode ? "Vaihda vaaleaan teemaan" : "Vaihda tummaan teemaan"}"
            aria-pressed="${isDarkMode}"
            @click="${toggleTheme}"
          >
            <img
              class="app-icon"
              src="${isDarkMode ? sunIcon : moonIcon}"
              alt=""
              aria-hidden="true"
            />
          </button>

          <div class="account">
            <button
              type="button"
              class="avatar size-8"
              aria-label="Avaa käyttäjävalikko"
              aria-expanded="${isMenuOpen}"
              @click="${toggleMenu}"
            >
              <span class="text-sm font-medium text-white">
                ${getUserInitials(currentSession)}
              </span>
            </button>

            <div
              id="user-menu"
              class="menu ${isMenuOpen ? "-is-open" : ""}"
              aria-hidden="${!isMenuOpen}"
            >
              <div class="user-info" role="presentation">
                <strong>Signed in as</strong>
                <span>${userLabel}</span>
              </div>

              <button class="logout" type="button" ?disabled="${isLoggingOut}" @click="${logout}">
                <img src="${logoutIcon}" alt="Logout Icon" class="size-4 inline-block mr-2" />
                ${isLoggingOut ? "Kirjaudutaan ulos..." : "Kirjaudu ulos"}
              </button>
            </div>
          </div>
        </nav>
      `,
      el,
    );
  };

  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
    renderComponent();
  };

  const closeMenu = () => {
    if (isMenuOpen) {
      isMenuOpen = false;
      renderComponent();
    }
  };

  const toggleTheme = () => {
    isDarkMode = !isDarkMode;
    document.documentElement.classList.toggle("-invertcolorscheme", isDarkMode);
    renderComponent();
  };

  const onDocumentClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element) || !event.target.closest(".account")) {
      closeMenu();
    }
  };

  const onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && isMenuOpen) {
      closeMenu();
      el.querySelector<HTMLButtonElement>(".avatar")?.focus();
    }
  };

  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    isLoggingOut = true;
    closeMenu();
    renderComponent();

    try {
      await authService.logout();
    } catch (error) {
      console.error("Failed to log out", error);
      isLoggingOut = false;
      renderComponent();
    }
  };

  const updatePath = (path: string) => {
    currentPath = path;
    closeMenu();
    renderComponent();
  };

  const disposeSessionListener = authService.session$.subscribe(function updateSession(session) {
    currentSession = session;
    closeMenu();
    renderComponent();
  });

  const disposeSyncListener = onData(el, "syncStatus", function updateSyncStatus(status) {
    syncStatus = status;
    renderComponent();
  });

  router.addRouteListener(updatePath);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  el.disposeAppBar = () => {
    disposeSessionListener();
    disposeSyncListener();
    router.removeRouteListener(updatePath);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onDocumentKeydown);
    delete el.disposeAppBar;
  };

  renderComponent();
  dispatchAction(el, "loadSyncStatus");
}
