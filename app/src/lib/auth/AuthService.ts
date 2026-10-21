import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";

export type AuthStateListener = (
  event: AuthChangeEvent,
  session: Session | null,
) => void | Promise<void>;

/**
 * Wraps Supabase auth and caches the current session so it can be read
 * synchronously (route guard, sidebar). Supabase emits an event for every
 * session change, including after `login` and `logout`, so that single
 * subscription is the only place the cached session is updated.
 */
export class AuthService {
  private currentSession: Session | null = null;
  private initialized = false;
  private readonly listeners = new Set<AuthStateListener>();

  constructor(private readonly client: SupabaseClient) {
    client.auth.onAuthStateChange(async (event, session) => {
      this.currentSession = session;
      await Promise.all([...this.listeners].map((listener) => listener(event, session)));
    });
  }

  get session() {
    return this.currentSession;
  }

  get isAuthenticated() {
    return this.currentSession !== null;
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
      throw error;
    }

    this.currentSession = session;
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
