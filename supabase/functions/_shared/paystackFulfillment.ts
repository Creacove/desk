export async function fulfillVerifiedPaystackCheckout(input: {
  db: any;
  checkout: any;
  transaction: Record<string, any>;
}) {
  const normalized = validatePaystackTransaction(input.checkout, input.transaction);
  const { data, error } = await input.db.rpc("fulfill_verified_checkout", {
    p_checkout_session_id: input.checkout.id,
    p_provider: "paystack",
    p_provider_transaction_id: normalized.transactionId,
    p_provider_customer_id: normalized.customerId,
    p_provider_subscription_id: normalized.subscriptionId,
    p_provider_product_id: input.checkout.provider_product_id ?? null,
    p_provider_price_id: input.checkout.provider_price_id ?? input.checkout.provider_plan_code,
    p_correlation_hash: input.checkout.checkout_correlation_hash ?? null,
    p_customer_email: normalized.customerEmail,
    p_subscription_status: "active",
    p_currency: normalized.currency,
    p_subtotal_minor: normalized.amountMinor,
    p_tax_minor: 0,
    p_total_minor: normalized.amountMinor,
    p_current_period_start: normalized.periodStart,
    p_current_period_end: normalized.periodEnd,
    p_provider_occurred_at: normalized.occurredAt,
    p_scheduled_change_action: null,
    p_scheduled_change_at: null,
  });
  if (error) throw error;

  const fulfillment = Array.isArray(data) ? data[0] : data;
  if (!fulfillment?.account_id || !fulfillment?.artist_workspace_id) {
    throw new Error("Atomic Paystack fulfillment did not return a workspace.");
  }

  const { data: checkout, error: checkoutError } = await input.db
    .from("billing_checkout_sessions")
    .select("*")
    .eq("id", input.checkout.id)
    .maybeSingle();
  if (checkoutError) throw checkoutError;

  return { fulfillment, checkout: checkout ?? input.checkout, ...normalized };
}

export function validatePaystackTransaction(checkout: any, transaction: Record<string, any>) {
  const status = String(transaction.status ?? "").toLowerCase();
  if (status && !["success", "successful"].includes(status)) {
    throw new Error("Paystack transaction is not successful.");
  }

  const amountMinor = Number(transaction.amount);
  const currency = String(transaction.currency ?? "").toUpperCase();
  if (!Number.isSafeInteger(amountMinor) || amountMinor !== Number(checkout.amount_minor)) {
    throw new Error("Paystack amount did not match checkout session.");
  }
  if (!currency || currency !== String(checkout.currency).toUpperCase()) {
    throw new Error("Paystack currency did not match checkout session.");
  }

  const transactionId = String(transaction.reference ?? transaction.transaction_reference ?? "").trim();
  const customerId = String(transaction.customer_code ?? transaction.customer?.customer_code ?? "").trim();
  const subscriptionId = String(
    transaction.subscription_code ?? transaction.subscription?.subscription_code ??
      transaction.subscription?.id ?? checkout.provider_subscription_code ??
      (transactionId ? `paystack_charge_${transactionId}` : ""),
  ).trim();
  if (!transactionId || !customerId || !subscriptionId) {
    throw new Error("Verified Paystack transaction identifiers are incomplete.");
  }

  return {
    transactionId,
    customerId,
    subscriptionId,
    customerEmail: transaction.customer?.email ?? transaction.email ?? null,
    amountMinor,
    currency,
    periodStart: transaction.period_start ?? transaction.subscription?.current_period_start ?? null,
    periodEnd: transaction.period_end ?? transaction.subscription?.current_period_end ?? transaction.subscription?.next_payment_date ?? null,
    occurredAt: transaction.paid_at ?? transaction.paidAt ?? transaction.created_at ?? new Date().toISOString(),
  };
}
