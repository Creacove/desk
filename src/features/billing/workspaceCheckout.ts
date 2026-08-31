import type {
  ProductionBillingCheckoutPreview,
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
