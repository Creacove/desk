import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("private-beta access backend contract", () => {
  it("adds isolated beta batches, hashed codes, grants, and email deliveries without replacing paid activation", () => {
    const migrationPath = join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260713000100_private_beta_access_and_transactional_email.sql",
    );

    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create table public.private_beta_batches");
    expect(migration).toContain("create table public.private_beta_codes");
    expect(migration).toContain("create table public.workspace_access_grants");
    expect(migration).toContain("create table public.transactional_email_deliveries");
    expect(migration).toContain("create or replace function public.activate_beta_artist_workspace");
    expect(migration).toContain("for update");
    expect(migration).toContain("digest(upper(trim(p_code)), 'sha256')");
    expect(migration).toContain("now() + interval '30 days'");
    expect(migration).toContain("public.has_active_workspace_entitlement");
    expect(migration).not.toContain("create or replace function public.activate_paid_artist_workspace");
    expect(migration).not.toContain("beta_redeemed");
  });

  it("allows the existing setup orchestrator only for paid checkouts or matching active beta grants", () => {
    const setup = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(setup).toContain("isAuthorizedSetupCheckout");
    expect(setup).toContain('checkout.status === "paid"');
    expect(setup).toContain('.from("workspace_access_grants")');
    expect(setup).toContain('.eq("access_type", "private_beta")');
    expect(setup).toContain('.eq("user_id", checkout.user_id)');
    expect(setup).toContain('.eq("artist_workspace_id", checkout.artist_workspace_id)');
  });

  it("redeems beta codes through an authenticated edge function and dispatches the existing discovery phase", () => {
    const functionPath = join(process.cwd(), "supabase", "functions", "redeem-private-beta-code", "index.ts");
    expect(existsSync(functionPath)).toBe(true);
    const redeem = readFileSync(functionPath, "utf8");

    expect(redeem).toContain('PRIVATE_BETA_ENABLED');
    expect(redeem).toContain("auth.auth.getUser()");
    expect(redeem).toContain('.rpc("activate_beta_artist_workspace"');
    expect(redeem).toContain('phase: "discovery"');
    expect(redeem).toContain('functionName: "paid-workspace-setup"');
    expect(redeem).not.toContain("console.log");
  });

  it("creates individual or community batches with raw codes returned once and only hashes persisted", () => {
    const functionPath = join(process.cwd(), "supabase", "functions", "create-beta-invite-batch", "index.ts");
    expect(existsSync(functionPath)).toBe(true);
    const batch = readFileSync(functionPath, "utf8");

    expect(batch).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(batch).toContain("crypto.getRandomValues");
    expect(batch).toContain("code_hash");
    expect(batch).toContain("code_hint");
    expect(batch).not.toContain("raw_code:");
  });

  it("deduplicates transactional Resend sends and never exposes secrets client-side", () => {
    const email = source("supabase", "functions", "_shared", "transactionalEmail.ts");
    const env = source(".env.example");

    expect(email).toContain("transactional_email_deliveries");
    expect(email).toContain('"Idempotency-Key"');
    expect(email).toContain("RESEND_API_KEY");
    expect(email).toContain("ORDERSOUNDS_FROM_EMAIL");
    expect(email).toContain("ORDERSOUNDS_REPLY_TO_EMAIL");
    expect(env).toContain("PRIVATE_BETA_ENABLED=");
    expect(env).toContain("VITE_PRIVATE_BETA_ENABLED=");
    expect(env).not.toContain("VITE_RESEND_API_KEY");
  });

  it("sends distinct account, invitation, paid, and beta emails without making access depend on delivery", () => {
    const account = source("supabase", "functions", "send-account-welcome", "index.ts");
    const invite = source("supabase", "functions", "create-beta-invite-batch", "index.ts");
    const paid = source("supabase", "functions", "_shared", "accessEmails.ts");
    const beta = source("supabase", "functions", "redeem-private-beta-code", "index.ts");
    const webhook = source("supabase", "functions", "paystack-webhook", "index.ts");

    expect(account).toContain("Your OrderSounds account is ready");
    expect(invite).toContain("private-beta access code");
    expect(paid).toContain("Your OrderSounds subscription is active");
    expect(paid).toContain("periodEnd");
    expect(beta).toContain("Welcome to the OrderSounds private beta");
    expect(beta).toContain("No card is required");
    expect(webhook).toContain("sendPaidSubscriptionActivatedEmail");
    expect(webhook).toContain(".catch(() => undefined)");
  });
});
