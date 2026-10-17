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

export function AppFooter(el: AppFooterElement) {
  el.disposeAppFooter?.();

  let syncStatus: SyncStatusData | null = null;

  const renderComponent = () => {
    render(
      html`
        <div
          class="app-footer ${syncStatus ? getSyncStatusClass(syncStatus) : ""}"
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
