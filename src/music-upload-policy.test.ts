import { describe, expect, it } from "vitest";
import { musicUploadAccept, musicUploadFileError } from "./features/music/musicUploadPolicy";

const asset = (group: "Audio" | "Artwork" | "Documents") => ({ group });
const file = (name: string, type: string, size = 10) => ({ name, type, size });

describe("song upload preflight policy", () => {
  it("accepts the formats advertised for each song asset group", () => {
    expect(musicUploadFileError(asset("Audio"), file("master.wav", "audio/wav"))).toBeNull();
    expect(musicUploadFileError(asset("Artwork"), file("cover.webp", "image/webp"))).toBeNull();
    expect(musicUploadFileError(asset("Documents"), file("splits.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toBeNull();
  });

  it("rejects group mismatches and legacy Word files", () => {
    expect(musicUploadFileError(asset("Audio"), file("cover.png", "image/png"))).toMatch(/audio/i);
    expect(musicUploadFileError(asset("Documents"), file("rights.doc", "application/msword"))).toMatch(/not supported/i);
  });

  it("keeps picker accepts aligned with policy", () => {
    expect(musicUploadAccept("Documents")).toContain(".docx");
    expect(musicUploadAccept("Documents")).not.toContain(".doc,");
  });
});
