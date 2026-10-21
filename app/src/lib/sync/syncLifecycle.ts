import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export type SyncControls = {
  connect: () => Promise<void>;
  reset: () => Promise<void>;
};

/**
 * Connects/resets sync in response to auth events. Knows nothing about routing
 * or subscriptions: the owner feeds it events. Supabase fires SIGNED_IN often
 * (e.g. on tab focus), so connect runs once per user until SIGNED_OUT.
 */
export function createSyncLifecycle(sync: SyncControls) {
  let connectedUserId: string | null = null;

  async function connectFor(session: Session) {
    if (connectedUserId === session.user.id) {
      return;
    }

    connectedUserId = session.user.id;
    try {
      await sync.connect();
    } catch (error) {
      connectedUserId = null;
      console.error("Failed to connect sync", error);
    }
  }

  return {
    /** Connect for an already-present session (e.g. at bootstrap). */
    async start(session: Session | null) {
      if (session) {
        await connectFor(session);
      }
    },

    async handleAuthEvent(event: AuthChangeEvent, session: Session | null) {
      if (event === "SIGNED_IN" && session) {
        await connectFor(session);
      } else if (event === "SIGNED_OUT") {
        connectedUserId = null;
        try {
          await sync.reset();
        } catch (error) {
          console.error("Failed to reset sync after sign-out", error);
        }
      }
    },
  };
}

export type SyncLifecycle = ReturnType<typeof createSyncLifecycle>;
