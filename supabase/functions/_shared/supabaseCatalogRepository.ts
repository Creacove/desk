import {
  PUBLIC_SPOTIFY_CATALOG_LIMITATION,
  type MusicIdentifierDraft,
  type MusicItemDraft,
  type MusicProjectDraft,
  type OperatingEventDraft,
  type SourceConnectionDraft,
  type SourceSnapshotDraft,
  type SourceSyncJobDraft,
  type SpotifyArtistIdentityDraft,
  type SpotifyCatalogBootstrapRepository,
} from "./spotifyCatalogBootstrap.ts";

type SupabaseLike = {
  from(table: string): any;
};

export function createSupabaseCatalogRepository(
  supabase: SupabaseLike,
  context: { accountId: string; artistWorkspaceId: string; artistId: string },
): SpotifyCatalogBootstrapRepository {
  return {
    async getSpotifyProviderId() {
      const { data, error } = await supabase.from("source_providers").select("id").eq("provider_key", "spotify").maybeSingle();
      if (error) throw error;
      if (data?.id) {
        return data.id as string;
      }

      const { data: created, error: createError } = await supabase
        .from("source_providers")
        .insert({
          provider_key: "spotify",
          display_name: "Spotify Public Catalog",
          source_kind: "official_api",
          default_confidence: "low",
          claim_boundaries: {
            supports: ["identity", "catalog", "public metadata"],
            forbidden: ["private saves", "source-of-stream", "revenue", "conversion"],
          },
        })
        .select("id")
        .single();
      if (createError) throw createError;
      return created.id as string;
    },

    async saveArtistSpotifyIdentity(identity) {
      await saveArtistSpotifyIdentity(supabase, context, identity);
    },

    async upsertSourceConnection(draft) {
      return upsertSourceConnection(supabase, draft);
    },

    async createSourceSyncJob(draft) {
      const { data, error } = await supabase
        .from("source_sync_jobs")
        .insert({
          account_id: draft.accountId,
          artist_workspace_id: draft.artistWorkspaceId,
          artist_id: draft.artistId,
          source_connection_id: draft.sourceConnectionId,
          job_type: draft.jobType,
          trigger_type: draft.triggerType,
          status: draft.status,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },

    async updateSourceSyncJob(id, patch) {
      const { error } = await supabase
        .from("source_sync_jobs")
        .update({
          status: patch.status,
          completed_at: new Date().toISOString(),
          error: patch.error,
        })
        .eq("id", id);
      if (error) throw error;
    },

    async writeSourceSnapshot(draft) {
      return writeSourceSnapshot(supabase, draft);
    },

    async findMusicProjectByKeys(keys) {
      return findMusicProjectByKeys(supabase, keys);
    },

    async createMusicProject(draft) {
      const { data, error } = await supabase.from("music_projects").insert(musicProjectPayload(draft)).select("id").single();
      if (error) throw error;
      return data.id as string;
    },

    async updateMusicProject(id, draft) {
      const { error } = await supabase.from("music_projects").update(musicProjectPayload(draft)).eq("id", id);
      if (error) throw error;
    },

    async findMusicItemByKeys(keys) {
      return findMusicItemByKeys(supabase, keys);
    },

    async createMusicItem(draft) {
      const { data, error } = await supabase.from("music_items").insert(musicItemPayload(draft)).select("id").single();
      if (error) throw error;
      return data.id as string;
    },

    async updateMusicItem(id, draft) {
      const { error } = await supabase.from("music_items").update(musicItemPayload(draft)).eq("id", id);
      if (error) throw error;
    },

    async upsertMusicProjectItem(draft) {
      const { error } = await supabase.from("music_project_items").upsert(
        {
          account_id: context.accountId,
          artist_workspace_id: context.artistWorkspaceId,
          artist_id: context.artistId,
          music_project_id: draft.musicProjectId,
          music_item_id: draft.musicItemId,
          order_index: draft.orderIndex,
          disc_number: draft.discNumber,
          display_title: draft.displayTitle,
          relationship: "contains_track",
        },
        { onConflict: "music_project_id,music_item_id" },
      );
      if (error) throw error;
    },

    async upsertMusicIdentifier(draft) {
      const { error } = await supabase.from("music_identifiers").upsert(
        {
          account_id: draft.accountId,
          artist_workspace_id: draft.artistWorkspaceId,
          artist_id: draft.artistId,
          music_item_id: draft.musicItemId,
          music_project_id: draft.musicProjectId,
          identifier_type: draft.identifierType,
          identifier_value: draft.identifierValue,
          provider_id: draft.providerId,
          source_snapshot_id: draft.sourceSnapshotId,
          confidence: draft.confidence,
        },
        { onConflict: "account_id,identifier_type,identifier_value" },
      );
      if (error) throw error;
    },

    async writeOperatingEvent(draft) {
      const { error } = await supabase.from("operating_events").insert({
        account_id: draft.accountId,
        artist_workspace_id: draft.artistWorkspaceId,
        artist_id: draft.artistId,
        event_type: draft.eventType,
        actor_type: draft.actorType,
        target_type: draft.targetType,
        target_id: draft.targetId,
        source_type: draft.sourceType,
        source_id: draft.sourceId,
        summary: draft.summary,
        payload: draft.payload,
      });
      if (error) throw error;
    },
  };
}

async function saveArtistSpotifyIdentity(
  supabase: SupabaseLike,
  context: { accountId: string; artistWorkspaceId: string; artistId: string },
  identity: SpotifyArtistIdentityDraft,
) {
  const spotifyIdentity = {
    id: identity.spotifyArtistId,
    name: identity.name,
    url: identity.spotifyUrl,
    uri: identity.spotifyUri,
    image_url: identity.imageUrl,
    followers: identity.followers,
    genres: identity.genres ?? [],
    popularity: identity.popularity,
  };

  const { error: artistError } = await supabase
    .from("artists")
    .update({
      display_name: identity.name,
      canonical_spotify_artist_id: identity.spotifyArtistId,
      canonical_spotify_url: identity.spotifyUrl,
    })
    .eq("account_id", context.accountId)
    .eq("id", context.artistId);
  if (artistError) throw artistError;

  const { data: profile, error: profileLookupError } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("account_id", context.accountId)
    .eq("artist_workspace_id", context.artistWorkspaceId)
    .eq("artist_id", context.artistId)
    .limit(1)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;

  if (profile?.id) {
    const { error } = await supabase
      .from("artist_profiles")
      .update({ display_name: identity.name, spotify_identity: spotifyIdentity })
      .eq("id", profile.id);
    if (error) throw error;
  }
}

async function upsertSourceConnection(supabase: SupabaseLike, draft: SourceConnectionDraft) {
  const { data: existingRows, error: findError } = await supabase
    .from("source_connections")
    .select("id")
    .eq("account_id", draft.accountId)
    .eq("artist_workspace_id", draft.artistWorkspaceId)
    .eq("provider_id", draft.providerId)
    .eq("handle_or_external_ref", draft.handleOrExternalRef)
    .limit(1);
  if (findError) throw findError;

  const payload = sourceConnectionPayload(draft);
  const existingId = (existingRows as Array<{ id?: string }> | null)?.[0]?.id;
  if (existingId) {
    const { error } = await supabase.from("source_connections").update(payload).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await supabase.from("source_connections").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

function sourceConnectionPayload(draft: SourceConnectionDraft) {
  return {
    account_id: draft.accountId,
    artist_workspace_id: draft.artistWorkspaceId,
    artist_id: draft.artistId,
    provider_id: draft.providerId,
    handle_or_external_ref: draft.handleOrExternalRef,
    status: draft.status,
    limitations: draft.limitations.length ? draft.limitations : [PUBLIC_SPOTIFY_CATALOG_LIMITATION],
    metadata: draft.metadata,
  };
}

async function writeSourceSnapshot(supabase: SupabaseLike, draft: SourceSnapshotDraft) {
  const payload = {
    account_id: draft.accountId,
    artist_workspace_id: draft.artistWorkspaceId,
    artist_id: draft.artistId,
    source_connection_id: draft.sourceConnectionId,
    provider_id: draft.providerId,
    source_kind: draft.sourceKind,
    snapshot_type: draft.snapshotType,
    raw_ref: draft.rawRef,
    raw_payload: draft.rawPayload,
    metadata: draft.metadata,
  };

  const { data, error } = await supabase.from("source_snapshots").insert(payload).select("id").single();
  if (!error) {
    return data.id as string;
  }

  const { data: retryData, error: retryError } = await supabase
    .from("source_snapshots")
    .insert({
      ...payload,
      raw_payload: undefined,
      snapshot_type: undefined,
      metadata: {
        ...draft.metadata,
        snapshot_type: draft.snapshotType,
        raw_payload: draft.rawPayload,
      },
    })
    .select("id")
    .single();
  if (retryError) throw error;
  return retryData.id as string;
}

async function findMusicProjectByKeys(supabase: SupabaseLike, keys: string[]) {
  for (const key of keys) {
    const identifier = identifierFromDedupeKey(key);
    if (identifier && ["spotify_album_id", "upc"].includes(identifier.type)) {
      const { data, error } = await supabase
        .from("music_identifiers")
        .select("music_project_id")
        .eq("identifier_type", identifier.type)
        .eq("identifier_value", identifier.value)
        .maybeSingle();
      if (error) throw error;
      if (data?.music_project_id) return data.music_project_id as string;
    }
  }

  return null;
}

async function findMusicItemByKeys(supabase: SupabaseLike, keys: string[]) {
  for (const key of keys) {
    const identifier = identifierFromDedupeKey(key);
    if (identifier && ["isrc", "spotify_track_id"].includes(identifier.type)) {
      const { data, error } = await supabase
        .from("music_identifiers")
        .select("music_item_id")
        .eq("identifier_type", identifier.type)
        .eq("identifier_value", identifier.value)
        .maybeSingle();
      if (error) throw error;
      if (data?.music_item_id) return data.music_item_id as string;
    }
  }

  return null;
}

function identifierFromDedupeKey(key: string) {
  const separator = key.indexOf(":");
  if (separator < 0) return null;
  return {
    type: key.slice(0, separator),
    value: key.slice(separator + 1),
  };
}

function musicProjectPayload(draft: MusicProjectDraft) {
  return {
    account_id: draft.accountId,
    artist_workspace_id: draft.artistWorkspaceId,
    artist_id: draft.artistId,
    title: draft.title,
    project_type: draft.projectType,
    lifecycle_stage: draft.lifecycleStage,
    source_kind: draft.sourceKind,
    source_limit: draft.sourceLimit,
    metadata: draft.metadata,
    released_at: draft.releasedAt,
    created_by_type: draft.createdByType,
  };
}

function musicItemPayload(draft: MusicItemDraft) {
  return {
    account_id: draft.accountId,
    artist_workspace_id: draft.artistWorkspaceId,
    artist_id: draft.artistId,
    title: draft.title,
    item_type: draft.itemType,
    lifecycle_stage: draft.lifecycleStage,
    source_kind: draft.sourceKind,
    source_limit: draft.sourceLimit,
    metadata: draft.metadata,
    released_at: draft.releasedAt,
    created_by_type: draft.createdByType,
  };
}
