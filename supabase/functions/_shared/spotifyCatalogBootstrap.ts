export const PUBLIC_SPOTIFY_CATALOG_LIMITATION =
  "Spotify public catalog supports identity, catalog, and public metadata only; it does not prove private analytics, saves, source-of-stream, revenue, conversion, or campaign ROI.";

export type SpotifyExternalUrls = {
  spotify?: string;
};

export type SpotifyImage = {
  url: string;
  width?: number | null;
  height?: number | null;
};

export type SpotifyArtistReference = {
  id: string;
  name: string;
  uri?: string;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyArtistPayload = SpotifyArtistReference & {
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
  followers?: { total?: number };
};

export type SpotifyAlbumSummary = {
  id: string;
  name: string;
  album_type: string;
  release_date?: string;
  release_date_precision?: string;
  total_tracks?: number;
  uri?: string;
  external_urls?: SpotifyExternalUrls;
  images?: SpotifyImage[];
  artists?: SpotifyArtistReference[];
};

export type SpotifyTrackPayload = {
  id: string;
  name: string;
  duration_ms?: number;
  explicit?: boolean;
  track_number?: number;
  disc_number?: number;
  uri?: string;
  external_urls?: SpotifyExternalUrls;
  preview_url?: string | null;
  popularity?: number;
  external_ids?: {
    isrc?: string;
    upc?: string;
  };
  artists?: SpotifyArtistReference[];
  album?: {
    id?: string;
    name?: string;
    album_type?: string;
    release_date?: string;
    release_date_precision?: string;
    total_tracks?: number;
    uri?: string;
    external_urls?: SpotifyExternalUrls;
    images?: SpotifyImage[];
    artists?: SpotifyArtistReference[];
  };
};

export type SpotifyAlbumPayload = SpotifyAlbumSummary & {
  external_ids?: {
    upc?: string;
  };
  copyrights?: Array<{ text?: string; type?: string }>;
  genres?: string[];
  label?: string;
  popularity?: number;
  tracks?: {
    items?: SpotifyTrackPayload[];
  };
};

export type SpotifyAudioFeaturesPayload = {
  id: string;
  acousticness?: number;
  danceability?: number;
  energy?: number;
  instrumentalness?: number;
  key?: number;
  liveness?: number;
  loudness?: number;
  mode?: number;
  speechiness?: number;
  tempo?: number;
  time_signature?: number;
  valence?: number;
};

export type SpotifyArtistAlbumsResponse = {
  items: SpotifyAlbumSummary[];
  total?: number;
};

export type SourceConnectionDraft = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  providerId: string;
  handleOrExternalRef: string;
  status: "connected";
  limitations: string[];
  metadata: Record<string, unknown>;
};

export type SourceSyncJobDraft = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  sourceConnectionId: string;
  jobType: "spotify_catalog_bootstrap";
  triggerType: "setup";
  status: "running";
};

export type SourceSnapshotDraft = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  sourceConnectionId: string;
  providerId: string;
  sourceKind: "official_api";
  snapshotType: "spotify_artist" | "spotify_artist_albums" | "spotify_album" | "spotify_album_tracks";
  rawRef: string;
  rawPayload: unknown;
  metadata: Record<string, unknown>;
};

export type MusicItemDraft = {
  id?: string;
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  title: string;
  itemType: "released_track";
  lifecycleStage: "released" | "scheduled" | "catalog";
  sourceKind: "spotify_public_catalog";
  sourceLimit: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
  releasedAt?: string;
  createdByType: "integration";
};

export type MusicProjectDraft = {
  id?: string;
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  title: string;
  projectType: "single" | "ep" | "album" | "compilation" | "other";
  lifecycleStage: "released" | "scheduled" | "catalog";
  sourceKind: "spotify_public_catalog";
  sourceLimit: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
  releasedAt?: string;
  createdByType: "integration";
};

