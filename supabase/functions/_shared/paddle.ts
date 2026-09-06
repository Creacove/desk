import { Environment, Paddle } from "npm:@paddle/paddle-node-sdk@3.8.0";

export type PaddleEnvironment = "sandbox" | "production";

export function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function readPaddleEnvironment(): PaddleEnvironment {
  const value = requireEnv("PADDLE_ENVIRONMENT");
  if (value !== "sandbox" && value !== "production") {
    throw new Error("PADDLE_ENVIRONMENT must be sandbox or production.");
  }
  return value;
}

export function createPaddleClient() {
  const environment = readPaddleEnvironment();
  return new Paddle(requireEnv("PADDLE_API_KEY"), {
    environment: environment === "sandbox" ? Environment.sandbox : Environment.production,
  });
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type BillingPlanKey = "solo" | "team_6";

export function readCanonicalPaddlePrice(interval: "monthly" | "yearly", planKey: BillingPlanKey = "solo") {
  if (planKey === "team_6" && interval !== "monthly") throw new Error("Team is available monthly only.");
  const productId = planKey === "team_6" ? requireEnv("PADDLE_TEAM_PRODUCT_ID") : requireEnv("PADDLE_PRO_PRODUCT_ID");
  const priceId = planKey === "team_6"
    ? requireEnv("PADDLE_TEAM_MONTHLY_PRICE_ID")
    : interval === "monthly"
      ? requireEnv("PADDLE_PRO_MONTHLY_PRICE_ID")
      : requireEnv("PADDLE_PRO_YEARLY_PRICE_ID");
  return { productId, priceId };
}
