import { describe, expect, it } from "vitest";
import {
  PUBLIC_SPOTIFY_CATALOG_LIMITATION,
  bootstrapSpotifyCatalog,
  type SpotifyCatalogBootstrapInput,
  type SpotifyCatalogBootstrapRepository,
  type SpotifyCatalogClient,
} from "../supabase/functions/_shared/spotifyCatalogBootstrap";
import type {
  MusicIdentifierDraft,
  MusicItemDraft,
  MusicProjectDraft,
  OperatingEventDraft,
  SourceConnectionDraft,
  SourceSnapshotDraft,
  SourceSyncJobDraft,
} from "../supabase/functions/_shared/spotifyCatalogBootstrap";

const baseInput: SpotifyCatalogBootstrapInput = {
  accountId: "account-1",
  artistWorkspaceId: "workspace-1",
  artistId: "artist-1",
  selectedArtist: {
    spotifyArtistId: "spotify-artist-1",
    name: "Sable Day",
    spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
    spotifyUri: "spotify:artist:spotify-artist-1",
  },
  market: "US",
};

describe("Spotify catalog bootstrap", () => {
  it("stores raw snapshots before creating normalized Music records", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();

    const result = await bootstrapSpotifyCatalog({
      input: baseInput,
      spotify: createSpotifyClient(),
      repository: repo,
    });

    expect(result.status).toBe("completed");
    expect(repo.sourceConnections).toHaveLength(1);
    expect(repo.sourceConnections[0]).toMatchObject({
      handleOrExternalRef: "spotify-artist-1",
      limitations: [PUBLIC_SPOTIFY_CATALOG_LIMITATION],
      status: "connected",
    });
    expect(repo.savedArtistIdentity).toEqual({
      spotifyArtistId: "spotify-artist-1",
      name: "Sable Day",
      spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
      spotifyUri: "spotify:artist:spotify-artist-1",
      imageUrl: "https://i.scdn.co/image/artist",
      followers: 24000,
      genres: ["alt-pop"],
      popularity: 51,
    });
    expect(repo.syncJobs[0]).toMatchObject({
      jobType: "spotify_catalog_bootstrap",
      status: "running",
    });

    expect(repo.snapshots.map((snapshot) => snapshot.snapshotType)).toEqual([
      "spotify_artist",
      "spotify_artist_albums",
      "spotify_album",
      "spotify_album_tracks",
    ]);

    const firstMusicWrite = repo.callLog.findIndex((entry) => entry.startsWith("music:"));
    const lastSnapshotWrite = repo.callLog.map((entry) => entry.startsWith("snapshot:")).lastIndexOf(true);
    expect(lastSnapshotWrite).toBeGreaterThan(-1);
    expect(firstMusicWrite).toBeGreaterThan(lastSnapshotWrite);

    expect(repo.musicProjects).toHaveLength(1);
    expect(repo.musicProjects[0]).toMatchObject({
      title: "Night Bus",
      projectType: "album",
      lifecycleStage: "released",
      sourceKind: "spotify_public_catalog",
      sourceLimit: PUBLIC_SPOTIFY_CATALOG_LIMITATION,
    });

    expect(repo.musicItems.map((item) => item.title).sort()).toEqual(["After Hours", "Night Bus"]);
    expect(repo.projectItems).toEqual([
      {
        musicProjectId: "music_project-1",
        musicItemId: "music_item-1",
        orderIndex: 1,
        discNumber: 1,
        displayTitle: "Night Bus",
      },
      {
        musicProjectId: "music_project-1",
        musicItemId: "music_item-2",
        orderIndex: 2,
        discNumber: 1,
        displayTitle: "After Hours",
      },
    ]);

    expect(repo.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identifierType: "spotify_album_id", identifierValue: "album-1" }),
        expect.objectContaining({ identifierType: "spotify_album_uri", identifierValue: "spotify:album:album-1" }),
        expect.objectContaining({ identifierType: "spotify_album_url", identifierValue: "https://open.spotify.com/album/album-1" }),
        expect.objectContaining({ identifierType: "upc", identifierValue: "012345678901" }),
        expect.objectContaining({ identifierType: "spotify_track_id", identifierValue: "track-1" }),
        expect.objectContaining({ identifierType: "spotify_track_uri", identifierValue: "spotify:track:track-1" }),
        expect.objectContaining({ identifierType: "spotify_track_url", identifierValue: "https://open.spotify.com/track/track-1" }),
        expect.objectContaining({ identifierType: "isrc", identifierValue: "USRC17607839" }),
      ]),
    );

    const trackWithNullPreview = repo.musicItems.find((item) => item.title === "After Hours");
    expect(trackWithNullPreview?.metadata.spotify.preview_url).toBeNull();
    expect(trackWithNullPreview?.metadata.spotify.cover_image_url).toBe("https://i.scdn.co/image/album");
    expect(trackWithNullPreview?.metadata.spotify.upc).toBe("012345678901");
    expect(trackWithNullPreview?.metadata.spotify.label).toBe("Moonlit Records");
    expect(trackWithNullPreview?.metadata.spotify.copyrights).toEqual([{ type: "P", text: "2026 Moonlit Records" }]);
    expect(trackWithNullPreview?.metadata.spotify.audio_features).toMatchObject({ mode: 0 });
    expect(repo.musicProjects[0]?.metadata.spotify.cover_image_url).toBe("https://i.scdn.co/image/album");
    expect(repo.musicProjects[0]?.metadata.spotify.label).toBe("Moonlit Records");
    expect(repo.musicProjects[0]?.metadata.spotify.copyrights).toEqual([{ type: "P", text: "2026 Moonlit Records" }]);
    expect(JSON.stringify(repo.musicItems.map((item) => item.metadata.spotify))).not.toMatch(/source-of-stream|revenue|conversion|audio_download/i);
    expect(repo.operatingEvents.at(-1)).toMatchObject({
      eventType: "spotify_catalog_bootstrap_completed",
      summary: "Imported 2 Spotify catalog tracks and 1 release container from public catalog metadata.",
    });
  });

  it("dedupes tracks, projects, identifiers, and tracklist rows when rerun", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const spotify = createSpotifyClient();

    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });
    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(repo.musicItems).toHaveLength(2);
    expect(repo.musicProjects).toHaveLength(1);
    expect(repo.projectItems).toHaveLength(2);
    expect(repo.identifiers.filter((identifier) => identifier.identifierType === "spotify_track_id")).toHaveLength(2);
    expect(repo.identifiers.filter((identifier) => identifier.identifierType === "spotify_album_id")).toHaveLength(1);
    expect(repo.operatingEvents.filter((event) => event.eventType === "spotify_catalog_bootstrap_completed")).toHaveLength(2);
  });

  it("preserves provider identifier case in persisted dedupe keys", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();

    await bootstrapSpotifyCatalog({ input: baseInput, spotify: createSpotifyClient(), repository: repo });

    expect(repo.musicProjects[0]?.dedupeKey).toBe("spotify_album_id:album-1");
    expect(repo.musicItems[0]?.dedupeKey).toBe("isrc:USRC17607839");
  });

  it("prefers the latest project-like release before falling back to newer singles", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const spotify = createSpotifyClient({
      getArtistAlbums: async () => ({
        items: [
          {
            id: "single-new",
            name: "Quick Signal",
            album_type: "single",
            release_date: "2026-05-01",
            release_date_precision: "day",
            total_tracks: 1,
            uri: "spotify:album:single-new",
            external_urls: { spotify: "https://open.spotify.com/album/single-new" },
            images: [],
          },
          {
            id: "album-1",
            name: "Night Bus",
            album_type: "album",
            release_date: "2026-04-12",
            release_date_precision: "day",
            total_tracks: 2,
            uri: "spotify:album:album-1",
            external_urls: { spotify: "https://open.spotify.com/album/album-1" },
            images: [],
          },
        ],
        total: 2,
      }),
    });

    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(repo.musicProjects[0]?.title).toBe("Night Bus");
  });

  it("requests Spotify albums within the documented limit and imports every track from the latest project", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const albumOptions: Array<{ market?: string; limit: number; includeGroup: "album" | "single" }> = [];
    const spotify = createSpotifyClient({
      getArtistAlbums: async (_artistId, options) => {
        albumOptions.push(options);
        return {
          items: [
            {
              id: "album-1",
              name: "Night Bus",
              album_type: "album",
              release_date: "2026-04-12",
              release_date_precision: "day",
              total_tracks: 7,
              uri: "spotify:album:album-1",
              external_urls: { spotify: "https://open.spotify.com/album/album-1" },
              images: [],
            },
          ],
          total: 1,
        };
      },
      getAlbum: async () => ({
        id: "album-1",
        name: "Night Bus",
        album_type: "album",
        release_date: "2026-04-12",
        release_date_precision: "day",
        total_tracks: 7,
        uri: "spotify:album:album-1",
        external_urls: { spotify: "https://open.spotify.com/album/album-1" },
        images: [],
        external_ids: { upc: "012345678901" },
        label: "Moonlit Records",
        copyrights: [{ type: "P", text: "2026 Moonlit Records" }],
        tracks: {
          items: Array.from({ length: 7 }, (_, index) => ({
            id: `album-track-${index + 1}`,
            name: `Album Track ${index + 1}`,
            duration_ms: 180000 + index,
            explicit: false,
            track_number: index + 1,
            disc_number: 1,
            uri: `spotify:track:album-track-${index + 1}`,
            external_urls: { spotify: `https://open.spotify.com/track/album-track-${index + 1}` },
            preview_url: null,
            external_ids: { isrc: `USRC1760784${index}` },
            artists: [{ id: "spotify-artist-1", name: "Sable Day" }],
          })),
        },
      }),
    });

    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(albumOptions).toEqual([
      { market: "US", limit: 10, includeGroup: "album" },
      { market: "US", limit: 10, includeGroup: "single" },
    ]);
    expect(repo.musicProjects.map((project) => project.title)).toEqual(["Night Bus"]);
    expect(repo.musicItems.map((item) => item.title)).toEqual([
      "Album Track 1",
      "Album Track 2",
      "Album Track 3",
      "Album Track 4",
      "Album Track 5",
      "Album Track 6",
      "Album Track 7",
    ]);
    expect(repo.projectItems).toHaveLength(7);
    expect(repo.projectItems.map((item) => item.orderIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("imports up to five recent standalone singles without creating project tracklist rows for them", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const requestedAlbums: string[] = [];
    const albumSummaries = [
      {
        id: "single-6",
        name: "Sixth Signal",
        album_type: "single",
        release_date: "2026-06-06",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-6",
        external_urls: { spotify: "https://open.spotify.com/album/single-6" },
        images: [],
      },
      {
        id: "single-5",
        name: "Fifth Signal",
        album_type: "single",
        release_date: "2026-06-05",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-5",
        external_urls: { spotify: "https://open.spotify.com/album/single-5" },
        images: [],
      },
      {
        id: "single-4",
        name: "Fourth Signal",
        album_type: "single",
        release_date: "2026-06-04",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-4",
        external_urls: { spotify: "https://open.spotify.com/album/single-4" },
        images: [],
      },
      {
        id: "single-3",
        name: "Third Signal",
        album_type: "single",
        release_date: "2026-06-03",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-3",
        external_urls: { spotify: "https://open.spotify.com/album/single-3" },
        images: [],
      },
      {
        id: "single-2",
        name: "Second Signal",
        album_type: "single",
        release_date: "2026-06-02",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-2",
        external_urls: { spotify: "https://open.spotify.com/album/single-2" },
        images: [],
      },
      {
        id: "single-1",
        name: "First Signal",
        album_type: "single",
        release_date: "2026-06-01",
        release_date_precision: "day",
        total_tracks: 1,
        uri: "spotify:album:single-1",
        external_urls: { spotify: "https://open.spotify.com/album/single-1" },
        images: [],
      },
      {
        id: "album-1",
        name: "Night Bus",
        album_type: "album",
        release_date: "2026-04-12",
        release_date_precision: "day",
        total_tracks: 2,
        uri: "spotify:album:album-1",
        external_urls: { spotify: "https://open.spotify.com/album/album-1" },
        images: [],
      },
    ];
    const spotify = createSpotifyClient({
      getArtistAlbums: async () => ({ items: albumSummaries, total: albumSummaries.length }),
      getAlbum: async (albumId) => {
        requestedAlbums.push(albumId);
        if (albumId === "album-1") {
          return createAlbumPayload(albumId, "Night Bus", "album", 2);
        }

        const summary = albumSummaries.find((album) => album.id === albumId);
        return createAlbumPayload(albumId, summary?.name ?? albumId, "single", 1, summary?.release_date);
      },
    });

    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(requestedAlbums).toEqual(["album-1", "single-6", "single-5", "single-4", "single-3", "single-2"]);
    expect(repo.musicProjects.map((project) => project.title)).toEqual(["Night Bus"]);
    expect(repo.musicItems.map((item) => item.title)).toEqual([
      "Night Bus Track 1",
      "Night Bus Track 2",
      "Sixth Signal Track 1",
      "Fifth Signal Track 1",
      "Fourth Signal Track 1",
      "Third Signal Track 1",
      "Second Signal Track 1",
    ]);
    expect(repo.projectItems).toHaveLength(2);
    expect(repo.projectItems.map((item) => item.displayTitle)).toEqual(["Night Bus Track 1", "Night Bus Track 2"]);
  });

  it("dedupes standalone singles against project tracks by track identity", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const spotify = createSpotifyClient({
      getArtistAlbums: async () => ({
        items: [
          {
            id: "single-duplicate",
            name: "Night Bus Radio Edit",
            album_type: "single",
            release_date: "2026-05-01",
            release_date_precision: "day",
            total_tracks: 1,
            uri: "spotify:album:single-duplicate",
            external_urls: { spotify: "https://open.spotify.com/album/single-duplicate" },
            images: [],
          },
          {
            id: "album-1",
            name: "Night Bus",
            album_type: "album",
            release_date: "2026-04-12",
            release_date_precision: "day",
            total_tracks: 2,
            uri: "spotify:album:album-1",
            external_urls: { spotify: "https://open.spotify.com/album/album-1" },
            images: [],
          },
        ],
        total: 2,
      }),
      getAlbum: async (albumId) => {
        if (albumId === "single-duplicate") {
          return {
            ...createAlbumPayload(albumId, "Night Bus Radio Edit", "single", 1, "2026-05-01"),
            tracks: {
              items: [
                {
                  id: "track-duplicate",
                  name: "Night Bus Radio Edit",
                  duration_ms: 184000,
                  explicit: false,
                  track_number: 1,
                  disc_number: 1,
                  uri: "spotify:track:track-duplicate",
                  external_urls: { spotify: "https://open.spotify.com/track/track-duplicate" },
                  preview_url: null,
                  external_ids: { isrc: "USRC17607839" },
                  artists: [{ id: "spotify-artist-1", name: "Sable Day" }],
                },
              ],
            },
          };
        }

        return createSpotifyClient().getAlbum(albumId, { market: "US" });
      },
    });

    await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(repo.musicItems.map((item) => item.title)).toEqual(["Night Bus", "After Hours"]);
    expect(repo.projectItems).toHaveLength(2);
  });

  it("marks partial imports completed with limits when optional catalog calls fail after snapshots exist", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const spotify = createSpotifyClient({
      getAlbum: async () => {
        throw new Error("Spotify album endpoint returned partial data.");
      },
    });

    const result = await bootstrapSpotifyCatalog({ input: baseInput, spotify, repository: repo });

    expect(result.status).toBe("completed_with_limits");
    expect(repo.musicItems).toHaveLength(0);
    expect(repo.musicProjects).toHaveLength(0);
    expect(repo.syncJobUpdates.at(-1)).toMatchObject({
      status: "completed_with_limits",
      error: "Spotify album endpoint returned partial data.",
    });
    expect(repo.operatingEvents.at(-1)).toMatchObject({
      eventType: "spotify_catalog_bootstrap_completed_with_limits",
    });
  });

  it("marks the sync job failed when Spotify calls fail after setup is saved", async () => {
    const repo = new InMemorySpotifyBootstrapRepository();
    const spotify = createSpotifyClient({
      getArtistAlbums: async () => {
        throw new Error("Spotify rate limited the catalog request.");
      },
    });

    const result = await bootstrapSpotifyCatalog({
      input: baseInput,
      spotify,
      repository: repo,
    });

    expect(result.status).toBe("failed");
    expect(repo.sourceConnections).toHaveLength(1);
    expect(repo.syncJobUpdates.at(-1)).toMatchObject({
      id: "sync_job-1",
      status: "failed",
      error: "Spotify rate limited the catalog request.",
    });
    expect(repo.musicItems).toHaveLength(0);
    expect(repo.operatingEvents.at(-1)).toMatchObject({
      eventType: "spotify_catalog_bootstrap_failed",
    });
  });
});

