import { describe, expect, it } from "vitest";
import { mergeChartmetricTrackPayload } from "../supabase/functions/_shared/chartmetricPayload";

describe("Chartmetric track payload shaping", () => {
  it("unwraps documented stats, playlist, and chart response envelopes", () => {
    const payload = mergeChartmetricTrackPayload(
      {
        obj: {
          id: 165260603,
          name: "Colorado",
          cm_statistics: { sp_streams: 8_203_174 },
        },
      },
      {
        spotifyStats: {
          obj: [
            {
              domain: "spotify",
              type: "streams",
              data: [{ timestp: "2026-06-01T00:00:00.000Z", value: 120_000 }],
            },
            {
              domain: "spotify",
              type: "streams",
              data: [{ timestp: "2026-06-02T00:00:00.000Z", value: 130_000 }],
            },
          ],
        },
        tiktokStats: {
          obj: [
            {
              domain: "tiktok",
              type: "posts",
              data: [{ timestp: "2026-06-01T00:00:00.000Z", value: 5_000 }],
            },
          ],
        },
        playlistSnapshot: {
          obj: [
            {
              added_at: "2026-05-30T00:00:00.000Z",
              playlist: {
                name: "African Heat",
                followers: 1_500_000,
                editorial: true,
              },
            },
          ],
        },
        spotifyTopCharts: {
          obj: {
            data: [
              {
                rank: 21,
                added_at: "2026-06-01T00:00:00.000Z",
                code2: "NG",
                chart_type: "regional",
              },
            ],
          },
        },
        spotifyViralCharts: {
          obj: {
            data: [
              {
                rank: 7,
                added_at: "2026-06-02T00:00:00.000Z",
                code2: "GLOBAL",
                chart_type: "viral",
              },
            ],
          },
        },
        fetchWindow: { since: "2026-05-08", until: "2026-06-07" },
        supplementalErrors: {},
      },
    );

    expect(payload).toMatchObject({
      id: 165260603,
      name: "Colorado",
      cm_statistics: { sp_streams: 8_203_174 },
      _fetch_window: { since: "2026-05-08", until: "2026-06-07" },
    });
    expect(payload._spotify_stream_history).toEqual([
      { timestp: "2026-06-01T00:00:00.000Z", value: 120_000 },
      { timestp: "2026-06-02T00:00:00.000Z", value: 130_000 },
    ]);
    expect(payload._tiktok_activity).toEqual([
      { timestp: "2026-06-01T00:00:00.000Z", value: 5_000 },
    ]);
    expect(payload._active_playlists).toEqual([
      expect.objectContaining({
        name: "African Heat",
        followers: 1_500_000,
        editorial: true,
        added_at: "2026-05-30T00:00:00.000Z",
      }),
    ]);
    expect(payload._chart_history).toHaveLength(2);
    expect(payload._chart_history).toEqual([
      expect.objectContaining({
        chart_name: "regional",
        platform: "spotify",
        date: "2026-06-01T00:00:00.000Z",
        country: "NG",
      }),
      expect.objectContaining({
        chart_name: "viral",
        platform: "spotify",
        date: "2026-06-02T00:00:00.000Z",
        country: "GLOBAL",
      }),
    ]);
  });

  it("keeps provider failures available for coverage diagnostics", () => {
    const payload = mergeChartmetricTrackPayload(
      { obj: { id: 1, name: "Track" } },
      {
        spotifyStats: undefined,
        tiktokStats: undefined,
        playlistSnapshot: undefined,
        spotifyTopCharts: undefined,
        spotifyViralCharts: undefined,
        fetchWindow: { since: "2026-05-08", until: "2026-06-07" },
        supplementalErrors: {
          spotifyStats: "Chartmetric request failed with status 429.",
        },
      },
    );

    expect(payload._supplemental_errors).toEqual({
      spotifyStats: "Chartmetric request failed with status 429.",
    });
  });
});
