import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("split confirmation environment wiring", () => {
  it("documents every server-side secret needed by split confirmation functions", () => {
    const envExample = readFileSync(join(process.cwd(), ".env.example"), "utf8");

    expect(envExample).toContain("RESEND_API_KEY=");
    expect(envExample).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(envExample).toContain("SPLIT_CONFIRMATION_FROM_EMAIL=");
  });

  it("ships a script that syncs Resend and split confirmation secrets to Supabase Edge Functions", () => {
    const scriptPath = join(process.cwd(), "scripts", "set-split-confirmation-secrets.ps1");
    expect(existsSync(scriptPath)).toBe(true);

    const script = readFileSync(scriptPath, "utf8");
    expect(script).toContain("RESEND_API_KEY");
    expect(script).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(script).toContain("SPLIT_CONFIRMATION_FROM_EMAIL");
    expect(script).toContain("supabase secrets set");
    expect(script).toContain("--project-ref");
  });

  it("exposes the split secret sync script through npm", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };

    expect(pkg.scripts?.["secrets:splits"]).toBe("powershell -ExecutionPolicy Bypass -File scripts/set-split-confirmation-secrets.ps1");
  });
});
