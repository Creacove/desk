import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({ auth: {} }));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

describe("browser Supabase client", () => {
  beforeEach(() => {
    createClient.mockClear();
  });

  it("reuses one auth client for every production adapter and poller", async () => {
    const { createBrowserSupabaseClient } = await import("./lib/supabaseClient");

    const first = createBrowserSupabaseClient();
    const second = createBrowserSupabaseClient();

    expect(second).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);
  });
});
