import type { MusicReadTarget, TodayBriefViewModel } from "./cleanProduction";

export type ProductionUser = {
  id: string;
  email?: string;
  displayName?: string;
};

export type ProductionSession = {
  user: ProductionUser | null;
};

export type ProductionWorkspace = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  artistName: string;
  workspaceName: string;
  status: "setup" | "active" | "paused" | "archived";
  spotifyConnected: boolean;
  spotifyArtistId?: string;
  spotifyArtistName?: string;
  spotifyArtistUrl?: string;
  spotifyImageUrl?: string;
  contextComplete: boolean;
  latestCatalogSyncStatus?: "queued" | "running" | "needs_context" | "completed" | "completed_with_limits" | "failed" | "cancelled";
  entitlementActive?: boolean;
  subscriptionStatus?: "none" | "open" | "active" | "trialing" | "non-renewing" | "attention" | "completed" | "cancelled" | "canceled" | "paused" | "past_due" | "inactive";
  billingProvider?: "paddle" | "paystack";
  setupStatus?: "not_started" | "queued" | "running" | "completed" | "failed";
  setupStage?: "checkout" | "workspace_created" | "spotify_connected" | "catalog_bootstrap" | "manager_discovery" | "setup_brief" | "music_reads";
  billingCheckoutSessionId?: string;
  accessType?: "paid_subscription" | "private_beta" | "none";
  accessStatus?: "active" | "expired" | "inactive";
  accessStartsAt?: string;
  accessEndsAt?: string;
  renewalAt?: string;
  paddleCustomerId?: string;
};

export type ProductionWorkspaceDraft = {
  artistName: string;
  workspaceName?: string;
};

export type ProductionWorkspaceLoader = {
  loadActiveWorkspace(user: ProductionUser): Promise<ProductionWorkspace | null>;
  createInitialWorkspace?(user: ProductionUser, draft: ProductionWorkspaceDraft): Promise<ProductionWorkspace>;
};

export type ProductionAuthCredentials = {
  email: string;
  password: string;
};

export type ProductionAuthResult = {
  user: ProductionUser | null;
  message?: string;
};

export type ProductionAuthAdapter = {
  getSession(): Promise<ProductionSession>;
  signInWithPassword?(credentials: ProductionAuthCredentials): Promise<ProductionAuthResult>;
  signUpWithPassword?(credentials: ProductionAuthCredentials): Promise<ProductionAuthResult>;
  requestPasswordReset?(input: { email: string; redirectTo: string }): Promise<void>;
  updatePassword?(input: { password: string }): Promise<void>;
  signOut?(): Promise<void>;
};

export type ProductionMusicItem = {
  id: string;
  title: string;
  itemType: string;
  lifecycleStage: string;
  sourceKind?: string | null;
  sourceLimit?: string | null;
  spotifyUrl?: string;
  spotifyTrackId?: string;
  spotifyUri?: string;
  isrc?: string;
  upc?: string;
  albumId?: string;
  albumName?: string;
  albumLabel?: string;
  copyrights?: string[];
  genres?: string[];
  language?: string;
  mood?: string;
  mode?: string;
  releaseDate?: string;
  durationMs?: number;
  explicit?: boolean;
  trackNumber?: number;
  discNumber?: number;
  primaryArtist?: string;
  featuredArtists: string[];
  coverImageUrl?: string;
  previewUrl?: string | null;
  popularity?: number;
  evidence: Array<{
    id: string;
    source: string;
    sourceKind: string;
    evidenceType?: string | null;
    metricName?: string | null;
    metricValue?: number | null;
    metricUnit?: string | null;
    freshness?: string | null;
    confidence?: string | null;
    limitation?: string | null;
  }>;
  releasedAt?: string | null;
  manualDetails?: Record<string, string>;
  generatedManagerRead?: {
    situationLine?: string;
    managerRead?: string;
    nextMove?: string;
    watchNext?: string;
    generationState?: "fresh" | "limited" | "fallback" | "failed";
    intelligenceSnapshot?: Array<{ title: string; insight: string; metrics: Array<{ label: string; value: string; context?: string; evidenceIds: string[] }> }>;
    snapshotSummary?: string;
    claimAudit?: Array<{ claim: string; evidenceIds: string[]; limitation: string }>;
    confidence?: string;
    sourceLine?: string;
  };
  assets: Array<{ label: string; status: string; group: "Audio" | "Artwork" | "Splits"; action: string; assetType?: string; canUpload?: boolean; canReplace?: boolean }>;
  credits: Array<{ role: string; names: string; status: string }>;
  splits?: {
    status: string;
    summary: string;
    publishingTotal?: string;
    masterTotal?: string;
    contributors: Array<{
      name: string;
      role: string;
      publishingShare: string;
      masterShare: string;
      approval: string;
    }>;
  };
};

