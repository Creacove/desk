import { describe, expect, it, vi } from "vitest";
import { loadPublicMusicShare } from "./services/publicMusicShare";

describe("loadPublicMusicShare", () => {
  it("calls only the public package endpoint and normalizes its bounded payload", async () => {
    const invoke = vi.fn(async () => ({
      data: {
        label: "Jam package",
        preset: "delivery",
        assets: [{ id: "asset-1", title: "Master", assetType: "final_master", fileName: "jam.wav", fileType: "audio/wav", downloadUrl: "https://files.example/jam" }],
      },
      error: null,
    }));

    await expect(loadPublicMusicShare({ functions: { invoke } }, "a".repeat(64))).resolves.toEqual({
      label: "Jam package",
      preset: "delivery",
      assets: [{ id: "asset-1", title: "Master", assetType: "final_master", fileName: "jam.wav", fileType: "audio/wav", downloadUrl: "https://files.example/jam" }],
    });
    expect(invoke).toHaveBeenCalledWith("public-music-share", { body: { token: "a".repeat(64) } });
  });

  it("does not expose malformed or provider error details to a public page", async () => {
    const invoke = vi.fn(async () => ({ data: { error: "raw storage details" }, error: null }));
    await expect(loadPublicMusicShare({ functions: { invoke } }, "b".repeat(64))).rejects.toThrow("Share package is unavailable.");
  });

  it("normalizes identity and first-class shared documents", async () => {
    const invoke = vi.fn(async () => ({
      data: {
        label: "Jam press kit",
        preset: "epk_press",
        title: "Jam",
        artist: "Nova Vale",
        createdAt: "2026-08-09T10:00:00Z",
        assets: [{
          id: "asset-master",
          title: "Final master",
          assetType: "final_master",
          fileName: "jam.wav",
          fileType: "audio/wav",
          inlineUrl: "https://files.example/inline-master",
          downloadUrl: "https://files.example/download-master",
        }],
        documents: [{
          id: "press",
          title: "Jam — Press Release (Updated Draft)",
          documentType: "press_release",
          body: "**Purpose:** Internal use\n\n# Jam\n\nJam is the new single.\n\n## Needs Verification\nTBD",
        }],
        information: [{ key: "genre", title: "Genre", value: "Alté" }],
      },
      error: null,
    }));

    await expect(loadPublicMusicShare({ functions: { invoke } }, "c".repeat(64))).resolves.toMatchObject({
      title: "Jam",
      artist: "Nova Vale",
      documents: [{
        id: "press",
        title: "Jam — Press Release",
        documentType: "press_release",
        body: "# Jam\n\nJam is the new single.",
      }],
      information: [{ key: "genre", title: "Genre", value: "Alté" }],
    });
  });

  it("upgrades old information-based document snapshots without duplicating them as release info", async () => {
    const invoke = vi.fn(async () => ({
      data: {
        label: "Legacy package",
        preset: "epk_press",
        assets: [],
        information: [
          { key: "document:epk", title: "Jam EPK (Draft)", value: "# Jam EPK\n\nPress copy.", documentType: "epk" },
          { key: "genre", title: "Genre", value: "Alté" },
        ],
      },
      error: null,
    }));

    await expect(loadPublicMusicShare({ functions: { invoke } }, "d".repeat(64))).resolves.toMatchObject({
      documents: [{ id: "epk", title: "Jam EPK", documentType: "epk" }],
      information: [{ key: "genre", title: "Genre", value: "Alté" }],
    });
  });
});
