import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const path = join(process.cwd(), "supabase", "functions", "paystack-customer-portal", "index.ts");

describe("Paystack customer portal function", () => {
  it("generates a hosted management link only for an authenticated workspace member", () => {
    const endpoint = existsSync(path) ? readFileSync(path, "utf8") : "";

    expect(endpoint).toContain("auth.getUser()");
    expect(endpoint).toContain('.from("account_memberships")');
    expect(endpoint).toContain('.from("billing_subscriptions")');
    expect(endpoint).toContain('.eq("provider", "paystack")');
    expect(endpoint).toContain("/subscription/${encodeURIComponent(subscription.provider_subscription_code)}/manage/link");
    expect(endpoint).toContain('hostname === "paystack.com" || hostname.endsWith(".paystack.com")');
    expect(endpoint).not.toContain("providerSubscriptionCode");
  });
});
