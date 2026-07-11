import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Headphones,
  Megaphone,
  Route,
} from "lucide-react";
import type {
  AgentViewModel,
  ArtistProfileViewModel,
  CleanProductionRepositories,
  ConversationViewModel,
  EvidenceItemViewModel,
  MissionGenesisResultViewModel,
  MissionTaskDeliverableViewModel,
  MissionViewModel,
  MusicObjectViewModel,
  SpotifyCatalogSearchResult,
  SpotifyImportResult,
  SplitConfirmationViewModel,
  SplitContributorInput,
  TodayBriefGenerationMode,
  TodayBriefViewModel,
} from "../types/cleanProduction";
import { consumeManagerConversationEventStream } from "./managerConversationStream";
import type {
  ProductionAuthAdapter,
  ProductionBillingCheckoutPreview,
  ProductionBillingService,
  ProductionBillingStatus,
  ProductionMusicItem,
  ProductionMusicLibrary,
  ProductionMusicLibraryLoader,
  ProductionMusicProject,
  ProductionProfileSetupService,
  ProductionSetupProfile,
  ProductionSetupPhaseResult,
  ProductionSpotifyArtistAdapter,
  ProductionSpotifyArtistCandidate,
  ProductionSpotifyBootstrapResult,
  ProductionSpotifyCatalogPreview,
  ProductionWorkspace,
  ProductionWorkspaceLoader,
} from "../types/productionApp";

const PUBLIC_SPOTIFY_CATALOG_LIMITATION =
  "Spotify public catalog supports identity, catalog, and public metadata only; it does not prove private analytics, saves, source-of-stream, revenue, conversion, or campaign ROI.";
const MUSIC_UPLOADS_BUCKET = "music-uploads";
const WORKSPACE_DOCUMENTS_BUCKET = "workspace-documents";
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
const MISSION_GENESIS_POLL_INTERVAL_MS = 1500;
const MISSION_GENESIS_POLL_ATTEMPTS = 240;

function supabaseFunctionUrl(functionName: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL for Manager conversation streaming.");
  }

  return `${String(supabaseUrl).replace(/\/$/, "")}/functions/v1/${functionName}`;
}

export function createSupabaseAuthAdapter(client: SupabaseClient): ProductionAuthAdapter {
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();

      if (error) {
        throw error;
      }

      const user = data.session?.user;
      return {
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName: readDisplayName(user.user_metadata),
            }
          : null,
      };
    },
    async signInWithPassword({ email, password }) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        await throwFunctionInvokeError(error, "Spotify artist search failed.");
      }

      return {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
              displayName: readDisplayName(data.user.user_metadata),
            }
          : null,
        message: "Signed in.",
      };
    },
    async signUpWithPassword({ email, password }) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      return {
        user: data.user
          ? {
              id: data.user.id,
              email: data.user.email,
              displayName: readDisplayName(data.user.user_metadata),
            }
          : null,
        message: data.session ? "Account created." : "Check your email to confirm the account.",
      };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) {
        throw error;
      }
    },
  };
}