export type MusicIdentifierDraft = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId?: string;
  musicProjectId?: string;
  identifierType:
    | "isrc"
    | "upc"
    | "spotify_track_id"
    | "spotify_album_id"
    | "spotify_track_uri"
    | "spotify_album_uri"
    | "spotify_track_url"
    | "spotify_album_url";
  identifierValue: string;
  dedupeKey: string;
  providerId: string;
  sourceSnapshotId: string;
  confidence: "medium";
};

export type OperatingEventDraft = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  eventType:
    | "spotify_catalog_bootstrap_started"
    | "spotify_catalog_bootstrap_completed"
    | "spotify_catalog_bootstrap_completed_with_limits"
    | "spotify_catalog_bootstrap_failed";
  actorType: "integration";
  targetType: "source_connection" | "artist_workspace";
  targetId: string;
  sourceType?: "source_sync_job";
  sourceId?: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type SpotifyCatalogBootstrapInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  selectedArtist: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    spotifyUri?: string;
  };
  market?: string;
  sourceConnectionId?: string;
  sourceSyncJobId?: string;
};

export type SpotifyArtistIdentityDraft = SpotifyCatalogBootstrapInput["selectedArtist"] & {
  imageUrl?: string;
  followers?: number;
  genres: string[];
  popularity?: number;
};

export type SpotifyCatalogClient = {
  getArtist(artistId: string): Promise<SpotifyArtistPayload>;
  getArtistAlbums(
    artistId: string,
    options: { market?: string; limit: number; includeGroup: "album" | "single" },
  ): Promise<SpotifyArtistAlbumsResponse>;
  getAlbum(albumId: string, options: { market?: string }): Promise<SpotifyAlbumPayload>;
  getTrackAudioFeatures?(trackId: string): Promise<SpotifyAudioFeaturesPayload>;
};

export type SpotifyCatalogBootstrapRepository = {
  getSpotifyProviderId(): Promise<string>;
  saveArtistSpotifyIdentity(input: SpotifyArtistIdentityDraft): Promise<void>;
  upsertSourceConnection(draft: SourceConnectionDraft): Promise<string>;
  createSourceSyncJob(draft: SourceSyncJobDraft): Promise<string>;
  updateSourceSyncJob(id: string, patch: { status: "completed" | "completed_with_limits" | "failed"; error?: string }): Promise<void>;
  writeSourceSnapshot(draft: SourceSnapshotDraft): Promise<string>;
  findMusicProjectByKeys(keys: string[]): Promise<string | null>;
  createMusicProject(draft: MusicProjectDraft): Promise<string>;
  updateMusicProject(id: string, draft: MusicProjectDraft): Promise<void>;
  findMusicItemByKeys(keys: string[]): Promise<string | null>;
  createMusicItem(draft: MusicItemDraft): Promise<string>;
  updateMusicItem(id: string, draft: MusicItemDraft): Promise<void>;
  upsertMusicProjectItem(draft: {
    musicProjectId: string;
    musicItemId: string;
    orderIndex: number;
    discNumber: number;
    displayTitle: string;
  }): Promise<void>;
  upsertMusicIdentifier(draft: MusicIdentifierDraft): Promise<void>;
  writeOperatingEvent(draft: OperatingEventDraft): Promise<void>;
};

export type SpotifyCatalogBootstrapResult =
  | { status: "completed"; musicItemCount: number; musicProjectCount: number; sourceSyncJobId: string }
  | { status: "completed_with_limits"; musicItemCount: number; musicProjectCount: number; sourceSyncJobId: string; error: string }
  | { status: "failed"; error: string; sourceSyncJobId: string };

type SnapshotIds = {
  artist: string;
  albums: string;
  album?: string;
  albumTracks?: string;
};

type FetchedAlbumSnapshot = {
  album: SpotifyAlbumPayload;
  albumSnapshotId: string;
  albumTracksSnapshotId: string;
};

