import { html, render } from "lit";
import "@/components/app-link.ts";
import { router } from "@packages/router";
import { supabase } from "@/lib/client.ts";
import appLogo from "@/assets/logo.svg";
import logoutIcon from "@/assets/logout-icon.svg";
import type { Session } from "@supabase/supabase-js";

type AppBarElement = HTMLElement & { disposeAppBar?: () => void };

const navItems = [
  { text: "Työpöytä", to: "/" },
];

function getAvatarName(session: Session | null) {
  return session?.user.email ?? session?.user.id ?? "Käyttäjä";
}

function getUserInitials(session: Session | null) {
  const parts = getAvatarName(session).split(/[\s@._-]+/).filter(Boolean);
  return parts.length > 1
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : (parts[0] ?? "K").slice(0, 2).toUpperCase();
}

export function AppBar(el: AppBarElement, initialPath = router.path) {
  el.disposeAppBar?.();

  let currentPath = initialPath;
  let currentSession = supabase.currentSession;
  let isMenuOpen = false;
  let isLoggingOut = false;

  const renderComponent = () => {
    const userLabel = currentSession?.user.email ?? "Käyttäjä";

    render(
      html`
        <nav class="app-bar" aria-label="Päänavigaatio">
          <div class="flex gap-2 items-center">
            <img src="${appLogo}" class="size-5" alt="Supa App">
            <span class="text-base font-medium">Supa App</span>
          </div>

          <div class="links">
            ${navItems.map((item) =>
              html`
                <app-link
                  text="${item.text}"
                  to="${item.to}"
                  ?active="${item.to === currentPath}"
                ></app-link>
              `
            )}
          </div>

          <div class="account">
            <span
              class="avatar size-8"
              aria-label="Avaa käyttäjävalikko"
              aria-haspopup="menu"
              aria-expanded="${isMenuOpen}"
              @click="${toggleMenu}"
            >
              <span class="text-sm font-medium text-white">
                ${getUserInitials(currentSession)}
              </span>
            </span>

            <div
              class="menu"
              role="menu"
              ?hidden="${!isMenuOpen}"
            >
              <div class="user" role="presentation">
                <strong>Signed in as</strong>
                <span>${userLabel}</span>
              </div>

              <button
                class="logout"
                type="button"
                role="menuitem"
                ?disabled="${isLoggingOut}"
                @click="${logout}"
              >
                  <img src="${logoutIcon}" alt="Logout Icon" class="size-4 inline-block mr-2">
                  ${isLoggingOut ? "Kirjaudutaan ulos..." : "Kirjaudu ulos"}
              </button>
            </div>
          </div>
        </nav>
      `,
      el,
    );
  };

  const closeMenu = () => {
    if (!isMenuOpen) {
      return;
    }
    isMenuOpen = false;
    renderComponent();
  };

  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
    renderComponent();
  };

  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    isLoggingOut = true;
    renderComponent();

    try {
      await supabase.logout();
    } catch (error) {
      console.error("Failed to log out", error);
      isLoggingOut = false;
      renderComponent();
    }
  };

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (!el.contains(event.target as Node)) {
      closeMenu();
    }
  };

  const onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !isMenuOpen) {
      return;
    }

    event.preventDefault();
    closeMenu();
    el.querySelector<HTMLButtonElement>(".avatar")?.focus();
  };

  const updatePath = (path: string) => {
    currentPath = path;
    renderComponent();
  };

  const disposeSessionListener = supabase.registerListener({
    sessionChanged: (session) => {
      currentSession = session;
      closeMenu();
      renderComponent();
    },
  });

  router.addRouteListener(updatePath);
  document.addEventListener("pointerdown", onDocumentPointerDown);
  document.addEventListener("keydown", onDocumentKeyDown);

  el.disposeAppBar = () => {
    disposeSessionListener();
    router.removeRouteListener(updatePath);
    document.removeEventListener("pointerdown", onDocumentPointerDown);
    document.removeEventListener("keydown", onDocumentKeyDown);
    delete el.disposeAppBar;
  };

  renderComponent();
}
