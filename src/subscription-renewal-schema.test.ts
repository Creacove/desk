import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260831000100_subscription_renewal_recovery.sql",
);

function migrationSource() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
}

describe("subscription renewal schema", () => {
  it("records every verified recurring transaction without replaying checkout fulfillment", () => {
    const migration = migrationSource();

    expect(migration).toContain("drop constraint if exists billing_transactions_checkout_session_id_key");
    expect(migration).toContain("create or replace function public.record_verified_subscription_renewal");
    expect(migration).toContain("provider_subscription_code = p_provider_subscription_id");
    expect(migration).toContain("provider_customer_code is distinct from p_provider_customer_id");
    expect(migration).toContain("provider_price_id is distinct from p_provider_price_id");
    expect(migration).toContain("upper(subscription.currency) is distinct from upper(p_currency)");
    expect(migration).toContain("amount_minor is distinct from p_total_minor");
    expect(migration).toContain("on conflict (provider, provider_transaction_id) do update");
    expect(migration).toContain("current_period_start = p_current_period_start");
    expect(migration).toContain("current_period_end = p_current_period_end");
  });

  it("marks a reactivation setup row complete when the workspace was already prepared", () => {
    const migration = migrationSource();

    expect(migration).toContain("create or replace function public.complete_reactivation_setup_run");
    expect(migration).toContain("before insert on public.workspace_setup_runs");
    expect(migration).toContain("existing_setup.status = 'completed'");
    expect(migration).toContain("new.status := 'completed'");
    expect(migration).toContain("new.current_stage := 'music_reads'");
  });
});