export type ProductionMusicProjectTrack = {
  id: string;
  title: string;
  orderIndex: number;
  discNumber?: number;
  lifecycleStage?: string;
  sourceKind?: string | null;
  blocker?: string;
};

export type ProductionMusicProject = {
  id: string;
  title: string;
  projectType: string;
  lifecycleStage: string;
  sourceKind?: string | null;
  sourceLimit?: string | null;
  spotifyUrl?: string;
  spotifyAlbumId?: string;
  spotifyUri?: string;
  upc?: string;
  albumType?: string;
  releaseDate?: string;
  totalTracks?: number;
  coverImageUrl?: string;
  releasedAt?: string | null;
  generatedManagerRead?: {
    situationLine?: string;
    managerRead?: string;
    nextMove?: string;
    watchNext?: string;
    generationState?: "fresh" | "limited" | "fallback" | "failed";
    intelligenceSnapshot?: Array<{ title: string; insight: string; metrics: Array<{ label: string; value: string; context?: string; evidenceIds: string[] }> }>;
    snapshotSummary?: string;
    claimAudit?: Array<{ claim: string; evidenceIds: string[]; limitation: string }>;
    confidence?: string;
    sourceLine?: string;
  };
  evidence: Array<{
    id: string;
    source: string;
    sourceKind: string;
    evidenceType?: string | null;
    metricName?: string | null;
    metricValue?: number | null;
    metricUnit?: string | null;
    freshness?: string | null;
    confidence?: string | null;
    limitation?: string | null;
  }>;
  tracks: ProductionMusicProjectTrack[];
};

export type ProductionMusicLibrary = {
  songs: ProductionMusicItem[];
  projects: ProductionMusicProject[];
};

export type ProductionMusicLibraryLoader = {
  loadMusicLibrary(workspace: ProductionWorkspace): Promise<ProductionMusicLibrary>;
};

export type ProductionSpotifyArtistCandidate = {
  spotifyArtistId: string;
  name: string;
  spotifyUrl: string;
  spotifyUri?: string;
  followers?: number;
  genres: string[];
  imageUrl?: string;
};

export type ProductionSpotifyBootstrapResult = {
  status: "completed" | "completed_with_limits" | "failed";
  sourceSyncJobId: string;
  musicItemCount?: number;
  musicProjectCount?: number;
  error?: string;
};

export type ProductionSpotifyCatalogPreviewTrack = {
  spotifyTrackId: string;
  name: string;
  durationMs?: number;
  spotifyUrl?: string;
  explicit?: boolean;
};

export type ProductionSpotifyCatalogPreviewRelease = {
  spotifyAlbumId: string;
  name: string;
  releaseType?: string;
  releaseDate?: string;
  artworkUrl?: string;
  spotifyUrl?: string;
  tracks: ProductionSpotifyCatalogPreviewTrack[];
};

export type ProductionSpotifyCatalogPreview = {
  artist: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl?: string;
    imageUrl?: string;
  };
  latestProject?: ProductionSpotifyCatalogPreviewRelease;
  standaloneSingles: ProductionSpotifyCatalogPreviewRelease[];
};

export type ProductionSpotifyArtistAdapter = {
  searchArtists(query: string): Promise<ProductionSpotifyArtistCandidate[]>;
  previewCatalog?(candidate: ProductionSpotifyArtistCandidate): Promise<ProductionSpotifyCatalogPreview>;
  connectArtist(
    workspace: ProductionWorkspace,
    candidate: ProductionSpotifyArtistCandidate,
  ): Promise<ProductionWorkspace>;
  bootstrapCatalog(
    workspace: ProductionWorkspace,
    candidate: ProductionSpotifyArtistCandidate,
  ): Promise<ProductionSpotifyBootstrapResult>;
};

