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
    generationState?: "fresh" | "limited";
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
    generationState?: "fresh" | "limited";
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

export type ProductionSpotifyArtistAdapter = {
  searchArtists(query: string): Promise<ProductionSpotifyArtistCandidate[]>;
  connectArtist(
    workspace: ProductionWorkspace,
    candidate: ProductionSpotifyArtistCandidate,
  ): Promise<ProductionWorkspace>;
  bootstrapCatalog(
    workspace: ProductionWorkspace,
    candidate: ProductionSpotifyArtistCandidate,
  ): Promise<ProductionSpotifyBootstrapResult>;
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