export async function bootstrapSpotifyCatalog({
  input,
  spotify,
  repository,
}: {
  input: SpotifyCatalogBootstrapInput;
  spotify: SpotifyCatalogClient;
  repository: SpotifyCatalogBootstrapRepository;
}): Promise<SpotifyCatalogBootstrapResult> {
  const providerId = await repository.getSpotifyProviderId();

  await repository.saveArtistSpotifyIdentity({
    ...input.selectedArtist,
    genres: [],
  });

  const sourceConnectionId =
    input.sourceConnectionId ??
    (await repository.upsertSourceConnection({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      providerId,
      handleOrExternalRef: input.selectedArtist.spotifyArtistId,
      status: "connected",
      limitations: [PUBLIC_SPOTIFY_CATALOG_LIMITATION],
      metadata: {
        spotify_artist_id: input.selectedArtist.spotifyArtistId,
        spotify_artist_url: input.selectedArtist.spotifyUrl,
        spotify_artist_uri: input.selectedArtist.spotifyUri,
      },
    }));

  const sourceSyncJobId =
    input.sourceSyncJobId ??
    (await repository.createSourceSyncJob({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      sourceConnectionId,
      jobType: "spotify_catalog_bootstrap",
      triggerType: "setup",
      status: "running",
    }));

  await repository.writeOperatingEvent({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    eventType: "spotify_catalog_bootstrap_started",
    actorType: "integration",
    targetType: "source_connection",
    targetId: sourceConnectionId,
    sourceType: "source_sync_job",
    sourceId: sourceSyncJobId,
    summary: `Started Spotify public catalog import for ${input.selectedArtist.name}.`,
    payload: {
      spotify_artist_id: input.selectedArtist.spotifyArtistId,
      market: input.market,
    },
  });

  try {
    const snapshots = await fetchAndSnapshotSpotifyCatalog({
      input,
      spotify,
      repository,
      providerId,
      sourceConnectionId,
    });

    const result = await normalizeSpotifyCatalog({
      input,
      repository,
      providerId,
      snapshots,
    });

    const limited = snapshots.limitations.length > 0;
    await repository.updateSourceSyncJob(sourceSyncJobId, {
      status: limited ? "completed_with_limits" : "completed",
      error: limited ? snapshots.limitations.join(" ") : undefined,
    });

    await repository.writeOperatingEvent({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      eventType: limited ? "spotify_catalog_bootstrap_completed_with_limits" : "spotify_catalog_bootstrap_completed",
      actorType: "integration",
      targetType: "artist_workspace",
      targetId: input.artistWorkspaceId,
      sourceType: "source_sync_job",
      sourceId: sourceSyncJobId,
      summary: limited
        ? `Imported ${result.musicItemCount} Spotify catalog tracks and ${result.musicProjectCount} release container with Spotify public catalog limits.`
        : `Imported ${result.musicItemCount} Spotify catalog tracks and ${result.musicProjectCount} release container from public catalog metadata.`,
      payload: {
        music_item_count: result.musicItemCount,
        music_project_count: result.musicProjectCount,
        limitation: PUBLIC_SPOTIFY_CATALOG_LIMITATION,
        partial_limitations: snapshots.limitations,
      },
    });

    return limited
      ? {
          status: "completed_with_limits",
          musicItemCount: result.musicItemCount,
          musicProjectCount: result.musicProjectCount,
          sourceSyncJobId,
          error: snapshots.limitations.join(" "),
        }
      : {
          status: "completed",
          musicItemCount: result.musicItemCount,
          musicProjectCount: result.musicProjectCount,
          sourceSyncJobId,
        };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spotify catalog bootstrap failed.";

    await repository.updateSourceSyncJob(sourceSyncJobId, {
      status: "failed",
      error: message,
    });
    await repository.writeOperatingEvent({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      eventType: "spotify_catalog_bootstrap_failed",
      actorType: "integration",
      targetType: "source_connection",
      targetId: sourceConnectionId,
      sourceType: "source_sync_job",
      sourceId: sourceSyncJobId,
      summary: `Spotify public catalog import failed: ${message}`,
      payload: {
        error: message,
        spotify_artist_id: input.selectedArtist.spotifyArtistId,
      },
    });

    return {
      status: "failed",
      error: message,
      sourceSyncJobId,
    };
  }
}

