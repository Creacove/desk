import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("hardened multi-provider billing security contract", () => {
  const migrationPath = [
    "supabase",
    "migrations",
    "20260714000200_hardened_multi_provider_billing.sql",
  ];

  it("removes every authenticated checkout mutation path", () => {
    const migration = source(...migrationPath);

    expect(migration).toContain("drop policy if exists billing_checkout_sessions_user_insert");
    expect(migration).toContain("revoke insert, update, delete on public.billing_checkout_sessions from authenticated");
    expect(migration).toContain("revoke all on public.billing_checkout_sessions from anon");
    expect(migration).toContain("grant select on public.billing_checkout_sessions to authenticated");
  });

  it("adds private customer and transaction ledgers with service-only grants", () => {
    const migration = source(...migrationPath);

    expect(migration).toContain("create table public.billing_customers");
    expect(migration).toContain("create table public.billing_transactions");
    expect(migration).toContain("alter table public.billing_customers enable row level security");
    expect(migration).toContain("alter table public.billing_transactions enable row level security");
    expect(migration).toContain("revoke all on public.billing_customers from anon, authenticated");
    expect(migration).toContain("revoke all on public.billing_transactions from anon, authenticated");
    expect(migration).toContain("grant all on public.billing_customers to service_role");
    expect(migration).toContain("grant all on public.billing_transactions to service_role");
  });

  it("turns webhook events into a claimable durable service-only queue", () => {
    const migration = source(...migrationPath);

    expect(migration).toContain("attempt_count integer not null default 0");
    expect(migration).toContain("next_attempt_at timestamptz");
    expect(migration).toContain("claimed_at timestamptz");
    expect(migration).toContain("for update skip locked");
    expect(migration).toContain("create or replace function public.claim_billing_webhook_events");
    expect(migration).toContain("revoke all on function public.claim_billing_webhook_events(integer) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.claim_billing_webhook_events(integer) to service_role");
  });

  it("defines an atomic service-only verified checkout fulfillment boundary", () => {
    const migration = source(...migrationPath);

    expect(migration).toContain("create or replace function public.fulfill_verified_checkout");
    expect(migration).toContain("for update");
    expect(migration).toContain("checkout provider does not match verified transaction");
    expect(migration).toContain("checkout price does not match verified transaction");
    expect(migration).toContain("checkout correlation does not match verified transaction");
    expect(migration).toContain("activate_paid_artist_workspace");
    expect(migration).toContain("revoke all on function public.fulfill_verified_checkout");
    expect(migration).toContain("grant execute on function public.fulfill_verified_checkout");
  });

  it("keeps Paddle access provider-aware and ignores scheduled cancellation until status changes", () => {
    const migration = source(...migrationPath);

    expect(migration).toContain("subscription.provider = 'paddle'");
    expect(migration).toContain("subscription.status in ('active', 'trialing')");
    expect(migration).toContain("subscription.provider = 'paystack'");
    expect(migration).toContain("subscription.status in ('active', 'non-renewing', 'attention')");
    expect(migration).not.toContain("scheduled_change_action is null");
  });

  it("requires durable payment evidence before paid discovery can run", () => {
    const setup = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(setup).toContain('.from("billing_transactions")');
    expect(setup).toContain('.eq("status", "completed")');
    expect(setup).toContain('.from("billing_subscriptions")');
    expect(setup).toContain("subscriptionGrantsPaidSetupAccess");
  });
});
