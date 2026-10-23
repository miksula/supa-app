import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { LocalUserStore } from "@/auth/localUserStore.ts";

export type SyncControls = {
  connect: () => Promise<void>;
  reset: () => Promise<void>;
  userStore?: LocalUserStore;
};

/**
 * Connects/resets sync in response to auth events and binds the local database
 * to a single user id. Knows nothing about routing or subscriptions: the owner
 * feeds it events. Supabase fires SIGNED_IN often (e.g. on tab focus), so
 * connect runs once per user until SIGNED_OUT.
 */
export function createSyncLifecycle(sync: SyncControls) {
  let connectedUserId: string | null = null;
  let storedUserId: string | null = sync.userStore?.get() ?? null;

  function setStoredUserId(userId: string | null) {
    storedUserId = userId;
    sync.userStore?.set(userId);
  }

  async function resetLocalData() {
    connectedUserId = null;
    try {
      await sync.reset();
      setStoredUserId(null);
    } catch (error) {
      console.error("Failed to reset sync", error);
    }
  }

  async function connectFor(session: Session) {
    const userId = session.user.id;
    if (connectedUserId === userId) {
      return;
    }

    if (storedUserId !== null && storedUserId !== userId) {
      await resetLocalData();
    }

    connectedUserId = userId;
    try {
      await sync.connect();
      setStoredUserId(userId);
    } catch (error) {
      connectedUserId = null;
      console.error("Failed to connect sync", error);
    }
  }

  return {
    /**
     * Start sync for an already-present session (e.g. at bootstrap), or clear
     * stale local data if the session was revoked while the app was closed.
     * When `hasFallbackUser` is true (offline cold start with an expired token),
     * keep the local database intact for the last known user.
     */
    async start(session: Session | null, options?: { hasFallbackUser?: boolean }) {
      if (session) {
        await connectFor(session);
      } else if (storedUserId !== null && !options?.hasFallbackUser) {
        await resetLocalData();
      }
    },

    async handleAuthEvent(event: AuthChangeEvent, session: Session | null) {
      if (event === "SIGNED_IN" && session) {
        await connectFor(session);
      } else if (event === "SIGNED_OUT") {
        await resetLocalData();
      }
    },
  };
}

export type SyncLifecycle = ReturnType<typeof createSyncLifecycle>;
