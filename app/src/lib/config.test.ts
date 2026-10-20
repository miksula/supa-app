import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllEnvs());

describe("app configuration", () => {
  it("reads endpoints, offline mode and dev prefill centrally", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-publishable-key");
    vi.stubEnv("VITE_POWERSYNC_URL", "http://localhost:8080");
    vi.stubEnv("VITE_OFFLINE_MODE", "true");
    vi.stubEnv("VITE_DEV_EMAIL", "test@example.com");
    vi.stubEnv("VITE_DEV_PASSWORD", "test-password");
    const { config } = await import("./config.ts");
    expect(config).toEqual({
      supabaseUrl: "http://localhost:54321",
      supabaseKey: "test-publishable-key",
      powersyncUrl: "http://localhost:8080",
      isOfflineMode: true,
      isDevelopment: true,
      devEmail: "test@example.com",
      devPassword: "test-password",
    });
  });

  it("never prefills credentials outside development", async () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_DEV_EMAIL", "test@example.com");
    vi.stubEnv("VITE_DEV_PASSWORD", "test-password");
    vi.stubEnv("VITE_OFFLINE_MODE", "false");
    const { config } = await import("./config.ts");
    expect(config.devEmail).toBe("");
    expect(config.devPassword).toBe("");
    expect(config.isOfflineMode).toBe(false);
  });

  it("falls back to the legacy anon key", async () => {
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    const { config } = await import("./config.ts");
    expect(config.supabaseKey).toBe("test-anon-key");
  });
});
