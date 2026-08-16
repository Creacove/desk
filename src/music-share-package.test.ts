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
    { id: "epk", title: "After Midnight EPK", documentType: "epk", body: "Real EPK", ready: true },
    { id: "press", title: "Press release", documentType: "press_release", body: "Real press copy", ready: true },
    { id: "bio", title: "Biography", documentType: "artist_biography", body: "Real artist biography", ready: true },
    { id: "credits", title: "Credit sheet", documentType: "credits", body: "Real credits", ready: true },
    { id: "press-pitch", title: "Press pitch", documentType: "press_pitch", body: "Outbound pitch", ready: true },
    { id: "spotify-pitch", title: "Spotify pitch", documentType: "spotify_editorial_pitch", body: "Outbound editorial pitch", ready: true },
    { id: "draft-one-sheet", title: "One-sheet", documentType: "one_sheet", body: "Draft one-sheet", ready: false },
    { id: "delivery", title: "Distribution delivery sheet", documentType: "distributor_notes", body: "Delivery notes", ready: true },
  ],
  information: [
    { key: "song_title", label: "Song title", value: "After Midnight" },
    { key: "primary_artist", label: "Primary artist", value: "Nova Vale" },
    { key: "release_date", label: "Release date", value: "" },
    { key: "genre", label: "Genre", value: "Alté" },
    { key: "copyright", label: "Copyright", value: "2026 Nova Vale" },
  ],
};

describe("song share package selection", () => {
  it("offers only song information with real values", () => {
    expect(availableShareInformation(inventory)).toEqual([
      { key: "song_title", label: "Song title", value: "After Midnight" },
      { key: "primary_artist", label: "Primary artist", value: "Nova Vale" },
      { key: "genre", label: "Genre", value: "Alté" },
      { key: "copyright", label: "Copyright", value: "2026 Nova Vale" },
    ]);
  });

  it("builds a private listen around the current audio and identity", () => {
    expect(buildShareSelection("listen", inventory)).toEqual({
      assetIds: ["master", "cover"],
      documentIds: [],
      informationKeys: ["song_title", "primary_artist"],
    });
  });

  it("builds a real press/media kit and excludes outbound pitch drafts", () => {
    expect(buildShareSelection("epk_press", inventory)).toEqual({
      assetIds: ["master", "cover", "press-photo"],
      documentIds: ["epk", "press", "bio", "credits"],
      informationKeys: ["song_title", "primary_artist", "genre"],
    });
  });

  it("builds distributor delivery from delivery-safe files, documents, and facts", () => {
    expect(buildShareSelection("delivery", inventory)).toEqual({
      assetIds: ["master", "cover"],
      documentIds: ["lyrics", "credits", "delivery"],
      informationKeys: ["song_title", "primary_artist", "genre", "copyright"],
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