function createSpotifyClient(overrides: Partial<SpotifyCatalogClient> = {}): SpotifyCatalogClient {
  return {
    getArtist: async () => ({
      id: "spotify-artist-1",
      name: "Sable Day",
      uri: "spotify:artist:spotify-artist-1",
      external_urls: { spotify: "https://open.spotify.com/artist/spotify-artist-1" },
      images: [{ url: "https://i.scdn.co/image/artist", width: 640, height: 640 }],
      genres: ["alt-pop"],
      popularity: 51,
      followers: { total: 24000 },
    }),
    getArtistAlbums: async () => ({
      items: [
        {
          id: "album-old",
          name: "Old Lights",
          album_type: "album",
          release_date: "2024-04-01",
          release_date_precision: "day",
          total_tracks: 9,
          uri: "spotify:album:album-old",
          external_urls: { spotify: "https://open.spotify.com/album/album-old" },
          images: [],
        },
        {
          id: "album-1",
          name: "Night Bus",
          album_type: "album",
          release_date: "2026-04-12",
          release_date_precision: "day",
          total_tracks: 2,
          uri: "spotify:album:album-1",
          external_urls: { spotify: "https://open.spotify.com/album/album-1" },
          images: [{ url: "https://i.scdn.co/image/album", width: 640, height: 640 }],
        },
      ],
      total: 2,
    }),
    getAlbum: async () => ({
      id: "album-1",
      name: "Night Bus",
      album_type: "album",
      release_date: "2026-04-12",
      release_date_precision: "day",
      total_tracks: 2,
      uri: "spotify:album:album-1",
      external_urls: { spotify: "https://open.spotify.com/album/album-1" },
      images: [{ url: "https://i.scdn.co/image/album", width: 640, height: 640 }],
      external_ids: { upc: "012345678901" },
      label: "Moonlit Records",
      copyrights: [{ type: "P", text: "2026 Moonlit Records" }],
      tracks: {
        items: [
          {
            id: "track-1",
            name: "Night Bus",
            duration_ms: 184000,
            explicit: false,
            track_number: 1,
            disc_number: 1,
            uri: "spotify:track:track-1",
            external_urls: { spotify: "https://open.spotify.com/track/track-1" },
            preview_url: "https://p.scdn.co/mp3-preview/night-bus",
            external_ids: { isrc: "USRC17607839" },
            artists: [{ id: "spotify-artist-1", name: "Sable Day" }],
          },
          {
            id: "track-2",
            name: "After Hours",
            duration_ms: 201000,
            explicit: true,
            track_number: 2,
            disc_number: 1,
            uri: "spotify:track:track-2",
            external_urls: { spotify: "https://open.spotify.com/track/track-2" },
            preview_url: null,
            external_ids: { isrc: "USRC17607840" },
            artists: [{ id: "spotify-artist-1", name: "Sable Day" }],
          },
        ],
      },
    }),
    getTrackAudioFeatures: async (trackId: string) => ({
      id: trackId,
      mode: trackId === "track-2" ? 0 : 1,
    }),
    ...overrides,
  };
}

