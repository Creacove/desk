import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({ auth: {} }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("browser Supabase client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://activity-center-test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "activity-center-test-anon-key");
    createClient.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reuses one auth client for every production adapter and poller", async () => {
    const { createBrowserSupabaseClient } = await import("./lib/supabaseClient");

    const first = createBrowserSupabaseClient();
    const second = createBrowserSupabaseClient();

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createClient).toHaveBeenCalledWith("https://activity-center-test.supabase.co", "activity-center-test-anon-key", {
      realtime: { params: { eventsPerSecond: 10 } },
    });
  });
});
