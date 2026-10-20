import type { AuthChangeEvent, Session, SupabaseClient } from "@supabase/supabase-js";

export type SessionObservable = {
  subscribe: (listener: (session: Session | null) => void) => () => void;
};

export class AuthService {
  readonly client: SupabaseClient;
  readonly session$: SessionObservable;

  ready = false;
  private currentSession: Session | null = null;
  private readonly sessionListeners = new Set<(session: Session | null) => void>();

  constructor(client: SupabaseClient) {
    this.client = client;

    this.session$ = {
      subscribe: (listener) => {
        this.sessionListeners.add(listener);
        return () => this.sessionListeners.delete(listener);
      },
    };
  }

  get session() {
    return this.currentSession;
  }

  get isAuthenticated() {
    return this.currentSession !== null;
  }

  async init() {
    if (this.ready) {
      return;
    }

    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }

    this.updateSession(session);
    this.ready = true;
  }

  async login(email: string, password: string) {
    const {
      data: { session },
      error,
    } = await this.client.auth.signInWithPassword({ email, password });

    if (error) {
      throw error;
    }

    this.updateSession(session);
  }

  async logout() {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }

    this.updateSession(null);
  }

  async getSession() {
    const {
      data: { session },
      error,
    } = await this.client.auth.getSession();

    if (error) {
      throw error;
    }

    return session;
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.client.auth.onAuthStateChange((event, session) => {
      this.updateSession(session);
      callback(event, session);
    });
  }

  private updateSession(session: Session | null) {
    this.currentSession = session;
    for (const listener of this.sessionListeners) {
      listener(session);
    }
  }
}
