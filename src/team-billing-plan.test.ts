import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Team billing plan contract", () => {
  it("keeps solo as the default and requires distinct monthly and yearly Team prices", () => {
    const paddle = read("supabase/functions/_shared/paddle.ts");
    expect(paddle).toContain('planKey: BillingPlanKey = "solo"');
    expect(paddle).toContain('PADDLE_TEAM_PRODUCT_ID');
    expect(paddle).toContain('PADDLE_TEAM_MONTHLY_PRICE_ID');
    expect(paddle).toContain('PADDLE_TEAM_YEARLY_PRICE_ID');
    expect(paddle).not.toContain('Team is available monthly only');
  });

  it("publishes and accepts both Team billing intervals", () => {
    const pricing = read("supabase/functions/billing-pricing-config/index.ts");
    const checkout = read("supabase/functions/paddle-create-checkout/index.ts");
    const webhook = read("supabase/functions/paddle-process-webhooks/index.ts");
    const dialog = read("src/features/billing/SubscriptionPlanDialog.tsx");
    expect(pricing).toContain('priceId: { monthly: teamMonthly.priceId, yearly: teamYearly.priceId }');
    expect(checkout).not.toContain("Team is available monthly only");
    expect(webhook).not.toContain("Verified Team checkout must be monthly");
    expect(dialog).not.toContain('disabled={loading || opening || !pricing || planKey === "team_6"}');
  });

  it("binds idempotent checkout reuse to plan and limits Team purchase to owners", () => {
    const checkout = read("supabase/functions/paddle-create-checkout/index.ts");
    expect(checkout).toContain('(existingRequest.plan_key ?? "solo") !== planKey');
    expect(checkout).toContain('.eq("plan_key", planKey)');
    expect(checkout).toContain('Only the workspace owner can purchase Team.');
    expect(checkout).toContain('plan_key: planKey');
  });

  it("derives entitlement from the provider-verified checkout and reconciles replay safely", () => {
    const webhook = read("supabase/functions/paddle-process-webhooks/index.ts");
    expect(webhook).toContain("reconcileVerifiedCheckoutPlan");
    expect(webhook).toContain('.eq("provider_subscription_code", subscriptionId)');
    expect(webhook).toContain('.eq("provider_product_id", productId)');
    expect(webhook).toContain('.eq("provider_price_id", priceId)');
    expect(webhook).toContain('plan_key: planKey');
    expect(webhook).toContain('enabled: true');
    expect(webhook).not.toMatch(/amount_minor\s*[<>=].*team_6/i);
  });
});