export function createSupabaseWorkspaceLoader(client: SupabaseClient): ProductionWorkspaceLoader {
  return {
    async loadActiveWorkspace() {
      const { data: memberships, error: membershipError } = await client
        .from("account_memberships")
        .select("account_id")
        .eq("status", "active")
        .limit(1);

      if (membershipError) {
        throw membershipError;
      }

      const accountId = memberships?.[0]?.account_id as string | undefined;
      if (!accountId) {
        return null;
      }

      const { data: workspaces, error: workspaceError } = await client
        .from("artist_workspaces")
        .select(
          [
            "id",
            "account_id",
            "artist_id",
            "name",
            "status",
            "artists(display_name, canonical_spotify_artist_id, canonical_spotify_url)",
            "artist_profiles(display_name, spotify_identity, genres, home_market, stage, artist_direction, current_goal, budget_context)",
            "source_sync_jobs(status,created_at)",
            "billing_subscriptions(status,current_period_end)",
            "workspace_setup_runs(status,current_stage,checkout_session_id,updated_at)",
          ].join(", "),
        )
        .eq("account_id", accountId)
        .in("status", ["setup", "active"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (workspaceError) {
        throw workspaceError;
      }

      const workspace = workspaces?.[0] as WorkspaceRow | undefined;
      if (!workspace) {
        return null;
      }

      return {
        accountId: workspace.account_id,
        artistWorkspaceId: workspace.id,
        artistId: workspace.artist_id,
        artistName: workspace.artists?.display_name ?? workspace.name,
        workspaceName: workspace.name,
        status: workspace.status,
        spotifyConnected: Boolean(workspace.artists?.canonical_spotify_artist_id),
        spotifyArtistId: workspace.artists?.canonical_spotify_artist_id ?? undefined,
        spotifyArtistName: readSpotifyIdentityName(workspace.artist_profiles?.[0]?.spotify_identity) ?? workspace.artists?.display_name ?? undefined,
        spotifyArtistUrl: workspace.artists?.canonical_spotify_url ?? readSpotifyIdentityUrl(workspace.artist_profiles?.[0]?.spotify_identity),
        spotifyImageUrl: readSpotifyIdentityImage(workspace.artist_profiles?.[0]?.spotify_identity),
        contextComplete: isContextComplete(workspace.artist_profiles?.[0]),
        latestCatalogSyncStatus: readLatestSyncStatus(workspace.source_sync_jobs),
        entitlementActive: hasActiveEntitlement(workspace.billing_subscriptions),
        subscriptionStatus: readLatestSubscriptionStatus(workspace.billing_subscriptions),
        setupStatus: readLatestSetupStatus(workspace.workspace_setup_runs),
        setupStage: readLatestSetupStage(workspace.workspace_setup_runs),
        billingCheckoutSessionId: readLatestSetupCheckoutSessionId(workspace.workspace_setup_runs),
      } satisfies ProductionWorkspace;
    },
    async createInitialWorkspace(_user, draft) {
      const { data, error } = await client.rpc("create_initial_artist_workspace", {
        p_artist_display_name: draft.artistName.trim(),
        p_workspace_name: draft.workspaceName?.trim() || null,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as WorkspaceRpcRow | undefined) : (data as WorkspaceRpcRow | null);
      if (!row) {
        throw new Error("Initial workspace creation did not return a workspace.");
      }

      return workspaceFromRpcRow(row);
    },
  };
}

export function createSupabaseMusicLibraryLoader(client: SupabaseClient): ProductionMusicLibraryLoader {
  return {
    async loadMusicLibrary(workspace) {
      const { data: itemRows, error: itemError } = await client
        .from("music_items")
        .select("id,title,item_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
        .eq("artist_workspace_id", workspace.artistWorkspaceId)
        .eq("status", "active")
        .order("released_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (itemError) {
        throw itemError;
      }

      const { data: projectRows, error: projectError } = await client
        .from("music_projects")
        .select("id,title,project_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
        .eq("artist_workspace_id", workspace.artistWorkspaceId)
        .eq("status", "active")
        .order("released_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (projectError) {
        throw projectError;
      }

      const { data: projectItemRows, error: projectItemError } = await client
        .from("music_project_items")
        .select("music_project_id,music_item_id,order_index,display_title")
        .eq("artist_workspace_id", workspace.artistWorkspaceId)
        .order("disc_number", { ascending: true })
        .order("order_index", { ascending: true });

      if (projectItemError) {
        throw projectItemError;
      }

      const { data: identifierRows, error: identifierError } = await client
        .from("music_identifiers")
        .select("music_item_id,music_project_id,identifier_type,identifier_value")
        .eq("artist_workspace_id", workspace.artistWorkspaceId);

      if (identifierError) {
        throw identifierError;
      }

      const { data: assetRows, error: assetError } = await client
        .from("music_assets")
        .select("music_item_id,music_project_id,asset_type,title,status,uploaded_file_id")
        .eq("artist_workspace_id", workspace.artistWorkspaceId);

      if (assetError) {
        throw assetError;
      }

      const { data: creditRows, error: creditError } = await client
        .from("music_credits")
        .select("music_item_id,music_project_id,role,name,status")
        .eq("artist_workspace_id", workspace.artistWorkspaceId);

      if (creditError) {
        throw creditError;
      }

      const { data: splitRows, error: splitError } = await client
        .from("music_splits")
        .select("id,music_item_id,status,summary,publishing_total,master_total")
        .eq("artist_workspace_id", workspace.artistWorkspaceId);

      if (splitError) {
        throw splitError;
      }

      const { data: evidenceRows, error: evidenceError } = await client
        .from("evidence_items")
        .select("id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,limitation")
        .eq("artist_workspace_id", workspace.artistWorkspaceId)
        .order("created_at", { ascending: false });

      if (evidenceError) {
        throw evidenceError;
      }

      const { data: managerOutputRows, error: managerOutputError } = await client
        .from("manager_outputs")
        .select("id,source_packet_id,created_from_run_id,output_type,subject_type,subject_id,is_current,render_json,created_at")
        .eq("artist_workspace_id", workspace.artistWorkspaceId)
        .eq("is_current", true)
        .in("subject_type", ["music_item", "music_project"])
        .in("output_type", ["song_manager_read", "project_manager_read"])
        .order("created_at", { ascending: false });

      if (managerOutputError) {
        throw managerOutputError;
      }

      const splitIds = ((splitRows ?? []) as MusicSplitRow[]).map((row) => row.id).filter(Boolean);
      const { data: splitContributorRows, error: splitContributorError } = splitIds.length
        ? await client
            .from("music_split_contributors")
            .select("id,music_split_id,name,role,email,publishing_share,master_share,approval_status")
            .in("music_split_id", splitIds)
        : { data: [], error: null };

      if (splitContributorError) {
        throw splitContributorError;
      }

      return mapMusicLibrary({
        itemRows: (itemRows ?? []) as MusicItemRow[],
        projectRows: (projectRows ?? []) as MusicProjectRow[],
        projectItemRows: (projectItemRows ?? []) as MusicProjectItemRow[],
        identifierRows: (identifierRows ?? []) as MusicIdentifierRow[],
        assetRows: (assetRows ?? []) as MusicAssetRow[],
        creditRows: (creditRows ?? []) as MusicCreditRow[],
        splitRows: (splitRows ?? []) as MusicSplitRow[],
        splitContributorRows: (splitContributorRows ?? []) as MusicSplitContributorRow[],
        evidenceRows: (evidenceRows ?? []) as EvidenceRow[],
        managerOutputRows: (managerOutputRows ?? []) as ManagerOutputRow[],
      });
    },
  };
}

export function createSupabaseSpotifyArtistAdapter(client: SupabaseClient): ProductionSpotifyArtistAdapter {
  return {
    async searchArtists(query) {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return [];
      }

      const { data, error } = await client.functions.invoke("spotify-artist-search", {
        body: { query: normalizedQuery },
      });

      if (error) {
        throw error;
      }

      const artists = (data as { artists?: ProductionSpotifyArtistCandidate[] } | null)?.artists;
      return Array.isArray(artists) ? artists : [];
    },
    async previewCatalog(candidate) {
      const { data, error } = await client.functions.invoke("spotify-catalog-preview", {
        body: { selectedArtist: candidate, market: "US" },
      });
      if (error) {
        await throwFunctionInvokeError(error, "Spotify catalog preview failed.");
      }
      return spotifyCatalogPreviewFromPayload(data);
    },
    async bootstrapCatalog(workspace, candidate) {
      const { data, error } = await client.functions.invoke("spotify-catalog-bootstrap", {
        body: {
          accountId: workspace.accountId,
          artistWorkspaceId: workspace.artistWorkspaceId,
          artistId: workspace.artistId,
          selectedArtist: candidate,
          market: "US",
        },
      });

      if (error) {
        await throwFunctionInvokeError(error, "Spotify catalog bootstrap failed.");
      }

      return data as ProductionSpotifyBootstrapResult;
    },
    async connectArtist(workspace, candidate) {
      const { data, error } = await client.functions.invoke("connect-spotify-artist", {
        body: {
          accountId: workspace.accountId,
          artistWorkspaceId: workspace.artistWorkspaceId,
          artistId: workspace.artistId,
          selectedArtist: candidate,
          market: "US",
        },
      });

      if (error) {
        const message = await readFunctionInvokeErrorMessage(error, "Spotify artist could not be connected.");
        return connectArtistWithClientFallback(client, workspace, candidate, message);
      }

      const row = Array.isArray(data) ? (data[0] as WorkspaceRpcRow | undefined) : (data as WorkspaceRpcRow | null);
      if (!row) {
        throw new Error("Spotify artist connection did not return a workspace.");
      }

      return workspaceFromRpcRow(row);
    },
  };
}

function spotifyCatalogPreviewFromPayload(payload: unknown): ProductionSpotifyCatalogPreview {
  const preview = payload as ProductionSpotifyCatalogPreview | null;
  if (!preview?.artist?.spotifyArtistId || !preview.artist.name || !Array.isArray(preview.standaloneSingles)) {
    throw new Error("Spotify catalog preview response was incomplete.");
  }
  return preview;
}

export function createSupabaseBillingService(client: SupabaseClient): ProductionBillingService {
  return {
    async createCheckoutPreview({ candidate }) {
      const { data, error } = await client.functions.invoke("paystack-initialize-checkout", {
        body: {
          selectedArtist: candidate,
        },
      });

      if (error) {
        await throwFunctionInvokeError(error, "Paystack checkout could not be initialized.");
      }

      return billingCheckoutPreviewFromPayload(data);
    },
    async loadLatestCheckoutPreview() {
      const { data, error } = await client.functions.invoke("billing-status", {
        body: { latestOpenCheckout: true },
      });

      if (error) {
        await throwFunctionInvokeError(error, "Billing status could not be loaded.");
      }

      const payload = data as { preview?: unknown } | null;
      return payload?.preview ? billingCheckoutPreviewFromPayload(payload.preview) : null;
    },
    async loadBillingStatus({ reference }) {
      const { data, error } = await client.functions.invoke("billing-status", {
        body: { reference },
      });

      if (error) {
        await throwFunctionInvokeError(error, "Billing status could not be loaded.");
      }

      return billingStatusFromPayload(data);
    },
    async retrySetup({ checkoutSessionId }) {
      const { data, error } = await client.functions.invoke("billing-status", {
        body: { checkoutSessionId, retrySetup: true },
      });

      if (error) {
        await throwFunctionInvokeError(error, "Desk setup could not be retried.");
      }

      return billingStatusFromPayload(data);
    },
    async runSetupPhase({ checkoutSessionId, phase }) {
      const { data, error } = await client.functions.invoke("paid-workspace-setup", {
        body: { checkoutSessionId, phase },
      });
      if (error) await throwFunctionInvokeError(error, "Paid workspace setup could not continue.");
      const payload = data as ProductionSetupPhaseResult & { brief?: unknown; setupMusicReadTargets?: unknown };
      return {
        ...payload,
        brief: todayBriefFromPayload(payload.brief),
        setupMusicReadTargets: readSetupMusicReadTargets(payload.setupMusicReadTargets),
      };
    },
  };
}

export function createSupabaseProfileSetupService(client: SupabaseClient): ProductionProfileSetupService {
  return {
    async saveSetupContext(workspace, profile) {
      const { data, error } = await client.rpc("complete_artist_setup_context", {
        p_artist_workspace_id: workspace.artistWorkspaceId,
        p_stage: normalizeText(profile.stage),
        p_home_market: normalizeText(profile.market),
        p_genres: normalizeGenres(profile.genre),
        p_artist_direction: normalizeText(profile.goal),
        p_current_goal: normalizeText(profile.goal),
        p_budget_context: normalizeText(profile.budget),
        p_social_handles: {
          tiktok: normalizeText(profile.tiktok),
          instagram: normalizeText(profile.instagram),
          youtube: normalizeText(profile.youtube),
          x: normalizeText(profile.x),
        },
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? (data[0] as WorkspaceRpcRow | undefined) : (data as WorkspaceRpcRow | null);
      if (!row) {
        throw new Error("Setup context save did not return a workspace.");
      }

      return { ...workspace, ...workspaceFromRpcRow(row) };
    },
  };
}

export function createSupabaseProductionRepositories(client: SupabaseClient, workspace: ProductionWorkspace): CleanProductionRepositories {
  const musicLibraryLoader = createSupabaseMusicLibraryLoader(client);

  return {
    artistProfile: {
      async loadProfile() {
        const [{ data, error }, { data: evidenceData, error: evidenceError }] = await Promise.all([
          client
            .from("artist_profiles")
            .select("display_name,spotify_identity,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .limit(1)
            .maybeSingle(),
          client
            .from("evidence_items")
            .select("id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,limitation")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .eq("subject_type", "artist")
            .order("created_at", { ascending: false })
            .limit(80),
        ]);

        if (error) {
          throw error;
        }
        if (evidenceError) {
          throw evidenceError;
        }

        return profileFromRow((data as WorkspaceProfileRow | null) ?? null, workspace, (evidenceData as EvidenceRow[] | null) ?? []);
      },
    },
    desk: {
      async loadDesk() {
        const [
          { data: syncRows, error: syncError },
          { data: eventRows, error: eventError },
          { data: managerOutputRows, error: managerOutputError },
          { data: briefRows, error: briefError },
        ] = await Promise.all([
          client
            .from("source_sync_jobs")
            .select("status,completed_at,job_type")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .order("created_at", { ascending: false })
            .limit(5),
          client
            .from("operating_events")
            .select("id,event_type,summary,created_at")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .order("created_at", { ascending: false })
            .limit(20),
          client
            .from("manager_outputs")
            .select("id,source_packet_id,created_from_run_id,output_type,subject_type,subject_id,is_current,render_json,hero_json,blocks_json,summary,confidence_json,supporting_evidence_json,created_at")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .eq("subject_type", "artist")
            .eq("subject_id", workspace.artistId)
            .eq("is_current", true)
            .in("output_type", ["setup_first_manager_read", "recurring_todays_brief"])
            .order("created_at", { ascending: false })
            .limit(1),
          client
            .from("manager_synthesis_runs")
            .select("id,status,classification,confidence,action_plan,limitations,completed_at,created_at")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .eq("classification", "setup_todays_brief_v1")
            .eq("status", "completed")
            .order("completed_at", { ascending: false })
            .limit(1),
        ]);

        if (syncError) throw syncError;
        if (eventError) throw eventError;
        if (managerOutputError) throw managerOutputError;
        if (briefError) throw briefError;

        const latestSync = (syncRows as SourceSyncJobRow[] | null)?.[0];
        const connectedLabel = latestSync?.status === "completed_with_limits" ? "Spotify catalog connected with limits" : "Spotify catalog connected";
        const attentionItems = buildDeskAttentionItems(latestSync);
        const todayBrief =
          todayBriefFromManagerOutput(((managerOutputRows as ManagerOutputRow[] | null) ?? [])[0]) ??
          todayBriefFromManagerRun(((briefRows as ManagerSynthesisRunRow[] | null) ?? [])[0]) ??
          buildFallbackTodayBrief(workspace);

        return {
          priority: [
            {
              label: "Focus",
              value: connectedLabel,
              meta: "Music",
              actionLabel: "Open imported catalog",
              target: "musicWorkspace",
            },
            {
              label: "Source",
              value: "Public catalog only",
              meta: "Spotify",
              actionLabel: "Open source limitation",
              target: "musicWorkspace",
            },
          ],
          attention: attentionItems,
          movement: ((eventRows as OperatingEventRow[] | null) ?? []).map((event) => ({
            label: formatEventLabel(event.event_type),
            title: formatMovementSummary(event.summary),
            time: formatEventTime(event.created_at),
          })),
          todayBrief,
        };
      },
      async generateTodaysBrief(mode: TodayBriefGenerationMode = "operating") {
        const { data, error } = await client.functions.invoke("generate-todays-brief", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            trigger: mode === "setup-map" ? "setup" : "manual",
            generationMode: mode,
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Today's Brief generation failed.");
        }

        const payload = data as { status?: unknown; brief?: unknown; setupMusicReadTargets?: unknown } | null;
        const brief = todayBriefFromPayload(payload?.brief);
        if (!brief) {
          throw new Error("Today's Brief generation did not return a usable brief.");
        }
        const state = payload?.status === "completed_with_fallback" ? "fallback" as const : brief.state;
        const freshBrief = { ...brief, state };
        return {
          ...freshBrief,
          brief: freshBrief,
          setupMusicReadTargets: readSetupMusicReadTargets(payload?.setupMusicReadTargets),
        };
      },
      async refreshPublicContext() {
        const { data, error } = await client.functions.invoke("refresh-public-context", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Public context refresh failed.");
        }

        return readPublicContextRefreshResult(data);
      },
    },
    staff: {
      async loadAgents() {
        const { data, error } = await client
          .from("agent_profiles")
          .select(
            "agent_key,name,title,status_default,purpose,tools,required_source_capabilities,optional_source_capabilities,manager_can_prepare",
          )
          .order("agent_key", { ascending: true });

        if (error) {
          throw error;
        }

        return ((data as AgentProfileRow[] | null) ?? []).map(agentFromRow);
      },
    },
    music: {
      async loadMusic() {
        const library = await musicLibraryLoader.loadMusicLibrary(workspace);
        return musicViewModelsFromLibrary(library);
      },
      async generateMusicSummary(subjectId, subjectType) {
        const subjectLabel = subjectType === "music_project" ? "Project" : "Song";
        const libraryBeforeRead = await musicLibraryLoader.loadMusicLibrary(workspace);
        if (subjectType === "music_item") {
          const subject = libraryBeforeRead.songs.find((song) => song.id === subjectId);
          if (subject && !hasChartmetricEvidence(subject.evidence)) {
            const { data: enrichmentData, error: enrichmentError } = await client.functions.invoke("chartmetric-track-enrichment", {
              body: {
                accountId: workspace.accountId,
                artistWorkspaceId: workspace.artistWorkspaceId,
                artistId: workspace.artistId,
                musicItemId: subjectId,
              },
            });

            if (enrichmentError) {
              await throwFunctionInvokeError(enrichmentError, "Song enrichment failed before Manager Read generation.");
            }

            const enrichmentStatus = readFunctionStatus(enrichmentData);
            if (enrichmentStatus === "unresolved" || enrichmentStatus === "failed") {
              throw new Error("Song enrichment could not resolve enough source evidence for a generated Manager Read.");
            }
          }
        } else {
          // Projects mirror the song path: self-enrich from Chartmetric before the read so
          // an imported album — or a project whose manager-read button is clicked — has
          // audience signals to reason over. Individual album tracks stay un-enriched.
          const subject = libraryBeforeRead.projects.find((project) => project.id === subjectId);
          if (subject && !hasChartmetricEvidence(subject.evidence)) {
            const { error: enrichmentError } = await client.functions.invoke("chartmetric-project-enrichment", {
              body: {
                accountId: workspace.accountId,
                artistWorkspaceId: workspace.artistWorkspaceId,
                artistId: workspace.artistId,
                musicProjectId: subjectId,
              },
            });

            if (enrichmentError) {
              await throwFunctionInvokeError(enrichmentError, "Project enrichment failed before Manager Read generation.");
            }
            // Unlike songs, an unresolved Chartmetric album is not fatal: the read function
            // produces a grounded fallback from catalog metadata when audience signals are thin.
          }
        }

        const { data, error } = await client.functions.invoke("generate-music-summary", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            subjectType,
            subjectId,
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, `${subjectLabel} brief generation failed.`);
        }

        const payload = data as { read?: unknown } | null;
        const generatedRead = readGeneratedManagerReadPayload(payload?.read);

        // Reload the full library so the returned view model carries the fresh brief
        const library = await musicLibraryLoader.loadMusicLibrary(workspace);
        const models = musicViewModelsFromLibrary(library);
        const updated = models.find((m) => m.id === subjectId);
        if (!updated) {
          throw new Error(`${subjectLabel} brief was generated but the ${subjectType === "music_project" ? "project" : "track"} could not be reloaded.`);
        }
        return mergeGeneratedManagerReadIntoMusicObject(updated, generatedRead);
      },
      async searchSpotifyCatalog(input) {
        const { data, error } = await client.functions.invoke("spotify-catalog-search", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            kind: input.kind,
            albumId: input.albumId,
            market: "US",
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Spotify catalog search failed.");
        }

        return data as SpotifyCatalogSearchResult;
      },
      async importSpotifySelection(input) {
        const { data, error } = await client.functions.invoke("spotify-import-selection", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            kind: input.kind,
            albumId: input.albumId,
            trackId: input.trackId,
            market: "US",
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Spotify import failed.");
        }

        return data as SpotifyImportResult;
      },
      async createSong(input) {
        const { data, error } = await client
          .from("music_items")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            title: input.title.trim(),
            item_type: input.itemType,
            lifecycle_stage: input.lifecycleStage,
            source_kind: "manual",
            source_limit: "User-created record. Add files, credits, identifiers, and evidence before treating it as operationally confirmed.",
            created_by_type: "user",
          })
          .select("id,title,item_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
          .single();

        if (error) throw error;

        const row = data as MusicItemRow;
        await writeOperatingEvent(client, workspace, {
          eventType: "music_item_created",
          targetType: "music_item",
          targetId: row.id,
          summary: `Created song ${row.title}.`,
        });

        return musicViewModelsFromLibrary(mapMusicLibrary({
          itemRows: [row],
          projectRows: [],
          projectItemRows: [],
          identifierRows: [],
          assetRows: [],
          creditRows: [],
          splitRows: [],
          splitContributorRows: [],
        }))[0];
      },
      async createProject(input) {
        const { data, error } = await client
          .from("music_projects")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            title: input.title.trim(),
            project_type: input.projectType,
            lifecycle_stage: input.lifecycleStage,
            source_kind: "manual",
            source_limit: "User-created project. Add songs and project assets before treating it as operationally ready.",
            created_by_type: "user",
          })
          .select("id,title,project_type,lifecycle_stage,source_kind,source_limit,released_at,metadata")
          .single();

        if (error) throw error;

        const row = data as MusicProjectRow;
        await writeOperatingEvent(client, workspace, {
          eventType: "music_project_created",
          targetType: "music_project",
          targetId: row.id,
          summary: `Created project ${row.title}.`,
        });

        return musicViewModelsFromLibrary(mapMusicLibrary({
          itemRows: [],
          projectRows: [row],
          projectItemRows: [],
          identifierRows: [],
          assetRows: [],
          creditRows: [],
          splitRows: [],
          splitContributorRows: [],
        }))[0];
      },
      async updateLifecycleStage(musicItemId, lifecycleStage) {
        const { error } = await client
          .from("music_items")
          .update({ lifecycle_stage: lifecycleStage })
          .eq("id", musicItemId)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (error) throw error;

        await writeOperatingEvent(client, workspace, {
          eventType: "music_lifecycle_updated",
          targetType: "music_item",
          targetId: musicItemId,
          summary: `Updated song stage to ${titleCaseStatus(lifecycleStage)}.`,
          payload: { lifecycle_stage: lifecycleStage },
        });
      },
      async saveDetail(musicItemId, input) {
        const { data: current, error: readError } = await client
          .from("music_items")
          .select("metadata")
          .eq("id", musicItemId)
          .eq("artist_workspace_id", workspace.artistWorkspaceId)
          .maybeSingle();

        if (readError) throw readError;

        const metadata = current?.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
          ? { ...(current.metadata as Record<string, unknown>) }
          : {};
        const existingManual = metadata.manual_details && typeof metadata.manual_details === "object" && !Array.isArray(metadata.manual_details)
          ? metadata.manual_details as Record<string, unknown>
          : {};
        const existingGroups = metadata.manual_detail_groups && typeof metadata.manual_detail_groups === "object" && !Array.isArray(metadata.manual_detail_groups)
          ? metadata.manual_detail_groups as Record<string, unknown>
          : {};
        const key = normalizeManualDetailKey(input.label);
        metadata.manual_details = { ...existingManual, [key]: input.value.trim() };
        metadata.manual_detail_groups = { ...existingGroups, [key]: input.group };

        const { error } = await client
          .from("music_items")
          .update({ metadata })
          .eq("id", musicItemId)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (error) throw error;

        await writeOperatingEvent(client, workspace, {
          eventType: "music_metadata_updated",
          targetType: "music_item",
          targetId: musicItemId,
          summary: `Updated ${input.label.trim()} metadata.`,
          payload: { group: input.group, label: input.label.trim(), value: input.value.trim() },
        });
      },
      async saveCredit(musicItemId, input) {
        const { error } = await client.from("music_credits").insert({
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          music_item_id: musicItemId,
          role: input.role.trim(),
          name: input.name.trim(),
          status: "draft",
          created_by_type: "user",
        });

        if (error) throw error;

        await writeOperatingEvent(client, workspace, {
          eventType: "music_credit_updated",
          targetType: "music_item",
          targetId: musicItemId,
          summary: `Added ${input.role.trim()} credit.`,
          payload: { role: input.role.trim(), name: input.name.trim() },
        });
      },
      async saveIdentifier(musicItemId, input) {
        const { error } = await client.from("music_identifiers").insert({
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          music_item_id: musicItemId,
          identifier_type: input.identifierType,
          identifier_value: input.identifierValue.trim(),
          confidence: "unknown",
        });

        if (error) throw error;

        await writeOperatingEvent(client, workspace, {
          eventType: "music_identifier_added",
          targetType: "music_item",
          targetId: musicItemId,
          summary: `Added ${titleCaseStatus(input.identifierType)} identifier.`,
          payload: { identifier_type: input.identifierType, identifier_value: input.identifierValue.trim() },
        });
      },
      async saveSplitContributor(musicItemId, input) {
        const split = await ensureMusicSplit(client, workspace, musicItemId);
        const contributor = normalizeSplitContributorInput(input);

        const { error } = await client.from("music_split_contributors").insert({
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          music_split_id: split.id,
          name: contributor.name,
          role: contributor.role,
          email: contributor.email,
          publishing_share: contributor.publishingShare,
          master_share: contributor.masterShare,
          approval_status: "draft",
        });

        if (error) throw error;

        await recomputeSplitTotals(client, split.id);
        await writeOperatingEvent(client, workspace, {
          eventType: "music_split_contributor_saved",
          targetType: "music_split",
          targetId: split.id,
          summary: `Added split contributor ${contributor.name}.`,
          payload: {
            music_item_id: musicItemId,
            role: contributor.role,
            email: contributor.email,
            publishing_share: contributor.publishingShare,
            master_share: contributor.masterShare,
          },
        });
      },
      async removeSplitContributor(musicItemId, contributorId) {
        const split = await loadMusicSplitForItem(client, workspace, musicItemId);
        if (!split) return;

        const { error } = await client
          .from("music_split_contributors")
          .delete()
          .eq("id", contributorId)
          .eq("music_split_id", split.id)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (error) throw error;

        await recomputeSplitTotals(client, split.id);
        await writeOperatingEvent(client, workspace, {
          eventType: "music_split_contributor_removed",
          targetType: "music_split",
          targetId: split.id,
          summary: "Removed split contributor.",
          payload: { music_item_id: musicItemId, contributor_id: contributorId },
        });
      },
      async sendSplitConfirmationLinks(musicItemId) {
        const split = await loadMusicSplitForItem(client, workspace, musicItemId);
        if (!split) {
          throw new Error("Add split contributors before sending confirmation links.");
        }

        const contributors = await loadSplitContributors(client, split.id);
        validateSplitReadyToSend(split, contributors);

        const { error } = await client
          .from("music_split_contributors")
          .update({ approval_status: "pending" })
          .eq("music_split_id", split.id)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (error) throw error;

        const { error: splitError } = await client
          .from("music_splits")
          .update({
            status: "pending_confirmation",
            summary: "Split confirmation links sent. Waiting for collaborators to confirm their shares.",
          })
          .eq("id", split.id)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (splitError) throw splitError;

        const appOrigin = typeof window === "undefined" ? "http://localhost:5173" : window.location.origin;
        const { error: functionError } = await client.functions.invoke("send-split-confirmations", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            musicItemId,
            appOrigin,
          },
        });

        if (functionError) {
          await throwFunctionInvokeError(functionError, "Split confirmation email delivery failed.");
        }

        await writeOperatingEvent(client, workspace, {
          eventType: "music_split_confirmation_sent",
          targetType: "music_split",
          targetId: split.id,
          summary: "Sent split confirmation links to collaborators.",
          payload: { music_item_id: musicItemId, contributor_count: contributors.length },
        });
      },
      async loadSplitConfirmation(token) {
        const normalizedToken = token.trim();
        if (!normalizedToken) throw new Error("Split confirmation token is required.");

        const { data, error } = await client.functions.invoke("load-split-confirmation", {
          body: { token: normalizedToken },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Split confirmation could not be loaded.");
        }

        return normalizeSplitConfirmationView(data);
      },
      async submitSplitConfirmation(token, input) {
        const normalizedToken = token.trim();
        if (!normalizedToken) throw new Error("Split confirmation token is required.");

        const { error } = await client.functions.invoke("confirm-split", {
          body: {
            token: normalizedToken,
            decision: input.decision,
            confirmationText: input.confirmationText?.trim(),
          },
        });

        if (error) {
          await throwFunctionInvokeError(error, "Split confirmation could not be submitted.");
        }
      },
      async uploadAsset(musicItemId, input) {
        const storagePath = buildMusicStoragePath(workspace, musicItemId, input.assetType, input.file.name);
        const uploadMethod = shouldUseResumableUpload(input.file, input.assetType) ? "resumable_tus" : "standard";
        const { data: uploadedFile, error: intentError } = await client
          .from("uploaded_files")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            file_name: input.file.name,
            file_type: input.file.type || "application/octet-stream",
            classification: normalizeUploadClassification(input.assetType),
            storage_bucket: MUSIC_UPLOADS_BUCKET,
            storage_ref: storagePath,
            status: "processing",
            metadata: { upload_method: uploadMethod, size: input.file.size },
          })
          .select("id,storage_ref")
          .single();

        if (intentError) throw intentError;

        const uploadedFileRow = uploadedFile as { id: string; storage_ref: string };
        await writeOperatingEvent(client, workspace, {
          eventType: "music_asset_upload_intent_created",
          targetType: "music_item",
          targetId: musicItemId,
          sourceType: "uploaded_file",
          sourceId: uploadedFileRow.id,
          summary: `Prepared upload for ${input.title}.`,
          payload: { asset_type: input.assetType, storage_ref: storagePath, upload_method: uploadMethod },
        });

        try {
          await uploadMusicFile(client, input.file, storagePath, uploadMethod);
        } catch (uploadError) {
          const uploadErrorMessage = readErrorMessage(uploadError, "Upload failed.");
          await client.from("uploaded_files").update({ status: "failed", error: uploadErrorMessage }).eq("id", uploadedFileRow.id);
          await writeOperatingEvent(client, workspace, {
            eventType: "music_asset_upload_failed",
            targetType: "music_item",
            targetId: musicItemId,
            sourceType: "uploaded_file",
            sourceId: uploadedFileRow.id,
            summary: `Upload failed for ${input.title}.`,
            payload: { asset_type: input.assetType, error: uploadErrorMessage },
          });
          throw new Error(uploadErrorMessage);
        }

        await client.from("uploaded_files").update({ status: "uploaded" }).eq("id", uploadedFileRow.id);

        const { error: assetError } = await client.from("music_assets").insert({
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          music_item_id: musicItemId,
          asset_type: input.assetType,
          title: input.title.trim(),
          uploaded_file_id: uploadedFileRow.id,
          status: "uploaded",
          created_by_type: "user",
          notes: `Stored in ${MUSIC_UPLOADS_BUCKET}/${storagePath}.`,
        });

        if (assetError) throw assetError;

        await writeOperatingEvent(client, workspace, {
          eventType: "music_asset_uploaded",
          targetType: "music_item",
          targetId: musicItemId,
          sourceType: "uploaded_file",
          sourceId: uploadedFileRow.id,
          summary: `Uploaded ${input.title}.`,
          payload: { asset_type: input.assetType, storage_ref: storagePath, upload_method: uploadMethod },
        });

        return {
          group: assetGroup(input.assetType),
          label: input.title.trim(),
          status: "Uploaded",
          action: "Uploaded",
          assetType: input.assetType,
        };
      },
    },
    manager: {
      async loadConversations() {
        const { data, error } = await client
          .from("conversations")
          .select("id,topic,status,summary,last_update_at,created_at")
          .eq("artist_workspace_id", workspace.artistWorkspaceId)
          .order("last_update_at", { ascending: false })
          .limit(20);

        if (error) {
          throw error;
        }

        const rows = (data as ConversationRow[] | null) ?? [];
        if (!rows.length) {
          return [];
        }

        const [
          { data: messageData, error: messageError },
          { data: outputData, error: outputError },
        ] = await Promise.all([
          client
            .from("conversation_messages")
            .select("id,conversation_id,speaker,label,body,metadata,created_at")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .in("conversation_id", rows.map((row) => row.id))
            .order("created_at", { ascending: true }),
          client
            .from("manager_outputs")
            .select("id,subject_id,summary,render_json,created_at")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .eq("output_type", "decision_package")
            .eq("subject_type", "conversation")
            .eq("is_current", true)
            .in("subject_id", rows.map((row) => row.id)),
        ]);

        if (messageError) throw messageError;
        if (outputError) throw outputError;

        const messagesByConversation = new Map<string, ConversationMessageRow[]>();
        for (const message of (messageData as ConversationMessageRow[] | null) ?? []) {
          const bucket = messagesByConversation.get(message.conversation_id) ?? [];
          bucket.push(message);
          messagesByConversation.set(message.conversation_id, bucket);
        }
        const outputsByConversation = new Map<string, ManagerOutputRow>();
        for (const output of (outputData as ManagerOutputRow[] | null) ?? []) {
          if (output.subject_id) outputsByConversation.set(output.subject_id, output);
        }

        return rows.map((row) => conversationFromRows(row, messagesByConversation.get(row.id) ?? [], outputsByConversation.get(row.id)));
      },
      async sendMessage(input) {
        const body = input.body.trim();
        if (!body) {
          throw new Error("Ask Manager requires a directive or question.");
        }

        const { data, error } = await client.functions.invoke("manager-conversation", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            conversationId: input.conversationId,
            body,
            ...(input.contextRequestId ? { contextRequestId: input.contextRequestId } : {}),
            ...(input.contextAnswers?.length ? { contextAnswers: input.contextAnswers } : {}),
          },
        });
        if (error) await throwFunctionInvokeError(error, "Manager conversation failed.");
        return conversationViewModel(data);
      },
      async sendMessageStream(input, handlers) {
        const body = input.body.trim();
        if (!body) {
          throw new Error("Ask Manager requires a directive or question.");
        }

        const session = await client.auth.getSession();
        const accessToken = session.data.session?.access_token;
        if (!accessToken) {
          throw new Error("Manager conversation streaming requires an authenticated session.");
        }

        const response = await fetch(supabaseFunctionUrl("manager-conversation-stream"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            conversationId: input.conversationId,
            body,
            ...(input.contextRequestId ? { contextRequestId: input.contextRequestId } : {}),
            ...(input.contextAnswers?.length ? { contextAnswers: input.contextAnswers } : {}),
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new Error(errorBody || `Manager conversation stream failed with status ${response.status}.`);
        }

        await consumeManagerConversationEventStream(response.body, handlers.onEvent);
      },
    },
    missions: {
      async loadMissions() {
        const { data, error } = await client
          .from("missions")
          .select("id,title,objective,status,progress,review_point,summary,current_recommendation,pattern_name")
          .eq("artist_workspace_id", workspace.artistWorkspaceId)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        const activeRows = ((data as MissionRow[] | null) ?? []).filter((mission) => !["candidate", "archived", "cancelled"].includes(mission.status ?? ""));
        const missionIds = new Set(activeRows.map((mission) => mission.id));
        const [
          { data: checkpointData, error: checkpointError },
          { data: taskData, error: taskError },
          { data: stepData, error: stepError },
          { data: resultData, error: resultError }
        ] = await Promise.all([
          client
            .from("checkpoints")
            .select("id,mission_id,title,question,status,recommendation,decision_rule,next_action,blocked_reason,dependency_impact,watched_signals,required_evidence,missing_evidence,reason_for_checkpoint")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .order("created_at", { ascending: true }),
          client
            .from("tasks")
            .select("id,mission_id,primary_checkpoint_id,title,status,owner_role,purpose,deadline,priority,approval_state,dependency,evidence_needed,risk_if_late")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .order("created_at", { ascending: true }),
          client
            .from("task_steps")
            .select("task_id,body,order_index")
            .eq("artist_workspace_id", workspace.artistWorkspaceId)
            .order("order_index", { ascending: true }),
          client
            .from("task_results")
            .select("task_id,status,summary,user_note,manager_interpretation,mission_effect,recommended_follow_up"),
        ]);

        if (checkpointError) throw checkpointError;
        if (taskError) throw taskError;
        if (stepError) throw stepError;
        if (resultError) throw resultError;

        const checkpoints = ((checkpointData as CheckpointRow[] | null) ?? []).filter((checkpoint) => missionIds.has(checkpoint.mission_id));
        const tasks = ((taskData as TaskRow[] | null) ?? []).filter((task) => task.mission_id && missionIds.has(task.mission_id));
        const steps = ((stepData as TaskStepRow[] | null) ?? []).filter((step) => tasks.some((t) => t.id === step.task_id));
        const results = ((resultData as TaskResultRow[] | null) ?? []).filter((res) => tasks.some((t) => t.id === res.task_id));
        const deliverablesByTask = await loadTaskDocumentDeliverables(client, workspace, tasks.map((task) => task.id));

        return activeRows.map((mission) => missionFromRow(
          mission,
          checkpoints.filter((checkpoint) => checkpoint.mission_id === mission.id),
          tasks.filter((task) => task.mission_id === mission.id),
          steps,
          results,
          deliverablesByTask,
        ));
      },
      async approveTask(taskId) {
        const { error } = await client
          .from("tasks")
          .update({ approval_state: "approved", status: "approved" })
          .eq("id", taskId)
          .eq("artist_workspace_id", workspace.artistWorkspaceId);

        if (error) throw error;
      },
      async uploadTaskDeliverable(taskId, input) {
        const title = input.title.trim() || input.file.name;
        const storagePath = buildTaskDocumentStoragePath(workspace, taskId, input.file.name);
        const { data: uploadedFile, error: intentError } = await client
          .from("uploaded_files")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            file_name: input.file.name,
            file_type: input.file.type || "application/octet-stream",
            classification: "other",
            storage_bucket: WORKSPACE_DOCUMENTS_BUCKET,
            storage_ref: storagePath,
            status: "processing",
            metadata: { task_id: taskId, title, size: input.file.size },
          })
          .select("id,storage_ref")
          .single();

        if (intentError) throw intentError;

        const uploadedFileRow = uploadedFile as { id: string; storage_ref: string };

        try {
          await uploadWorkspaceDocumentFile(client, input.file, storagePath);
        } catch (uploadError) {
          const uploadErrorMessage = readErrorMessage(uploadError, "Upload failed.");
          await client.from("uploaded_files").update({ status: "failed", error: uploadErrorMessage }).eq("id", uploadedFileRow.id);
          throw new Error(uploadErrorMessage);
        }

        await client.from("uploaded_files").update({ status: "uploaded" }).eq("id", uploadedFileRow.id);

        const { data: documentRow, error: documentError } = await client
          .from("documents")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            title,
            document_type: "task_deliverable",
            origin: "user_uploaded",
            status: "uploaded",
            created_by_type: "user",
            metadata: { task_id: taskId },
          })
          .select("id")
          .single();

        if (documentError) throw documentError;

        const documentId = (documentRow as { id: string }).id;
        const { data: versionRow, error: versionError } = await client
          .from("document_versions")
          .insert({
            account_id: workspace.accountId,
            artist_workspace_id: workspace.artistWorkspaceId,
            artist_id: workspace.artistId,
            document_id: documentId,
            version_number: 1,
            uploaded_file_id: uploadedFileRow.id,
            file_name: input.file.name,
            file_type: input.file.type || "application/octet-stream",
            storage_bucket: WORKSPACE_DOCUMENTS_BUCKET,
            storage_ref: storagePath,
            extraction_status: "pending",
          })
          .select("id")
          .single();

        if (versionError) throw versionError;

        await client.from("documents").update({ current_version_id: (versionRow as { id: string }).id }).eq("id", documentId);
        await client.from("artifact_links").insert({
          account_id: workspace.accountId,
          artist_workspace_id: workspace.artistWorkspaceId,
          artist_id: workspace.artistId,
          source_type: "document",
          source_id: documentId,
          target_type: "task",
          target_id: taskId,
          relationship: "response_to",
        });
        await writeOperatingEvent(client, workspace, {
          eventType: "task_deliverable_uploaded",
          targetType: "task",
          targetId: taskId,
          sourceType: "document",
          sourceId: documentId,
          summary: `Uploaded ${title}.`,
          payload: { uploaded_file_id: uploadedFileRow.id, storage_ref: storagePath },
        });

        return {
          id: documentId,
          title,
          status: "uploaded",
          documentId,
          fileName: input.file.name,
          validationSummary: "Ready for Manager review.",
        };
      },
      async completeTask(taskId, input) {
        const { data, error } = await client.functions.invoke("manager-review-task-result", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            taskId,
            status: input.status,
            note: input.note,
            documentIds: input.documentIds ?? [],
          },
        });
        if (error) await throwFunctionInvokeError(error, "Manager task review failed.");

        const missionId = isPlainRecord(data) && isPlainRecord(data.mission)
          ? readConversationString(data.mission.id, "")
          : "";
        const missions = await createSupabaseProductionRepositories(client, workspace).missions.loadMissions();
        const mission = missions.find((item) => item.id === missionId) ?? missions.find((item) =>
          item.tasks.some((task) => task.id === taskId),
        );
        if (!mission) {
          throw new Error("Manager task review completed, but the reviewed mission could not be reloaded.");
        }
        return mission;
      },
    },
    missionGenesis: {
      async runMissionGenesis() {
        const { data, error } = await client.functions.invoke("mission-genesis", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            mode: "initial",
          },
        });
        if (error) await throwFunctionInvokeError(error, "Mission Genesis failed.");
        return resolveMissionGenesisResponse(client, workspace, data);
      },
      async answerMissionGenesisContext(input) {
        const { data, error } = await client.functions.invoke("mission-genesis", {
          body: {
            accountId: workspace.accountId,
            artistWorkspaceId: workspace.artistWorkspaceId,
            artistId: workspace.artistId,
            mode: "continuation",
            candidateMissionId: input.candidateMissionId,
            answers: input.answers,
          },
        });
        if (error) await throwFunctionInvokeError(error, "Mission Genesis failed.");
        return resolveMissionGenesisResponse(client, workspace, data);
      },
    },
    evidence: {
      async loadEvidence() {
        const { data, error } = await client
          .from("evidence_items")
          .select("id,source,source_kind,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,limitation")
          .eq("artist_workspace_id", workspace.artistWorkspaceId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          throw error;
        }

        return ((data as EvidenceRow[] | null) ?? []).map(evidenceFromRow);
      },
    },
  };
}