async function fetchAndSnapshotSpotifyCatalog({
  input,
  spotify,
  repository,
  providerId,
  sourceConnectionId,
}: {
  input: SpotifyCatalogBootstrapInput;
  spotify: SpotifyCatalogClient;
  repository: SpotifyCatalogBootstrapRepository;
  providerId: string;
  sourceConnectionId: string;
}) {
  const artist = await spotify.getArtist(input.selectedArtist.spotifyArtistId);
  await repository.saveArtistSpotifyIdentity(createArtistIdentity(input.selectedArtist, artist));
  const artistSnapshotId = await writeSnapshot({
    input,
    repository,
    providerId,
    sourceConnectionId,
    snapshotType: "spotify_artist",
    rawRef: `spotify:artist:${artist.id}`,
    rawPayload: artist,
  });

  const [projectReleases, singleReleases] = await Promise.all([
    spotify.getArtistAlbums(input.selectedArtist.spotifyArtistId, {
      market: input.market,
      limit: 10,
      includeGroup: "album",
    }),
    spotify.getArtistAlbums(input.selectedArtist.spotifyArtistId, {
      market: input.market,
      limit: 10,
      includeGroup: "single",
    }),
  ]);
  const albumsResponse: SpotifyArtistAlbumsResponse = {
    items: uniqueReleaseSummaries([...projectReleases.items, ...singleReleases.items]),
    total: (projectReleases.total ?? projectReleases.items.length) + (singleReleases.total ?? singleReleases.items.length),
  };
  const albumsSnapshotId = await writeSnapshot({
    input,
    repository,
    providerId,
    sourceConnectionId,
    snapshotType: "spotify_artist_albums",
    rawRef: `spotify:artist:${input.selectedArtist.spotifyArtistId}:albums`,
    rawPayload: albumsResponse,
  });

  const latestAlbumSummary = selectLatestRelease(albumsResponse.items);
  const standaloneSingleSummaries = selectStandaloneSingles(albumsResponse.items, latestAlbumSummary?.id, 5);
  const limitations: string[] = [];
  let album: SpotifyAlbumPayload | undefined;
  let albumSnapshotId: string | undefined;
  let albumTracksSnapshotId: string | undefined;
  const standaloneAlbums: FetchedAlbumSnapshot[] = [];
  let audioFeaturesByTrackId: Record<string, SpotifyAudioFeaturesPayload> = {};

  if (!latestAlbumSummary) {
    limitations.push("Spotify returned no public album or single releases for this artist.");
  } else {
    try {
      album = await spotify.getAlbum(latestAlbumSummary.id, { market: input.market });
      albumSnapshotId = await writeSnapshot({
        input,
        repository,
        providerId,
        sourceConnectionId,
        snapshotType: "spotify_album",
        rawRef: `spotify:album:${album.id}`,
        rawPayload: album,
      });
      albumTracksSnapshotId = await writeSnapshot({
        input,
        repository,
        providerId,
        sourceConnectionId,
        snapshotType: "spotify_album_tracks",
        rawRef: `spotify:album:${album.id}:tracks`,
        rawPayload: {
          album_id: album.id,
          items: album.tracks?.items ?? [],
        },
      });
    } catch (error) {
      limitations.push(error instanceof Error ? error.message : "Spotify album fetch returned partial data.");
    }
  }

  for (const singleSummary of standaloneSingleSummaries) {
    try {
      const singleAlbum = await spotify.getAlbum(singleSummary.id, { market: input.market });
      const singleAlbumSnapshotId = await writeSnapshot({
        input,
        repository,
        providerId,
        sourceConnectionId,
        snapshotType: "spotify_album",
        rawRef: `spotify:album:${singleAlbum.id}`,
        rawPayload: singleAlbum,
      });
      const singleAlbumTracksSnapshotId = await writeSnapshot({
        input,
        repository,
        providerId,
        sourceConnectionId,
        snapshotType: "spotify_album_tracks",
        rawRef: `spotify:album:${singleAlbum.id}:tracks`,
        rawPayload: {
          album_id: singleAlbum.id,
          items: singleAlbum.tracks?.items ?? [],
        },
      });
      standaloneAlbums.push({
        album: singleAlbum,
        albumSnapshotId: singleAlbumSnapshotId,
        albumTracksSnapshotId: singleAlbumTracksSnapshotId,
      });
    } catch (error) {
      limitations.push(
        error instanceof Error
          ? `Spotify standalone single ${singleSummary.id} fetch failed: ${error.message}`
          : `Spotify standalone single ${singleSummary.id} fetch returned partial data.`,
      );
    }
  }

  audioFeaturesByTrackId = await fetchAudioFeaturesForTracks(spotify, [
    ...selectUniqueTracks(album?.tracks?.items ?? []),
    ...selectUniqueStandaloneTracks(
      standaloneAlbums.flatMap((singleAlbum) => singleAlbum.album.tracks?.items ?? []),
      album?.tracks?.items ?? [],
    ),
  ]);

  return {
    artist,
    albumsResponse,
    album,
    standaloneAlbums,
    audioFeaturesByTrackId,
    snapshotIds: {
      artist: artistSnapshotId,
      albums: albumsSnapshotId,
      album: albumSnapshotId,
      albumTracks: albumTracksSnapshotId,
    } satisfies SnapshotIds,
    limitations,
  };
}