function createAlbumPayload(id: string, name: string, albumType: "album" | "single", totalTracks: number, releaseDate = "2026-04-12") {
  return {
    id,
    name,
    album_type: albumType,
    release_date: releaseDate,
    release_date_precision: "day",
    total_tracks: totalTracks,
    uri: `spotify:album:${id}`,
    external_urls: { spotify: `https://open.spotify.com/album/${id}` },
    images: [],
    external_ids: { upc: `upc-${id}` },
    label: "Moonlit Records",
    copyrights: [{ type: "P", text: "2026 Moonlit Records" }],
    tracks: {
      items: Array.from({ length: totalTracks }, (_, index) => ({
        id: `${id}-track-${index + 1}`,
        name: `${name} Track ${index + 1}`,
        duration_ms: 180000 + index,
        explicit: false,
        track_number: index + 1,
        disc_number: 1,
        uri: `spotify:track:${id}-track-${index + 1}`,
        external_urls: { spotify: `https://open.spotify.com/track/${id}-track-${index + 1}` },
        preview_url: null,
        external_ids: { isrc: `isrc-${id}-${index + 1}` },
        artists: [{ id: "spotify-artist-1", name: "Sable Day" }],
      })),
    },
  };
}

class InMemorySpotifyBootstrapRepository implements SpotifyCatalogBootstrapRepository {
  readonly callLog: string[] = [];
  savedArtistIdentity: unknown;
  readonly sourceConnections: SourceConnectionDraft[] = [];
  readonly syncJobs: SourceSyncJobDraft[] = [];
  readonly syncJobUpdates: Array<{ id: string; status: string; error?: string }> = [];
  readonly snapshots: SourceSnapshotDraft[] = [];
  readonly musicItems: MusicItemDraft[] = [];
  readonly musicProjects: MusicProjectDraft[] = [];
  readonly projectItems: Array<{ musicProjectId: string; musicItemId: string; orderIndex: number; discNumber: number; displayTitle: string }> = [];
  readonly identifiers: MusicIdentifierDraft[] = [];
  readonly operatingEvents: OperatingEventDraft[] = [];