type WorkspaceRow = {
  id: string;
  account_id: string;
  artist_id: string;
  name: string;
  status: ProductionWorkspace["status"];
  artists?: {
    display_name?: string | null;
    canonical_spotify_artist_id?: string | null;
    canonical_spotify_url?: string | null;
  } | null;
  artist_profiles?: WorkspaceProfileRow[] | null;
  source_sync_jobs?: Array<{ status?: ProductionWorkspace["latestCatalogSyncStatus"] | null; created_at?: string | null }> | null;
  billing_subscriptions?: Array<{ status?: ProductionWorkspace["subscriptionStatus"] | null; current_period_end?: string | null }> | null;
  workspace_setup_runs?: Array<{ status?: ProductionWorkspace["setupStatus"] | null; current_stage?: ProductionWorkspace["setupStage"] | null; checkout_session_id?: string | null; updated_at?: string | null }> | null;
};

type WorkspaceRpcRow = {
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  artist_name: string;
  workspace_name: string;
  status: ProductionWorkspace["status"];
  spotify_connected: boolean;
  spotify_artist_id?: string | null;
  spotify_artist_name?: string | null;
  spotify_artist_url?: string | null;
  spotify_image_url?: string | null;
  context_complete?: boolean | null;
  latest_catalog_sync_status?: ProductionWorkspace["latestCatalogSyncStatus"] | null;
  entitlement_active?: boolean | null;
  subscription_status?: ProductionWorkspace["subscriptionStatus"] | null;
  setup_status?: ProductionWorkspace["setupStatus"] | null;
  setup_stage?: ProductionWorkspace["setupStage"] | null;
};

type MusicItemRow = {
  id: string;
  title: string;
  item_type: string;
  lifecycle_stage: string;
  source_kind?: string | null;
  source_limit?: string | null;
  released_at?: string | null;
  metadata?: unknown;
};

type MusicProjectRow = {
  id: string;
  title: string;
  project_type: string;
  lifecycle_stage: string;
  source_kind?: string | null;
  source_limit?: string | null;
  released_at?: string | null;
  metadata?: unknown;
};

type MusicProjectItemRow = {
  music_project_id: string;
  music_item_id: string;
  order_index: number;
  disc_number?: number;
  display_title?: string | null;
};

type MusicIdentifierRow = {
  music_item_id?: string | null;
  music_project_id?: string | null;
  identifier_type: string;
  identifier_value: string;
};

type MusicAssetRow = {
  music_item_id?: string | null;
  music_project_id?: string | null;
  asset_type: string;
  title: string;
  status: string;
  uploaded_file_id?: string | null;
};

type MusicCreditRow = {
  music_item_id?: string | null;
  music_project_id?: string | null;
  role: string;
  name: string;
  status: string;
};

type MusicSplitRow = {
  id?: string;
  music_item_id?: string | null;
  status: string;
  summary?: string | null;
  publishing_total?: number | string | null;
  master_total?: number | string | null;
  contributors?: unknown;
};

type MusicSplitContributorRow = {
  id: string;
  music_split_id: string;
  name: string;
  role: string;
  email?: string | null;
  publishing_share: number | string;
  master_share: number | string;
  approval_status: string;
};

type WorkspaceProfileRow = {
  display_name?: string | null;
  spotify_identity?: unknown;
  genres?: string[] | null;
  home_market?: string | null;
  stage?: string | null;
  current_goal?: string | null;
  artist_direction?: string | null;
  budget_context?: string | null;
  social_handles?: unknown;
};

type SourceSyncJobRow = {
  status?: ProductionWorkspace["latestCatalogSyncStatus"] | null;
  completed_at?: string | null;
  job_type?: string | null;
};

type OperatingEventRow = {
  id: string;
  event_type: string;
  summary: string;
  created_at?: string | null;
};

type ManagerSynthesisRunRow = {
  id: string;
  status?: string | null;
  classification?: string | null;
  confidence?: string | null;
  action_plan?: unknown;
  limitations?: string[] | null;
  completed_at?: string | null;
  created_at?: string | null;
};

type ManagerOutputRow = {
  id: string;
  source_packet_id?: string | null;
  created_from_run_id?: string | null;
  output_type?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  is_current?: boolean | null;
  render_json?: unknown;
  hero_json?: unknown;
  blocks_json?: unknown;
  summary?: string | null;
  confidence_json?: unknown;
  supporting_evidence_json?: unknown;
  created_at?: string | null;
};

type AgentProfileRow = {
  agent_key: string;
  name: string;
  title?: string | null;
  status_default: AgentViewModel["status"];
  purpose?: string | null;
  tools?: string[] | null;
  required_source_capabilities?: string[] | null;
  optional_source_capabilities?: string[] | null;
  manager_can_prepare?: string[] | null;
};

type ConversationRow = {
  id: string;
  topic: string;
  status: string;
  summary?: string | null;
  last_update_at?: string | null;
  created_at?: string | null;
};

type ConversationMessageRow = {
  id: string;
  conversation_id: string;
  speaker: "artist" | "manager" | "system";
  label?: string | null;
  body: string;
  metadata?: unknown;
  created_at?: string | null;
};

type ManagerOutputRow = {
  id: string;
  subject_id?: string | null;
  summary?: string | null;
  render_json?: unknown;
  created_at?: string | null;
};

type MissionRow = {
  id: string;
  title: string;
  objective?: string | null;
  status?: MissionViewModel["status"] | null;
  progress?: number | null;
  review_point?: string | null;
  summary?: string | null;
  current_recommendation?: string | null;
  pattern_name?: string | null;
};

type CheckpointRow = {
  id: string;
  mission_id: string;
  title: string;
  question: string;
  status: string;
  recommendation?: string | null;
  decision_rule?: string | null;
  next_action?: string | null;
  blocked_reason?: string | null;
  dependency_impact?: string | null;
  watched_signals?: string[] | null;
  required_evidence?: string[] | null;
  missing_evidence?: string[] | null;
  reason_for_checkpoint?: string | null;
};

type TaskRow = {
  id: string;
  mission_id?: string | null;
  primary_checkpoint_id?: string | null;
  title: string;
  status: string;
  owner_role?: string | null;
  purpose?: string | null;
  deadline?: string | null;
  priority?: number | null;
  approval_state?: string | null;
  dependency?: string | null;
  evidence_needed?: string[] | null;
  risk_if_late?: string | null;
};

type TaskStepRow = {
  task_id: string;
  body: string;
  order_index: number;
};

type TaskResultRow = {
  task_id: string;
  status: string;
  summary?: string | null;
  user_note?: string | null;
  manager_interpretation?: string | null;
  mission_effect?: string | null;
  recommended_follow_up?: string | null;
};

type ArtifactLinkRow = {
  source_id: string;
  target_id: string;
  relationship?: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  status?: MissionTaskDeliverableViewModel["status"] | null;
  current_version_id?: string | null;
};

type DocumentVersionRow = {
  id: string;
  document_id: string;
  file_name?: string | null;
};

type EvidenceRow = {
  id: string;
  source: string;
  source_kind: string;
  evidence_type?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  subject_label?: string | null;
  metric_name?: string | null;
  metric_value?: number | null;
  metric_unit?: string | null;
  freshness?: string | null;
  confidence?: string | null;
  limitation?: string | null;
};

function conversationFromRows(row: ConversationRow, messages: ConversationMessageRow[], output?: ManagerOutputRow): ConversationViewModel {
  const mappedMessages = messages.map(conversationMessageFromRow);
  const prompt = mappedMessages.find((message) => message.speaker === "artist")?.body ?? row.summary ?? "";

  return {
    id: row.id,
    topic: row.topic,
    status: row.status,
    summary: row.summary ?? "No summary has been generated yet.",
    prompt,
    lastUpdate: row.last_update_at ?? row.created_at ?? undefined,
    messages: mappedMessages,
    ...(output ? { decisionPackage: decisionPackageFromRow(output) } : {}),
    createdWork: mappedMessages.flatMap((message) => message.createdWork ?? []),
  };
}

function decisionPackageFromRow(row: ManagerOutputRow): ConversationViewModel["decisionPackage"] {
  const render = isPlainRecord(row.render_json) ? row.render_json : {};
  return {
    id: row.id,
    title: readConversationString(render.title, "Manager decision package"),
    summary: readConversationString(render.summary, row.summary ?? "Manager saved a decision package."),
    recommendation: readConversationString(render.recommendation, ""),
    confidence: readConversationString(render.confidence, "unknown"),
    actionPolicy: readConversationString(render.actionPolicy, "create_decision_package"),
    evidenceIds: readStringList(render.evidenceIds),
    limitations: readStringList(render.limitations),
    createdWork: normalizeCreatedWork(render.createdWork),
    proposedActions: normalizeProposedActions(render.proposedActions),
    createdAt: row.created_at ?? undefined,
  };
}

function conversationMessageFromRow(row: ConversationMessageRow): ConversationViewModel["messages"][number] {
  const metadata = isPlainRecord(row.metadata) ? row.metadata : {};
  const speaker = row.speaker === "artist" ? "artist" : "manager";
  const createdWork = normalizeCreatedWork(metadata.createdWork);
  const contextQuestions = normalizeContextQuestions(metadata.contextQuestions);
  const contextRequestId = readOptionalConversationString(metadata.contextRequestId);
  return {
    id: row.id,
    speaker,
    label: row.label ?? (speaker === "artist" ? "You" : "Manager"),
    body: row.body,
    ...(createdWork.length ? { createdWork } : {}),
    ...(contextQuestions.length ? { contextQuestions } : {}),
    ...(contextRequestId ? { contextRequestId } : {}),
  };
}

function conversationViewModel(input: unknown): ConversationViewModel {
  if (!isPlainRecord(input)) throw new Error("Manager conversation returned an invalid thread.");
  const messages = Array.isArray(input.messages)
    ? input.messages.map((message, index) => {
        if (!isPlainRecord(message)) throw new Error("Manager conversation returned an invalid message.");
        const speaker = message.speaker === "artist" ? "artist" : "manager";
        const createdWork = normalizeCreatedWork(message.createdWork);
        const contextQuestions = normalizeContextQuestions(message.contextQuestions);
        const contextRequestId = readOptionalConversationString(message.contextRequestId);
        return {
          id: readConversationString(message.id, `message-${index}`),
          speaker,
          label: readConversationString(message.label, speaker === "artist" ? "You" : "Manager"),
          body: readConversationString(message.body, ""),
          ...(createdWork.length ? { createdWork } : {}),
          ...(contextQuestions.length ? { contextQuestions } : {}),
          ...(contextRequestId ? { contextRequestId } : {}),
        };
      })
    : [];
  const createdWork = normalizeCreatedWork(input.createdWork);

  return {
    id: readConversationString(input.id, ""),
    topic: readConversationString(input.topic, "Manager conversation"),
    status: readConversationString(input.status, "Manager responded"),
    summary: readConversationString(input.summary, "Manager answered the directive."),
    prompt: readConversationString(input.prompt, messages.find((message) => message.speaker === "artist")?.body ?? ""),
    lastUpdate: typeof input.lastUpdate === "string" ? input.lastUpdate : undefined,
    messages,
    createdWork: createdWork.length ? createdWork : messages.flatMap((message) => message.createdWork ?? []),
  };
}

function normalizeCreatedWork(value: unknown): ConversationViewModel["createdWork"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainRecord)
    .map((item) => ({
      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",
      title: readConversationString(item.title, ""),
      body: readConversationString(item.body, ""),
      id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : undefined,
      parentMissionId: typeof item.parentMissionId === "string" && item.parentMissionId.trim() ? item.parentMissionId.trim() : undefined,
      status: item.status === "created" || item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : undefined,
    }))
    .filter((item) => item.title && item.body);
}

function normalizeContextQuestions(value: unknown): NonNullable<ConversationViewModel["messages"][number]["contextQuestions"]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainRecord)
    .map((item) => ({
      key: readConversationString(item.key, ""),
      question: readConversationString(item.question, ""),
      reason: readConversationString(item.reason, ""),
      answerKind: item.answerKind === "single_select" || item.answerKind === "multi_select" || item.answerKind === "money_range" ? item.answerKind : "short_text",
      options: Array.isArray(item.options) ? item.options.filter((option): option is string => typeof option === "string" && Boolean(option.trim())).map((option) => option.trim()) : [],
    }))
    .filter((item) => item.key && item.question);
}

function normalizeProposedActions(value: unknown): NonNullable<ConversationViewModel["decisionPackage"]>["proposedActions"] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainRecord)
    .map((item) => ({
      title: readConversationString(item.title, ""),
      body: readConversationString(item.body, ""),
      actionType: readConversationString(item.actionType, ""),
      targetType: readConversationString(item.targetType, ""),
      approvalRequired: Boolean(item.approvalRequired),
    }))
    .filter((item) => item.title && item.body);
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function readConversationString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readOptionalConversationString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function resolveMissionGenesisResponse(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  data: unknown,
): Promise<MissionGenesisResultViewModel> {
  if (!isMissionGenesisProcessingResponse(data)) {
    return missionGenesisViewModel(data);
  }

  return waitForMissionGenesisRun(client, workspace, data.runId);
}

function isMissionGenesisProcessingResponse(value: unknown): value is { status: "processing"; runId: string } {
  return isPlainRecord(value) && value.status === "processing" && typeof value.runId === "string" && Boolean(value.runId.trim());
}

async function waitForMissionGenesisRun(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  runId: string,
): Promise<MissionGenesisResultViewModel> {
  for (let attempt = 0; attempt < MISSION_GENESIS_POLL_ATTEMPTS; attempt += 1) {
    const { data: run, error: runError } = await client
      .from("manager_synthesis_runs")
      .select("id,status,error")
      .eq("id", runId)
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .maybeSingle();

    if (runError) throw runError;

    const runRow = isPlainRecord(run) ? run : null;
    if (runRow?.status === "failed") {
      throw new Error(readConversationString(runRow.error, "Mission Genesis failed."));
    }

    const result = await loadPersistedMissionGenesisResult(client, runId);
    if (result) return result;

    await sleep(MISSION_GENESIS_POLL_INTERVAL_MS);
  }

  throw new Error("Mission Genesis is still processing. Try again in a moment.");
}

async function loadPersistedMissionGenesisResult(client: SupabaseClient, runId: string) {
  const { data, error } = await client
    .from("manager_run_actions")
    .select("payload,result_payload")
    .eq("manager_synthesis_run_id", runId)
    .order("order_index", { ascending: true })
    .limit(1);

  if (error) throw error;
  const action = Array.isArray(data) && isPlainRecord(data[0]) ? data[0] : null;
  if (!action) return null;

  return missionGenesisViewModel(missionGenesisViewModelFromAction(action.payload, action.result_payload));
}

function missionGenesisViewModelFromAction(payload: unknown, resultPayload: unknown) {
  const output = isPlainRecord(payload) ? payload : {};
  const result = isPlainRecord(resultPayload) ? resultPayload : {};
  const outcome = readMissionGenesisOutcome(output.outcome ?? result.outcome);
  const ids = normalizeMissionGenesisIds(outcome, result);

  return {
    outcome,
    title: missionGenesisOutcomeTitle(outcome),
    body: readConversationString(output.decisionSummary, "Mission Genesis completed."),
    reasons: readStringArray(output.reasons),
    questions: Array.isArray(result.questions) ? result.questions : Array.isArray(output.questions) ? output.questions : [],
    evidenceNeeded: readStringArray(output.evidenceNeeded),
    ...(ids.missionIds.length ? { missionIds: ids.missionIds } : {}),
    ...(ids.candidateMissionIds.length ? { candidateMissionIds: ids.candidateMissionIds } : {}),
    ...(ids.activatedMissionIds.length ? { activatedMissionIds: ids.activatedMissionIds } : {}),
    ...(outcome === "candidate_needs_context" ? { candidateMissionId: ids.candidateMissionIds[0] ?? ids.primaryMissionId } : {}),
    ...((outcome === "activate_mission" || outcome === "update_existing_mission")
      ? { activatedMissionId: ids.activatedMissionIds[0] ?? ids.primaryMissionId }
      : {}),
  };
}

function normalizeMissionGenesisIds(outcome: MissionGenesisResultViewModel["outcome"], value: Record<string, unknown>) {
  const missionIds = uniqueMissionGenesisStrings([
    ...readStringArray(value.missionIds),
    readOptionalString(value.missionId),
    readOptionalString(value.primaryMissionId),
  ]);
  const explicitActivatedMissionIds = uniqueMissionGenesisStrings([
    readOptionalString(value.activatedMissionId),
    ...readStringArray(value.activatedMissionIds),
  ]);
  const activatedMissionIds = explicitActivatedMissionIds.length
    ? explicitActivatedMissionIds
    : outcome === "activate_mission" || outcome === "update_existing_mission"
      ? missionIds
      : [];
  const candidateMissionIds = uniqueMissionGenesisStrings([
    readOptionalString(value.candidateMissionId),
    ...readStringArray(value.candidateMissionIds),
    ...(outcome === "candidate_needs_context" ? missionIds : []),
  ]);
  return {
    missionIds,
    activatedMissionIds,
    candidateMissionIds,
    primaryMissionId: activatedMissionIds[0] ?? candidateMissionIds[0] ?? missionIds[0],
  };
}

function readMissionGenesisOutcome(value: unknown): MissionGenesisResultViewModel["outcome"] {
  const outcomes: MissionGenesisResultViewModel["outcome"][] = ["activate_mission", "candidate_needs_context", "request_evidence", "update_existing_mission", "no_mission"];
  return outcomes.includes(value as MissionGenesisResultViewModel["outcome"]) ? value as MissionGenesisResultViewModel["outcome"] : "no_mission";
}

