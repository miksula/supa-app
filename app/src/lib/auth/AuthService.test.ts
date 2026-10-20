import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { AuthService } from "./AuthService.ts";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({})) }));

describe("AuthService configuration", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([true, false])("configures auth persistence for offline=%s", (isOfflineMode) => {
    const config = {
      supabaseUrl: "http://localhost:54321",
      supabaseKey: "test-publishable-key",
      isOfflineMode,
    };

    const auth = new AuthService(config);

    expect(auth.config).toBe(config);
    expect(createClient).toHaveBeenCalledExactlyOnceWith(config.supabaseUrl, config.supabaseKey, {
      auth: {
        persistSession: !isOfflineMode,
        autoRefreshToken: !isOfflineMode,
        detectSessionInUrl: !isOfflineMode,
      },
    });
  });
});
