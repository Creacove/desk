const PLACEHOLDER = /^(?:changeme|replace[-_ ]?me|placeholder|example|test|your[-_]|xxx|todo|tbd)$/i;
const LOCAL_HOST = /^(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)$/i;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function required(errors, env, name) {
  const value = text(env[name]);
  if (!value) errors.push(`${name} is required in production.`);
  else if (PLACEHOLDER.test(value)) errors.push(`${name} still contains a placeholder value.`);
  return value;
}

function productionUrl(errors, name, value) {
  const raw = text(value);
  if (!raw) {
    errors.push(`${name} is required in production.`);
    return;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") errors.push(`${name} must use HTTPS.`);
    if (LOCAL_HOST.test(parsed.hostname) || parsed.hostname.endsWith(".local")) errors.push(`${name} must not point to localhost/local development.`);
  } catch {
    errors.push(`${name} must be a valid absolute URL.`);
  }
}

export function validateProductionEnv(env = process.env) {
  const errors = [];

  if (text(env.VITE_APP_MODE).toLowerCase() !== "production") {
    errors.push("VITE_APP_MODE must be production for a production deploy.");
  }
  if (text(env.APP_ENVIRONMENT).toLowerCase() !== "production") {
    errors.push("APP_ENVIRONMENT must be production so telemetry is attributed to the correct environment.");
  }

  productionUrl(errors, "VITE_SUPABASE_URL", env.VITE_SUPABASE_URL);
  required(errors, env, "VITE_SUPABASE_ANON_KEY");
  required(errors, env, "SUPABASE_SERVICE_ROLE_KEY");
  required(errors, env, "OPENAI_API_KEY");
  required(errors, env, "APP_RELEASE");

  const appOrigin = text(env.PUBLIC_APP_URL) || text(env.APP_ORIGIN);
  productionUrl(errors, text(env.PUBLIC_APP_URL) ? "PUBLIC_APP_URL" : "APP_ORIGIN", appOrigin);

  required(errors, env, "SPOTIFY_CLIENT_ID");
  required(errors, env, "SPOTIFY_CLIENT_SECRET");
  productionUrl(errors, "SPOTIFY_REDIRECT_URI", env.SPOTIFY_REDIRECT_URI);

  if (text(env.RESEND_API_KEY) || text(env.ORDERSOUNDS_FROM_EMAIL)) {
    required(errors, env, "RESEND_API_KEY");
    required(errors, env, "ORDERSOUNDS_FROM_EMAIL");
  }

  const paddleConfigured = ["PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN", "PADDLE_WEBHOOK_SECRET"].some((key) => text(env[key]));
  if (paddleConfigured) {
    if (text(env.PADDLE_ENVIRONMENT).toLowerCase() !== "production") {
      errors.push("PADDLE_ENVIRONMENT must be production when Paddle credentials are configured for a production deploy.");
    }
    for (const key of ["PADDLE_API_KEY", "PADDLE_CLIENT_TOKEN", "PADDLE_WEBHOOK_SECRET", "PADDLE_NOTIFICATION_DESTINATION_ID", "PADDLE_PRO_PRODUCT_ID", "PADDLE_PRO_MONTHLY_PRICE_ID", "PADDLE_PRO_YEARLY_PRICE_ID"]) {
      required(errors, env, key);
    }
  }

  const paystackConfigured = text(env.PAYSTACK_SECRET_KEY) || text(env.PAYSTACK_MONTHLY_PLAN_CODE) || text(env.PAYSTACK_YEARLY_PLAN_CODE);
  if (paystackConfigured) {
    for (const key of ["PAYSTACK_SECRET_KEY", "PAYSTACK_MONTHLY_PLAN_CODE", "PAYSTACK_YEARLY_PLAN_CODE"]) required(errors, env, key);
    productionUrl(errors, "PAYSTACK_CALLBACK_URL", env.PAYSTACK_CALLBACK_URL);
  }

  return errors;
}

export function assertProductionEnv(env = process.env) {
  const errors = validateProductionEnv(env);
  if (!errors.length) return;
  throw new Error(`Production environment validation failed:\n- ${errors.join("\n- ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    assertProductionEnv(process.env);
    console.log("Production environment contract is valid.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