  async getSpotifyProviderId() {
    return "provider-spotify";
  }

  async saveArtistSpotifyIdentity(identity: unknown) {
    this.callLog.push("artist:spotify_identity");
    this.savedArtistIdentity = identity;
  }

  async upsertSourceConnection(draft: SourceConnectionDraft) {
    this.callLog.push("source_connection:upsert");
    const existing = this.sourceConnections.find((connection) => connection.handleOrExternalRef === draft.handleOrExternalRef);
    if (existing) {
      Object.assign(existing, draft);
      return "source_connection-1";
    }
    this.sourceConnections.push(draft);
    return "source_connection-1";
  }

  async createSourceSyncJob(draft: SourceSyncJobDraft) {
    this.callLog.push("sync_job:create");
    this.syncJobs.push(draft);
    return "sync_job-1";
  }

  async updateSourceSyncJob(id: string, patch: { status: "completed" | "completed_with_limits" | "failed"; error?: string }) {
    this.callLog.push(`sync_job:${patch.status}`);
    this.syncJobUpdates.push({ id, ...patch });
  }

  async writeSourceSnapshot(draft: SourceSnapshotDraft) {
    this.callLog.push(`snapshot:${draft.snapshotType}`);
    this.snapshots.push(draft);
    return `snapshot-${this.snapshots.length}`;
  }

