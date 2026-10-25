import {
  isAuthRetryableFetchError,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";
import type { LocalUserStore } from "./localUserStore.ts";

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void | Promise<void>;

/** The auth surface the rest of the app uses; implemented by AuthService and LocalAuthService. */
export type AppAuthService = Pick<
  AuthService,
  | "session"
  | "userId"
  | "isAuthenticated"
  | "ready"
  | "init"
  | "login"
  | "logout"
  | "onAuthStateChange"
>;

/**
 * Wraps Supabase auth and caches the current session so it can be read
 * synchronously (route guard, sidebar). Supabase emits an event for every
 * session change, including after `login` and `logout`, so that single
 * subscription is the only place the cached session is updated.
 */
export class AuthService {
  private currentSession: Session | null = null;
  private offlineUserId: string | null = null;
  private initialized = false;
  private readonly listeners = new Set<AuthStateListener>();

  constructor(
    private readonly client: SupabaseClient,
    private readonly userStore?: Pick<LocalUserStore, "get">,
  ) {
    client.auth.onAuthStateChange(async (event, session) => {
      this.currentSession = session;
      if (session || event === "SIGNED_OUT") {
        this.offlineUserId = null;
      }
      await Promise.all([...this.listeners].map((listener) => listener(event, session)));
    });
  }

  get session() {
    return this.currentSession;
  }

  /** Active user id from the live session, or the bound local DB owner during an offline cold start. */
  get userId(): string | null {
    return this.currentSession?.user.id ?? this.offlineUserId;
  }

  get isAuthenticated() {
    return this.userId !== null;
  }

  /** True once the stored session has been read. */
  get ready() {
    return this.initialized;
  }

  async init() {
    if (this.initialized) {
      return;
    }

    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      const storedUserId = this.userStore?.get() ?? null;
      if (isAuthRetryableFetchError(error) && storedUserId) {
        this.currentSession = null;
        this.offlineUserId = storedUserId;
        this.initialized = true;
        return;
      }
      this.initialized = true;
      throw error;
    }

    this.currentSession = session;
    this.offlineUserId = null;
    this.initialized = true;
  }

  async login(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /** Subscribe to session changes. Returns an unsubscribe function. */
  onAuthStateChange(listener: AuthStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