export type ProductionBillingCheckoutPreview = {
  checkoutSessionId: string;
  reference: string;
  provider?: "paddle" | "paystack";
  status: "open" | "initialized" | "processing" | "paid" | "expired" | "failed" | "abandoned";
  artist: ProductionSpotifyArtistCandidate;
  amount?: number;
  amountMinor?: number;
  currency?: string;
  formattedTotal?: string;
  interval: "monthly" | "yearly";
  productId?: string;
  priceId?: string;
  paddleConfig?: { environment: "sandbox" | "production"; clientToken: string };
  customData?: Record<string, unknown>;
  expiresAt?: string;
  authorizationUrl?: string;
  accessCode?: string;
  intervalOptions?: Record<"monthly" | "yearly", {
    amount?: number;
    amountMinor?: number;
    currency?: string;
    formattedTotal?: string;
    priceId?: string;
  }>;
};

export type ProductionBillingProviderPreference = "auto" | "paddle" | "paystack";

export type ProductionBillingStatus = {
  checkoutSessionId?: string;
  checkoutStatus: "open" | "initialized" | "processing" | "paid" | "expired" | "failed" | "abandoned" | "missing";
  subscriptionStatus: ProductionWorkspace["subscriptionStatus"];
  entitlementActive: boolean;
  setupStatus: NonNullable<ProductionWorkspace["setupStatus"]>;
  setupStage?: ProductionWorkspace["setupStage"];
  workspace?: ProductionWorkspace;
  authorizationUrl?: string;
  accessCode?: string;
  message?: string;
};

export type ProductionSetupPhaseResult = {
  status: "queued" | "running" | "waiting_for_context" | "waiting_for_discovery" | "completed" | "completed_with_limits";
  phase: "discovery" | "contextualize";
  brief?: TodayBriefViewModel;
  setupMusicReadTargets?: MusicReadTarget[];
};

export type ProductionBillingService = {
  prepareProviderCheckout?(input: {
    user: ProductionUser;
    candidate: ProductionSpotifyArtistCandidate;
    existingWorkspace?: ProductionWorkspace;
    interval: "monthly" | "yearly";
    providerPreference?: ProductionBillingProviderPreference;
  }): Promise<ProductionBillingCheckoutPreview>;
  openProviderCheckout?(input: {
    user: ProductionUser;
    preview: ProductionBillingCheckoutPreview;
  }): Promise<void>;
  openCustomerPortal?(workspace: ProductionWorkspace): Promise<void>;
  createCheckoutPreview(input: {
    user: ProductionUser;
    candidate: ProductionSpotifyArtistCandidate;
    existingWorkspace?: ProductionWorkspace;
  }): Promise<ProductionBillingCheckoutPreview>;
  loadLatestCheckoutPreview?(): Promise<ProductionBillingCheckoutPreview | null>;
  loadBillingStatus(input: { reference?: string; checkoutSessionId?: string }): Promise<ProductionBillingStatus>;
  retrySetup?(input: { checkoutSessionId: string }): Promise<ProductionBillingStatus>;
  runSetupPhase?(input: {
    checkoutSessionId: string;
    phase: "discovery" | "contextualize";
  }): Promise<ProductionSetupPhaseResult>;
  redeemPrivateBetaCode?(input: {
    checkoutSessionId: string;
    code: string;
  }): Promise<{
    workspace: ProductionWorkspace;
    setupStatus: "queued" | "running" | "failed";
    accessEndsAt: string;
    message?: string;
  }>;
};

export type ProductionSetupProfile = {
  name: string;
  spotify: string;
  genre: string;
  market: string;
  release: string;
  goal: string;
  budget: string;
  stage: string;
  tiktok: string;
  instagram: string;
  youtube: string;
  x: string;
};

export type ProductionProfileSetupService = {
  saveSetupContext(workspace: ProductionWorkspace, profile: ProductionSetupProfile): Promise<ProductionWorkspace>;
};