function missionGenesisOutcomeTitle(outcome: MissionGenesisResultViewModel["outcome"]) {
  const titles: Record<MissionGenesisResultViewModel["outcome"], string> = {
    activate_mission: "Mission activated",
    candidate_needs_context: "The Manager needs context",
    request_evidence: "Mission was not created",
    update_existing_mission: "Existing mission should be updated",
    no_mission: "Mission was not created",
  };
  return titles[outcome];
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueMissionGenesisStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function missionGenesisViewModel(input: unknown): MissionGenesisResultViewModel {
  if (!input || typeof input !== "object") throw new Error("Mission Genesis did not return a usable decision.");
  const record = input as Record<string, unknown>;
  const result = input as MissionGenesisResultViewModel;
  const outcomes: MissionGenesisResultViewModel["outcome"][] = ["activate_mission", "candidate_needs_context", "request_evidence", "update_existing_mission", "no_mission"];
  if (!outcomes.includes(result.outcome) || !result.title?.trim() || !result.body?.trim()) {
    throw new Error("Mission Genesis returned an invalid decision contract.");
  }
  const ids = normalizeMissionGenesisIds(result.outcome, record);
  return {
    ...result,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    evidenceNeeded: Array.isArray(result.evidenceNeeded) ? result.evidenceNeeded : [],
    questions: (Array.isArray(result.questions) ? result.questions : []).map((question) => ({
      key: question.key,
      question: question.question,
      reason: question.reason,
      answerKind: question.answerKind,
      options: question.options,
    })),
    ...(ids.missionIds.length ? { missionIds: ids.missionIds } : {}),
    ...(ids.candidateMissionIds.length ? { candidateMissionIds: ids.candidateMissionIds } : {}),
    ...(ids.activatedMissionIds.length ? { activatedMissionIds: ids.activatedMissionIds } : {}),
    ...(result.outcome === "candidate_needs_context" ? { candidateMissionId: ids.candidateMissionIds[0] ?? ids.primaryMissionId } : {}),
    ...((result.outcome === "activate_mission" || result.outcome === "update_existing_mission")
      ? { activatedMissionId: ids.activatedMissionIds[0] ?? ids.primaryMissionId }
      : {}),
  };
}

type SupabaseStorageClient = {
  storage?: {
    from(bucket: string): {
      upload(path: string, file: File, options?: { contentType?: string; upsert?: boolean }): Promise<{ data: unknown; error: unknown }>;
    };
  };
  auth?: {
    getSession(): Promise<{ data?: { session?: { access_token?: string | null } | null } | null; error?: unknown }>;
  };
};

async function writeOperatingEvent(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  event: {
    eventType: string;
    targetType: string;
    targetId: string;
    summary: string;
    sourceType?: string;
    sourceId?: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await client.from("operating_events").insert({
    account_id: workspace.accountId,
    artist_workspace_id: workspace.artistWorkspaceId,
    artist_id: workspace.artistId,
    event_type: event.eventType,
    actor_type: "user",
    target_type: event.targetType,
    target_id: event.targetId,
    source_type: event.sourceType,
    source_id: event.sourceId,
    summary: event.summary,
    payload: event.payload ?? {},
  });

  if (error) throw error;
}

async function loadTaskDocumentDeliverables(client: SupabaseClient, workspace: ProductionWorkspace, taskIds: string[]) {
  const deliverablesByTask = new Map<string, MissionTaskDeliverableViewModel[]>();
  if (!taskIds.length) return deliverablesByTask;

  const { data: linkData, error: linkError } = await client
    .from("artifact_links")
    .select("source_id,target_id,relationship")
    .eq("artist_workspace_id", workspace.artistWorkspaceId)
    .eq("source_type", "document")
    .eq("target_type", "task")
    .in("target_id", taskIds);

  if (linkError) throw linkError;

  const links = ((linkData as ArtifactLinkRow[] | null) ?? []).filter((link) => link.source_id && link.target_id);
  const documentIds = [...new Set(links.map((link) => link.source_id))];
  if (!documentIds.length) return deliverablesByTask;

  const [{ data: documentData, error: documentError }, { data: versionData, error: versionError }] = await Promise.all([
    client
      .from("documents")
      .select("id,title,status,current_version_id")
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .in("id", documentIds),
    client
      .from("document_versions")
      .select("id,document_id,file_name")
      .eq("artist_workspace_id", workspace.artistWorkspaceId)
      .in("document_id", documentIds),
  ]);

  if (documentError) throw documentError;
  if (versionError) throw versionError;

  const documents = ((documentData as DocumentRow[] | null) ?? []);
  const versions = ((versionData as DocumentVersionRow[] | null) ?? []);

  for (const link of links) {
    const document = documents.find((item) => item.id === link.source_id);
    if (!document) continue;
    const version = versions.find((item) => item.id === document.current_version_id) ?? versions.find((item) => item.document_id === document.id);
    const taskDeliverables = deliverablesByTask.get(link.target_id) ?? [];
    taskDeliverables.push({
      id: document.id,
      title: document.title,
      status: mapDocumentDeliverableStatus(document.status),
      documentId: document.id,
      fileName: version?.file_name ?? undefined,
      validationSummary: "Ready for Manager review.",
    });
    deliverablesByTask.set(link.target_id, taskDeliverables);
  }

  return deliverablesByTask;
}

function mapDocumentDeliverableStatus(status: string | null | undefined): MissionTaskDeliverableViewModel["status"] {
  if (status === "checking" || status === "accepted" || status === "needs_revision" || status === "failed" || status === "uploaded") return status;
  return "uploaded";
}

async function loadMusicSplitForItem(client: SupabaseClient, workspace: ProductionWorkspace, musicItemId: string): Promise<MusicSplitRow | null> {
  const { data, error } = await client
    .from("music_splits")
    .select("id,music_item_id,status,summary,publishing_total,master_total")
    .eq("music_item_id", musicItemId)
    .eq("artist_workspace_id", workspace.artistWorkspaceId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as MusicSplitRow | null) ?? null;
}

async function ensureMusicSplit(client: SupabaseClient, workspace: ProductionWorkspace, musicItemId: string): Promise<MusicSplitRow & { id: string }> {
  const existing = await loadMusicSplitForItem(client, workspace, musicItemId);
  if (existing?.id) return existing as MusicSplitRow & { id: string };

  const { data, error } = await client
    .from("music_splits")
    .insert({
      account_id: workspace.accountId,
      artist_workspace_id: workspace.artistWorkspaceId,
      artist_id: workspace.artistId,
      music_item_id: musicItemId,
      status: "draft",
      summary: "Split proposal started. Balance shares before sending confirmation links.",
      publishing_total: 0,
      master_total: 0,
      created_by_type: "user",
    })
    .select("id,music_item_id,status,summary,publishing_total,master_total")
    .single();

  if (error) throw error;
  const row = data as MusicSplitRow & { id: string };
  await writeOperatingEvent(client, workspace, {
    eventType: "music_split_created",
    targetType: "music_split",
    targetId: row.id,
    summary: "Created split proposal.",
    payload: { music_item_id: musicItemId },
  });
  return row;
}

async function loadSplitContributors(client: SupabaseClient, splitId: string): Promise<MusicSplitContributorRow[]> {
  const { data, error } = await client
    .from("music_split_contributors")
    .select("id,music_split_id,name,role,email,publishing_share,master_share,approval_status")
    .eq("music_split_id", splitId);

  if (error) throw error;
  return (data ?? []) as MusicSplitContributorRow[];
}

async function recomputeSplitTotals(client: SupabaseClient, splitId: string) {
  const contributors = await loadSplitContributors(client, splitId);
  const publishingTotal = sumShares(contributors.map((contributor) => contributor.publishing_share));
  const masterTotal = sumShares(contributors.map((contributor) => contributor.master_share));
  const status = contributors.length ? "draft" : "missing";
  const summary = contributors.length
    ? "Split proposal is in draft. Balance shares before sending confirmation links."
    : "No collaborator split sheet or rights evidence has been uploaded for this song.";

  const { error } = await client
    .from("music_splits")
    .update({ publishing_total: publishingTotal, master_total: masterTotal, status, summary })
    .eq("id", splitId);

  if (error) throw error;
}

function validateSplitReadyToSend(split: MusicSplitRow, contributors: MusicSplitContributorRow[]) {
  if (["cleared", "revoked", "superseded"].includes(split.status)) {
    throw new Error("This split proposal cannot send confirmation links in its current state.");
  }
  if (!contributors.length) {
    throw new Error("Add split contributors before sending confirmation links.");
  }
  if (contributors.some((contributor) => !String(contributor.email ?? "").trim())) {
    throw new Error("Every split contributor needs an email before confirmation links can be sent.");
  }

  const publishingTotal = sumShares(contributors.map((contributor) => contributor.publishing_share));
  const masterTotal = sumShares(contributors.map((contributor) => contributor.master_share));
  if (publishingTotal !== 100 || masterTotal !== 100) {
    throw new Error("Publishing and master split totals must both equal 100%.");
  }
}

function normalizeSplitContributorInput(input: SplitContributorInput) {
  const name = input.name.trim();
  const role = input.role.trim();
  const email = input.email.trim();
  const publishingShare = normalizeShare(input.publishingShare);
  const masterShare = normalizeShare(input.masterShare);
  if (!name) throw new Error("Contributor name is required.");
  if (!role) throw new Error("Contributor role is required.");
  if (!email) throw new Error("Contributor email is required.");
  return { name, role, email, publishingShare, masterShare };
}

function normalizeShare(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Split shares must be between 0 and 100%.");
  }
  return Number(value.toFixed(2));
}

function sumShares(values: Array<number | string>) {
  return Number(values.reduce((sum, value) => sum + parsePercentValue(value), 0).toFixed(2));
}

function normalizeSplitConfirmationView(data: unknown): SplitConfirmationViewModel {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  return {
    songTitle: readStringField(record.songTitle) ?? "Split proposal",
    contributorName: readStringField(record.contributorName) ?? "Contributor",
    contributorRole: readStringField(record.contributorRole) ?? "Contributor",
    publishingShare: formatPercent(record.publishingShare as string | number | null | undefined) ?? "Missing",
    masterShare: formatPercent(record.masterShare as string | number | null | undefined) ?? "Missing",
    status: readStringField(record.status) ?? "sent",
    contributors: Array.isArray(record.contributors)
      ? record.contributors.map((item) => {
          const contributor = item && typeof item === "object" ? item as Record<string, unknown> : {};
          return {
            name: readStringField(contributor.name) ?? "Contributor",
            role: readStringField(contributor.role) ?? "Contributor",
            publishingShare: formatPercent(contributor.publishingShare as string | number | null | undefined) ?? "Missing",
            masterShare: formatPercent(contributor.masterShare as string | number | null | undefined) ?? "Missing",
            approval: titleCaseStatus(readStringField(contributor.approval) ?? "pending"),
          };
        })
      : [],
  };
}

function buildMusicStoragePath(workspace: ProductionWorkspace, musicItemId: string, assetType: string, fileName: string) {
  return [
    workspace.accountId,
    workspace.artistWorkspaceId,
    musicItemId,
    assetType,
    `${Date.now()}-${safeStorageFileName(fileName)}`,
  ].join("/");
}

function buildTaskDocumentStoragePath(workspace: ProductionWorkspace, taskId: string, fileName: string) {
  return [
    workspace.accountId,
    workspace.artistWorkspaceId,
    "tasks",
    taskId,
    `${Date.now()}-${safeStorageFileName(fileName)}`,
  ].join("/");
}

function safeStorageFileName(fileName: string) {
  const trimmed = fileName.trim().toLowerCase();
  const withoutUnsafe = trimmed.replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return withoutUnsafe || "upload";
}

function normalizeUploadClassification(assetType: string) {
  const allowed = new Set([
    "spotify_for_artists_export",
    "royalty_statement",
    "split_sheet",
    "campaign_report",
    "pitch_asset",
    "rights_document",
    "final_master",
    "clean_version",
    "instrumental",
    "stems",
    "cover_art",
    "lyrics",
    "other",
  ]);
  return allowed.has(assetType) ? assetType : "other";
}

function shouldUseResumableUpload(file: File, assetType: string) {
  return file.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES || ["final_master", "clean_version", "instrumental", "stems"].includes(assetType);
}

async function uploadMusicFile(client: SupabaseClient, file: File, storagePath: string, uploadMethod: string) {
  if (uploadMethod === "resumable_tus") {
    await uploadMusicFileResumable(client, file, storagePath);
    return;
  }

  const storage = (client as unknown as SupabaseStorageClient).storage;
  if (!storage) {
    throw new Error("Supabase Storage is not configured.");
  }

  const { error } = await storage.from(MUSIC_UPLOADS_BUCKET).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) throw error;
}

async function uploadWorkspaceDocumentFile(client: SupabaseClient, file: File, storagePath: string) {
  const storage = (client as unknown as SupabaseStorageClient).storage;
  if (!storage) {
    throw new Error("Supabase Storage is not configured.");
  }

  const { error } = await storage.from(WORKSPACE_DOCUMENTS_BUCKET).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) throw error;
}

async function uploadMusicFileResumable(client: SupabaseClient, file: File, storagePath: string) {
  const clientLike = client as unknown as SupabaseStorageClient;
  const sessionResult = await clientLike.auth?.getSession();
  const token = sessionResult?.data?.session?.access_token;
  const supabaseUrl = readSupabaseUrl();

  if (!token || !supabaseUrl) {
    const storage = clientLike.storage;
    if (!storage) {
      throw new Error("Resumable upload requires an authenticated Supabase session.");
    }
    const { error } = await storage.from(MUSIC_UPLOADS_BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) throw error;
    return;
  }

  const tus = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      headers: {
        authorization: `Bearer ${token}`,
        "x-upsert": "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: MUSIC_UPLOADS_BUCKET,
        objectName: storagePath,
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
      },
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
}

function readSupabaseUrl() {
  const env = import.meta.env as Record<string, string | undefined>;
  return env.VITE_SUPABASE_URL?.replace(/\/$/, "");
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

function workspaceFromRpcRow(row: WorkspaceRpcRow): ProductionWorkspace {
  return {
    accountId: row.account_id,
    artistWorkspaceId: row.artist_workspace_id,
    artistId: row.artist_id,
    artistName: row.artist_name,
    workspaceName: row.workspace_name,
    status: row.status,
    spotifyConnected: row.spotify_connected,
    spotifyArtistId: row.spotify_artist_id ?? undefined,
    spotifyArtistName: row.spotify_artist_name ?? undefined,
    spotifyArtistUrl: row.spotify_artist_url ?? undefined,
    spotifyImageUrl: row.spotify_image_url ?? undefined,
    contextComplete: Boolean(row.context_complete),
    latestCatalogSyncStatus: row.latest_catalog_sync_status ?? undefined,
    entitlementActive: row.entitlement_active ?? undefined,
    subscriptionStatus: row.subscription_status ?? undefined,
    setupStatus: row.setup_status ?? undefined,
    setupStage: row.setup_stage ?? undefined,
  };
}

function billingCheckoutPreviewFromPayload(payload: unknown): ProductionBillingCheckoutPreview {
  const data = payload as Partial<ProductionBillingCheckoutPreview> | null;
  if (!data?.checkoutSessionId || !data.reference || !data.artist?.spotifyArtistId) {
    throw new Error("Billing checkout response did not include a valid preview.");
  }

  return {
    checkoutSessionId: data.checkoutSessionId,
    reference: data.reference,
    status: data.status ?? "open",
    artist: data.artist,
    amount: Number(data.amount ?? 20),
    amountMinor: Number(data.amountMinor ?? 2000),
    currency: data.currency ?? "USD",
    interval: data.interval ?? "monthly",
    expiresAt: data.expiresAt,
    authorizationUrl: data.authorizationUrl,
    accessCode: data.accessCode,
  };
}

function billingStatusFromPayload(payload: unknown): ProductionBillingStatus {
  const data = payload as Partial<ProductionBillingStatus> | null;
  if (!data) {
    throw new Error("Billing status response was empty.");
  }

  return {
    checkoutSessionId: data.checkoutSessionId,
    checkoutStatus: data.checkoutStatus ?? "missing",
    subscriptionStatus: data.subscriptionStatus ?? "none",
    entitlementActive: Boolean(data.entitlementActive),
    setupStatus: data.setupStatus ?? "not_started",
    setupStage: data.setupStage,
    workspace: data.workspace
      ? {
          ...data.workspace,
          billingCheckoutSessionId: data.checkoutSessionId ?? data.workspace.billingCheckoutSessionId,
          entitlementActive: Boolean(data.entitlementActive),
          subscriptionStatus: data.subscriptionStatus ?? data.workspace.subscriptionStatus,
          setupStatus: data.setupStatus ?? data.workspace.setupStatus,
          setupStage: data.setupStage ?? data.workspace.setupStage,
        }
      : undefined,
    authorizationUrl: data.authorizationUrl,
    accessCode: data.accessCode,
    message: data.message,
  };
}

function mapMusicLibrary({
  itemRows,
  projectRows,
  projectItemRows,
  identifierRows,
  assetRows,
  creditRows,
  splitRows,
  splitContributorRows,
  evidenceRows = [],
  managerOutputRows = [],
}: {
  itemRows: MusicItemRow[];
  projectRows: MusicProjectRow[];
  projectItemRows: MusicProjectItemRow[];
  identifierRows: MusicIdentifierRow[];
  assetRows: MusicAssetRow[];
  creditRows: MusicCreditRow[];
  splitRows: MusicSplitRow[];
  splitContributorRows: MusicSplitContributorRow[];
  evidenceRows?: EvidenceRow[];
  managerOutputRows?: ManagerOutputRow[];
}): ProductionMusicLibrary {
  const identifiersByItem = groupIdentifiers(identifierRows, "music_item_id");
  const identifiersByProject = groupIdentifiers(identifierRows, "music_project_id");
  const assetsByItem = groupRows(assetRows, "music_item_id");
  const assetsByProject = groupRows(assetRows, "music_project_id");
  const creditsByItem = groupRows(creditRows, "music_item_id");
  const splitsByItem = groupRows(splitRows, "music_item_id");
  const evidenceByItem = groupRows((evidenceRows ?? []).filter((row) => row.subject_type === "music_item"), "subject_id");
  const evidenceByProject = groupRows((evidenceRows ?? []).filter((row) => row.subject_type === "music_project"), "subject_id");
  const generatedReadsByItem = managerReadOutputsBySubject(managerOutputRows, "music_item", "song_manager_read");
  const generatedReadsByProject = managerReadOutputsBySubject(managerOutputRows, "music_project", "project_manager_read");
  const contributorsBySplit = groupRows(splitContributorRows, "music_split_id");
  const projectRowsById = new Map(projectRows.map((row) => [row.id, row]));
  const projectMetadataById = new Map(projectRows.map((row) => [row.id, readSpotifyMetadata(row.metadata)]));
  const projectIdsBySong = new Map<string, string[]>();

  for (const row of projectItemRows) {
    projectIdsBySong.set(row.music_item_id, [...(projectIdsBySong.get(row.music_item_id) ?? []), row.music_project_id]);
  }

  const songs: ProductionMusicItem[] = itemRows.map((row) => {
    const identifiers = identifiersByItem.get(row.id);
    const spotify = readSpotifyMetadata(row.metadata);
    const manualDetails = readManualDetails(row.metadata);
    const generatedManagerRead = generatedReadsByItem.get(row.id) ?? readGeneratedManagerRead(row.metadata);
    const artists = readSpotifyArtists(spotify.artists);
    const assets = mapAssets(assetsByItem.get(row.id));
    const linkedProjectIds = projectIdsBySong.get(row.id) ?? [];
    const linkedProjectSpotify = linkedProjectIds.map((projectId) => projectMetadataById.get(projectId) ?? {});
    const linkedProjectIdentifiers = linkedProjectIds.flatMap((projectId) => identifiersByProject.get(projectId) ?? []);
    return {
      id: row.id,
      title: row.title,
      itemType: row.item_type,
      lifecycleStage: row.lifecycle_stage,
      sourceKind: row.source_kind,
      sourceLimit: row.source_limit,
      releasedAt: row.released_at,
      spotifyUrl: readIdentifier(identifiers, "spotify_track_url") ?? readStringField(spotify.url) ?? readSpotifyUrl(row.metadata),
      spotifyTrackId: readIdentifier(identifiers, "spotify_track_id") ?? readStringField(spotify.track_id),
      spotifyUri: readIdentifier(identifiers, "spotify_track_uri") ?? readStringField(spotify.uri),
      isrc: readIdentifier(identifiers, "isrc") ?? readStringField(spotify.isrc),
      upc: readIdentifier(identifiers, "upc") ?? readStringField(spotify.upc) ?? readIdentifier(linkedProjectIdentifiers, "upc"),
      albumId: readStringField(spotify.album_id) ?? readFirstString(linkedProjectSpotify, "album_id"),
      albumName: readStringField(spotify.album_name) ?? projectRowsById.get(linkedProjectIds[0] ?? "")?.title,
      albumLabel: readStringField(spotify.label) ?? readStringField(spotify.album_label) ?? readFirstString(linkedProjectSpotify, "label"),
      copyrights: readCopyrightTexts(spotify.copyrights).length ? readCopyrightTexts(spotify.copyrights) : firstCopyrightTexts(linkedProjectSpotify),
      genres: readStringArray(spotify.genres).length ? readStringArray(spotify.genres) : firstStringArray(linkedProjectSpotify, "genres"),
      language: readStringField(spotify.language),
      mood: readStringField(spotify.mood),
      mode: readMode(spotify.audio_features) ?? readMode(spotify.mode),
      releaseDate: readStringField(spotify.release_date),
      durationMs: readNumberField(spotify.duration_ms),
      explicit: readBooleanField(spotify.explicit),
      trackNumber: readNumberField(spotify.track_number),
      discNumber: readNumberField(spotify.disc_number),
      primaryArtist: artists[0]?.name,
      featuredArtists: artists.slice(1).map((artist) => artist.name),
      coverImageUrl:
        readStringField(spotify.cover_image_url) ??
        readFirstImageUrl(spotify.images) ??
        readFirstImageUrl(spotify.album_images) ??
        firstProjectCover(linkedProjectSpotify),
      previewUrl: readNullableStringField(spotify.preview_url),
      popularity: readNumberField(spotify.popularity),
      manualDetails,
      generatedManagerRead,
      assets,
      credits: mapCredits(creditsByItem.get(row.id)),
      evidence: mapMusicEvidence(evidenceByItem.get(row.id)),
      splits: mapSplit(splitsByItem.get(row.id)?.[0], contributorsBySplit),
    };
  });

  const songTitleById = new Map(songs.map((song) => [song.id, song.title]));
  const songById = new Map(songs.map((song) => [song.id, song]));
  const projectTracksById = new Map<string, Array<{ id: string; title: string; orderIndex: number; discNumber?: number; lifecycleStage?: string; sourceKind?: string | null; blocker?: string }>>();

  for (const row of projectItemRows) {
    const tracks = projectTracksById.get(row.music_project_id) ?? [];
    const song = songById.get(row.music_item_id);
    tracks.push({
      id: row.music_item_id,
      title: row.display_title ?? songTitleById.get(row.music_item_id) ?? "Untitled track",
      orderIndex: row.order_index,
      discNumber: row.disc_number,
      lifecycleStage: song?.lifecycleStage,
      sourceKind: song?.sourceKind,
      blocker: song && requiresInAppSplitProof(song) && song.splits?.status && song.splits.status !== "Cleared" ? song.splits.status : undefined,
    });
    projectTracksById.set(row.music_project_id, tracks);
  }

  const projects: ProductionMusicProject[] = projectRows.map((row) => {
    const identifiers = identifiersByProject.get(row.id);
    const spotify = readSpotifyMetadata(row.metadata);
    const generatedManagerRead = generatedReadsByProject.get(row.id) ?? readGeneratedManagerRead(row.metadata);
    const assetCover = mapAssets(assetsByProject.get(row.id)).find((asset) => asset.group === "Artwork");
    return {
      id: row.id,
      title: row.title,
      projectType: row.project_type,
      lifecycleStage: row.lifecycle_stage,
      sourceKind: row.source_kind,
      sourceLimit: row.source_limit,
      releasedAt: row.released_at,
      generatedManagerRead,
      spotifyUrl: readIdentifier(identifiers, "spotify_album_url") ?? readSpotifyUrl(row.metadata),
      spotifyAlbumId: readIdentifier(identifiers, "spotify_album_id") ?? readStringField(spotify.album_id),
      spotifyUri: readIdentifier(identifiers, "spotify_album_uri") ?? readStringField(spotify.uri),
      upc: readIdentifier(identifiers, "upc"),
      albumType: readStringField(spotify.album_type),
      releaseDate: readStringField(spotify.release_date),
      totalTracks: readNumberField(spotify.total_tracks),
      coverImageUrl: readStringField(spotify.cover_image_url) ?? readFirstImageUrl(spotify.images) ?? (assetCover ? readStringField((assetCover as unknown as { url?: unknown }).url) : undefined),
      evidence: mapMusicEvidence(evidenceByProject.get(row.id)),
      tracks: (projectTracksById.get(row.id) ?? []).sort((a, b) => a.orderIndex - b.orderIndex),
    };
  });

  return { songs, projects };
}

function groupIdentifiers(rows: MusicIdentifierRow[], column: "music_item_id" | "music_project_id") {
  const groups = new Map<string, MusicIdentifierRow[]>();
  for (const row of rows) {
    const id = row[column];
    if (!id) continue;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return groups;
}

function readIdentifier(rows: MusicIdentifierRow[] | undefined, identifierType: string) {
  return rows?.find((row) => row.identifier_type === identifierType)?.identifier_value;
}

function readSpotifyUrl(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const spotify = (metadata as { spotify?: unknown }).spotify;
  if (!spotify || typeof spotify !== "object") {
    return undefined;
  }

  const directUrl = (spotify as { url?: unknown }).url;
  if (typeof directUrl === "string" && directUrl) {
    return directUrl;
  }

  const externalUrls = (spotify as { external_urls?: unknown }).external_urls;
  if (!externalUrls || typeof externalUrls !== "object") {
    return undefined;
  }

  const spotifyUrl = (externalUrls as { spotify?: unknown }).spotify;
  return typeof spotifyUrl === "string" && spotifyUrl ? spotifyUrl : undefined;
}

function groupRows<T extends Record<string, unknown>>(rows: T[], column: string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = row[column];
    if (typeof id !== "string" || !id) continue;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return groups;
}

function readSpotifyMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {};
  const spotify = (metadata as { spotify?: unknown }).spotify;
  return spotify && typeof spotify === "object" ? (spotify as Record<string, unknown>) : {};
}

function readManualDetails(metadata: unknown): Record<string, string> {
  if (!metadata || typeof metadata !== "object") return {};
  const manualDetails = (metadata as { manual_details?: unknown }).manual_details;
  if (!manualDetails || typeof manualDetails !== "object" || Array.isArray(manualDetails)) return {};
  return Object.entries(manualDetails as Record<string, unknown>).reduce<Record<string, string>>((details, [key, value]) => {
    const stringValue = readStringField(value);
    if (stringValue) details[key] = stringValue;
    return details;
  }, {});
}

function managerReadOutputsBySubject(rows: ManagerOutputRow[], subjectType: string, outputType: string) {
  const reads = new Map<string, ReturnType<typeof readGeneratedManagerReadPayload>>();
  const sortedRows = [...rows].sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
  for (const row of sortedRows) {
    if (!row.subject_id || row.subject_type !== subjectType || row.output_type !== outputType || row.is_current === false) continue;
    if (reads.has(row.subject_id)) continue;
    const read = readGeneratedManagerReadPayload(row.render_json);
    if (hasGeneratedManagerReadContent(read)) {
      reads.set(row.subject_id, read);
    }
  }
  return reads;
}

function readGeneratedManagerRead(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return readGeneratedManagerReadPayload((metadata as { manager_read?: unknown }).manager_read);
}

function readGeneratedManagerReadPayload(managerRead: unknown) {
  if (!managerRead || typeof managerRead !== "object" || Array.isArray(managerRead)) return {};
  return {
    situationLine: readStringField((managerRead as Record<string, unknown>).situationLine),
    managerRead: readStringField((managerRead as Record<string, unknown>).managerRead),
    nextMove: readStringField((managerRead as Record<string, unknown>).nextMove),
    watchNext: readStringField((managerRead as Record<string, unknown>).watchNext),
    generationState: readManagerReadGenerationState((managerRead as Record<string, unknown>).generationState),
    intelligenceSnapshot: readBriefSnapshotGroups((managerRead as Record<string, unknown>).intelligenceSnapshot),
    snapshotSummary: readStringField((managerRead as Record<string, unknown>).snapshotSummary),
    claimAudit: readBriefClaimAudit((managerRead as Record<string, unknown>).claimAudit),
    confidence: readStringField((managerRead as Record<string, unknown>).confidence),
    sourceLine: readStringField((managerRead as Record<string, unknown>).sourceLine),
  };
}

function hasGeneratedManagerReadContent(read: ReturnType<typeof readGeneratedManagerReadPayload>) {
  return Boolean(read.managerRead || read.nextMove || read.situationLine || read.watchNext || read.intelligenceSnapshot.length);
}

function mergeGeneratedManagerReadIntoMusicObject(
  model: MusicObjectViewModel,
  generated: ReturnType<typeof readGeneratedManagerReadPayload>,
): MusicObjectViewModel {
  if (!hasGeneratedManagerReadContent(generated)) return model;

  const managerRead = acceptedGeneratedManagerRead(generated, "managerRead");
  const nextMove = acceptedGeneratedManagerRead(generated, "nextMove");
  const situationLine = acceptedGeneratedVisibleMusicText(generated.situationLine);
  const watchNext = acceptedGeneratedVisibleMusicText(generated.watchNext);
  const intelligenceSnapshot = acceptedGeneratedIntelligenceSnapshot(generated.intelligenceSnapshot);
  const snapshotSummary = acceptedGeneratedVisibleMusicText(generated.snapshotSummary);
  const sourceLine = acceptedGeneratedVisibleMusicText(generated.sourceLine);

  return {
    ...model,
    situationLine: situationLine ?? model.situationLine,
    managerRead: managerRead ?? model.managerRead,
    watchNext: watchNext ?? model.watchNext,
    managerReadState: managerRead ? generated.generationState ?? "fresh" : model.managerReadState,
    nextMove: nextMove ?? model.nextMove,
    intelligenceSnapshot: intelligenceSnapshot ?? model.intelligenceSnapshot,
    snapshotSummary: snapshotSummary ?? model.snapshotSummary,
    confidence: generated.confidence || model.confidence,
    sourceLine: sourceLine ?? model.sourceLine,
  };
}

function readBriefClaimAudit(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).map((item) => ({
    claim: readRequiredBriefString(item.claim),
    evidenceIds: readBriefStringArray(item.evidenceIds),
    limitation: readRequiredBriefString(item.limitation),
  })).filter((audit) => audit.claim && audit.evidenceIds.length && audit.limitation);
}

