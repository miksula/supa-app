import { html, nothing, render } from "lit";
import type { SyncStatus, SyncStatusSource } from "@/sync/syncStatus.ts";
import type { Dispose } from "@/types.ts";
import "./sync-status-indicator.css";

function getSyncLabel(status: SyncStatus) {
  if (status.error) return "Sync error";
  if (status.connecting) return "Connecting...";
  if (!status.connected) return "Offline";
  return status.downloading || status.uploading ? "Syncing..." : "Synced";
}

export function SyncStatusIndicator(el: HTMLElement, syncStatus: SyncStatusSource): Dispose {
  let disposed = false;
  const renderComponent = (status: SyncStatus) => {
    if (disposed) return;
    const statusClass = status.error || !status.connected ? "-is-error" : "-is-connected";
    render(
      html`
        <div class="sync-status ${statusClass}" role="status" aria-label="Sync status">
          <span class="status-indicator" aria-hidden="true"></span>
          ${getSyncLabel(status)}
        </div>
      `,
      el,
    );
  };
  const unsubscribe = syncStatus.subscribe(renderComponent);
  renderComponent(syncStatus.current());

  return () => {
    if (disposed) return;
    disposed = true;
    unsubscribe();
    render(nothing, el);
  };
}
