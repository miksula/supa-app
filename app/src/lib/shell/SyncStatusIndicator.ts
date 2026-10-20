import { html, nothing, render } from "lit";
import { dispatchAction, onData, type SyncStatusData } from "@/events.ts";
import type { Dispose } from "@/types.ts";
import "./sync-status-indicator.css";

function getSyncLabel(status: SyncStatusData) {
  if (status.error) return "Synkronointivirhe";
  if (status.connecting) return "Yhdistetään...";
  if (!status.connected) return "Ei yhteyttä";
  return status.downloading || status.uploading ? "Synkronoidaan..." : "Synkronoitu";
}

export function SyncStatusIndicator(el: HTMLElement): Dispose {
  let disposed = false;
  const renderComponent = (status: SyncStatusData | null) => {
    if (disposed) return;
    const statusClass = status
      ? status.error || !status.connected
        ? "-is-error"
        : "-is-connected"
      : "";
    render(
      html`
        <div class="sync-status ${statusClass}" role="status" aria-label="Synkronoinnin tila">
          ${
            status
              ? html`
                  <span class="status-indicator" aria-hidden="true"></span>
                  ${getSyncLabel(status)}
                `
              : nothing
          }
        </div>
      `,
      el,
    );
  };
  const disposeListener = onData(el, "syncStatus", renderComponent);
  renderComponent(null);
  dispatchAction(el, "loadSyncStatus");

  return () => {
    if (disposed) return;
    disposed = true;
    disposeListener();
    render(nothing, el);
  };
}
