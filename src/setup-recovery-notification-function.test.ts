import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionPath = join(process.cwd(), "supabase", "functions", "send-setup-recovery-notification", "index.ts");
const functionSource = existsSync(functionPath) ? readFileSync(functionPath, "utf8") : "";

describe("setup recovery notification function", () => {
  it("only lets trusted server work notify a user after their setup and first brief are ready", () => {
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain('eq("checkout_session_id", input.checkoutSessionId)');
    expect(functionSource).toContain('eq("status", "completed")');
    expect(functionSource).toContain('eq("output_type", "setup_first_manager_read")');
    expect(functionSource).toContain("auth.admin.getUserById");
  });

  it("uses the shared production mailer and an idempotent recovery event key", () => {
    expect(functionSource).toContain("sendTransactionalEmail");
    expect(functionSource).toContain("setup-recovered-chartmetric:");
    expect(functionSource).toContain("Your OrderSounds setup is ready");
    expect(functionSource).toContain("We identified and resolved an issue that affected your account setup.");
  });
});