async function fetchAudioFeaturesForTracks(spotify: SpotifyCatalogClient, tracks: SpotifyTrackPayload[]) {
  if (!spotify.getTrackAudioFeatures) return {};

  const entries = await Promise.all(
    tracks.map(async (track) => {
      try {
        return [track.id, await spotify.getTrackAudioFeatures?.(track.id)] as const;
      } catch {
        return [track.id, undefined] as const;
      }
    }),
  );

  return Object.fromEntries(entries.filter((entry): entry is readonly [string, SpotifyAudioFeaturesPayload] => Boolean(entry[1])));
}

async function writeSnapshot({
  input,
  repository,
  providerId,
  sourceConnectionId,
  snapshotType,
  rawRef,
  rawPayload,
}: {
  input: SpotifyCatalogBootstrapInput;
  repository: SpotifyCatalogBootstrapRepository;
  providerId: string;
  sourceConnectionId: string;
  snapshotType: SourceSnapshotDraft["snapshotType"];
  rawRef: string;
  rawPayload: unknown;
}) {
  return repository.writeSourceSnapshot({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    sourceConnectionId,
    providerId,
    sourceKind: "official_api",
    snapshotType,
    rawRef,
    rawPayload,
    metadata: {
      snapshot_type: snapshotType,
      provider: "spotify",
    },
  });
}

