import { describe, expect, it } from "vitest";
import { mergeChartmetricProjectPayload } from "../supabase/functions/_shared/chartmetricProjectPayload";

describe("Chartmetric project payload shaping", () => {
  it("unwraps album popularity, playlist, and track response envelopes", () => {
    const payload = mergeChartmetricProjectPayload(
      {
        obj: {
          cm_album: 815685,
          name: "Release",
          cm_statistics: {
            sp_popularity: 71,
            num_sp_playlists: 629,
          },
        },
      },
      {
        spotifyPopularity: {
          obj: [
            { timestp: "2026-06-01T00:00:00.000Z", value: 70 },
            { timestp: "2026-06-02T00:00:00.000Z", value: 71 },
          ],
        },
        playlistSnapshot: {
          obj: [
            {
              playlist: {
                name: "African Heat",
                followers: 1_500_000,
                editorial: true,
                position: 4,
                added_at: "2026-05-30",
              },
              track: { name: "Colorado", cm_track: 165260603 },
            },
          ],
        },
        albumTracks: {
          obj: [
            {
              name: "Colorado",
              cm_track: 165260603,
              cm_statistics: { sp_streams: 8_203_174 },
            },
          ],
        },
        fetchWindow: { since: "2026-05-08", until: "2026-06-07" },
        supplementalErrors: {},
      },
    );

    expect(payload).toMatchObject({
      cm_album: 815685,
      name: "Release",
      _fetch_window: { since: "2026-05-08", until: "2026-06-07" },
    });
    expect(payload._spotify_popularity_history).toHaveLength(2);
    expect(payload._active_playlists).toEqual([
      expect.objectContaining({
        name: "African Heat",
        followers: 1_500_000,
        position: 4,
        added_at: "2026-05-30",
        track_name: "Colorado",
      }),
    ]);
    expect(payload._album_tracks).toEqual([
      expect.objectContaining({ name: "Colorado", cm_track: 165260603 }),
    ]);
    expect(payload).not.toHaveProperty("_spotify_stream_history");
  });
});
