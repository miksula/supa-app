import type { Session } from "@supabase/supabase-js";
import type { AppAuthService, AuthStateListener } from "./AuthService.ts";
import { OFFLINE_USER_ID } from "./localUserStore.ts";

const LOCAL_SESSION_KEY = "supa_local_session";

export type LocalCredentials = { email: string; password: string };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/** A Supabase-shaped session, so the rest of the app can't tell the modes apart. */
export function createLocalSession(email: string): Session {
  return {
    access_token: "local-only",
    refresh_token: "local-only",
    token_type: "bearer",
    // Placeholder: Local-Only Mode never refreshes or sends tokens.
    expires_in: 3600,
    user: {
      id: OFFLINE_USER_ID,
      email,
      aud: "authenticated",
      role: "authenticated",
      app_metadata: { provider: "local" },
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  };
}

/**
 * Cosmetic sign-in for Local-Only Mode. Accepts one email/password pair that is
 * compiled into the build: it hides the UI from casual visitors but does not
 * protect the data stored on the device.
 */
export class LocalAuthService implements AppAuthService {
  private currentSession: Session | null = null;
  private initialized = false;
  private readonly listeners = new Set<AuthStateListener>();

  constructor(private readonly credentials: LocalCredentials) {}

  get session() {
    return this.currentSession;
  }

  get userId(): string | null {
    return this.currentSession?.user.id ?? null;
  }

  get isAuthenticated() {
    return this.currentSession !== null;
  }

  get ready() {
    return this.initialized;
  }

  async init() {
    if (this.initialized) return;
    const storedEmail = readStoredEmail();
    if (
      storedEmail !== null &&
      this.isConfigured() &&
      normalizeEmail(storedEmail) === normalizeEmail(this.credentials.email)
    ) {
      this.currentSession = createLocalSession(this.credentials.email);
    } else if (storedEmail !== null) {
      writeStoredEmail(null);
    }
    this.initialized = true;
  }

  async login(email: string, password: string) {
    if (!this.isConfigured()) {
      throw new Error("Local-only login is not configured");
    }
    if (
      normalizeEmail(email) !== normalizeEmail(this.credentials.email) ||
      password !== this.credentials.password
    ) {
      throw new Error("Invalid login credentials");
    }

    const session = createLocalSession(this.credentials.email);
    this.currentSession = session;
    writeStoredEmail(this.credentials.email);
    await this.emit("SIGNED_IN", session);
  }

  async logout() {
    this.currentSession = null;
    writeStoredEmail(null);
    await this.emit("SIGNED_OUT", null);
  }

  onAuthStateChange(listener: AuthStateListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private isConfigured() {
    return this.credentials.email.trim() !== "" && this.credentials.password !== "";
  }

  private async emit(event: "SIGNED_IN" | "SIGNED_OUT", session: Session | null) {
    await Promise.all([...this.listeners].map((listener) => listener(event, session)));
  }
}

function readStoredEmail(): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      "email" in parsed &&
      typeof parsed.email === "string"
      ? parsed.email
      : null;
  } catch {
    return null;
  }
}

function writeStoredEmail(email: string | null) {
  try {
    if (email === null) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
    } else {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify({ email }));
    }
  } catch {}
}
