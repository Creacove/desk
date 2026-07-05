import { describe, expect, it } from "vitest";
import {
  importSpotifyAlbumAsProject,
  importSpotifyTrackAsSong,
  type MusicIdentifierDraft,
  type MusicItemDraft,
  type MusicProjectDraft,
  type OperatingEventDraft,
  type SourceConnectionDraft,
  type SourceSnapshotDraft,
  type SourceSyncJobDraft,
  type SpotifyAlbumPayload,
  type SpotifyCatalogBootstrapInput,
  type SpotifyCatalogBootstrapRepository,
  type SpotifyCatalogClient,
} from "../supabase/functions/_shared/spotifyCatalogBootstrap";

const input: SpotifyCatalogBootstrapInput = {
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

function nightBusAlbum(): SpotifyAlbumPayload {
  return {
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
          preview_url: null,
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
  };
}

function createSpotify(overrides: Partial<SpotifyCatalogClient> = {}): SpotifyCatalogClient {
  return {
    getArtist: async () => ({ id: "spotify-artist-1", name: "Sable Day" }),
    getArtistAlbums: async () => ({ items: [], total: 0 }),
    getAlbum: async () => nightBusAlbum(),
    getTrackAudioFeatures: async (trackId: string) => ({ id: trackId, mode: 1 }),
    ...overrides,
  };
}

describe("Spotify single-selection import", () => {
  it("imports an album as a project with all tracks linked and identifiers written", async () => {
    const repo = new InMemoryRepo();

    const result = await importSpotifyAlbumAsProject({ input, spotify: createSpotify(), repository: repo, album: nightBusAlbum() });

    expect(result).toMatchObject({ musicProjectId: "music_project-1", importedTrackCount: 2, alreadyExisted: false });
    expect(repo.musicProjects).toHaveLength(1);
    expect(repo.musicProjects[0]).toMatchObject({ title: "Night Bus", projectType: "album", sourceKind: "spotify_public_catalog" });
    expect(repo.musicItems.map((item) => item.title).sort()).toEqual(["After Hours", "Night Bus"]);
    expect(repo.projectItems).toHaveLength(2);
    expect(repo.projectItems.every((row) => row.musicProjectId === "music_project-1")).toBe(true);
    expect(repo.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identifierType: "spotify_album_id", identifierValue: "album-1" }),
        expect.objectContaining({ identifierType: "upc", identifierValue: "012345678901" }),
        expect.objectContaining({ identifierType: "spotify_track_id", identifierValue: "track-1" }),
        expect.objectContaining({ identifierType: "isrc", identifierValue: "USRC17607839" }),
      ]),
    );
    // Provenance snapshots recorded for the album and its tracks.
    expect(repo.snapshots.map((snapshot) => snapshot.snapshotType)).toEqual(["spotify_album", "spotify_album_tracks"]);
  });

  it("dedupes an album project and its tracks when imported twice", async () => {
    const repo = new InMemoryRepo();
    const spotify = createSpotify();

    await importSpotifyAlbumAsProject({ input, spotify, repository: repo, album: nightBusAlbum() });
    const second = await importSpotifyAlbumAsProject({ input, spotify, repository: repo, album: nightBusAlbum() });

    expect(second.alreadyExisted).toBe(true);
    expect(repo.musicProjects).toHaveLength(1);
    expect(repo.musicItems).toHaveLength(2);
    expect(repo.projectItems).toHaveLength(2);
    expect(repo.identifiers.filter((identifier) => identifier.identifierType === "spotify_track_id")).toHaveLength(2);
  });

  it("imports a single track as a standalone song without a project link", async () => {
    const repo = new InMemoryRepo();

    const result = await importSpotifyTrackAsSong({ input, spotify: createSpotify(), repository: repo, album: nightBusAlbum(), trackId: "track-2" });

    expect(result).toMatchObject({ musicItemId: "music_item-1", alreadyExisted: false });
    expect(repo.musicItems.map((item) => item.title)).toEqual(["After Hours"]);
    expect(repo.musicProjects).toHaveLength(0);
    expect(repo.projectItems).toHaveLength(0);
    expect(repo.identifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ identifierType: "spotify_track_id", identifierValue: "track-2" }),
        expect.objectContaining({ identifierType: "isrc", identifierValue: "USRC17607840" }),
      ]),
    );
  });

  it("reports alreadyExisted when the same track is imported twice", async () => {
    const repo = new InMemoryRepo();
    const spotify = createSpotify();

    await importSpotifyTrackAsSong({ input, spotify, repository: repo, album: nightBusAlbum(), trackId: "track-1" });
    const second = await importSpotifyTrackAsSong({ input, spotify, repository: repo, album: nightBusAlbum(), trackId: "track-1" });

    expect(second.alreadyExisted).toBe(true);
    expect(repo.musicItems).toHaveLength(1);
  });

  it("throws when the requested track is not on the album", async () => {
    const repo = new InMemoryRepo();

    await expect(
      importSpotifyTrackAsSong({ input, spotify: createSpotify(), repository: repo, album: nightBusAlbum(), trackId: "missing" }),
    ).rejects.toThrow("was not found on Spotify album");
  });
});