async function normalizeSpotifyCatalog({
  input,
  repository,
  providerId,
  snapshots,
}: {
  input: SpotifyCatalogBootstrapInput;
  repository: SpotifyCatalogBootstrapRepository;
  providerId: string;
  snapshots: Awaited<ReturnType<typeof fetchAndSnapshotSpotifyCatalog>>;
}) {
  let musicProjectCount = 0;
  const musicItemIds = new Set<string>();
  let projectId: string | undefined;

  if (snapshots.album) {
    projectId = await upsertProject({
      input,
      repository,
      providerId,
      sourceSnapshotId: snapshots.snapshotIds.album ?? snapshots.snapshotIds.albums,
      album: snapshots.album,
    });
    musicProjectCount = 1;
  }

  const projectTracks = selectUniqueTracks(snapshots.album?.tracks?.items ?? []);
  const seenTrackKeys = new Set(projectTracks.map(trackIdentityKey));

  for (const track of projectTracks) {
    const musicItemId = await upsertTrack({
      input,
      repository,
      providerId,
      sourceSnapshotId: snapshots.snapshotIds.albumTracks ?? snapshots.snapshotIds.album ?? snapshots.snapshotIds.albums,
      track,
      album: snapshots.album,
      audioFeatures: snapshots.audioFeaturesByTrackId[track.id],
    });
    musicItemIds.add(musicItemId);

    if (projectId) {
      await repository.upsertMusicProjectItem({
        musicProjectId: projectId,
        musicItemId,
        orderIndex: track.track_number ?? 0,
        discNumber: track.disc_number ?? 1,
        displayTitle: track.name,
      });
    }
  }

  for (const standaloneAlbum of snapshots.standaloneAlbums) {
    const standaloneTracks = selectUniqueTracks(standaloneAlbum.album.tracks?.items ?? []);
    for (const track of standaloneTracks) {
      const trackKey = trackIdentityKey(track);
      if (seenTrackKeys.has(trackKey)) {
        continue;
      }

      seenTrackKeys.add(trackKey);
      const musicItemId = await upsertTrack({
        input,
        repository,
        providerId,
        sourceSnapshotId: standaloneAlbum.albumTracksSnapshotId ?? standaloneAlbum.albumSnapshotId ?? snapshots.snapshotIds.albums,
        track,
        album: standaloneAlbum.album,
        audioFeatures: snapshots.audioFeaturesByTrackId[track.id],
      });
      musicItemIds.add(musicItemId);
    }
  }

  return {
    musicItemCount: musicItemIds.size,
    musicProjectCount,
  };
}

function selectUniqueTracks(albumTracks: SpotifyTrackPayload[]) {
  const selected: SpotifyTrackPayload[] = [];
  const seen = new Set<string>();

  for (const track of albumTracks) {
    const key = trackIdentityKey(track);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    selected.push(track);
  }

  return selected;
}

function selectUniqueStandaloneTracks(standaloneTracks: SpotifyTrackPayload[], projectTracks: SpotifyTrackPayload[]) {
  const projectKeys = new Set(projectTracks.map(trackIdentityKey));
  return selectUniqueTracks(standaloneTracks).filter((track) => !projectKeys.has(trackIdentityKey(track)));
}

async function upsertProject({
  input,
  repository,
  providerId,
  sourceSnapshotId,
  album,
}: {
  input: SpotifyCatalogBootstrapInput;
  repository: SpotifyCatalogBootstrapRepository;
  providerId: string;
  sourceSnapshotId: string;
  album: SpotifyAlbumPayload;
}) {
  const dedupeKeys = projectDedupeKeys(album);
  const existingProjectId = await repository.findMusicProjectByKeys(dedupeKeys);
  const dedupeKey = dedupeKeys[0] ?? `spotify_album_id:${album.id.toLowerCase()}`;
  const draft: MusicProjectDraft = {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    title: album.name,
    projectType: toProjectType(album.album_type, album.total_tracks),
    lifecycleStage: toLifecycleStage(album.release_date),
    sourceKind: "spotify_public_catalog",
    sourceLimit: PUBLIC_SPOTIFY_CATALOG_LIMITATION,
    dedupeKey,
    metadata: {
      dedupe_key: dedupeKey,
      spotify: {
        album_id: album.id,
        album_type: album.album_type,
        uri: album.uri,
        release_date: album.release_date,
        release_date_precision: album.release_date_precision,
        total_tracks: album.total_tracks,
        artists: album.artists?.map((artist) => ({ id: artist.id, name: artist.name })) ?? [],
        images: album.images ?? [],
        cover_image_url: selectImage(album.images),
        external_urls: album.external_urls ?? {},
        upc: album.external_ids?.upc,
        label: album.label,
        copyrights: normalizeCopyrights(album.copyrights),
        genres: album.genres ?? [],
        popularity: album.popularity,
      },
    },
    releasedAt: releaseDateToIso(album.release_date),
    createdByType: "integration",
  };

  const musicProjectId = existingProjectId ?? (await repository.createMusicProject(draft));
  if (existingProjectId) {
    await repository.updateMusicProject(existingProjectId, draft);
  }

  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicProjectId }, "spotify_album_id", album.id, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicProjectId }, "spotify_album_uri", album.uri, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicProjectId }, "spotify_album_url", album.external_urls?.spotify, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicProjectId }, "upc", album.external_ids?.upc, dedupeKey);

  return musicProjectId;
}

