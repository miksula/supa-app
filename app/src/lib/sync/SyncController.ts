import type { SyncStatus } from "@powersync/web";
import { isOfflineMode, powersync } from "@/lib/client.ts";
import { dispatchData, onAction, type SyncStatusData } from "@/lib/events.ts";

function toSyncStatusData(status: SyncStatus): SyncStatusData {
  return {
    connected: status.connected,
    connecting: status.connecting,
    downloading: status.downloading,
    uploading: status.uploading,
    lastSyncedAt: status.lastSyncedAt,
    hasSynced: status.hasSynced,
    error: status.downloadError ?? status.uploadError,
  };
}

const offlineStatus: SyncStatusData = {
  connected: false,
  connecting: false,
  downloading: false,
  uploading: false,
};

/**
 * Mounts on the root element. Components pull by dispatching `loadSyncStatus`
 * (bubbling up); the controller replies with a `syncStatus` data event directly
 * on the requester and keeps it updated on every PowerSync status change.
 * Requesters that left the DOM are dropped on the next change.
 */
export function SyncController(el: HTMLElement) {
  let current = isOfflineMode ? offlineStatus : toSyncStatusData(powersync.currentStatus);
  const requesters = new Set<EventTarget>();

  const unsubscribeLoad = onAction(el, "loadSyncStatus", (_, e) => {
    if (e.target) {
      requesters.add(e.target);
      dispatchData(e.target, "syncStatus", current);
    }
  });

  const unregisterStatus = isOfflineMode
    ? undefined
    : powersync.registerListener({
        statusChanged: (status) => {
          current = toSyncStatusData(status);

          for (const requester of requesters) {
            if ((requester as Node).isConnected) {
              dispatchData(requester, "syncStatus", current);
            } else {
              requesters.delete(requester);
            }
          }
        },
      });

  return () => {
    unsubscribeLoad();
    unregisterStatus?.();
    requesters.clear();
  };
}