  async findMusicProjectByKeys(keys: string[]) {
    const existingIdentifier = this.identifiers.find((identifier) => keys.includes(identifier.dedupeKey) && identifier.musicProjectId);
    if (existingIdentifier) {
      return existingIdentifier.musicProjectId ?? null;
    }

    const existingProject = this.musicProjects.find((project) => keys.includes(project.dedupeKey));
    return existingProject?.id ?? null;
  }

  async createMusicProject(draft: MusicProjectDraft) {
    this.callLog.push(`music:project:${draft.title}`);
    const id = `music_project-${this.musicProjects.length + 1}`;
    this.musicProjects.push({ ...draft, id });
    return id;
  }

  async updateMusicProject(id: string, draft: MusicProjectDraft) {
    this.callLog.push(`music:project_update:${draft.title}`);
    const index = this.musicProjects.findIndex((project) => project.id === id);
    if (index >= 0) {
      this.musicProjects[index] = { ...this.musicProjects[index], ...draft, id };
    }
  }

  async findMusicItemByKeys(keys: string[]) {
    const existingIdentifier = this.identifiers.find((identifier) => keys.includes(identifier.dedupeKey) && identifier.musicItemId);
    if (existingIdentifier) {
      return existingIdentifier.musicItemId ?? null;
    }

    const existingItem = this.musicItems.find((item) => keys.includes(item.dedupeKey));
    return existingItem?.id ?? null;
  }

