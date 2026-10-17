import { html, nothing, render } from "lit";
import { dispatchAction, onData, type SyncStatusData } from "@/lib/events.ts";

type AppFooterElement = HTMLElement & { disposeAppFooter?: () => void };

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

type LightTheme = "basic" | "radix";
type DarkTheme = "newyork" | "slate" | "zinc";

function getActiveLightTheme(): LightTheme {
  const current = document.documentElement.getAttribute("data-light-theme");
  if (current === "basic" || current === "radix") {
    return current;
  }
  const stored = localStorage.getItem("light-theme");
  if (stored === "basic" || stored === "radix") {
    return stored;
  }
  return "basic";
}

function setActiveLightTheme(theme: LightTheme) {
  document.documentElement.setAttribute("data-light-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("light-theme", theme);
}

function getActiveDarkTheme(): DarkTheme {
  const current = document.documentElement.getAttribute("data-dark-theme");
  if (current === "newyork" || current === "slate" || current === "zinc") {
    return current;
  }
  const stored = localStorage.getItem("dark-theme");
  if (stored === "newyork" || stored === "slate" || stored === "zinc") {
    return stored;
  }
  return "slate";
}

function setActiveDarkTheme(theme: DarkTheme) {
  document.documentElement.setAttribute("data-dark-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("dark-theme", theme);
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

export function AppFooter(el: AppFooterElement) {
  el.disposeAppFooter?.();

  let syncStatus: SyncStatusData | null = null;
  let isDark = isDarkModeActive();
  let activeLightTheme: LightTheme = getActiveLightTheme();
  let activeDarkTheme: DarkTheme = getActiveDarkTheme();

  const selectLightTheme = (theme: LightTheme) => {
    if (activeLightTheme === theme) return;
    activeLightTheme = theme;
    setActiveLightTheme(theme);
    renderComponent();
  };

  const selectDarkTheme = (theme: DarkTheme) => {
    if (activeDarkTheme === theme) return;
    activeDarkTheme = theme;
    setActiveDarkTheme(theme);
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
        <div class="app-footer">
          <div class="theme-switcher" role="group" aria-label="Teeman valinta">
            <span class="label">Theme (${isDark ? "Dark" : "Light"}):</span>
            ${
              isDark
                ? html`
                    <button
                      type="button"
                      class="theme-btn ${activeDarkTheme === "newyork" ? "-is-active" : ""}"
                      aria-pressed="${activeDarkTheme === "newyork"}"
                      @click="${() => selectDarkTheme("newyork")}"
                    >
                      New York
                    </button>
                    <button
                      type="button"
                      class="theme-btn ${activeDarkTheme === "slate" ? "-is-active" : ""}"
                      aria-pressed="${activeDarkTheme === "slate"}"
                      @click="${() => selectDarkTheme("slate")}"
                    >
                      Slate
                    </button>
                    <button
                      type="button"
                      class="theme-btn ${activeDarkTheme === "zinc" ? "-is-active" : ""}"
                      aria-pressed="${activeDarkTheme === "zinc"}"
                      @click="${() => selectDarkTheme("zinc")}"
                    >
                      Zinc
                    </button>
                  `
                : html`
                    <button
                      type="button"
                      class="theme-btn ${activeLightTheme === "basic" ? "-is-active" : ""}"
                      aria-pressed="${activeLightTheme === "basic"}"
                      @click="${() => selectLightTheme("basic")}"
                    >
                      Basic
                    </button>
                    <button
                      type="button"
                      class="theme-btn ${activeLightTheme === "radix" ? "-is-active" : ""}"
                      aria-pressed="${activeLightTheme === "radix"}"
                      @click="${() => selectLightTheme("radix")}"
                    >
                      Radix
                    </button>
                  `
            }
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

  el.disposeAppFooter = () => {
    colorSchemeQuery.removeEventListener("change", checkColorMode);
    observer.disconnect();
    disposeSyncListener();
    delete el.disposeAppFooter;
  };

  renderComponent();
  dispatchAction(el, "loadSyncStatus");
}
