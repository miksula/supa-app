import {
  type AuthChangeEvent,
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

const isOfflineMode = import.meta.env.VITE_OFFLINE_MODE === "true";

export type SupabaseConfig = {
  supabaseUrl: string;
  supabaseKey: string;
};

export type SessionObservable = {
  subscribe: (listener: (session: Session | null) => void) => () => void;
};

export class AuthService {
  readonly client: SupabaseClient;
  readonly config: SupabaseConfig;
  readonly session$: SessionObservable;

  ready = false;
  private currentSession: Session | null = null;
  private readonly sessionListeners = new Set<
    (session: Session | null) => void
  >();

  constructor() {
    this.config = {
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
        import.meta.env.VITE_SUPABASE_ANON_KEY,
    };

    this.client = createClient(
      this.config.supabaseUrl,
      this.config.supabaseKey,
      {
        auth: {
          persistSession: !isOfflineMode,
          autoRefreshToken: !isOfflineMode,
          detectSessionInUrl: !isOfflineMode,
        },
      },
    );

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

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
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
