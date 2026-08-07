import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const functionPath = resolve(process.cwd(), "supabase/functions/initialize-song-workspace/index.ts");
const servicePath = resolve(process.cwd(), "src/services/productionSupabase.ts");

describe("manual song workspace function contract", () => {
  it("requires an authenticated request before calling the workspace RPC", () => {
    expect(existsSync(functionPath)).toBe(true);
    const source = readFileSync(functionPath, "utf8");
    expect(source).toContain("authClient.auth.getUser");
    expect(source).toContain("create_manual_song_workspace_v1");
    expect(source).toContain("assertActiveWorkspaceEntitlement");
  });

  it("exposes the server-owned workspace initializer through the music repository", () => {
    const source = readFileSync(servicePath, "utf8");
    expect(source).toContain("createSongWorkspace");
    expect(source).toContain('functions.invoke("initialize-song-workspace"');
  });
});
