import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("payment deployment configuration", () => {
  it("serves only a validated country code from Netlify geolocation", () => {
    const edge = read("netlify", "edge-functions", "billing-country.ts");
    const config = read("netlify.toml");
    expect(edge).toContain("context.geo?.country?.code");
    expect(edge).toContain("x-vercel-ip-country");
    expect(edge).toContain("/^[A-Z]{2}$/");
    expect(edge).not.toContain("OTHERS");
    expect(config).toContain('path = "/api/billing-country"');
  });

  it("documents every Paddle and multi-interval Paystack secret without exposing values", () => {
    const env = read(".env.example");
    for (const name of [
      "PADDLE_ENVIRONMENT", "PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN", "PADDLE_WEBHOOK_SECRET",
      "PADDLE_PRO_PRODUCT_ID", "PADDLE_PRO_MONTHLY_PRICE_ID", "PADDLE_PRO_YEARLY_PRICE_ID",
      "BILLING_WORKER_SECRET", "PAYSTACK_MONTHLY_PLAN_CODE", "PAYSTACK_YEARLY_PLAN_CODE",
      "PAYSTACK_MONTHLY_AMOUNT_MINOR", "PAYSTACK_YEARLY_AMOUNT_MINOR", "LOCAL_APP_ORIGIN",
    ]) expect(env).toContain(`${name}=`);
    expect(env).not.toMatch(/PADDLE_API_KEY=\S+/);
    expect(env).not.toMatch(/PADDLE_WEBHOOK_SECRET=\S+/);
  });

  it("adds baseline browser hardening and a report-only Paddle CSP for origin capture", () => {
    const config = read("netlify.toml");
    expect(config).toContain('X-Content-Type-Options = "nosniff"');
    expect(config).toContain('X-Frame-Options = "DENY"');
    expect(config).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(config).toContain("Content-Security-Policy-Report-Only");
    expect(config).toContain("https://cdn.paddle.com");
    expect(config).not.toContain("unsafe-eval");
  });
});