  async createMusicItem(draft: MusicItemDraft) {
    this.callLog.push(`music:item:${draft.title}`);
    const id = `music_item-${this.musicItems.length + 1}`;
    this.musicItems.push({ ...draft, id });
    return id;
  }

  async updateMusicItem(id: string, draft: MusicItemDraft) {
    this.callLog.push(`music:item_update:${draft.title}`);
    const index = this.musicItems.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.musicItems[index] = { ...this.musicItems[index], ...draft, id };
    }
  }

  async upsertMusicProjectItem(draft: { musicProjectId: string; musicItemId: string; orderIndex: number; discNumber: number; displayTitle: string }) {
    this.callLog.push(`music:project_item:${draft.musicProjectId}:${draft.musicItemId}`);
    const existing = this.projectItems.find((item) => item.musicProjectId === draft.musicProjectId && item.musicItemId === draft.musicItemId);
    if (existing) {
      Object.assign(existing, draft);
      return;
    }
    this.projectItems.push(draft);
  }

  async upsertMusicIdentifier(draft: MusicIdentifierDraft) {
    this.callLog.push(`music:identifier:${draft.identifierType}:${draft.identifierValue}`);
    const existing = this.identifiers.find(
      (identifier) => identifier.identifierType === draft.identifierType && identifier.identifierValue === draft.identifierValue,
    );
    if (existing) {
      Object.assign(existing, draft);
      return;
    }
    this.identifiers.push(draft);
  }

  async writeOperatingEvent(draft: OperatingEventDraft) {
    this.callLog.push(`event:${draft.eventType}`);
    this.operatingEvents.push(draft);
  }
}
