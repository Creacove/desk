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
  if (!billingService.prepareProviderCheckout || !billingService.openProviderCheckout) {
    throw new Error("Billing is temporarily unavailable. Please try again.");
  }
  const preview = await billingService.prepareProviderCheckout({
    user,
    candidate: workspaceCandidate(workspace),
    existingWorkspace: workspace,
    interval: workspace.billingInterval ?? "monthly",
    providerPreference: workspace.billingProvider ?? "auto",
  });
  await billingService.openProviderCheckout({ user, preview });
  return preview;
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
