import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import billingCountry from "../api/billing-country";

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
    expect(config).toContain("https://eu-assets.i.posthog.com");
    expect(config).toContain("https://eu.i.posthog.com");
    expect(config).toContain("https://fonts.googleapis.com");
    expect(config).toContain("https://fonts.gstatic.com");
    expect(config).not.toContain("unsafe-eval");
  });

  it("keeps the private-beta entry point enabled in production builds without changing local defaults", () => {
    const config = read("netlify.toml");
    expect(config).toContain("[context.production.environment]");
    expect(config).toContain('VITE_PRIVATE_BETA_ENABLED = "true"');
    expect(config).not.toContain("[build.environment]\n  VITE_PRIVATE_BETA_ENABLED");
  });

  it("defines the Vite production build and SPA fallback for Vercel", () => {
    const config = JSON.parse(read("vercel.json")) as {
      framework?: string;
      buildCommand?: string;
      outputDirectory?: string;
      rewrites?: Array<{ source?: string; destination?: string }>;
    };

    expect(config.framework).toBe("vite");
    expect(config.buildCommand).toBe("npm run build");
    expect(config.outputDirectory).toBe("dist");
    expect(config.rewrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/(.*)", destination: "/index.html" }),
    ]));
  });

  it("keeps the browser hardening headers on Vercel", () => {
    const config = JSON.parse(read("vercel.json")) as {
      headers?: Array<{ source?: string; headers?: Array<{ key?: string; value?: string }> }>;
    };
    const headers = config.headers?.flatMap((entry) => entry.headers ?? []) ?? [];
    const values = new Map(headers.map((header) => [header.key, header.value]));

    expect(values.get("X-Content-Type-Options")).toBe("nosniff");
    expect(values.get("X-Frame-Options")).toBe("DENY");
    expect(values.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(values.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=(), payment=(self)");
    expect(values.get("Content-Security-Policy-Report-Only")).toContain("https://cdn.paddle.com");
    expect(values.get("Content-Security-Policy-Report-Only")).toContain("https://eu.i.posthog.com");
  });

  it("preserves the country endpoint contract in the Vercel adapter", () => {
    const edge = read("api", "billing-country.ts");
    expect(edge).toContain('runtime: "edge"');
    expect(edge).toContain("x-vercel-ip-country");
    expect(edge).toContain("/^[A-Z]{2}$/");
    expect(edge).toContain('"Cache-Control": "private, no-store"');
    expect(edge).toContain('"Vary": "Cookie"');
    expect(edge).not.toContain("OTHERS");
  });

  it("reads the country header from Vercel's deployed request shape", async () => {
    const response = billingCountry({
      headers: { "x-vercel-ip-country": "ng" },
    } as unknown as Request) as Response;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ countryCode: "NG" });
  });

  it("completes the response through Vercel's serverless response object", () => {
    const state = { status: 0, headers: new Map<string, string>(), body: null as unknown };
    type VercelResponseMock = {
      status(code: number): VercelResponseMock;
      setHeader(name: string, value: string): void;
      json(body: unknown): unknown;
    };
    const response: VercelResponseMock = {
      status(code: number) {
        state.status = code;
        return response;
      },
      setHeader(name: string, value: string) {
        state.headers.set(name, value);
      },
      json(body: unknown) {
        state.body = body;
        return body;
      },
    };
    const handler = billingCountry as unknown as (request: unknown, response: VercelResponseMock) => unknown;

    handler({ headers: { "x-vercel-ip-country": "NG" } }, response);

    expect(state.status).toBe(200);
    expect(state.headers.get("Cache-Control")).toBe("private, no-store");
    expect(state.headers.get("Vary")).toBe("Cookie");
    expect(state.body).toEqual({ countryCode: "NG" });
  });

  it("pins the Vercel build to the same Node major used by Netlify", () => {
    const packageJson = JSON.parse(read("package.json")) as { engines?: { node?: string } };
    expect(packageJson.engines?.node).toBe("22.x");
  });
});
