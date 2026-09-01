import type {
  ProductionBillingCheckoutPreview,
  ProductionBillingPrice,
  ProductionBillingPricing,
  ProductionBillingService,
  ProductionSpotifyArtistCandidate,
  ProductionUser,
  ProductionWorkspace,
} from "../../types/productionApp";

export async function openWorkspaceSubscriptionCheckout({
  user,
  workspace,
  billingService,
}: {
  user: ProductionUser;
  workspace: ProductionWorkspace;
  billingService: ProductionBillingService;
}): Promise<ProductionBillingCheckoutPreview> {
  const preview = await prepareWorkspaceSubscriptionCheckout({ user, workspace, billingService });
  if (!billingService.openProviderCheckout) throw new Error("Billing is temporarily unavailable. Please try again.");
  await billingService.openProviderCheckout({ user, preview });
  return preview;
}

export async function prepareWorkspaceSubscriptionCheckout({
  user,
  workspace,
  billingService,
  interval = workspace.billingInterval ?? "monthly",
  providerPreference = workspace.billingProvider ?? "auto",
}: {
  user: ProductionUser;
  workspace: ProductionWorkspace;
  billingService: ProductionBillingService;
  interval?: "monthly" | "yearly";
  providerPreference?: "auto" | "paddle" | "paystack";
}): Promise<ProductionBillingCheckoutPreview> {
  if (!billingService.prepareProviderCheckout) throw new Error("Billing is temporarily unavailable. Please try again.");
  return billingService.prepareProviderCheckout({
    user,
    candidate: workspaceCandidate(workspace),
    existingWorkspace: workspace,
    interval,
    providerPreference,
  });
}

export async function loadWorkspaceSubscriptionPricing({
  workspace,
  billingService,
}: {
  workspace: ProductionWorkspace;
  billingService: ProductionBillingService;
}): Promise<ProductionBillingPricing> {
  if (!billingService.loadProviderPricing) throw new Error("Billing pricing is temporarily unavailable. Please try again.");
  return billingService.loadProviderPricing({
    existingWorkspace: workspace,
    providerPreference: workspace.billingProvider ?? "auto",
  });
}

export function formatSubscriptionPrice(price?: ProductionBillingPrice) {
  if (!price) return "Loading price…";
  if (price.formattedTotal) return price.formattedTotal;
  const amount = Number.isFinite(price.amount) ? Number(price.amount) : Number(price.amountMinor ?? 0) / 100;
  const currency = price.currency || "USD";
  if (!Number.isFinite(amount) || amount <= 0) return "Price unavailable";

  try {
    return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 ? 2 : 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(amount % 1 ? 2 : 0)}`;
  }
}

export function workspaceCandidate(workspace: ProductionWorkspace): ProductionSpotifyArtistCandidate {
  if (!workspace.spotifyArtistId || !workspace.spotifyArtistUrl) {
    throw new Error("This workspace is missing its connected Spotify artist.");
  }
  return {
    spotifyArtistId: workspace.spotifyArtistId,
    name: workspace.spotifyArtistName ?? workspace.artistName,
    spotifyUrl: workspace.spotifyArtistUrl,
    imageUrl: workspace.spotifyImageUrl,
    genres: [],
  };
}