class InMemoryRepo implements SpotifyCatalogBootstrapRepository {
  readonly sourceConnections: SourceConnectionDraft[] = [];
  readonly snapshots: SourceSnapshotDraft[] = [];
  readonly musicItems: MusicItemDraft[] = [];
  readonly musicProjects: MusicProjectDraft[] = [];
  readonly projectItems: Array<{ musicProjectId: string; musicItemId: string; orderIndex: number; discNumber: number; displayTitle: string }> = [];
  readonly identifiers: MusicIdentifierDraft[] = [];

  async getSpotifyProviderId() {
    return "provider-spotify";
  }
  async saveArtistSpotifyIdentity() {}
  async upsertSourceConnection(draft: SourceConnectionDraft) {
    const existing = this.sourceConnections.find((connection) => connection.handleOrExternalRef === draft.handleOrExternalRef);
    if (existing) return "source_connection-1";
    this.sourceConnections.push(draft);
    return "source_connection-1";
  }
  async createSourceSyncJob(_draft: SourceSyncJobDraft) {
    return "sync_job-1";
  }
  async updateSourceSyncJob() {}
  async writeSourceSnapshot(draft: SourceSnapshotDraft) {
    this.snapshots.push(draft);
    return `snapshot-${this.snapshots.length}`;
  }
  async findMusicProjectByKeys(keys: string[]) {
    const existing = this.identifiers.find((identifier) => keys.includes(identifier.dedupeKey) && identifier.musicProjectId);
    if (existing?.musicProjectId) return existing.musicProjectId;
    return this.musicProjects.find((project) => keys.includes(project.dedupeKey))?.id ?? null;
  }
  async createMusicProject(draft: MusicProjectDraft) {
    const id = `music_project-${this.musicProjects.length + 1}`;
    this.musicProjects.push({ ...draft, id });
    return id;
  }
  async updateMusicProject(id: string, draft: MusicProjectDraft) {
    const index = this.musicProjects.findIndex((project) => project.id === id);
    if (index >= 0) this.musicProjects[index] = { ...this.musicProjects[index], ...draft, id };
  }
  async findMusicItemByKeys(keys: string[]) {
    const existing = this.identifiers.find((identifier) => keys.includes(identifier.dedupeKey) && identifier.musicItemId);
    if (existing?.musicItemId) return existing.musicItemId;
    return this.musicItems.find((item) => keys.includes(item.dedupeKey))?.id ?? null;
  }
  async createMusicItem(draft: MusicItemDraft) {
    const id = `music_item-${this.musicItems.length + 1}`;
    this.musicItems.push({ ...draft, id });
    return id;
  }
  async updateMusicItem(id: string, draft: MusicItemDraft) {
    const index = this.musicItems.findIndex((item) => item.id === id);
    if (index >= 0) this.musicItems[index] = { ...this.musicItems[index], ...draft, id };
  }
  async upsertMusicProjectItem(draft: { musicProjectId: string; musicItemId: string; orderIndex: number; discNumber: number; displayTitle: string }) {
    const existing = this.projectItems.find((row) => row.musicProjectId === draft.musicProjectId && row.musicItemId === draft.musicItemId);
    if (existing) {
      Object.assign(existing, draft);
      return;
    }
    this.projectItems.push(draft);
  }
  async upsertMusicIdentifier(draft: MusicIdentifierDraft) {
    const existing = this.identifiers.find(
      (identifier) => identifier.identifierType === draft.identifierType && identifier.identifierValue === draft.identifierValue,
    );
    if (existing) {
      Object.assign(existing, draft);
      return;
    }
    this.identifiers.push(draft);
  }
  async writeOperatingEvent(_draft: OperatingEventDraft) {}
}