function acceptedGeneratedManagerRead(
  generated: { managerRead?: string; nextMove?: string; situationLine?: string; watchNext?: string } | undefined,
  field: "managerRead" | "nextMove",
) {
  const value = generated?.[field]?.trim();
  if (!value) return undefined;

  const wordCount = value.split(/\s+/).filter(Boolean).length;
  const sentenceCount = (value.match(/[.!?](?=\s|$)/g) ?? []).length;
  const lower = value.toLowerCase();
  const managerDumpPhrases = [
    "the public catalog gives us",
    "exact spotify asset",
    "released under",
    "exclusive license",
    "territory/scene lanes",
    "i will demand",
    "within 48 hours i will",
    "high-cost music video",
    "full dsp analytics",
    "copyright owner",
    "catalog-only proof",
  ];

  if (hasBannedMusicVisibleTerm(value) || managerDumpPhrases.some((phrase) => lower.includes(phrase))) return undefined;
  if (field === "managerRead") {
    if (wordCount > 320 || sentenceCount > 12) return undefined;
  } else if (wordCount > 48 || sentenceCount > 2) {
    return undefined;
  }

  return value;
}

function acceptedGeneratedVisibleMusicText(value?: string) {
  const text = value?.trim();
  if (!text || hasBannedMusicVisibleTerm(text)) return undefined;
  return text;
}

function acceptedGeneratedIntelligenceSnapshot(groups?: TodayBriefViewModel["intelligenceSnapshot"]) {
  if (!groups?.length) return undefined;
  const cleanGroups = groups.map((group) => {
    const title = acceptedGeneratedVisibleMusicText(group.title);
    const insight = acceptedGeneratedVisibleMusicText(group.insight);
    if (!title || !insight) return undefined;
    const metrics = group.metrics.filter(isAcceptableGeneratedMusicMetric);
    return metrics.length ? { title, insight, metrics } : undefined;
  }).filter((group): group is TodayBriefViewModel["intelligenceSnapshot"][number] => Boolean(group));

  return cleanGroups.length ? cleanGroups : undefined;
}

function isAcceptableGeneratedMusicMetric(metric: TodayBriefViewModel["intelligenceSnapshot"][number]["metrics"][number]) {
  const label = acceptedGeneratedVisibleMusicText(metric.label);
  const value = acceptedGeneratedVisibleMusicText(metric.value);
  const context = metric.context ? acceptedGeneratedVisibleMusicText(metric.context) : undefined;
  if (!label || !value || !metric.evidenceIds.length) return false;
  if (metric.context && !context) return false;
  if (!isCompactMusicMetricValue(value)) return false;
  return true;
}

function isCompactMusicMetricValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length > 22) return false;
  if (/[.!?]/.test(trimmed.replace(/(\d)\.(\d)/g, "$1$2"))) return false;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (!/[\d#%]/.test(trimmed) && wordCount > 2) return false;
  return true;
}

const MUSIC_READ_BANNED_VISIBLE_TERMS = [
  "chatgpt",
  "ai",
  "bot",
  "backend",
  "chartmetric",
  "provider",
  "api",
  "apis",
  "database",
  "evidence row",
  "third-party",
  "spotify confirms",
  "spotify for artists",
  "private conversion data",
  "private saves",
  "private analytics",
  "private documents",
  "distributor proof",
  "proof of listeners",
  "listeners or saves",
  "missing saves",
  "missing listeners",
  "we do not yet have",
  "we don't yet have",
  "repeat listeners",
  "source-of-stream",
  "source limits",
  "source limit",
  "conversion proof",
  "campaign roi",
  "missing proof",
  "still missing",
  "missing data",
  "catalog-only",
  "metadata-only",
  "only catalog metadata",
  "metadata record",
  "saved track metadata",
];

function hasBannedMusicVisibleTerm(value: string) {
  return MUSIC_READ_BANNED_VISIBLE_TERMS.some((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(value));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readManagerReadGenerationState(value: unknown): "fresh" | "limited" | "fallback" | "failed" | undefined {
  return value === "fresh" || value === "limited" || value === "fallback" || value === "failed" ? value : undefined;
}

function normalizeManualDetailKey(label: string) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function readStringField(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function readFunctionStatus(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return readStringField((value as Record<string, unknown>).status);
}

function hasChartmetricEvidence(evidence: Array<{ source?: string | null; sourceKind?: string | null }>) {
  return evidence.some((item) =>
    item.source?.toLowerCase() === "chartmetric" ||
    item.sourceKind?.toLowerCase() === "chartmetric"
  );
}

function readNullableStringField(value: unknown) {
  return value === null ? null : readStringField(value);
}

function readNumberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBooleanField(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readSpotifyArtists(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((artist) => {
      if (!artist || typeof artist !== "object") return null;
      const name = (artist as { name?: unknown }).name;
      const id = (artist as { id?: unknown }).id;
      return typeof name === "string" && name ? { id: typeof id === "string" ? id : undefined, name } : null;
    })
    .filter(Boolean) as Array<{ id?: string; name: string }>;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function readFirstString(records: Array<Record<string, unknown>>, field: string) {
  for (const record of records) {
    const value = readStringField(record[field]);
    if (value) return value;
  }
  return undefined;
}

function firstStringArray(records: Array<Record<string, unknown>>, field: string) {
  for (const record of records) {
    const values = readStringArray(record[field]);
    if (values.length) return values;
  }
  return [];
}

function readCopyrightTexts(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((copyright) => {
      if (!copyright || typeof copyright !== "object") return undefined;
      const text = (copyright as { text?: unknown }).text;
      return typeof text === "string" && text ? text : undefined;
    })
    .filter(Boolean) as string[];
}

function firstCopyrightTexts(records: Array<Record<string, unknown>>) {
  for (const record of records) {
    const values = readCopyrightTexts(record.copyrights);
    if (values.length) return values;
  }
  return [];
}

function firstProjectCover(records: Array<Record<string, unknown>>) {
  for (const record of records) {
    const cover = readStringField(record.cover_image_url) ?? readFirstImageUrl(record.images);
    if (cover) return cover;
  }
  return undefined;
}

function readMode(value: unknown) {
  if (value && typeof value === "object") {
    return readMode((value as { mode?: unknown }).mode);
  }
  if (value === 1) return "Major";
  if (value === 0) return "Minor";
  if (typeof value === "string" && value) return value;
  return undefined;
}

function readFirstImageUrl(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const images = value
    .map((image) => {
      if (!image || typeof image !== "object") return null;
      const url = (image as { url?: unknown }).url;
      const width = (image as { width?: unknown }).width;
      return typeof url === "string" && url ? { url, width: typeof width === "number" ? width : 0 } : null;
    })
    .filter(Boolean) as Array<{ url: string; width: number }>;
  return images.sort((a, b) => b.width - a.width)[0]?.url;
}

function mapAssets(rows: MusicAssetRow[] | undefined): ProductionMusicItem["assets"] {
  return (rows ?? []).map((row) => ({
    group: assetGroup(row.asset_type),
    label: row.title,
    status: titleCaseStatus(row.status),
    action: assetAction(row.asset_type),
    assetType: row.asset_type,
    canUpload: row.status === "missing" || row.status === "draft",
    canReplace: Boolean(row.uploaded_file_id) && ["uploaded", "confirmed"].includes(row.status),
  }));
}

function assetGroup(assetType: string): "Audio" | "Artwork" | "Splits" {
  if (assetType.includes("artwork") || assetType.includes("cover_art") || assetType.includes("press_photo")) return "Artwork";
  if (assetType.includes("split") || assetType.includes("royalty") || assetType.includes("distributor_export")) return "Splits";
  return "Audio";
}

function assetAction(assetType: string) {
  if (assetType.includes("cover")) return "Upload artwork";
  if (assetType.includes("split")) return "Upload split sheet";
  return "Upload file";
}

function mapCredits(rows: MusicCreditRow[] | undefined): ProductionMusicItem["credits"] {
  const grouped = new Map<string, { role: string; names: string[]; status: string }>();
  for (const row of rows ?? []) {
    const current = grouped.get(row.role) ?? { role: row.role, names: [], status: titleCaseStatus(row.status) };
    current.names.push(row.name);
    current.status = mergeStatus(current.status, titleCaseStatus(row.status));
    grouped.set(row.role, current);
  }
  return [...grouped.values()].map((row) => ({ role: row.role, names: row.names.join(", "), status: row.status }));
}

function mapSplit(row: MusicSplitRow | undefined, contributorsBySplit: Map<string, MusicSplitContributorRow[]> = new Map()): ProductionMusicItem["splits"] {
  if (!row) {
    return {
      status: "Missing",
      summary: "No collaborator split sheet or rights evidence has been uploaded for this song.",
      contributors: [],
    };
  }

  return {
    status: titleCaseStatus(row.status),
    summary: row.summary ?? "Split state exists, but no summary has been recorded.",
    publishingTotal: formatPercent(row.publishing_total),
    masterTotal: formatPercent(row.master_total),
    contributors: row.id && contributorsBySplit.has(row.id)
      ? readSplitContributorRows(contributorsBySplit.get(row.id) ?? [])
      : readSplitContributors(row.contributors),
  };
}

function readSplitContributorRows(rows: MusicSplitContributorRow[]): NonNullable<ProductionMusicItem["splits"]>["contributors"] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email ?? undefined,
    publishingShare: formatPercent(row.publishing_share) ?? "Missing",
    masterShare: formatPercent(row.master_share) ?? "Missing",
    approval: titleCaseStatus(row.approval_status),
  }));
}

function readSplitContributors(value: unknown): NonNullable<ProductionMusicItem["splits"]>["contributors"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((contributor) => {
      if (!contributor || typeof contributor !== "object") return null;
      const record = contributor as Record<string, unknown>;
      const name = readStringField(record.name);
      if (!name) return null;
      return {
        id: readStringField(record.id),
        name,
        role: readStringField(record.role) ?? "Contributor",
        email: readStringField(record.email) ?? undefined,
        publishingShare: readStringField(record.publishing_share) ?? readStringField(record.publishingShare) ?? "Missing",
        masterShare: readStringField(record.master_share) ?? readStringField(record.masterShare) ?? "Missing",
        approval: titleCaseStatus(readStringField(record.approval_status) ?? readStringField(record.approval) ?? "Draft"),
      };
    })
    .filter(Boolean) as NonNullable<ProductionMusicItem["splits"]>["contributors"];
}

function formatPercent(value: unknown) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  return typeof value === "number" ? `${value}%` : value.endsWith("%") ? value : `${value}%`;
}

function parsePercentValue(value: number | string) {
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value.replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function titleCaseStatus(status: string) {
  return status
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function mergeStatus(current: string, next: string) {
  if (current === "Missing" || next === "Missing") return "Missing";
  if (current === "Draft" || next === "Draft") return "Draft";
  return next || current;
}

function readDisplayName(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const value = (metadata as { name?: unknown; full_name?: unknown }).name ?? (metadata as { full_name?: unknown }).full_name;
  return typeof value === "string" ? value : undefined;
}

function normalizeText(value: string | undefined) {
  return value?.trim() ?? "";
}

function normalizeGenres(value: string) {
  return value
    .split(",")
    .map((genre) => genre.trim())
    .filter(Boolean);
}

function isContextComplete(profile: WorkspaceProfileRow | null | undefined) {
  if (!profile) return false;
  return Boolean(
    normalizeText((profile.artist_direction ?? profile.current_goal) ?? undefined) &&
      normalizeText(profile.budget_context ?? undefined),
  );
}

function readLatestSyncStatus(rows: Array<{ status?: ProductionWorkspace["latestCatalogSyncStatus"] | null; created_at?: string | null }> | null | undefined) {
  return [...(rows ?? [])]
    .sort((a, b) => (Date.parse(b.created_at ?? "") || 0) - (Date.parse(a.created_at ?? "") || 0))
    .find((row) => row.status)?.status ?? undefined;
}

function readLatestSubscriptionStatus(rows: WorkspaceRow["billing_subscriptions"]) {
  return [...(rows ?? [])]
    .sort((a, b) => (Date.parse(b.current_period_end ?? "") || 0) - (Date.parse(a.current_period_end ?? "") || 0))
    .find((row) => row.status)?.status ?? "none";
}

function hasActiveEntitlement(rows: WorkspaceRow["billing_subscriptions"]) {
  const now = Date.now();
  return [...(rows ?? [])].some((row) => {
    if (row.status !== "active" && row.status !== "non-renewing" && row.status !== "attention") {
      return false;
    }
    const periodEnd = row.current_period_end ? Date.parse(row.current_period_end) : Number.NaN;
    return !Number.isFinite(periodEnd) || periodEnd > now;
  });
}

function readLatestSetupStatus(rows: WorkspaceRow["workspace_setup_runs"]) {
  return latestSetupRun(rows)?.status ?? "not_started";
}

function readLatestSetupStage(rows: WorkspaceRow["workspace_setup_runs"]) {
  return latestSetupRun(rows)?.current_stage ?? undefined;
}

function readLatestSetupCheckoutSessionId(rows: WorkspaceRow["workspace_setup_runs"]) {
  return latestSetupRun(rows)?.checkout_session_id ?? undefined;
}

function latestSetupRun(rows: WorkspaceRow["workspace_setup_runs"]) {
  return [...(rows ?? [])]
    .sort((left, right) => (Date.parse(right.updated_at ?? "") || 0) - (Date.parse(left.updated_at ?? "") || 0))[0];
}

function readSpotifyIdentityName(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const name = (value as { name?: unknown }).name;
  return typeof name === "string" && name ? name : undefined;
}

function readSpotifyIdentityUrl(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const url = (value as { url?: unknown; spotifyUrl?: unknown }).url ?? (value as { spotifyUrl?: unknown }).spotifyUrl;
  return typeof url === "string" && url ? url : undefined;
}

function readSpotifyIdentityImage(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const image = (value as { image_url?: unknown; imageUrl?: unknown }).image_url ?? (value as { imageUrl?: unknown }).imageUrl;
  return typeof image === "string" && image ? image : undefined;
}

function profileFromRow(row: WorkspaceProfileRow | null, workspace: ProductionWorkspace, evidenceRows: EvidenceRow[] = []): ArtistProfileViewModel {
  const social = row?.social_handles && typeof row.social_handles === "object" ? (row.social_handles as Record<string, unknown>) : {};
  const spotifyName = readSpotifyIdentityName(row?.spotify_identity) ?? workspace.spotifyArtistName ?? workspace.artistName;
  return {
    name: row?.display_name ?? workspace.artistName,
    spotify: spotifyName ? `${spotifyName} - Spotify public catalog` : "Spotify public catalog",
    genre: row?.genres?.join(", ") ?? "",
    market: row?.home_market ?? "",
    release: "Spotify catalog import",
    goal: row?.artist_direction ?? row?.current_goal ?? "",
    budget: row?.budget_context ?? "",
    stage: row?.stage ?? "",
    tiktok: readString(social.tiktok),
    instagram: readString(social.instagram),
    youtube: readString(social.youtube),
    x: readString(social.x),
    imageUrl: readSpotifyIdentityImage(row?.spotify_identity) ?? workspace.spotifyImageUrl,
    artistIntelligence: buildArtistIntelligence(row?.display_name ?? workspace.artistName, evidenceRows),
  };
}

function buildArtistIntelligence(artistName: string, evidenceRows: EvidenceRow[]): ArtistProfileViewModel["artistIntelligence"] {
  const chartmetricRows = evidenceRows.filter((row) => row.source?.toLowerCase() === "chartmetric" && row.subject_type === "artist");
  if (!chartmetricRows.length) return undefined;

  const marketRows = chartmetricRows.filter((row) => row.evidence_type === "market_rank" || row.evidence_type === "market_metric");
  const platformRows = chartmetricRows.filter((row) => row.evidence_type === "platform_metric");
  const socialRows = chartmetricRows.filter((row) => row.evidence_type === "public_social_metric");

  return {
    headline: `Chartmetric shows ${artistName} has strong verified artist context.`,
    marketRead: buildEvidenceRead(marketRows, "No Chartmetric market evidence has been normalized yet."),
    platformRead: buildEvidenceRead(platformRows, "No Chartmetric platform evidence has been normalized yet."),
    socialRead: buildEvidenceRead(socialRows, "No Chartmetric social evidence has been normalized yet."),
    limitations: uniqueStrings(chartmetricRows.map((row) => row.limitation).filter((value): value is string => Boolean(value))).slice(0, 4),
  };
}

function todayBriefFromManagerRun(row?: ManagerSynthesisRunRow | null): TodayBriefViewModel | undefined {
  if (!row?.id || row.status !== "completed" || row.classification !== "setup_todays_brief_v1") return undefined;
  const actionPlan = Array.isArray(row.action_plan) ? row.action_plan : [];
  const brief = todayBriefFromPayload(actionPlan[0]);
  if (!brief) return undefined;
  return {
    ...brief,
    generatedAt: brief.generatedAt ?? row.completed_at ?? row.created_at ?? undefined,
    managerSynthesisRunId: brief.managerSynthesisRunId ?? row.id,
    state: brief.state,
  };
}

function todayBriefFromManagerOutput(row?: ManagerOutputRow | null): TodayBriefViewModel | undefined {
  if (!row?.id || row.is_current === false || row.subject_type !== "artist") return undefined;
  if (row.output_type !== "setup_first_manager_read" && row.output_type !== "recurring_todays_brief") return undefined;
  const brief = todayBriefFromPayload(row.render_json);
  if (!brief) return undefined;
  return {
    ...brief,
    generatedAt: brief.generatedAt ?? row.created_at ?? undefined,
    managerSynthesisRunId: brief.managerSynthesisRunId ?? row.created_from_run_id ?? undefined,
    managerOutputId: row.id,
    managerIntelligencePacketId: row.source_packet_id ?? undefined,
    state: brief.state,
  };
}

function todayBriefFromPayload(payload: unknown): TodayBriefViewModel | undefined {
  if (!isPlainRecord(payload)) return undefined;
  const intelligenceSnapshot = readBriefSnapshotGroups(payload.intelligenceSnapshot);
  const legacySignals = readLegacyBriefSignals(payload.signals);
  const snapshot = intelligenceSnapshot.length ? intelligenceSnapshot : legacySnapshotFromSignals(legacySignals);
  const managerRead = readRequiredBriefString(payload.managerRead);
  const brief: TodayBriefViewModel = {
    headlineRead: readRequiredBriefString(payload.headlineRead),
    intelligenceSnapshot: snapshot,
    snapshotSummary:
      readRequiredBriefString(payload.snapshotSummary) ||
      snapshot[0]?.insight ||
      readRequiredBriefString(payload.artistSnapshot),
    managerRead,
    managerEvidenceReads: readBriefManagerEvidenceReads(payload.managerEvidenceReads),
    sourceLine: readRequiredBriefString(payload.sourceLine),
    confidence: readTodayBriefConfidence(payload.confidence),
    generatedAt: readOptionalBriefString(payload.generatedAt),
    managerSynthesisRunId: readOptionalBriefString(payload.managerSynthesisRunId),
    managerOutputId: readOptionalBriefString(payload.managerOutputId),
    managerIntelligencePacketId: readOptionalBriefString(payload.managerIntelligencePacketId),
    state: readTodayBriefState(payload.state) ?? readTodayBriefState(payload.generationState) ?? "fresh",
  };
  if (!brief.headlineRead || !brief.managerRead || !brief.intelligenceSnapshot.length || !brief.snapshotSummary) return undefined;
  return brief;
}

function buildFallbackTodayBrief(workspace: ProductionWorkspace): TodayBriefViewModel {
  return {
    headlineRead: `${workspace.artistName}'s first management read is ready to organize around a focused starting point.`,
    intelligenceSnapshot: [
      {
        title: "Current Music In View",
        insight: "The workspace has enough saved setup context to choose the first management focus.",
        metrics: [
          { label: "Artist profile", value: "Saved", context: "setup context", evidenceIds: ["artist-profile"] },
          { label: "Working catalog", value: "In view", context: "current management focus", evidenceIds: ["catalog-setup"] },
        ],
      },
    ],
    snapshotSummary: "The first read should organize the workspace around one management focus, not a generic artist profile.",
    managerRead:
      `This is the first operating read for ${workspace.artistName}. The useful move is not to spread attention across every possible lane; it is to choose the first management focus from the saved profile and current music in view, then let the team build the next work from that center.`,
    sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    confidence: "limited",
    state: "fallback",
  };
}

function readSetupMusicReadTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).flatMap((item) => {
    const subjectType = item.subjectType === "music_item" || item.subjectType === "music_project" ? item.subjectType : undefined;
    const subjectId = readOptionalBriefString(item.subjectId);
    return subjectType && subjectId ? [{ subjectType, subjectId }] : [];
  });
}

function readPublicContextRefreshResult(value: unknown) {
  const payload = isPlainRecord(value) ? value : {};
  const inserted = typeof payload.findingsInserted === "number" && Number.isFinite(payload.findingsInserted)
    ? Math.max(0, Math.floor(payload.findingsInserted))
    : 0;
  return {
    findingsInserted: inserted,
    evidenceItemIds: readBriefStringArray(payload.evidenceItemIds),
    summary: readOptionalBriefString(payload.summary),
  };
}

function readRequiredBriefString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readTodayBriefState(value: unknown): TodayBriefViewModel["state"] | undefined {
  return value === "fresh" || value === "limited" || value === "fallback" || value === "failed" ? value : undefined;
}

function readOptionalBriefString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readBriefStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function readBriefSnapshotGroups(value: unknown): TodayBriefViewModel["intelligenceSnapshot"] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).map((group) => ({
    title: readRequiredBriefString(group.title),
    insight: readRequiredBriefString(group.insight),
    metrics: readBriefMetrics(group.metrics),
  })).filter((group) => group.title && group.insight && group.metrics.length);
}

