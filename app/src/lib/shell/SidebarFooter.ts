import { html, nothing, render } from "lit";
import { dispatchAction, onData, type SyncStatusData } from "@/events.ts";

type SidebarFooterElement = HTMLElement & { disposeSidebarFooter?: () => void };
type ThemeScheme = "light" | "dark";
type ThemeOption = {
  id: string;
  label: string;
  scheme: ThemeScheme;
};

const lightThemes: ThemeOption[] = [{ id: "newyork", label: "Light", scheme: "light" }];
const darkThemes: ThemeOption[] = [{ id: "newyork", label: "Dark", scheme: "dark" }];

function getSyncLabel(status: SyncStatusData | null) {
  if (!status) return "";
  if (status.error) return "Synkronointivirhe";
  if (status.connecting) return "Yhdistetään...";
  if (!status.connected) return "Ei yhteyttä";
  return status.downloading || status.uploading ? "Synkronoidaan..." : "Synkronoitu";
}

function getSyncStatusClass(status: SyncStatusData) {
  return status.error || !status.connected ? "-is-error" : "-is-connected";
}

function isDarkModeActive(): boolean {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta?.content === "dark") return true;
  if (meta?.content === "light") return false;
  const inline = document.documentElement.style.colorScheme;
  if (inline === "dark") return true;
  if (inline === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function setColorScheme(scheme: "light" | "dark") {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (meta) {
    meta.content = scheme;
  }
  document.documentElement.style.colorScheme = scheme;
  localStorage.setItem("color-scheme", scheme);
}

function getActiveTheme(scheme: ThemeScheme, themes: ThemeOption[]) {
  const attribute = scheme === "light" ? "data-light-theme" : "data-dark-theme";
  const storageKey = scheme === "light" ? "light-theme" : "dark-theme";
  const current = document.documentElement.getAttribute(attribute);
  if (current && themes.some((theme) => theme.id === current)) {
    return current;
  }

  const stored = localStorage.getItem(storageKey);
  if (stored && themes.some((theme) => theme.id === stored)) {
    return stored;
  }

  return themes[0].id;
}

function setActiveTheme(theme: ThemeOption) {
  const attribute = theme.scheme === "light" ? "data-light-theme" : "data-dark-theme";
  const storageKey = theme.scheme === "light" ? "light-theme" : "dark-theme";
  document.documentElement.setAttribute(attribute, theme.id);
  document.documentElement.setAttribute("data-theme", theme.id);
  localStorage.setItem(storageKey, theme.id);
}

export function SidebarFooter(el: SidebarFooterElement) {
  el.disposeSidebarFooter?.();

  let syncStatus: SyncStatusData | null = null;
  let isDark = isDarkModeActive();
  let activeLightTheme = getActiveTheme("light", lightThemes);
  let activeDarkTheme = getActiveTheme("dark", darkThemes);

  const selectTheme = (theme: ThemeOption) => {
    setActiveTheme(theme);
    setColorScheme(theme.scheme);
    isDark = theme.scheme === "dark";
    if (theme.scheme === "dark") {
      activeDarkTheme = theme.id;
    } else {
      activeLightTheme = theme.id;
    }
    renderComponent();
  };

  const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const checkColorMode = () => {
    const nextIsDark = isDarkModeActive();
    if (nextIsDark !== isDark) {
      isDark = nextIsDark;
      renderComponent();
    }
  };

  colorSchemeQuery.addEventListener("change", checkColorMode);

  const observer = new MutationObserver(checkColorMode);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  const metaEl = document.querySelector('meta[name="color-scheme"]');
  if (metaEl) {
    observer.observe(metaEl, { attributes: true, attributeFilter: ["content"] });
  }

  const renderComponent = () => {
    render(
      html`
        <div class="sidebar-footer">
          <div class="theme-switcher" role="group" aria-label="Teeman valinta">
            <span class="label">Theme:</span>
            ${[...lightThemes, ...darkThemes].map((theme) => {
              const isActive =
                (theme.scheme === "dark" && isDark && activeDarkTheme === theme.id) ||
                (theme.scheme === "light" && !isDark && activeLightTheme === theme.id);
              return html`
                <button
                  type="button"
                  class="theme-btn ${isActive ? "-is-active" : ""}"
                  aria-pressed="${isActive}"
                  @click="${() => selectTheme(theme)}"
                >
                  ${theme.label}
                </button>
              `;
            })}
          </div>

          <div
            class="sync-status ${syncStatus ? getSyncStatusClass(syncStatus) : ""}"
            role="status"
            aria-label="Synkronoinnin tila"
          >
            ${
              syncStatus
                ? html`
                    <span class="status-indicator" aria-hidden="true"></span>
                    ${getSyncLabel(syncStatus)}
                  `
                : nothing
            }
          </div>
        </div>
      `,
      el,
    );
  };

  const disposeSyncListener = onData(el, "syncStatus", function updateSyncStatus(status) {
    syncStatus = status;
    renderComponent();
  });

  el.disposeSidebarFooter = () => {
    colorSchemeQuery.removeEventListener("change", checkColorMode);
    observer.disconnect();
    disposeSyncListener();
    delete el.disposeSidebarFooter;
  };

  renderComponent();
  dispatchAction(el, "loadSyncStatus");
}
