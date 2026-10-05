import { html, render } from "lit";
import "@/components/app-link.ts";
import { router } from "@packages/router";
import { supabase } from "@/lib/client.ts";
import appLogo from "@/assets/logo.svg";
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

  const renderAppBar = () => {
    const userLabel = currentSession?.user.email ?? "Käyttäjä";

    render(
      html`
        <nav class="app-bar" aria-label="Päänavigaatio">
          <div class="flex gap-2 items-center">
            <img src="${appLogo}" class="size-5" alt="Supa App">
            <span class="text-base font-medium">Supa App</span>
          </div>
          <div class="app-bar__links hidden">
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
          <div class="app-bar__account">
            <button
              class="app-bar__avatar"
              type="button"
              aria-label="Avaa käyttäjävalikko"
              aria-haspopup="menu"
              aria-expanded="${isMenuOpen}"
              @click="${toggleMenu}"
            >${getUserInitials(currentSession)}</button>
            <div
              class="app-bar__menu"
              role="menu"
              ?hidden="${!isMenuOpen}"
            >
              <div class="app-bar__user" role="presentation">
                <strong>${getUserInitials(currentSession)}</strong>
                <span>${userLabel}</span>
              </div>
              <button
                class="app-bar__logout"
                type="button"
                role="menuitem"
                ?disabled="${isLoggingOut}"
                @click="${logout}"
              >${isLoggingOut
                ? "Kirjaudutaan ulos..."
                : "Kirjaudu ulos"}</button>
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
    renderAppBar();
  };

  const toggleMenu = () => {
    isMenuOpen = !isMenuOpen;
    renderAppBar();
  };

  const logout = async () => {
    if (isLoggingOut) {
      return;
    }

    isLoggingOut = true;
    renderAppBar();

    try {
      await supabase.logout();
    } catch (error) {
      console.error("Failed to log out", error);
      isLoggingOut = false;
      renderAppBar();
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
    el.querySelector<HTMLButtonElement>(".app-bar__avatar")?.focus();
  };

  const updatePath = (path: string) => {
    currentPath = path;
    renderAppBar();
  };

  const disposeSessionListener = supabase.registerListener({
    sessionChanged: (session) => {
      currentSession = session;
      closeMenu();
      renderAppBar();
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

  renderAppBar();
}
