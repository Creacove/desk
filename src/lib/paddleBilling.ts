import { initializePaddle, type Environments, type Paddle } from "@paddle/paddle-js";

export type BillingProvider = "paddle" | "paystack";
export type BillingProviderPreference = "auto" | BillingProvider;
export type PaddleClientConfig = { environment: Environments; clientToken: string };

let paddlePromise: Promise<Paddle> | null = null;
let initializedConfig: string | null = null;

export function validatePaddleClientConfig(config: PaddleClientConfig) {
  if (config.environment !== "sandbox" && config.environment !== "production") {
    throw new Error("Paddle environment must be explicitly configured.");
  }
  const expectedPrefix = config.environment === "sandbox" ? "test_" : "live_";
  if (!config.clientToken.startsWith(expectedPrefix)) {
    throw new Error(`Paddle client token must start with ${expectedPrefix} in ${config.environment}.`);
  }
  return config;
}

export function getPaddle(config: PaddleClientConfig) {
  validatePaddleClientConfig(config);
  const key = `${config.environment}:${config.clientToken}`;
  if (initializedConfig && initializedConfig !== key) {
    throw new Error("Paddle was already initialized with different account configuration.");
  }
  if (!paddlePromise) {
    initializedConfig = key;
    paddlePromise = initializePaddle({ environment: config.environment, token: config.clientToken })
      .then((instance) => {
        if (!instance) throw new Error("Paddle.js did not initialize.");
        return instance;
      });
  }
  return paddlePromise;
}

export async function previewLocalizedPaddlePrice(paddle: Pick<Paddle, "PricePreview">, priceId: string, countryCode?: string) {
  if (!priceId.startsWith("pri_")) throw new Error("Paddle price ID is invalid.");
  const normalizedCountry = normalizeCountryCode(countryCode);
  const response = await paddle.PricePreview({
    items: [{ priceId, quantity: 1 }],
    ...(normalizedCountry ? { address: { countryCode: normalizedCountry } } : {}),
  });
  const lineItem = response.data.details.lineItems.find((item) => item.price.id === priceId);
  const formattedTotal = lineItem?.formattedTotals.total;
  if (!formattedTotal) throw new Error("Paddle did not return a localized total for this plan.");
  return {
    priceId,
    formattedTotal,
    countryCode: normalizeCountryCode(response.data.address?.countryCode),
  };
}

export function resolveBillingProvider(
  serverCountryCode?: string,
  paddleCountryCode?: string,
  preference: BillingProviderPreference = "auto",
): BillingProvider {
  if (preference !== "auto" && preference !== "paddle" && preference !== "paystack") {
    throw new Error("Billing provider preference is invalid.");
  }
  if (preference !== "auto") return preference;
  const serverCountry = normalizeCountryCode(serverCountryCode);
  const paddleCountry = normalizeCountryCode(paddleCountryCode);
  return (serverCountry ?? paddleCountry) === "NG" ? "paystack" : "paddle";
}

export function openPaddleCheckout(paddle: Pick<Paddle, "Checkout">, input: {
  displayedPriceId: string;
  checkoutPriceId: string;
  email: string;
  customData: Record<string, unknown>;
}) {
  if (input.displayedPriceId !== input.checkoutPriceId) {
    throw new Error("Pricing changed while checkout was loading. Refresh the displayed price and try again.");
  }
  if (!input.email.trim()) throw new Error("A signed-in email is required for checkout.");
  paddle.Checkout.open({
    items: [{ priceId: input.checkoutPriceId, quantity: 1 }],
    customer: { email: input.email },
    customData: input.customData,
    settings: {
      displayMode: "overlay",
      variant: "one-page",
      successUrl: `${window.location.origin}/welcome`,
    },
  });
}

export function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : undefined;
}
