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

type ColorTheme = "slate" | "zinc";

function getActiveTheme(): ColorTheme {
  const current = document.documentElement.getAttribute("data-theme");
  if (current === "zinc" || current === "slate") {
    return current;
  }
  const stored = localStorage.getItem("theme");
  if (stored === "zinc" || stored === "slate") {
    return stored;
  }
  return "slate";
}

function setActiveTheme(theme: ColorTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

export function AppFooter(el: AppFooterElement) {
  el.disposeAppFooter?.();

  let syncStatus: SyncStatusData | null = null;
  let activeTheme: ColorTheme = getActiveTheme();

  const setTheme = (theme: ColorTheme) => {
    if (activeTheme === theme) return;
    activeTheme = theme;
    setActiveTheme(theme);
    renderComponent();
  };

  const renderComponent = () => {
    render(
      html`
        <div class="app-footer">
          <div class="theme-switcher" role="group" aria-label="Teeman valinta">
            <span class="label">Theme:</span>
            <button
              type="button"
              class="theme-btn ${activeTheme === "slate" ? "-is-active" : ""}"
              aria-pressed="${activeTheme === "slate"}"
              @click="${() => setTheme("slate")}"
            >
              Slate
            </button>
            <button
              type="button"
              class="theme-btn ${activeTheme === "zinc" ? "-is-active" : ""}"
              aria-pressed="${activeTheme === "zinc"}"
              @click="${() => setTheme("zinc")}"
            >
              Zinc
            </button>
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
    disposeSyncListener();
    delete el.disposeAppFooter;
  };

  renderComponent();
  dispatchAction(el, "loadSyncStatus");
}
