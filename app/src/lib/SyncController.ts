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

function isSameSnapshot(a: SyncStatusData, b: SyncStatusData) {
  return a.connected === b.connected &&
    a.connecting === b.connecting &&
    a.downloading === b.downloading &&
    a.uploading === b.uploading &&
    a.lastSyncedAt?.getTime() === b.lastSyncedAt?.getTime() &&
    a.hasSynced === b.hasSynced &&
    a.error === b.error;
}

/**
 * Mounts on the root element. Components pull by dispatching `loadSyncStatus`
 * (bubbling up); the controller replies with a `syncStatus` data event directly
 * on the requester and keeps it updated on every PowerSync status change.
 *
 * Requesters are held weakly and dropped once garbage collected or detached
 * from the DOM (checked on the next change); a re-attached component must
 * request again. Updates that don't change the snapshot are not dispatched.
 */
export function SyncController(el: HTMLElement) {
  let lastStatus = isOfflineMode ? undefined : powersync.currentStatus;
  let current = lastStatus ? toSyncStatusData(lastStatus) : offlineStatus;

  const requesters = new Set<WeakRef<EventTarget>>();
  const refs = new WeakMap<EventTarget, WeakRef<EventTarget>>();

  const unsubscribeLoad = onAction(el, "loadSyncStatus", (_, e) => {
    const requester = e.target;
    if (!requester) {
      return;
    }

    if (!refs.has(requester)) {
      const ref = new WeakRef(requester);
      refs.set(requester, ref);
      requesters.add(ref);
    }

    down(requester, "syncStatus", current);
  });

  const unregisterStatus = isOfflineMode
    ? undefined
    : powersync.registerListener({
      statusChanged: (status) => {
        // PowerSync's own comparison is a cheap first filter; the snapshot
        // comparison also drops changes we don't expose (e.g. download progress).
        if (lastStatus && status !== lastStatus && lastStatus.isEqual(status)) {
          return;
        }
        lastStatus = status;

        const next = toSyncStatusData(status);
        if (isSameSnapshot(current, next)) {
          return;
        }
        current = next;

        for (const ref of requesters) {
          const requester = ref.deref();
          if (requester && (requester as Node).isConnected) {
            down(requester, "syncStatus", current);
          } else {
            requesters.delete(ref);
            if (requester) {
              refs.delete(requester);
            }
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
