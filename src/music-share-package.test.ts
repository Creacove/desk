import { describe, expect, it } from "vitest";
import {
  availableShareInformation,
  buildShareSelection,
  selectionMatchesPreset,
  type ShareInventory,
} from "./features/music/musicSharePackage";

const inventory: ShareInventory = {
  assets: [
    { id: "master", group: "Audio", label: "Final master", assetType: "final_master" },
    { id: "cover", group: "Artwork", label: "Cover artwork", assetType: "cover_art" },
    { id: "old-cover", group: "Artwork", label: "Old cover", assetType: "cover_art" },
    { id: "press-photo", group: "Artwork", label: "Press portrait", assetType: "press_photo" },
  ],
  documents: [
    { id: "lyrics", title: "Lyrics", documentType: "lyrics", body: "Real lyrics", ready: true },
    { id: "press", title: "Press release", documentType: "press_release", body: "Real press copy", ready: true },
    { id: "draft-bio", title: "Biography", documentType: "artist_biography", body: "Draft biography", ready: false },
  ],
  information: [
    { key: "song_title", label: "Song title", value: "After Midnight" },
    { key: "primary_artist", label: "Primary artist", value: "Nova Vale" },
    { key: "release_date", label: "Release date", value: "" },
    { key: "genre", label: "Genre", value: "Alté" },
  ],
};

describe("song share package selection", () => {
  it("offers only song information with real values", () => {
    expect(availableShareInformation(inventory)).toEqual([
      { key: "song_title", label: "Song title", value: "After Midnight" },
      { key: "primary_artist", label: "Primary artist", value: "Nova Vale" },
      { key: "genre", label: "Genre", value: "Alté" },
    ]);
  });

  it("builds a listen package around current audio and identity", () => {
    expect(buildShareSelection("listen", inventory)).toEqual({
      assetIds: ["master", "cover"],
      documentIds: [],
      informationKeys: ["song_title", "primary_artist"],
    });
  });

  it("builds a press kit without unready or empty content", () => {
    expect(buildShareSelection("epk_press", inventory)).toEqual({
      assetIds: ["master", "cover", "press-photo"],
      documentIds: ["lyrics", "press"],
      informationKeys: ["song_title", "primary_artist", "genre"],
    });
  });

  it("builds delivery from final audio, cover, and populated release facts", () => {
    expect(buildShareSelection("delivery", inventory)).toEqual({
      assetIds: ["master", "cover"],
      documentIds: ["lyrics"],
      informationKeys: ["song_title", "primary_artist", "genre"],
    });
  });

  it("starts Custom empty and detects when a preset has been changed", () => {
    expect(buildShareSelection("custom", inventory)).toEqual({ assetIds: [], documentIds: [], informationKeys: [] });
    expect(selectionMatchesPreset("listen", inventory, buildShareSelection("listen", inventory))).toBe(true);
    expect(selectionMatchesPreset("listen", inventory, {
      ...buildShareSelection("listen", inventory),
      documentIds: ["lyrics"],
    })).toBe(false);
  });
});
