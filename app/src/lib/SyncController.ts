import type { SyncStatus } from "@powersync/web";
import { isOfflineMode, powersync } from "@/lib/client.ts";
import { down, onAction, type SyncStatusData } from "@/lib/events.ts";

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
 * Mounts on the root element. Turns PowerSync status changes into `syncStatus`
 * data events dispatched on `el`, and answers `loadSyncStatus` actions by
 * replying directly to the requesting element.
 */
export function SyncController(el: HTMLElement) {
  let current = isOfflineMode
    ? offlineStatus
    : toSyncStatusData(powersync.currentStatus);

  const unsubscribeLoad = onAction(el, "loadSyncStatus", (_, e) => {
    if (e.target) {
      down(e.target, "syncStatus", current);
    }
  });

  const unregisterStatus = isOfflineMode
    ? undefined
    : powersync.registerListener({
      statusChanged: (status) => {
        current = toSyncStatusData(status);
        down(el, "syncStatus", current);
      },
    });

  return () => {
    unsubscribeLoad();
    unregisterStatus?.();
  };
}
