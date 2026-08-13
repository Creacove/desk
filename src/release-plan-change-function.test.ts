import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const functionPath = resolve(process.cwd(), "supabase/functions/release-plan-change/index.ts");
const configPath = resolve(process.cwd(), "supabase/config.toml");
const source = existsSync(functionPath) ? readFileSync(functionPath, "utf8") : "";
const config = readFileSync(configPath, "utf8");

describe("release plan change Edge boundary", () => {
  it("authenticates the user and derives the song workspace server-side", () => {
    expect(existsSync(functionPath)).toBe(true);
    expect(source).toContain("authClient.auth.getUser");
    expect(source).toContain('rpc("is_account_member"');
    expect(source).toContain('from("music_items")');
    expect(source).toContain("account_id");
    expect(source).toContain("artist_workspace_id");
    expect(source).toContain("artist_id");
    const requestType = source.match(/type\s+ReleasePlanChangeRequest[\s\S]*?type\s+Scope/i)?.[0] ?? "";
    expect(requestType).not.toContain("accountId");
    expect(source).toContain('createClient(supabaseUrl, requireEnv("SUPABASE_SERVICE_ROLE_KEY"))');
  });

  it("accepts only bounded propose or approve payloads and calls the matching RPC", () => {
    expect(source).toMatch(/action:\s*"propose"/);
    expect(source).toMatch(/action:\s*"approve"/);
    expect(source).toContain('propose_release_date_change');
    expect(source).toContain('approve_release_date_change');
    expect(source).toMatch(/UUID_PATTERN/);
    expect(source).toMatch(/ISO_DATE_PATTERN/);
    expect(source).toMatch(/MAX_REASON_LENGTH/);
    expect(source).toMatch(/MAX_HASH_LENGTH/);
    expect(source).toMatch(/MAX_IDEMPOTENCY_LENGTH/);
    expect(source).toMatch(/expectedRevision/);
    expect(source).toMatch(/previewHash/);
    expect(source).toMatch(/idempotencyKey/);
  });

  it("returns safe status mappings and captures unexpected failures by workflow stage", () => {
    expect(source).toMatch(/release_plan_stale[\s\S]*409/);
    expect(source).toMatch(/release_request_expired[\s\S]*409/);
    expect(source).toMatch(/release_request_not_pending[\s\S]*409/);
    expect(source).toContain("VALIDATION_CODES");
    expect(source).toContain("release_reason_invalid");
    expect(source).toContain("OWNERSHIP_CODES");
    expect(source).toContain("release_request_owner_invalid");
    expect(source).toMatch(/(?:status:\s*400|,\s*400\))/);
    expect(source).toMatch(/(?:status:\s*401|,\s*401\))/);
    expect(source).toMatch(/(?:status:\s*403|,\s*403\))/);
    expect(source).toMatch(/(?:status:\s*500|,\s*500\))/);
    expect(source).toContain("captureAppError");
    expect(source).toContain("reschedule_preview");
    expect(source).toContain("reschedule_approval");
    expect(source).toContain("errorEventId");
  });

  it("keeps stale, expired, validation, and ownership outcomes out of unexpected-error telemetry", () => {
    const unexpectedCapture = source.indexOf("const errorEventId = await captureAppError");
    expect(unexpectedCapture).toBeGreaterThan(-1);
    for (const branch of [
      "if (databaseCode && CONFLICT_CODES.has(databaseCode))",
      "if (databaseCode && VALIDATION_CODES.has(databaseCode))",
      "if (databaseCode && OWNERSHIP_CODES.has(databaseCode))",
    ]) {
      expect(source.indexOf(branch)).toBeGreaterThan(-1);
      expect(source.indexOf(branch)).toBeLessThan(unexpectedCapture);
    }
    expect(source).toContain('return json({ error: conflictMessage(databaseCode), code: databaseCode }, 409);');
    expect(source).toContain('return json({ error: validationMessage(databaseCode), code: databaseCode }, 400);');
    expect(source).toContain('error: "You do not have permission to change this release plan."');
    expect(source).not.toContain('captureAppError(new Error("The release plan is stale"');
  });

  it("returns proposal or receipt state without logging private preview bodies", () => {
    expect(source).toMatch(/status:\s*"proposed"/);
    expect(source).toMatch(/status:\s*"applied"/);
    expect(source).toMatch(/request/);
    expect(source).toMatch(/receipt/);
    expect(source).not.toMatch(/console\.(log|error|warn)[^\n]*preview/i);
  });

  it("registers the function behind the authenticated gateway", () => {
    expect(config).toContain("[functions.release-plan-change]");
    expect(config).toMatch(/\[functions\.release-plan-change\][\s\S]*?verify_jwt\s*=\s*true/i);
  });
});