function readBriefMetrics(value: unknown): TodayBriefViewModel["intelligenceSnapshot"][number]["metrics"] {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).map((item) => ({
    label: readRequiredBriefString(item.label),
    value: readRequiredBriefString(item.value),
    context: readOptionalBriefString(item.context),
    evidenceIds: readBriefStringArray(item.evidenceIds),
  })).filter((metric) => metric.label && metric.value && metric.evidenceIds.length);
}

function readBriefManagerEvidenceReads(value: unknown): NonNullable<TodayBriefViewModel["managerEvidenceReads"]> {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainRecord)
    .map((item) => {
      const label = readOptionalBriefString(item.label);
      const read = readOptionalBriefString(item.read);
      const evidenceIds = readBriefStringArray(item.evidenceIds);
      if (!label || !read || !evidenceIds.length) return null;
      return {
        label,
        value: readOptionalBriefString(item.value),
        category: readBriefEvidenceReadCategory(item.category),
        read,
        evidenceIds,
        confidence: readOptionalBriefString(item.confidence),
      };
    })
    .filter((item): item is NonNullable<TodayBriefViewModel["managerEvidenceReads"]>[number] => Boolean(item));
}

function readBriefEvidenceReadCategory(value: unknown): NonNullable<TodayBriefViewModel["managerEvidenceReads"]>[number]["category"] {
  return value === "kpi" || value === "signal" || value === "asset" || value === "market" || value === "management"
    ? value
    : undefined;
}

function readLegacyBriefSignals(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isPlainRecord).map((item) => ({
    claim: readRequiredBriefString(item.claim),
    whyItMatters: readRequiredBriefString(item.whyItMatters),
    evidenceIds: readBriefStringArray(item.evidenceIds),
  })).filter((signal) => signal.claim && signal.whyItMatters && signal.evidenceIds.length);
}

function legacySnapshotFromSignals(signals: ReturnType<typeof readLegacyBriefSignals>): TodayBriefViewModel["intelligenceSnapshot"] {
  if (!signals.length) return [];
  return [
    {
      title: "Artist Intelligence",
      insight: signals[0].whyItMatters,
      metrics: signals.slice(0, 4).map((signal, index) => ({
        label: index === 0 ? "Lead signal" : `Signal ${index + 1}`,
        value: signal.claim,
        context: "saved read",
        evidenceIds: signal.evidenceIds,
      })),
    },
  ];
}

function readTodayBriefConfidence(value: unknown): TodayBriefViewModel["confidence"] {
  return value === "high" || value === "medium" || value === "low" || value === "limited" || value === "unknown" ? value : "unknown";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildEvidenceRead(rows: EvidenceRow[], fallback: string) {
  const rendered = rows.slice(0, 3).map(formatProfileEvidenceRow).filter(Boolean);
  return rendered.length ? rendered.join("; ") : fallback;
}

function formatProfileEvidenceRow(row: EvidenceRow) {
  const metricName = row.metric_name ?? row.evidence_type ?? "source_record";
  const label = profileEvidenceLabel(metricName);
  const value = formatProfileEvidenceValue(row);
  return value ? `${label}: ${value}` : label;
}

function profileEvidenceLabel(metricName: string) {
  if (metricName.startsWith("chartmetric_country_rank_")) {
    return `Country rank ${titleCaseStatus(metricName.replace("chartmetric_country_rank_", ""))}`;
  }
  if (metricName.startsWith("spotify_listener_city_")) {
    return titleCaseStatus(metricName.replace("spotify_listener_city_", ""));
  }
  if (metricName.startsWith("spotify_")) {
    return `Spotify ${metricName.replace("spotify_", "").replace(/_/g, " ")}`;
  }
  if (metricName.startsWith("tiktok_")) {
    return `TikTok ${metricName.replace("tiktok_", "").replace(/_/g, " ")}`;
  }
  if (metricName.startsWith("youtube_")) {
    return `YouTube ${metricName.replace("youtube_", "").replace(/_/g, " ")}`;
  }
  return sentenceCaseMetricName(metricName);
}

function formatProfileEvidenceValue(row: EvidenceRow) {
  if (row.metric_value === undefined || row.metric_value === null) return "";
  const formattedValue = row.metric_unit === "rank" ? `#${row.metric_value}` : row.metric_value.toLocaleString("en-US");
  return [formattedValue, row.metric_unit === "rank" ? "" : row.metric_unit].filter(Boolean).join(" ");
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function connectArtistWithClientFallback(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  connectErrorMessage: string,
): Promise<ProductionWorkspace> {
  await saveSpotifyIdentityWithClient(client, workspace, candidate);
  const syncStatus = await startClientManagedCatalogBootstrap(client, workspace, candidate, connectErrorMessage);

  return {
    ...workspace,
    artistName: candidate.name,
    spotifyConnected: true,
    spotifyArtistId: candidate.spotifyArtistId,
    spotifyArtistName: candidate.name,
    spotifyArtistUrl: candidate.spotifyUrl,
    spotifyImageUrl: candidate.imageUrl,
    latestCatalogSyncStatus: syncStatus,
  };
}

async function saveSpotifyIdentityWithClient(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
) {
  const spotifyIdentity = {
    id: candidate.spotifyArtistId,
    name: candidate.name,
    url: candidate.spotifyUrl,
    uri: candidate.spotifyUri,
    image_url: candidate.imageUrl,
    followers: candidate.followers,
    genres: candidate.genres ?? [],
  };

  const { error: artistError } = await client
    .from("artists")
    .update({
      display_name: candidate.name,
      canonical_spotify_artist_id: candidate.spotifyArtistId,
      canonical_spotify_url: candidate.spotifyUrl,
    })
    .eq("account_id", workspace.accountId)
    .eq("id", workspace.artistId);

  if (artistError) {
    throw artistError;
  }

  const { data: profiles, error: profileLookupError } = await client
    .from("artist_profiles")
    .select("id")
    .eq("account_id", workspace.accountId)
    .eq("artist_workspace_id", workspace.artistWorkspaceId)
    .eq("artist_id", workspace.artistId)
    .limit(1);

  if (profileLookupError) {
    throw profileLookupError;
  }

  const profileId = ((profiles ?? []) as Array<{ id?: string }>)[0]?.id;
  if (profileId) {
    const { error } = await client
      .from("artist_profiles")
      .update({ display_name: candidate.name, spotify_identity: spotifyIdentity })
      .eq("id", profileId);
    if (error) throw error;
    return;
  }

  const { error } = await client.from("artist_profiles").insert({
    account_id: workspace.accountId,
    artist_workspace_id: workspace.artistWorkspaceId,
    artist_id: workspace.artistId,
    display_name: candidate.name,
    spotify_identity: spotifyIdentity,
  });
  if (error) throw error;
}

async function startClientManagedCatalogBootstrap(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  connectErrorMessage: string,
): Promise<ProductionWorkspace["latestCatalogSyncStatus"]> {
  try {
    const providerId = await getClientSpotifyProviderId(client);
    const sourceConnectionId = await upsertClientSourceConnection(client, workspace, candidate, providerId);
    const sourceSyncJobId = await createClientSourceSyncJob(client, workspace, sourceConnectionId, {
      status: "running",
    });

    void invokeClientCatalogBootstrap(client, workspace, candidate, sourceConnectionId, sourceSyncJobId);
    return "running";
  } catch (error) {
    const message = readErrorObjectMessage(error) ?? connectErrorMessage;
    await createClientSourceSyncJob(client, workspace, undefined, {
      status: "failed",
      error: message,
    }).catch(() => undefined);
    return "failed";
  }
}

async function invokeClientCatalogBootstrap(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  sourceConnectionId: string,
  sourceSyncJobId: string,
) {
  const { error } = await client.functions.invoke("spotify-catalog-bootstrap", {
    body: {
      accountId: workspace.accountId,
      artistWorkspaceId: workspace.artistWorkspaceId,
      artistId: workspace.artistId,
      selectedArtist: candidate,
      market: "US",
      sourceConnectionId,
      sourceSyncJobId,
    },
  });

  if (!error) {
    return;
  }

  const message = await readFunctionInvokeErrorMessage(error, "Spotify catalog bootstrap failed.");
  await client
    .from("source_sync_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: message,
    })
    .eq("id", sourceSyncJobId);
}

async function getClientSpotifyProviderId(client: SupabaseClient) {
  const { data, error } = await client.from("source_providers").select("id").eq("provider_key", "spotify").maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error("Spotify source provider is not configured.");
  }
  return data.id as string;
}

async function upsertClientSourceConnection(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  providerId: string,
) {
  const existingId = await findClientSourceConnectionId(client, workspace, candidate, providerId);
  const payload = createSourceConnectionPayload(workspace, candidate, providerId, true);

  if (existingId) {
    const { error } = await client.from("source_connections").update(payload).eq("id", existingId);
    if (!error) return existingId;

    const retryPayload = createSourceConnectionPayload(workspace, candidate, providerId, false);
    const { error: retryError } = await client.from("source_connections").update(retryPayload).eq("id", existingId);
    if (retryError) throw error;
    return existingId;
  }

  const { data, error } = await client.from("source_connections").insert(payload).select("id").single();
  if (!error && data?.id) {
    return data.id as string;
  }

  const retryPayload = createSourceConnectionPayload(workspace, candidate, providerId, false);
  const { data: retryData, error: retryError } = await client.from("source_connections").insert(retryPayload).select("id").single();
  if (retryError) throw error ?? retryError;
  return retryData.id as string;
}

async function findClientSourceConnectionId(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  providerId: string,
) {
  const { data, error } = await client
    .from("source_connections")
    .select("id")
    .eq("account_id", workspace.accountId)
    .eq("artist_workspace_id", workspace.artistWorkspaceId)
    .eq("provider_id", providerId)
    .eq("handle_or_external_ref", candidate.spotifyArtistId)
    .limit(1);

  if (error) throw error;
  return ((data ?? []) as Array<{ id?: string }>)[0]?.id;
}

function createSourceConnectionPayload(
  workspace: ProductionWorkspace,
  candidate: ProductionSpotifyArtistCandidate,
  providerId: string,
  includeMetadata: boolean,
) {
  return {
    account_id: workspace.accountId,
    artist_workspace_id: workspace.artistWorkspaceId,
    artist_id: workspace.artistId,
    provider_id: providerId,
    handle_or_external_ref: candidate.spotifyArtistId,
    status: "connected",
    limitations: [PUBLIC_SPOTIFY_CATALOG_LIMITATION],
    ...(includeMetadata
      ? {
          metadata: {
            spotify_artist_id: candidate.spotifyArtistId,
            spotify_artist_url: candidate.spotifyUrl,
            spotify_artist_uri: candidate.spotifyUri,
          },
        }
      : {}),
  };
}

