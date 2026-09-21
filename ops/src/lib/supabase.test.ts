import { describe, expect, it } from "vitest";
import { isValidSupabaseUrl } from "./supabase";

describe("Supabase runtime configuration", () => {
  it("rejects a malformed URL instead of allowing client construction to crash the app", () => {
    expect(isValidSupabaseUrl("y\nhttps://bbwbxmnanccwottrmkqu.supabase.co")).toBe(false);
    expect(isValidSupabaseUrl("https://bbwbxmnanccwottrmkqu.supabase.co")).toBe(true);
    expect(isValidSupabaseUrl("not-a-url")).toBe(false);
  });
});
