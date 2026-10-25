const LOCAL_USER_ID_KEY = "supa_local_user_id";

/** Fixed user id used by Local-Only Mode (`VITE_OFFLINE_MODE=true`). */
export const OFFLINE_USER_ID = "00000000-0000-4000-8000-000000000000";

export type LocalUserStore = {
  get: () => string | null;
  set: (userId: string | null) => void;
};

/**
 * Persists the user id that owns the local PowerSync database in `localStorage`.
 * Used to detect when a session was cleared while the app was closed or when a
 * different user signs in, and to keep the app usable on an offline cold start.
 */
export function createLocalUserStore(): LocalUserStore {
  return {
    get() {
      try {
        return localStorage.getItem(LOCAL_USER_ID_KEY);
      } catch {
        return null;
      }
    },
    set(userId) {
      try {
        if (userId === null) {
          localStorage.removeItem(LOCAL_USER_ID_KEY);
        } else {
          localStorage.setItem(LOCAL_USER_ID_KEY, userId);
        }
      } catch {}
    },
  };
}