async function upsertTrack({
  input,
  repository,
  providerId,
  sourceSnapshotId,
  track,
  album,
  audioFeatures,
}: {
  input: SpotifyCatalogBootstrapInput;
  repository: SpotifyCatalogBootstrapRepository;
  providerId: string;
  sourceSnapshotId: string;
  track: SpotifyTrackPayload;
  album?: Pick<
    SpotifyAlbumPayload,
    "id" | "name" | "album_type" | "release_date" | "release_date_precision" | "images" | "external_ids" | "external_urls" | "uri" | "total_tracks" | "label" | "copyrights" | "genres"
  >;
  audioFeatures?: SpotifyAudioFeaturesPayload;
}) {
  const dedupeKeys = trackDedupeKeys(track, input.selectedArtist.name);
  const existingMusicItemId = await repository.findMusicItemByKeys(dedupeKeys);
  const dedupeKey = dedupeKeys[0] ?? `spotify_track_id:${track.id.toLowerCase()}`;
  const draft: MusicItemDraft = {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    title: track.name,
    itemType: "released_track",
    lifecycleStage: toLifecycleStage(album?.release_date),
    sourceKind: "spotify_public_catalog",
    sourceLimit: PUBLIC_SPOTIFY_CATALOG_LIMITATION,
    dedupeKey,
    metadata: {
      dedupe_key: dedupeKey,
      spotify: {
        track_id: track.id,
        uri: track.uri,
        url: track.external_urls?.spotify,
        album_id: album?.id,
        album_name: album?.name,
        album_type: album?.album_type,
        album_uri: album?.uri,
        album_url: album?.external_urls?.spotify,
        album_total_tracks: album?.total_tracks,
        release_date: album?.release_date,
        release_date_precision: album?.release_date_precision,
        duration_ms: track.duration_ms,
        explicit: track.explicit ?? false,
        track_number: track.track_number,
        disc_number: track.disc_number,
        isrc: track.external_ids?.isrc,
        upc: track.external_ids?.upc ?? album?.external_ids?.upc,
        label: album?.label,
        copyrights: normalizeCopyrights(album?.copyrights),
        genres: album?.genres ?? [],
        popularity: track.popularity,
        preview_url: track.preview_url ?? null,
        artists: track.artists?.map((artist) => ({ id: artist.id, name: artist.name })) ?? [],
        audio_features: audioFeatures,
        cover_image_url: selectImage(album?.images ?? track.album?.images),
      },
    },
    releasedAt: releaseDateToIso(album?.release_date),
    createdByType: "integration",
  };

  const musicItemId = existingMusicItemId ?? (await repository.createMusicItem(draft));
  if (existingMusicItemId) {
    await repository.updateMusicItem(existingMusicItemId, draft);
  }

  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicItemId }, "spotify_track_id", track.id, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicItemId }, "spotify_track_uri", track.uri, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicItemId }, "spotify_track_url", track.external_urls?.spotify, dedupeKey);
  await upsertIdentifier(repository, input, providerId, sourceSnapshotId, { musicItemId }, "isrc", track.external_ids?.isrc, dedupeKey);

  return musicItemId;
}

async function upsertIdentifier(
  repository: SpotifyCatalogBootstrapRepository,
  input: SpotifyCatalogBootstrapInput,
  providerId: string,
  sourceSnapshotId: string,
  owner: { musicItemId?: string; musicProjectId?: string },
  identifierType: MusicIdentifierDraft["identifierType"],
  identifierValue: string | undefined,
  dedupeKey: string,
) {
  const value = identifierValue?.trim();
  if (!value) return;

  await repository.upsertMusicIdentifier({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    ...owner,
    identifierType,
    identifierValue: value,
    dedupeKey,
    providerId,
    sourceSnapshotId,
    confidence: "medium",
  });
}

