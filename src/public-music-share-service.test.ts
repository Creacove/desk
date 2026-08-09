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

  it("normalizes music identity and separate inline and download media URLs", async () => {
    const invoke = vi.fn(async () => ({
      data: {
        label: "Jam private package",
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
        information: [{ key: "document:press", title: "Press release", value: "Jam is the new single.", documentType: "press_release" }],
      },
      error: null,
    }));

    await expect(loadPublicMusicShare({ functions: { invoke } }, "c".repeat(64))).resolves.toMatchObject({
      title: "Jam",
      artist: "Nova Vale",
      createdAt: "2026-08-09T10:00:00Z",
      assets: [{
        inlineUrl: "https://files.example/inline-master",
        downloadUrl: "https://files.example/download-master",
      }],
      information: [{ documentType: "press_release" }],
    });
  });
});
