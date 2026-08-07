import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const authenticatedPath = join(process.cwd(), "supabase", "functions", "music-share-links", "index.ts");
const publicPath = join(process.cwd(), "supabase", "functions", "public-music-share", "index.ts");
const configPath = join(process.cwd(), "supabase", "config.toml");

describe("music share-link Edge Functions", () => {
  it("creates, revokes, and optionally emails a selected asset package behind authenticated ownership checks", () => {
    expect(existsSync(authenticatedPath)).toBe(true);
    const source = readFileSync(authenticatedPath, "utf8");

    expect(source).toContain("auth.getUser()");
    expect(source).toContain("is_account_member");
    expect(source).toContain("createShareLink");
    expect(source).toContain("listShareLinks");
    expect(source).toContain("revokeShareLink");
    expect(source).toContain("sendShareEmail");
    expect(source).toContain("crypto.subtle.digest");
    expect(source).toContain("music_assets");
    expect(source).toContain("uploaded_files");
    expect(source).toContain("sendTransactionalEmail");
    expect(source).toContain('Deno.env.get("APP_ORIGIN")');
    expect(source).toContain("music_share_link_created");
    expect(source).toContain("tokenFromPublicUrl");
    expect(source).toContain("Share URL does not match this package");
    expect(source).toContain("asset_manifest");
    expect(source).not.toMatch(/select\([^)]*token_hash[^)]*token[^)]*\)/i);
  });

  it("resolves public packages server-side and issues short-lived downloads only for manifest assets", () => {
    expect(existsSync(publicPath)).toBe(true);
    const source = readFileSync(publicPath, "utf8");

    expect(source).toContain("token_hash");
    expect(source).toContain("crypto.subtle.digest");
    expect(source).toContain("createSignedUrl");
    expect(source).toContain("asset_manifest");
    expect(source).toContain("state",);
    expect(source).toContain("record_music_share_link_access");
    expect(source).not.toContain("access_count: Number(shareLink.access_count");
    expect(source).not.toContain("music_assets");
  });

  it("lets public capabilities and protected cron workers reach their application-level secret checks", () => {
    const config = readFileSync(configPath, "utf8");
    for (const functionName of ["public-music-share", "music-manager-read-refresh-worker", "music-audio-analysis-worker"]) {
      expect(config).toContain(`[functions.${functionName}]\nverify_jwt = false`);
    }
  });
});