async function createClientSourceSyncJob(
  client: SupabaseClient,
  workspace: ProductionWorkspace,
  sourceConnectionId: string | undefined,
  patch: { status: "running" | "failed"; error?: string },
) {
  const payload: Record<string, unknown> = {
    account_id: workspace.accountId,
    artist_workspace_id: workspace.artistWorkspaceId,
    artist_id: workspace.artistId,
    job_type: "spotify_catalog_bootstrap",
    trigger_type: "setup",
    status: patch.status,
    started_at: new Date().toISOString(),
  };

  if (sourceConnectionId) {
    payload.source_connection_id = sourceConnectionId;
  }

  if (patch.status === "failed") {
    payload.completed_at = new Date().toISOString();
    payload.error = patch.error;
  }

  const { data, error } = await client.from("source_sync_jobs").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function throwFunctionInvokeError(error: unknown, fallback: string): Promise<never> {
  throw new Error(await readFunctionInvokeErrorMessage(error, fallback));
}

async function readFunctionInvokeErrorMessage(error: unknown, fallback: string) {
  const bodyMessage = getFunctionErrorBodyMessage(await readFunctionErrorBody(error));
  const directMessage = readErrorObjectMessage(error);
  return bodyMessage ?? directMessage ?? fallback;
}

async function readFunctionErrorBody(error: unknown) {
  const context = error && typeof error === "object" ? (error as { context?: unknown }).context : undefined;
  if (!context || typeof context !== "object") {
    return null;
  }

  const response = typeof (context as { clone?: unknown }).clone === "function" ? (context as { clone: () => unknown }).clone() : context;
  if (!response || typeof response !== "object") {
    return null;
  }

  const json = (response as { json?: unknown }).json;
  if (typeof json === "function") {
    try {
      return await json.call(response);
    } catch {
      // Fall through to text parsing below.
    }
  }

  const text = (response as { text?: unknown }).text;
  if (typeof text === "function") {
    try {
      return await text.call(response);
    } catch {
      return null;
    }
  }

  return null;
}

function getFunctionErrorBodyMessage(body: unknown) {
  if (typeof body === "string" && body.trim()) {
    return body.trim();
  }

  if (!body || typeof body !== "object") {
    return null;
  }

  for (const key of ["error", "message", "details"]) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readErrorObjectMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message ? message : null;
}

function agentFromRow(row: AgentProfileRow): AgentViewModel {
  const iconByAgent: Record<string, AgentViewModel["icon"]> = {
    manager: BriefcaseBusiness,
    marketing: Megaphone,
    sync_deals: Headphones,
    touring: Route,
    finance_rights: BadgeDollarSign,
  };
  const needs = [...(row.required_source_capabilities ?? []), ...(row.optional_source_capabilities ?? [])];
  return {
    id: row.agent_key,
    name: row.name,
    status: row.status_default,
    readiness: row.title ?? (row.status_default === "available" ? "Available now" : "Needs source"),
    purpose: row.purpose ?? "Agent profile is configured, but no purpose has been set.",
    icon: iconByAgent[row.agent_key] ?? BriefcaseBusiness,
    workspaceTitle: row.name,
    workspaceSubtitle: row.purpose ?? "No specialist brief is available yet.",
    sections: [
      {
        eyebrow: "Configured tools",
        title: row.name,
        items: (row.tools ?? []).map((tool) => ({
          title: tool,
          meta: "System capability",
          status: row.status_default === "available" ? "Available" : "Needs source",
          detail: "This capability is configured from the production agent profile.",
        })),
      },
    ],
    sources: needs.map((source) => ({
      label: source.replaceAll("_", " "),
      action: "Connect or upload source",
      detail: "Required before this specialist can make stronger claims.",
      state: "needs_upload" as const,
    })),
  };
}

function musicViewModelsFromLibrary(library: ProductionMusicLibrary): MusicObjectViewModel[] {
  const projectIdsBySong = new Map<string, string[]>();
  for (const project of library.projects) {
    for (const track of project.tracks) {
      projectIdsBySong.set(track.id, [...(projectIdsBySong.get(track.id) ?? []), project.id]);
    }
  }

  const songs = library.songs.map((song) => {
    const generated = song.generatedManagerRead;
    const generatedManagerRead = acceptedGeneratedManagerRead(generated, "managerRead");
    const generatedNextMove = acceptedGeneratedManagerRead(generated, "nextMove");
    const generatedSnapshot = acceptedGeneratedIntelligenceSnapshot(generated?.intelligenceSnapshot);
    const splitProofRequired = requiresInAppSplitProof(song);
    const splitProofBlocker = splitProofRequired && song.splits?.status && song.splits.status !== "Cleared";
    return {
      id: song.id,
      kind: "song" as const,
      title: song.title,
      status: song.sourceKind === "spotify_public_catalog" ? "Released catalog" : titleCaseStatus(song.lifecycleStage),
      lifecycle: song.lifecycleStage,
      lifecycleStage: titleCaseStatus(song.lifecycleStage),
      blocker: splitProofBlocker ? `${song.splits!.status} split proof` : "No active blocker",
      sourceKind: song.sourceKind ?? "Spotify public catalog",
      sourceLimit: song.sourceLimit ?? PUBLIC_SPOTIFY_CATALOG_LIMITATION,
      sourceSummary: buildSongSourceSummary(song),
      situationLine: acceptedGeneratedVisibleMusicText(generated?.situationLine) || buildSongSituationLine(song),
      managerRead: generatedManagerRead ?? pendingSongManagerRead(song),
      watchNext: acceptedGeneratedVisibleMusicText(generated?.watchNext) || pendingSongWatchNext(song),
      managerReadState: generatedManagerRead
        ? generated?.generationState ?? ("fresh" as const)
        : ("loading" as const),
      nextMove: generatedNextMove ?? pendingSongNextMove(song),
      intelligenceSnapshot: generatedSnapshot ?? buildSongFallbackIntelligenceSnapshot(song),
      snapshotSummary: acceptedGeneratedVisibleMusicText(generated?.snapshotSummary) ?? buildSongFallbackSnapshotSummary(song),
      confidence: generated?.confidence ?? "unknown",
      sourceLine: acceptedGeneratedVisibleMusicText(generated?.sourceLine) ?? "",
      rightsState: buildRightsState(song),
      assets: buildAssetLabels(song),
      coverImageUrl: song.coverImageUrl,
      spotifyUrl: song.spotifyUrl,
      linkedMissionIds: [],
      linkedTaskIds: [],
      linkedTaskCount: 0,
      projectIds: projectIdsBySong.get(song.id) ?? [],
      files: buildFileAssets(song).map((asset) => ({ label: asset.label, status: asset.status })),
      fileAssets: buildFileAssets(song),
      details: buildSongDetails(song).map((field) => ({ label: field.label, value: field.value, status: field.status })),
      metadataFields: buildMetadataFields(song),
      releaseFields: buildReleaseFields(song),
      credits: buildCreditFields(song),
      identifiers: buildIdentifierFields(song),
      splits: {
        status: song.splits?.status ?? "Missing",
        summary: song.splits?.summary ?? "No collaborator split sheet or rights evidence has been uploaded for this song.",
        writers: song.splits?.publishingTotal ? `Publishing splits total ${song.splits.publishingTotal}.` : "Writer split proof missing.",
        producers: song.splits?.masterTotal ? `Master splits total ${song.splits.masterTotal}.` : "Producer/master split proof missing.",
        publishingTotal: song.splits?.publishingTotal,
        masterTotal: song.splits?.masterTotal,
        contributors: song.splits?.contributors ?? [],
      },
    };
  });

  const projects = library.projects.map((project) => {
    const generated = project.generatedManagerRead;
    const generatedManagerRead = acceptedGeneratedManagerRead(generated, "managerRead");
    const generatedNextMove = acceptedGeneratedManagerRead(generated, "nextMove");
    const generatedSnapshot = acceptedGeneratedIntelligenceSnapshot(generated?.intelligenceSnapshot);
    return {
      id: project.id,
      kind: "project" as const,
      title: project.title,
      status: titleCaseStatus(project.projectType),
      lifecycle: project.lifecycleStage,
      lifecycleStage: titleCaseStatus(project.lifecycleStage),
      blocker: firstProjectBlocker(project),
      sourceKind: project.sourceKind ?? "Spotify public catalog",
      sourceLimit: project.sourceLimit ?? PUBLIC_SPOTIFY_CATALOG_LIMITATION,
      sourceSummary: buildProjectSourceSummary(project),
      situationLine: acceptedGeneratedVisibleMusicText(generated?.situationLine) || buildProjectSituationLine(project),
      managerRead: generatedManagerRead ?? pendingProjectManagerRead(project),
      watchNext: acceptedGeneratedVisibleMusicText(generated?.watchNext) || pendingProjectWatchNext(project),
      managerReadState: generatedManagerRead
        ? generated?.generationState ?? ("fresh" as const)
        : ("loading" as const),
      nextMove: generatedNextMove ?? pendingProjectNextMove(project),
      intelligenceSnapshot: generatedSnapshot ?? buildProjectFallbackIntelligenceSnapshot(project),
      snapshotSummary: acceptedGeneratedVisibleMusicText(generated?.snapshotSummary) ?? buildProjectFallbackSnapshotSummary(project),
      confidence: generated?.confidence ?? "unknown",
      sourceLine: acceptedGeneratedVisibleMusicText(generated?.sourceLine) ?? "",
      coverImageUrl: project.coverImageUrl,
      spotifyUrl: project.spotifyUrl,
      linkedMissionIds: [],
      linkedTaskIds: [],
      linkedTaskCount: 0,
      songs: project.tracks.map((track) => track.title),
      songIds: project.tracks.map((track) => track.id),
    };
  });

  return [...songs, ...projects];
}

function buildAssetLabels(song: ProductionMusicItem) {
  return buildFileAssets(song).map((asset) => asset.label);
}

function isReleasedSpotifyCatalogMusic(song: Pick<ProductionMusicItem, "sourceKind" | "lifecycleStage" | "spotifyUrl" | "spotifyTrackId">) {
  const lifecycle = song.lifecycleStage.toLowerCase();
  const hasSpotifyCatalogSource = song.sourceKind === "spotify_public_catalog" || Boolean(song.spotifyUrl || song.spotifyTrackId);
  return hasSpotifyCatalogSource && (lifecycle === "released" || lifecycle === "catalog");
}

function requiresInAppSplitProof(song: Pick<ProductionMusicItem, "sourceKind" | "lifecycleStage" | "spotifyUrl" | "spotifyTrackId">) {
  return !isReleasedSpotifyCatalogMusic(song);
}

function buildSongFallbackIntelligenceSnapshot(song: ProductionMusicItem): TodayBriefViewModel["intelligenceSnapshot"] {
  const signals = buildSongManagementSignals(song);
  const publicPressure = signals.filter((signal) => ["tiktok_video_count", "tiktok_top_video_views", "youtube_views", "shazam_count", "airplay_spins"].includes(signal.metricName));
  const platformSupport = signals.filter((signal) => ["spotify_trailing_28d_streams", "spotify_trailing_7d_streams", "spotify_playlist_total_reach", "spotify_playlist_count", "spotify_editorial_playlist_count", "apple_music_editorial_playlist_count"].includes(signal.metricName));

  const groups: TodayBriefViewModel["intelligenceSnapshot"] = [];
  if (publicPressure.length) {
    groups.push({
      title: "Public Pressure",
      insight: `${song.title} has visible public behavior worth turning into a record-level read.`,
      metrics: publicPressure.slice(0, 4).map(signalToSnapshotMetric),
    });
  }
  if (platformSupport.length) {
    groups.push({
      title: "Music Platform Support",
      insight: `${song.title} has enough music-platform surface area to compare reach, playlists, and listening shape.`,
      metrics: platformSupport.slice(0, 5).map(signalToSnapshotMetric),
    });
  }

  const remainingSignals = signals.filter((signal) =>
    !publicPressure.includes(signal) && !platformSupport.includes(signal)
  );
  if (remainingSignals.length) {
    groups.push({
      title: "Record Intelligence",
      insight: `${song.title} has additional saved signals that can sharpen the next management read.`,
      metrics: remainingSignals.slice(0, 4).map(signalToSnapshotMetric),
    });
  }

  const metrics: TodayBriefViewModel["intelligenceSnapshot"][number]["metrics"] = [];
  if (typeof song.popularity === "number") {
    metrics.push({
      label: "Spotify Popularity",
      value: `${song.popularity}`,
      context: "public record score",
      evidenceIds: ["catalog-setup"],
    });
  }
  for (const item of song.evidence.filter((item) => !signals.some((signal) => signal.evidenceIds.includes(item.id)))) {
    metrics.push({
      label: sentenceCaseMetricName(item.metricName ?? item.evidenceType ?? "signal"),
      value: formatEvidenceMetricCompact(item),
      context: item.freshness ?? undefined,
      evidenceIds: [item.id],
    });
  }

  if (metrics.length) {
    groups.push({
      title: "Record Details",
      insight: `${song.title} has supporting details in view; the useful read still comes from audience behavior first.`,
      metrics: metrics.slice(0, 4),
    });
  }

  if (!groups.length) {
    metrics.push({
      label: "Catalog status",
      value: "Imported",
      context: "record available for management review",
      evidenceIds: ["catalog-setup"],
    });
    groups.push({
      title: "Record Intelligence",
      insight: `${song.title} is available in the workspace, but it needs one useful public or team signal before the Manager can call a lane.`,
      metrics,
    });
  }

  return groups.slice(0, 3);
}

function buildSongFallbackSnapshotSummary(song: ProductionMusicItem): string {
  const signals = buildSongManagementSignals(song);
  if (signals.length) {
    const lead = signals[0];
    const second = signals[1];
    return second
      ? `${song.title} is strongest around ${lead.context}, with ${second.context} giving the Manager a second read.`
      : `${song.title} is strongest around ${lead.context}; that is the first record behavior to inspect.`;
  }
  return `${song.title} is in view, but the first useful record read needs one public or team signal.`;
}

function pendingSongManagerRead(song: ProductionMusicItem) {
  return `The Manager's Read for ${song.title} is being prepared from the saved packet. The record details and audience facts below are available now, but the management judgment should wait for the generated read instead of using a local fallback.`;
}

function pendingSongNextMove(song: ProductionMusicItem) {
  return `Wait for ${song.title}'s generated Manager Read, or regenerate it if the read does not appear shortly.`;
}

function pendingSongWatchNext(song: ProductionMusicItem) {
  return `Watch this room for the generated Manager Read for ${song.title}.`;
}

function buildProjectFallbackIntelligenceSnapshot(project: ProductionMusicProject): TodayBriefViewModel["intelligenceSnapshot"] {
  const signals = buildProjectManagementSignals(project);
  const hasProjectSignals = signals.length > 0;
  const metrics: TodayBriefViewModel["intelligenceSnapshot"][number]["metrics"] = signals.map(signalToSnapshotMetric);
  if (!metrics.length) {
    metrics.push({
      label: "Project catalog",
      value: "Live",
      context: `${project.tracks.length} tracklist entries saved`,
      evidenceIds: ["catalog-setup"],
    });
  }
  return [
    {
      title: "Project Intelligence",
      insight: hasProjectSignals
        ? `${project.title} has usable project-level facts for choosing the release focus.`
        : `${project.title} has the release shape in view; the tracklist should decide the first inspection lane.`,
      metrics: metrics.slice(0, 8),
    },
  ];
}

function buildProjectFallbackSnapshotSummary(project: ProductionMusicProject): string {
  const signals = buildProjectManagementSignals(project);
  if (signals.length) {
    const lead = signals[0];
    const second = signals[1];
    return second
      ? `${project.title} is strongest around ${lead.context}, with ${second.context} giving the Manager a second project read.`
      : `${project.title} is strongest around ${lead.context}; that is the first project behavior to inspect.`;
  }
  return `${project.title} has ${project.tracks.length || project.totalTracks || 0} mapped songs ready for a project-level read.`;
}

function pendingProjectManagerRead(project: ProductionMusicProject) {
  return `The Manager's Read for ${project.title} is being prepared from the saved packet. The project details and tracklist facts below are available now, but the management judgment should wait for the generated read instead of using a local fallback.`;
}

function pendingProjectNextMove(project: ProductionMusicProject) {
  return `Wait for ${project.title}'s generated Manager Read, or regenerate it if the read does not appear shortly.`;
}

function pendingProjectWatchNext(project: ProductionMusicProject) {
  return `Watch this room for the generated Manager Read for ${project.title}.`;
}

function buildSongSourceSummary(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["sourceSummary"]> {
  const evidence = song.evidence.map((item) => ({
    label: sentenceCaseMetricName(item.metricName ?? item.evidenceType ?? "source_record"),
    value: formatEvidenceMetric(item),
    source: sourceDisplayName(item.source),
    window: item.freshness ?? "Unknown window",
    limitation: item.limitation ?? undefined,
  }));
  const badges = [
    ...(song.spotifyUrl || song.spotifyTrackId || song.sourceKind === "spotify_public_catalog" ? ["Spotify"] : []),
    ...Array.from(new Set(song.evidence.map((item) => sourceDisplayName(item.source)))),
  ];
  const sourceText = [
    badges.includes("Spotify") ? "Spotify public catalog" : sourceDisplayName(song.sourceKind ?? "manual"),
    evidence.length ? "Chartmetric evidence" : "",
  ].filter(Boolean).join(" and ");

  return {
    headline: `${song.title} is a ${titleCaseStatus(song.lifecycleStage)}${song.sourceKind === "spotify_public_catalog" ? " catalog" : ""} song backed by ${sourceText || "stored Music records"}.`,
    badges,
    facts: buildSongSummaryFacts(song),
    evidence,
    limitations: uniqueStrings([
      song.sourceLimit ?? PUBLIC_SPOTIFY_CATALOG_LIMITATION,
      ...song.evidence.map((item) => item.limitation).filter((value): value is string => Boolean(value)),
    ]),
  };
}

function buildSongSummaryFacts(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["sourceSummary"]>["facts"] {
  return [
    { label: "Spotify track ID", value: song.spotifyTrackId ?? "Missing", source: "Spotify", status: song.spotifyTrackId ? "Confirmed" as const : "Missing" as const },
    { label: "ISRC", value: song.isrc ?? "Missing", source: "Spotify", status: song.isrc ? "Confirmed" as const : "Missing" as const },
    { label: "UPC", value: song.upc ?? "Missing", source: "Spotify", status: song.upc ? "Confirmed" as const : "Missing" as const },
    { label: "Release date", value: song.releaseDate || song.releasedAt ? formatDateLabel(song.releaseDate ?? song.releasedAt) : "Missing", source: "Spotify", status: song.releaseDate || song.releasedAt ? "Confirmed" as const : "Missing" as const },
    { label: "Popularity", value: typeof song.popularity === "number" ? `${song.popularity}` : "Missing", source: "Spotify", status: typeof song.popularity === "number" ? "Confirmed" as const : "Missing" as const },
  ];
}

function buildProjectSourceSummary(project: ProductionMusicProject): NonNullable<MusicObjectViewModel["sourceSummary"]> {
  const evidence = project.evidence.map((item) => ({
    label: sentenceCaseMetricName(item.metricName ?? item.evidenceType ?? "source_record"),
    value: formatEvidenceMetric(item),
    source: sourceDisplayName(item.source),
    window: item.freshness ?? "Unknown window",
    limitation: item.limitation ?? undefined,
  }));
  const badges = [
    ...(project.spotifyUrl || project.spotifyAlbumId || project.sourceKind === "spotify_public_catalog" ? ["Spotify"] : []),
    ...Array.from(new Set(project.evidence.map((item) => sourceDisplayName(item.source)))),
  ];

  return {
    headline: `${project.title} is a ${titleCaseStatus(project.lifecycleStage)} ${project.projectType} backed by ${badges.length ? badges.join(" and ") : "stored Music records"}.`,
    badges,
    facts: [
      { label: "Spotify album ID", value: project.spotifyAlbumId ?? "Missing", source: "Spotify", status: project.spotifyAlbumId ? "Confirmed" as const : "Missing" as const },
      { label: "UPC", value: project.upc ?? "Missing", source: "Spotify", status: project.upc ? "Confirmed" as const : "Missing" as const },
      { label: "Release date", value: project.releaseDate || project.releasedAt ? formatDateLabel(project.releaseDate ?? project.releasedAt) : "Missing", source: "Spotify", status: project.releaseDate || project.releasedAt ? "Confirmed" as const : "Missing" as const },
      { label: "Track count", value: String(project.tracks.length || project.totalTracks || "Missing"), source: "Music", status: project.tracks.length || project.totalTracks ? "Confirmed" as const : "Missing" as const },
    ],
    evidence,
    limitations: uniqueStrings([
      project.sourceLimit ?? PUBLIC_SPOTIFY_CATALOG_LIMITATION,
      ...project.evidence.map((item) => item.limitation).filter((value): value is string => Boolean(value)),
    ]),
  };
}

function mapMusicEvidence(rows: EvidenceRow[] | undefined): ProductionMusicItem["evidence"] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    source: row.source,
    sourceKind: row.source_kind,
    evidenceType: row.evidence_type,
    metricName: row.metric_name,
    metricValue: row.metric_value,
    metricUnit: row.metric_unit,
    freshness: row.freshness,
    confidence: row.confidence,
    limitation: row.limitation,
  }));
}

function formatEvidenceMetric(item: ProductionMusicItem["evidence"][number]) {
  const value = item.metricValue === undefined || item.metricValue === null ? "Recorded" : `${item.metricValue}`;
  return [value, item.metricUnit].filter(Boolean).join(" ");
}

function formatEvidenceMetricCompact(item: ProductionMusicItem["evidence"][number]) {
  if (typeof item.metricValue !== "number") return "Recorded";
  if (item.metricUnit === "rank") return `#${item.metricValue.toLocaleString("en-US")}`;
  if (item.metricUnit === "score" || item.metricUnit === "percent_change") {
    return `${item.metricValue.toLocaleString("en-US")}${item.metricUnit === "percent_change" ? "%" : ""}`;
  }
  return formatCompactEvidenceNumber(item.metricValue);
}

function formatReadableEvidenceMetric(item: ProductionMusicItem["evidence"][number]) {
  const value =
    item.metricValue === undefined || item.metricValue === null
      ? "recorded"
      : item.metricValue.toLocaleString("en-US");
  return [value, item.metricUnit].filter(Boolean).join(" ");
}

function evidenceDetail(item: ProductionMusicItem["evidence"][number]) {
  const metric = sentenceCaseMetricName(item.metricName ?? item.evidenceType ?? "source record");
  return `${formatReadableEvidenceMetric(item)} from ${metric}${item.freshness ? ` over ${item.freshness}` : ""}`;
}

function sourceDisplayName(value: string) {
  if (value.toLowerCase() === "chartmetric") return "Chartmetric";
  if (value.toLowerCase().includes("spotify")) return "Spotify";
  return titleCaseStatus(value);
}

function sentenceCaseMetricName(value: string) {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return normalized ? normalized.slice(0, 1).toUpperCase() + normalized.slice(1) : "Source record";
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((value) => value.trim())));
}

type SongManagementSignal = {
  label: string;
  shortLabel: string;
  metricLabel: string;
  value: string;
  context: string;
  priority: number;
  metricName: string;
  evidenceIds: string[];
};

function buildSongManagementSignals(song: ProductionMusicItem) {
  const definitions: Array<{
    priority: number;
    match: (metricName: string) => boolean;
    label: (value: number) => string;
    shortLabel: (value: number) => string;
  }> = [
    {
      priority: 100,
      match: (metricName) => metricName === "spotify_trailing_28d_streams",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in the latest 28-day window`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in 28 days`,
    },
    {
      priority: 96,
      match: (metricName) => metricName === "spotify_trailing_7d_streams",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in the latest 7-day window`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in 7 days`,
    },
    {
      priority: 92,
      match: (metricName) => metricName === "spotify_playlist_total_reach" || metricName === "spotify_playlist_reach" || metricName === "spotify_editorial_playlist_reach",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify playlist reach`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} playlist reach`,
    },
    {
      priority: 88,
      match: (metricName) => metricName === "spotify_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} playlists`,
    },
    {
      priority: 86,
      match: (metricName) => metricName === "spotify_editorial_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify editorial playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} editorial playlists`,
    },
    {
      priority: 84,
      match: (metricName) => metricName === "apple_music_editorial_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Apple Music editorial playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Apple editorial playlists`,
    },
    {
      priority: 82,
      match: (metricName) => metricName === "tiktok_video_count" || metricName.includes("video_creates"),
      label: (value) => `${formatCompactEvidenceNumber(value)} TikTok videos created around the track`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} TikTok videos`,
    },
    {
      priority: 80,
      match: (metricName) => metricName === "tiktok_top_video_views",
      label: (value) => `${formatCompactEvidenceNumber(value)} views on the top TikTok video`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} top TikTok views`,
    },
    {
      priority: 76,
      match: (metricName) => metricName === "shazam_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Shazams`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Shazams`,
    },
    {
      priority: 72,
      match: (metricName) => metricName === "youtube_views",
      label: (value) => `${formatCompactEvidenceNumber(value)} YouTube views`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} YouTube views`,
    },
    {
      priority: 70,
      match: (metricName) => metricName === "airplay_spins",
      label: (value) => `${formatCompactEvidenceNumber(value)} airplay spins`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} airplay spins`,
    },
  ];

  return definitions.flatMap((definition): SongManagementSignal[] => {
    const match = song.evidence
      .filter((item) => {
        const metricName = item.metricName ?? "";
        return definition.match(metricName) && typeof item.metricValue === "number";
      })
      .sort((a, b) => (b.metricValue ?? 0) - (a.metricValue ?? 0))[0];
    if (!match || typeof match.metricValue !== "number") return [];
    return [{
      label: definition.label(match.metricValue),
      shortLabel: definition.shortLabel(match.metricValue),
      metricLabel: signalMetricLabel(match.metricName ?? ""),
      value: formatCompactEvidenceNumber(match.metricValue),
      context: signalMetricContext(match.metricName ?? ""),
      priority: definition.priority,
      metricName: match.metricName ?? "",
      evidenceIds: [match.id],
    }];
  }).sort((a, b) => b.priority - a.priority);
}

function buildProjectManagementSignals(project: ProductionMusicProject) {
  return buildManagementSignalsFromEvidence(project.evidence);
}

function buildManagementSignalsFromEvidence(evidence: ProductionMusicItem["evidence"]) {
  const definitions: Array<{
    priority: number;
    match: (metricName: string) => boolean;
    label: (value: number) => string;
    shortLabel: (value: number) => string;
  }> = [
    {
      priority: 100,
      match: (metricName) => metricName === "spotify_trailing_28d_streams",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in the latest 28-day window`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in 28 days`,
    },
    {
      priority: 96,
      match: (metricName) => metricName === "spotify_trailing_7d_streams",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in the latest 7-day window`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Spotify streams in 7 days`,
    },
    {
      priority: 92,
      match: (metricName) => metricName === "spotify_playlist_total_reach" || metricName === "spotify_playlist_reach" || metricName === "spotify_editorial_playlist_reach",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify playlist reach`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} playlist reach`,
    },
    {
      priority: 88,
      match: (metricName) => metricName === "spotify_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} playlists`,
    },
    {
      priority: 86,
      match: (metricName) => metricName === "spotify_editorial_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Spotify editorial playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} editorial playlists`,
    },
    {
      priority: 84,
      match: (metricName) => metricName === "apple_music_editorial_playlist_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Apple Music editorial playlists`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Apple editorial playlists`,
    },
    {
      priority: 82,
      match: (metricName) => metricName === "tiktok_video_count" || metricName.includes("video_creates"),
      label: (value) => `${formatCompactEvidenceNumber(value)} TikTok videos created around the project`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} TikTok videos`,
    },
    {
      priority: 80,
      match: (metricName) => metricName === "tiktok_top_video_views",
      label: (value) => `${formatCompactEvidenceNumber(value)} views on the top TikTok video`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} top TikTok views`,
    },
    {
      priority: 76,
      match: (metricName) => metricName === "shazam_count",
      label: (value) => `${formatCompactEvidenceNumber(value)} Shazams`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} Shazams`,
    },
    {
      priority: 72,
      match: (metricName) => metricName === "youtube_views",
      label: (value) => `${formatCompactEvidenceNumber(value)} YouTube views`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} YouTube views`,
    },
    {
      priority: 70,
      match: (metricName) => metricName === "airplay_spins",
      label: (value) => `${formatCompactEvidenceNumber(value)} airplay spins`,
      shortLabel: (value) => `${formatCompactEvidenceNumber(value)} airplay spins`,
    },
  ];

  return definitions.flatMap((definition): SongManagementSignal[] => {
    const match = evidence
      .filter((item) => {
        const metricName = item.metricName ?? "";
        return definition.match(metricName) && typeof item.metricValue === "number";
      })
      .sort((a, b) => (b.metricValue ?? 0) - (a.metricValue ?? 0))[0];
    if (!match || typeof match.metricValue !== "number") return [];
    return [{
      label: definition.label(match.metricValue),
      shortLabel: definition.shortLabel(match.metricValue),
      metricLabel: signalMetricLabel(match.metricName ?? ""),
      value: formatCompactEvidenceNumber(match.metricValue),
      context: signalMetricContext(match.metricName ?? ""),
      priority: definition.priority,
      metricName: match.metricName ?? "",
      evidenceIds: [match.id],
    }];
  }).sort((a, b) => b.priority - a.priority);
}

function signalToSnapshotMetric(signal: SongManagementSignal): TodayBriefViewModel["intelligenceSnapshot"][number]["metrics"][number] {
  return {
    label: signal.metricLabel,
    value: signal.value,
    context: signal.context,
    evidenceIds: signal.evidenceIds,
  };
}

function signalMetricLabel(metricName: string) {
  switch (metricName) {
    case "spotify_trailing_28d_streams":
      return "Recent streams";
    case "spotify_trailing_7d_streams":
      return "Last 7 days";
    case "spotify_playlist_total_reach":
    case "spotify_playlist_reach":
    case "spotify_editorial_playlist_reach":
      return "Playlist reach";
    case "spotify_playlist_count":
      return "Playlist count";
    case "spotify_editorial_playlist_count":
      return "Editorial support";
    case "apple_music_editorial_playlist_count":
      return "Apple editorial";
    case "tiktok_video_count":
      return "TikTok videos";
    case "tiktok_top_video_views":
      return "Top TikTok clip";
    case "shazam_count":
      return "Shazams";
    case "youtube_views":
      return "YouTube views";
    case "airplay_spins":
      return "Airplay";
    default:
      return sentenceCaseMetricName(metricName || "Signal");
  }
}

function signalMetricContext(metricName: string) {
  switch (metricName) {
    case "spotify_trailing_28d_streams":
      return "Spotify streams in the latest 28-day window";
    case "spotify_trailing_7d_streams":
      return "Spotify streams in the latest 7-day window";
    case "spotify_playlist_total_reach":
    case "spotify_playlist_reach":
    case "spotify_editorial_playlist_reach":
      return "Spotify playlist reach";
    case "spotify_playlist_count":
      return "Spotify playlists carrying the record";
    case "spotify_editorial_playlist_count":
      return "Spotify editorial playlist support";
    case "apple_music_editorial_playlist_count":
      return "Apple Music editorial support";
    case "tiktok_video_count":
      return "TikTok videos created around the record";
    case "tiktok_top_video_views":
      return "views on the top TikTok clip";
    case "shazam_count":
      return "people actively identifying the record";
    case "youtube_views":
      return "YouTube view demand";
    case "airplay_spins":
      return "radio spins";
    default:
      return "saved record signal";
  }
}

function formatCompactEvidenceNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function buildManagerRead(song: ProductionMusicItem) {
  const signals = buildSongManagementSignals(song);
  if (song.sourceKind === "spotify_public_catalog" && signals.length) {
    const proof = readableList(signals.slice(0, 4).map((signal) => signal.label));
    const role = inferSongRecordRole(signals);
    const secondLane = signals[1] ? ` The second useful lane is ${signals[1].context}, which stops this from being a one-platform read.` : "";
    const unlock = requiresInAppSplitProof(song) && song.splits?.status && song.splits.status !== "Cleared"
      ? ` If ${song.splits.status.toLowerCase()} split proof is blocking action, clear it as the operating unlock, not as the story of the record.`
      : "";
    return `${song.title} is the record with the clearest public pressure right now: ${proof}. I would treat it as the ${role}, because the strongest saved facts are pointing to one song instead of asking the team to split attention across the catalog.${secondLane}${unlock} Today, I would make ${song.title} the first record to inspect, then decide whether ${managementLaneChoice(signals)} should lead the next team action.`;
  }

  const outsideDetails = song.evidence
    .slice(0, 2)
    .map(evidenceDetail);

  if (song.sourceKind === "spotify_public_catalog") {
    const evidenceRead = outsideDetails.length
      ? `${song.title} is live, and the first management read starts with ${outsideDetails.join("; ")}.`
      : `${song.title} is live, but the first management read is simple: the record is in view and needs one useful public or team signal before I can call its lane.`;
    return `${evidenceRead} I would not turn this into a broad plan yet; I would make ${song.title} the record to inspect first and wait for one concrete behavior to tell us whether the song is a playlist record, social record, video/search record, or quiet catalog support.`;
  }

  const evidenceRead = outsideDetails.length
    ? ` I found ${outsideDetails.join("; ")}.`
    : "";
  return `${song.title} is in the workspace, but it is still an internal music object until one useful audience or team signal changes the read.${evidenceRead} I would make the next step about finding the first real behavior around this record, not filling the page with setup notes.`;
}

