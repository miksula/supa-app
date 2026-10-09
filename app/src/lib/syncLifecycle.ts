import type { AuthChangeEvent } from "@supabase/supabase-js";

export type SyncAuth = {
  onAuthStateChange: (callback: (event: AuthChangeEvent) => void) => unknown;
};

export type SyncControls = {
  connect: () => Promise<void>;
  reset: () => Promise<void>;
};

/** Connects/resets sync on auth changes. Knows nothing about routing. */
export function startSyncLifecycle(auth: SyncAuth, sync: SyncControls) {
  return auth.onAuthStateChange(async (event) => {
    try {
      if (event === "SIGNED_IN") {
        await sync.connect();
      } else if (event === "SIGNED_OUT") {
        await sync.reset();
      }
    } catch (error) {
      console.error(`Failed to update sync after ${event}`, error);
    }
  });
}