function createArtistIdentity(
  selectedArtist: SpotifyCatalogBootstrapInput["selectedArtist"],
  artist: SpotifyArtistPayload,
): SpotifyArtistIdentityDraft {
  return {
    spotifyArtistId: artist.id ?? selectedArtist.spotifyArtistId,
    name: artist.name ?? selectedArtist.name,
    spotifyUrl: artist.external_urls?.spotify ?? selectedArtist.spotifyUrl,
    spotifyUri: artist.uri ?? selectedArtist.spotifyUri,
    imageUrl: selectImage(artist.images),
    followers: artist.followers?.total,
    genres: artist.genres ?? [],
    popularity: artist.popularity,
  };
}

function selectLatestRelease(albums: SpotifyAlbumSummary[]) {
  const sorted = [...albums].sort((a, b) => releaseSortValue(b.release_date) - releaseSortValue(a.release_date));
  return sorted.find(isProjectLikeRelease) ?? sorted[0];
}

function uniqueReleaseSummaries(albums: SpotifyAlbumSummary[]) {
  return Array.from(new Map(albums.map((album) => [album.id, album])).values());
}

function selectStandaloneSingles(albums: SpotifyAlbumSummary[], selectedProjectId: string | undefined, limit: number) {
  return [...albums]
    .filter((album) => album.id !== selectedProjectId && album.album_type === "single" && (album.total_tracks ?? 0) === 1)
    .sort((a, b) => releaseSortValue(b.release_date) - releaseSortValue(a.release_date))
    .slice(0, limit);
}

function isProjectLikeRelease(album: SpotifyAlbumSummary) {
  return album.album_type === "album" || album.album_type === "compilation" || (album.total_tracks ?? 0) > 1;
}

function selectImage(images: SpotifyImage[] | undefined) {
  return [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function normalizeCopyrights(copyrights: SpotifyAlbumPayload["copyrights"] | undefined) {
  return (copyrights ?? [])
    .map((copyright) => ({
      type: copyright.type,
      text: copyright.text,
    }))
    .filter((copyright) => copyright.text);
}

function trackIdentityKey(track: SpotifyTrackPayload) {
  return track.external_ids?.isrc
    ? `isrc:${track.external_ids.isrc.toLowerCase()}`
    : track.id
      ? `spotify_track_id:${track.id.toLowerCase()}`
      : `track:${normalize(track.name)}:${track.duration_ms ?? "unknown"}`;
}

function projectDedupeKeys(album: SpotifyAlbumPayload) {
  return [
    album.id ? `spotify_album_id:${album.id}` : undefined,
    album.external_ids?.upc ? `upc:${album.external_ids.upc}` : undefined,
    `project_fallback:${normalize(album.name)}:${album.release_date ?? "unknown"}`,
  ].filter(Boolean) as string[];
}

function trackDedupeKeys(track: SpotifyTrackPayload, primaryArtistName: string) {
  return [
    track.external_ids?.isrc ? `isrc:${track.external_ids.isrc}` : undefined,
    track.id ? `spotify_track_id:${track.id}` : undefined,
    `track_fallback:${normalize(track.name)}:${track.duration_ms ?? "unknown"}:${normalize(primaryArtistName)}`,
  ].filter(Boolean) as string[];
}

function toProjectType(albumType: string | undefined, totalTracks: number | undefined): MusicProjectDraft["projectType"] {
  if (albumType === "single") return totalTracks && totalTracks > 1 ? "ep" : "single";
  if (albumType === "compilation") return "compilation";
  if (albumType === "album") return "album";
  return "other";
}

function toLifecycleStage(releaseDate: string | undefined): MusicItemDraft["lifecycleStage"] {
  if (!releaseDate) return "catalog";
  return releaseSortValue(releaseDate) > Date.now() ? "scheduled" : "released";
}

function releaseDateToIso(releaseDate: string | undefined) {
  if (!releaseDate) return undefined;
  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function releaseSortValue(releaseDate: string | undefined) {
  if (!releaseDate) return 0;
  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