function inferSongRecordRole(signals: SongManagementSignal[]) {
  const metricNames = new Set(signals.map((signal) => signal.metricName));
  if (metricNames.has("tiktok_video_count") || metricNames.has("tiktok_top_video_views")) return "public-pressure record";
  if (metricNames.has("youtube_views") || metricNames.has("shazam_count")) return "video/search demand record";
  if (
    metricNames.has("spotify_playlist_total_reach") ||
    metricNames.has("spotify_playlist_reach") ||
    metricNames.has("spotify_editorial_playlist_reach") ||
    metricNames.has("spotify_playlist_count") ||
    metricNames.has("spotify_editorial_playlist_count")
  ) return "playlist-support record";
  if (metricNames.has("spotify_trailing_28d_streams") || metricNames.has("spotify_trailing_7d_streams")) return "streaming-scale record";
  return "record with the clearest usable evidence";
}

function managementLaneFromSignal(signal: SongManagementSignal | undefined) {
  if (!signal) return "the first visible audience behavior";
  switch (signal.metricName) {
    case "tiktok_video_count":
    case "tiktok_top_video_views":
      return "short-form discovery";
    case "youtube_views":
      return "video/search demand";
    case "spotify_playlist_total_reach":
    case "spotify_playlist_reach":
    case "spotify_editorial_playlist_reach":
    case "spotify_playlist_count":
    case "spotify_editorial_playlist_count":
    case "apple_music_editorial_playlist_count":
      return "playlist support";
    case "spotify_trailing_28d_streams":
    case "spotify_trailing_7d_streams":
      return "streaming scale";
    case "shazam_count":
      return "active discovery";
    case "airplay_spins":
      return "radio pressure";
    default:
      return signal.context;
  }
}

function managementLaneChoice(signals: SongManagementSignal[]) {
  const lead = managementLaneFromSignal(signals[0]);
  const preferredContrast = signals.find((signal) =>
    ["tiktok_video_count", "tiktok_top_video_views", "youtube_views", "shazam_count"].includes(signal.metricName) &&
    managementLaneFromSignal(signal) !== lead
  );
  const fallbackContrast = signals.find((signal) => managementLaneFromSignal(signal) !== lead);
  const contrast = preferredContrast ?? fallbackContrast;
  if (!contrast) return lead;
  return `${lead} or ${managementLaneFromSignal(contrast)}`;
}

function buildSongSituationLine(song: ProductionMusicItem) {
  const parts = [`${titleCaseStatus(song.lifecycleStage)} song`];
  const leadSignal = buildSongManagementSignals(song).find((signal) => signal.metricName !== "spotify_playlist_reach");
  if (leadSignal) {
    parts.push(leadSignal.shortLabel);
  } else if (song.evidence.length) {
    const trend = song.evidence.find((item) => (item.metricName ?? "").includes("trend"));
    if (typeof trend?.metricValue === "number") {
      if (trend.metricValue >= 5) parts.push(`recent daily listening is up ${Math.round(trend.metricValue)}%`);
      else if (trend.metricValue <= -5) parts.push(`recent daily listening is down ${Math.abs(Math.round(trend.metricValue))}%`);
      else parts.push("recent daily listening is steady");
    } else {
      parts.push(`${song.evidence.length} current ${song.evidence.length === 1 ? "result" : "results"} available`);
    }
  } else {
    parts.push("recent listening results are missing");
  }
  if (requiresInAppSplitProof(song) && song.splits?.status && song.splits.status !== "Cleared") parts.push(`${song.splits.status} split proof`);
  return parts.join(" · ");
}

function buildSongWatchNext(song: ProductionMusicItem) {
  const hasPlaylistEvidence = song.evidence.some((item) => (item.evidenceType ?? "").includes("playlist"));
  if (hasPlaylistEvidence) return "Check whether people keep listening after playlist support changes.";
  if (song.evidence.length) return "Check whether the strongest result continues over the next seven days.";
  return "Add recent listening data so the next read can show how people are responding.";
}

function buildProjectManagerRead(project: ProductionMusicProject) {
  const trackCount = project.tracks.length || project.totalTracks || 0;
  const signals = buildProjectManagementSignals(project);
  const signalRead = signals.length
    ? ` The strongest project facts are ${readableList(signals.slice(0, 4).map((signal) => signal.label))}.`
    : " The release shape is the useful starting point until one project-level audience fact is connected.";
  const trackRead = project.tracks.length
    ? ` ${project.tracks[0].title} is the first song to inspect because it is ${project.tracks.length === 1 ? "the only track currently mapped into the project" : "first in the mapped tracklist"}.`
    : " The next read should map the tracklist before choosing the song that carries the project.";
  return `${project.title} has ${trackCount} mapped ${trackCount === 1 ? "song" : "songs"} as a ${titleCaseStatus(project.lifecycleStage).toLowerCase()} ${project.projectType}.${signalRead}${trackRead} I would use this project read to choose the focus track before treating the whole release as one campaign.`;
}

function buildProjectSituationLine(project: ProductionMusicProject) {
  const trackCount = project.tracks.length || project.totalTracks || 0;
  return `${titleCaseStatus(project.lifecycleStage)} ${project.projectType} · ${trackCount} ${trackCount === 1 ? "song" : "songs"} mapped · ${project.evidence.length ? "results available" : "results still needed"}`;
}

function buildProjectWatchNext(project: ProductionMusicProject) {
  return project.evidence.length
    ? "Check which song keeps earning attention before choosing the focus track."
    : "Add song-level listening results before choosing a focus track or campaign.";
}

function buildProjectNextMove(project: ProductionMusicProject) {
  const blockedTracks = project.tracks.filter((track) => track.blocker);
  if (blockedTracks.length) {
    return `Clear rights on ${blockedTracks.length === 1 ? blockedTracks[0].title : `${blockedTracks.length} tracks`} before treating this project as campaign-ready.`;
  }

  if (project.evidence.length) {
    return "Use the project read to pick the track that deserves action, then compare the next visible result before spending against the whole release.";
  }

  return "Map project evidence before deciding whether this release needs a campaign, a focus track, or quiet catalog support.";
}

function readableList(values: string[]) {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function buildNextMove(song: ProductionMusicItem) {
  const signals = buildSongManagementSignals(song);

  if (signals.length) {
    return `Make ${song.title} the first record to inspect, then decide whether ${managementLaneChoice(signals)} should lead the next team action.`;
  }

  if (song.sourceKind === "spotify_public_catalog") {
    return `Make ${song.title} the first music focus only after a useful public or team signal is connected.`;
  }

  const missingInternalFile = buildFileAssets(song).some((asset) => asset.group === "Audio" && asset.status === "Missing");
  if (missingInternalFile) {
    return "Upload or connect internal master files if this track needs operational delivery, edits, pitching, or reuse.";
  }

  return `Make ${song.title} the first music focus only after a useful public or team signal is connected.`;
}

function buildRightsState(song: ProductionMusicItem) {
  if (song.splits?.status === "Cleared") return "Split sheet confirmed";
  if (isReleasedSpotifyCatalogMusic(song)) return "Released catalog rights attached outside this app";
  if (song.splits?.status && song.splits.status !== "Missing") return `${song.splits.status} split proof`;
  return "Rights proof not connected";
}

function buildFileAssets(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["fileAssets"]> {
  const assets = [...song.assets];
  const hasSpotifyReference = Boolean(song.spotifyUrl);
  const hasConfirmedAudioAsset = assets.some((asset) => asset.group === "Audio" && ["Uploaded", "Confirmed", "Cleared"].includes(asset.status));
  const hasSplitAsset = assets.some((asset) => asset.group === "Splits");
  const needsSplitProof = requiresInAppSplitProof(song);

  return [
    ...(hasSpotifyReference
      ? [{ group: "Audio" as const, label: "Spotify track page", status: "Confirmed", action: "Open Spotify URL" }]
      : []),
    { group: "Artwork" as const, label: "Cover artwork", status: song.coverImageUrl ? "Confirmed" : "Missing", action: "Add artwork source", assetType: "cover_art", canUpload: !song.coverImageUrl },
    ...assets.filter((asset) => asset.group === "Artwork"),
    ...assets.filter((asset) => asset.group === "Audio"),
    ...(hasConfirmedAudioAsset ? [] : [{ group: "Audio" as const, label: "User-uploaded master", status: "Missing", action: "Upload final master", assetType: "final_master", canUpload: true }]),
    ...assets.filter((asset) => asset.group === "Splits"),
    ...(!hasSplitAsset && needsSplitProof ? [{ group: "Splits" as const, label: "Split sheet document", status: song.splits?.status === "Cleared" ? "Confirmed" : "Missing", action: "Upload split sheet", assetType: "split_sheet", canUpload: song.splits?.status !== "Cleared" }] : []),
  ];
}

function buildSongDetails(song: ProductionMusicItem) {
  return [...buildMetadataFields(song), ...buildIdentifierFields(song), ...buildReleaseFields(song), ...buildCreditFields(song).map((credit) => ({ label: credit.role, value: credit.names, status: credit.status }))];
}

function buildMetadataFields(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["metadataFields"]> {
  return [
    { label: "Song title", value: song.title, status: "Confirmed" },
    manualDetailField(song, "Primary artist", song.primaryArtist),
    { label: "Featured artists", value: song.featuredArtists.length ? song.featuredArtists.join(", ") : "None", status: "Confirmed" },
    manualDetailField(song, "Version", song.itemType === "alternate_version" ? "Alternate version" : undefined, "Draft"),
    manualDetailField(song, "Genre", song.genres?.length ? song.genres.join(", ") : undefined),
    manualDetailField(song, "Mood", song.mood),
    manualDetailField(song, "Language", song.language),
    manualDetailField(song, "Mode", song.mode),
    manualDetailField(song, "Album / project", song.albumName),
    manualDetailField(song, "Explicit", typeof song.explicit === "boolean" ? (song.explicit ? "Yes" : "No") : undefined),
    { label: "Spotify track", value: song.spotifyUrl ?? "Missing", status: song.spotifyUrl ? "Confirmed" : "Missing" },
  ];
}

function buildReleaseFields(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["releaseFields"]> {
  return [
    manualDetailField(song, "Release date", song.releaseDate || song.releasedAt ? formatDateLabel(song.releaseDate ?? song.releasedAt) : undefined),
    manualDetailField(song, "Record label", song.albumLabel),
    manualDetailField(song, "Copyright", song.copyrights?.length ? song.copyrights.join("; ") : undefined),
    manualDetailField(song, "Publishing", undefined),
    { label: "Lifecycle", value: titleCaseStatus(song.lifecycleStage), status: "Confirmed" },
    manualDetailField(song, "Track number", song.trackNumber ? `${song.trackNumber}` : undefined),
    manualDetailField(song, "Disc number", song.discNumber ? `${song.discNumber}` : undefined),
    manualDetailField(song, "Duration", song.durationMs ? formatDuration(song.durationMs) : undefined),
    manualDetailField(song, "Popularity", typeof song.popularity === "number" ? `${song.popularity}` : undefined),
  ];
}

function manualDetailField(song: ProductionMusicItem, label: string, providerValue?: string, fallbackStatus: "Missing" | "Draft" = "Missing") {
  if (providerValue) return { label, value: providerValue, status: "Confirmed" as const };
  const manualValue = song.manualDetails?.[normalizeManualDetailKey(label)];
  return manualValue ? { label, value: manualValue, status: "Draft" as const } : { label, value: "Missing", status: fallbackStatus };
}

function buildIdentifierFields(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["identifiers"]> {
  return [
    { label: "ISRC", value: song.isrc ?? "Missing", status: song.isrc ? "Confirmed" : "Missing" },
    { label: "UPC", value: song.upc ?? "Missing", status: song.upc ? "Confirmed" : "Missing" },
    { label: "Spotify track ID", value: song.spotifyTrackId ?? "Missing", status: song.spotifyTrackId ? "Confirmed" : "Missing" },
    { label: "Spotify URI", value: song.spotifyUri ?? "Missing", status: song.spotifyUri ? "Confirmed" : "Missing" },
    { label: "Album ID", value: song.albumId ?? "Missing", status: song.albumId ? "Confirmed" : "Missing" },
  ];
}

function buildCreditFields(song: ProductionMusicItem): NonNullable<MusicObjectViewModel["credits"]> {
  return song.credits.length
    ? song.credits.map((credit) => ({
        role: credit.role,
        names: credit.names,
        status: toFieldStatus(credit.status),
      }))
    : [
        { role: "Producer", names: "Missing", status: "Missing" },
        { role: "Writer", names: "Missing", status: "Missing" },
        { role: "Mix engineer", names: "Missing", status: "Missing" },
        { role: "Mastering engineer", names: "Missing", status: "Missing" },
      ];
}

function toFieldStatus(status: string): "Missing" | "Draft" | "Confirmed" {
  if (status === "Confirmed" || status === "Cleared" || status === "Uploaded") return "Confirmed";
  if (status === "Missing") return "Missing";
  return "Draft";
}

function firstProjectBlocker(project: ProductionMusicProject) {
  const blocked = project.tracks.find((track) => track.blocker);
  return blocked?.blocker ?? "No inherited blockers";
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return "Missing";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = `${totalSeconds % 60}`.padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function mapCheckpointStatus(status: string): MissionCheckpointViewModel["status"] {
  if (status === "needs_revision" || status === "Needs revision") return "Needs revision";
  if (status === "ready_for_manager_check" || status === "Ready for AI review") return "Ready for AI review";
  if (status === "cleared" || status === "Met") return "Met";
  if (status === "watching_signal" || status === "Watching signal") return "Watching signal";
  return "Waiting on tasks";
}

function mapTaskApprovalState(state: string | null | undefined): MissionTaskViewModel["approvalState"] {
  if (state === "needs approval" || state === "needs_approval") return "needs approval";
  if (state === "approved") return "approved";
  if (state === "blocked") return "blocked";
  if (state === "active") return "active";
  return "not_required";
}

function missionFromRow(
  row: MissionRow,
  checkpoints: CheckpointRow[] = [],
  tasks: TaskRow[] = [],
  steps: TaskStepRow[] = [],
  results: TaskResultRow[] = [],
  deliverablesByTask: Map<string, MissionTaskDeliverableViewModel[]> = new Map(),
): MissionViewModel {
  const nextTask = tasks.find((task) => !["completed", "archived", "rejected", "superseded"].includes(task.status));

  const mappedTasks: MissionTaskViewModel[] = tasks.map((task) => {
    const taskSteps = steps
      .filter((step) => step.task_id === task.id)
      .map((step) => step.body);

    const taskResult = results.find((res) => res.task_id === task.id);
    const resultViewModel: MissionTaskResultViewModel | undefined = taskResult
      ? {
          status: taskResult.status as MissionTaskResultViewModel["status"],
          summary: taskResult.summary ?? "No summary.",
          userNote: taskResult.user_note ?? "",
          interpretation: taskResult.manager_interpretation ?? "",
          missionEffect: taskResult.mission_effect ?? "",
          followUp: taskResult.recommended_follow_up ?? "",
        }
      : undefined;

    return {
      id: task.id,
      checkpointId: task.primary_checkpoint_id ?? "",
      title: task.title,
      owner: task.owner_role ?? "Manager",
      deadline: task.deadline ? new Date(task.deadline).toLocaleDateString() : "Next review",
      approvalState: mapTaskApprovalState(task.approval_state),
      purpose: task.purpose ?? "",
      steps: taskSteps,
      evidenceIds: task.evidence_needed ?? [],
      deliverables: deliverablesByTask.get(task.id),
      dependency: task.dependency ?? "None",
      riskIfLate: task.risk_if_late ?? "None",
      result: resultViewModel,
    };
  });

  const mappedCheckpoints: MissionCheckpointViewModel[] = checkpoints.map((checkpoint, index) => {
    const requiredTaskIds = mappedTasks
      .filter((t) => t.checkpointId === checkpoint.id)
      .map((t) => t.id);

    const dependsOnCheckpointIds = index > 0 ? [checkpoints[index - 1].id] : [];
    const unlocks = index < checkpoints.length - 1 ? [checkpoints[index + 1].title] : [];

    return {
      id: checkpoint.id,
      phase: index + 1,
      title: checkpoint.title,
      status: mapCheckpointStatus(checkpoint.status),
      question: checkpoint.question,
      requiredTaskIds,
      dependsOnCheckpointIds,
      unlocks,
      blockedReason: checkpoint.blocked_reason ?? "",
      dependencyImpact: checkpoint.dependency_impact ?? "Downstream work should wait until this review has task results.",
      watchedSignals: checkpoint.watched_signals ?? [],
      decisionRule: checkpoint.decision_rule ?? "Do not change the mission state without task results or source-backed context.",
      recommendation: checkpoint.recommendation ?? "No recommendation.",
      resultSummary: checkpoint.reason_for_checkpoint ?? checkpoint.question,
      nextAction: checkpoint.next_action ?? "Complete tasks under this checkpoint.",
    };
  });

  return {
    id: row.id,
    title: row.title,
    status: row.status ?? "active",
    progress: row.progress ?? deriveMissionProgress(tasks),
    review: row.review_point ?? mappedCheckpoints[0]?.title ?? "No review has run yet.",
    summary: row.summary ?? "No mission summary has been generated yet.",
    recommendation: row.current_recommendation ?? "No current recommendation.",
    musicSubject: "No linked music subject",
    nextTask: nextTask?.title ?? "No next task selected.",
    checkpoints: mappedCheckpoints,
    tasks: mappedTasks,
  };
}

function deriveMissionProgress(tasks: TaskRow[]) {
  if (!tasks.length) return 0;
  const completed = tasks.filter((task) => task.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

function interpretTaskResult(task: TaskRow, input: { status: "completed" | "blocked"; note: string }) {
  const trimmedNote = input.note.trim();
  if (input.status === "blocked") {
    return `Task blocked: ${task.title}. The Manager should revise the checkpoint before more work continues. ${trimmedNote}`;
  }

  return `Task completed: ${task.title}. The result is now checkpoint evidence for Manager review. ${trimmedNote}`;
}

function buildCheckpointReview(
  checkpoint: CheckpointRow | undefined,
  task: TaskRow,
  missionTasks: TaskRow[],
  input: { status: "completed" | "blocked"; note: string },
) {
  const checkpointTasks = task.primary_checkpoint_id
    ? missionTasks.filter((missionTask) => missionTask.primary_checkpoint_id === task.primary_checkpoint_id)
    : missionTasks;
  const title = checkpoint?.title ?? "Mission checkpoint";

  if (input.status === "blocked") {
    return {
      title,
      status: "needs_revision",
      recommendation: `Task blocked on ${task.title}. Revise the plan before spending more effort: ${input.note.trim()}`,
    };
  }

  const allCheckpointTasksCompleted = checkpointTasks.length > 0 && checkpointTasks.every((missionTask) => missionTask.status === "completed");
  if (allCheckpointTasksCompleted) {
    return {
      title,
      status: "ready_for_manager_check",
      recommendation: `${title} is ready for Manager review. Use the completed task evidence before deciding whether to continue, revise, or stop.`,
    };
  }

  return {
    title,
    status: "in_progress",
    recommendation: `${task.title} is complete. Continue the remaining checkpoint tasks before Manager review.`,
  };
}

function evidenceFromRow(row: EvidenceRow): EvidenceItemViewModel {
  const metric = [row.metric_name, row.metric_value, row.metric_unit].filter((value) => value !== undefined && value !== null && value !== "").join(" ");
  return {
    id: row.id,
    source: row.source,
    sourceKind: row.source_kind,
    subject: row.subject_label ?? "Artist workspace",
    metric: metric || "Source record",
    window: row.freshness ?? "Unknown window",
    confidence: row.confidence ?? "unknown",
    limitation: row.limitation ?? "No limitation text recorded.",
  };
}

function buildDeskAttentionItems(latestSync: SourceSyncJobRow | undefined) {
  const items = [];

  if (latestSync?.status === "running" || latestSync?.status === "queued") {
    items.push({
      title: "Catalog import running",
      body: "Desk is still pulling public Spotify catalog records.",
      tone: "accent" as const,
    });
  }

  if (latestSync?.status === "failed") {
    items.push({
      title: "Catalog import failed",
      body: "Retry Spotify import before trusting the catalog read.",
      tone: "warning" as const,
    });
  }

  return items;
}

function formatMovementSummary(value: string | null | undefined) {
  const summary = value?.trim();
  if (!summary) return "Workspace activity recorded";
  if (/today'?s brief.*(?:visible copy used banned|banned setup\/source|source term)/i.test(summary)) {
    return "Today's Brief needs a fresh Manager read.";
  }
  return summary.replace(/\s*\/\s*recorded$/i, "").replace(/\s+/g, " ");
}

function formatEventLabel(value: string | null | undefined) {
  const eventType = value?.trim().toLowerCase() ?? "";

  if (eventType.includes("setup")) return "Setup";
  if (eventType.includes("spotify") || eventType.includes("catalog")) return "Catalog";
  if (eventType.includes("workspace")) return "Workspace";
  if (eventType.includes("source") || eventType.includes("sync")) return "Source";
  if (eventType.includes("mission")) return "Mission";
  if (eventType.includes("task")) return "Task";
  if (eventType.includes("checkpoint") || eventType.includes("review")) return "Review";
  if (eventType.includes("music")) return "Music";

  return "System";
}

function formatEventTime(value: string | null | undefined) {
  if (!value) return "Recorded";

  const eventTime = new Date(value).getTime();
  if (!Number.isFinite(eventTime)) return "Recorded";

  const elapsedMs = Date.now() - eventTime;
  if (elapsedMs < 0) return "Just now";

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;

  if (elapsedMs < minute) return "Just now";
  if (elapsedMs < hour) {
    const minutes = Math.max(1, Math.floor(elapsedMs / minute));
    return `${minutes}m ago`;
  }
  if (elapsedMs < day) {
    const hours = Math.max(1, Math.floor(elapsedMs / hour));
    return `${hours}h ago`;
  }
  if (elapsedMs < month) {
    const days = Math.max(1, Math.floor(elapsedMs / day));
    return `${days}d ago`;
  }

  const months = Math.max(1, Math.floor(elapsedMs / month));
  return `${months}mo ago`;
}
