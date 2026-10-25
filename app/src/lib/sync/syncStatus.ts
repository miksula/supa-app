import type { PowerSyncDatabase, SyncStatus as PowerSyncStatus } from "@powersync/web";
import type { Dispose } from "@/types.ts";

export type SyncStatus = {
  connected: boolean;
  connecting: boolean;
  downloading: boolean;
  uploading: boolean;
  localOnly?: boolean;
  lastSyncedAt?: Date;
  hasSynced?: boolean;
  error?: Error;
};

/** Read-only view of the PowerSync connection state for UI components. */
export type SyncStatusSource = {
  current: () => SyncStatus;
  subscribe: (listener: (status: SyncStatus) => void) => Dispose;
};

const LOCAL_ONLY_STATUS: SyncStatus = {
  connected: false,
  connecting: false,
  downloading: false,
  uploading: false,
  localOnly: true,
};

/** Status source for Local-Only Mode: never connects and never changes. */
export function createLocalOnlyStatusSource(): SyncStatusSource {
  return { current: () => LOCAL_ONLY_STATUS, subscribe: () => () => {} };
}

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
