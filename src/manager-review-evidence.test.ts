import { describe, expect, it } from "vitest";
import {
  canonicalEvidenceAlreadySatisfiesTask,
  hasCanonicalAssetEvidence,
  isCanonicalEvidenceTask,
  removeRedundantCanonicalFollowUps,
} from "../supabase/functions/_shared/managerReviewEvidence";

const canonicalPackage = {
  assets: [{
    asset_type: "final_master",
    status: "uploaded",
    uploadedFile: { status: "processed", file_type: "audio/mpeg" },
  }],
};

describe("deterministic Manager review evidence", () => {
  it("requires a live canonical file, not just an asset label", () => {
    expect(hasCanonicalAssetEvidence(canonicalPackage, { title: "Add the current working audio" })).toBe(true);
    expect(hasCanonicalAssetEvidence({
      assets: [{ asset_type: "final_master", status: "uploaded", uploadedFile: null }],
    }, { title: "Add the current working audio" })).toBe(false);
  });

  it("recognizes an asset task and accepts a plain completion note", () => {
    const task = {
      title: "Add the current working audio",
      purpose: "Give the song workspace a real audio reference.",
      evidence_needed: ["Current audio file or package confirmation."],
    };
    expect(isCanonicalEvidenceTask(task)).toBe(true);
    expect(canonicalEvidenceAlreadySatisfiesTask({
      input: { status: "completed", note: "uploaded" },
      task,
      canonicalMusicPackage: canonicalPackage,
    })).toBe(true);
  });

  it("applies the same rule to non-audio assets and duplicate non-asset submissions", () => {
    expect(canonicalEvidenceAlreadySatisfiesTask({
      input: { status: "completed", note: "done" },
      task: { title: "Add the cover artwork", purpose: "Attach the current cover image." },
      canonicalMusicPackage: {
        assets: [{ asset_type: "cover_art", status: "confirmed", uploadedFile: { status: "uploaded" } }],
      },
    })).toBe(true);
    expect(canonicalEvidenceAlreadySatisfiesTask({
      input: { status: "completed", note: "done" },
      task: { id: "task-1", title: "Choose the release route", purpose: "Record the approved route." },
      previousResults: [{ task_id: "task-1", status: "completed" }],
    })).toBe(true);
  });

  it("keeps an explicit bad-file report revisable", () => {
    expect(canonicalEvidenceAlreadySatisfiesTask({
      input: { status: "completed", note: "This is the wrong placeholder; replace it." },
      task: { title: "Confirm the final master", purpose: "Verify the current audio package." },
      canonicalMusicPackage: canonicalPackage,
    })).toBe(false);
  });

  it("removes repeated artist confirmations but retains Manager work", () => {
    const followUps = [
      { title: "Artist: Confirm or replace the uploaded final_master", ownerRole: "Artist / team", purpose: "Verify the file." },
      { title: "Manager: Review metadata and distribution", ownerRole: "Manager", purpose: "Review credits." },
      { title: "Artist: Prepare approved campaign assets", ownerRole: "Artist / team", purpose: "Create the launch assets." },
    ];
    expect(removeRedundantCanonicalFollowUps(followUps, true, { title: "Add the current working audio", purpose: "Give the song workspace a real audio reference." }).map((item) => item.title)).toEqual([
      "Manager: Review metadata and distribution",
      "Artist: Prepare approved campaign assets",
    ]);
  });
});
