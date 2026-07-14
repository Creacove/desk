type CanonicalPlan = {
  name: string;
  amount: number;
  interval: "monthly" | "annually";
  currency: "NGN";
};

const CANONICAL_PLANS: CanonicalPlan[] = [
  { name: "OrderSounds Pro Monthly NGN", amount: 3_000_000, interval: "monthly", currency: "NGN" },
  { name: "OrderSounds Pro Yearly NGN", amount: 30_000_000, interval: "annually", currency: "NGN" },
];

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!timingSafeEqual(supplied, serviceRoleKey)) return json({ error: "Unauthorized." }, 401);

  try {
    const secretKey = requireEnv("PAYSTACK_SECRET_KEY");
    const existing = await listPlans(secretKey);
    const plans = [];
    for (const expected of CANONICAL_PLANS) {
      const match = existing.find((plan) =>
        plan.name === expected.name && Number(plan.amount) === expected.amount &&
        plan.interval === expected.interval && String(plan.currency).toUpperCase() === expected.currency
      );
      plans.push(match ?? await createPlan(secretKey, expected));
    }
    return json({
      monthlyPlanCode: readPlanCode(plans[0]),
      yearlyPlanCode: readPlanCode(plans[1]),
      currency: "NGN",
      monthlyAmountMinor: 3_000_000,
      yearlyAmountMinor: 30_000_000,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Paystack catalog could not be reconciled." }, 500);
  }
});

async function listPlans(secretKey: string) {
  const response = await fetch("https://api.paystack.co/plan?perPage=100", {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: any[] } | null;
  if (!response.ok || payload?.status !== true || !Array.isArray(payload.data)) {
    throw new Error(payload?.message ?? `Paystack plan lookup failed with ${response.status}.`);
  }
  return payload.data;
}

async function createPlan(secretKey: string, plan: CanonicalPlan) {
  const response = await fetch("https://api.paystack.co/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(plan),
  });
  const payload = await response.json().catch(() => null) as { status?: boolean; message?: string; data?: any } | null;
  if (!response.ok || payload?.status !== true || !payload.data) {
    throw new Error(payload?.message ?? `Paystack plan creation failed with ${response.status}.`);
  }
  return payload.data;
}

function readPlanCode(plan: any) {
  const value = String(plan?.plan_code ?? "").trim();
  if (!value.startsWith("PLN_")) throw new Error("Paystack returned an invalid plan code.");
  return value;
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
