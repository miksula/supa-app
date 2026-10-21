import type { PowerSyncDatabase, SyncStatus as PowerSyncStatus } from "@powersync/web";
import type { Dispose } from "@/types.ts";

export type SyncStatus = {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  lastSyncedAt?: Date;
  hasSynced?: boolean;
  error?: Error;
};

/** Read-only view of the PowerSync connection state for UI components. */
export type SyncStatusSource = {
  current: () => SyncStatus;
  subscribe: (listener: (status: SyncStatus) => void) => Dispose;
};

function toSyncStatus(status: PowerSyncStatus): SyncStatus {
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

export function createSyncStatusSource(
  powersync: Pick<PowerSyncDatabase, "currentStatus" | "registerListener">,
): SyncStatusSource {
  return {
    current: () => toSyncStatus(powersync.currentStatus),
    subscribe: (listener) =>
      powersync.registerListener({ statusChanged: (status) => listener(toSyncStatus(status)) }),
  };
}
