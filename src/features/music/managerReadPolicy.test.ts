import { describe, expect, it } from "vitest";

import { managerReadControls, shouldRefreshManagerRead } from "./managerReadPolicy";

describe("managerReadControls", () => {
  it("keeps a fresh Read refreshable without competing with the conversation action", () => {
    expect(managerReadControls({ status: "fresh", hasConversation: true })).toEqual({
      readAction: "refresh",
      readActionPriority: "secondary",
      conversationAction: "continue",
    });
  });

  it("asks for an independent Read before one exists", () => {
    expect(managerReadControls({ status: "not_generated", hasConversation: false })).toEqual({
      readAction: "ask",
      readActionPriority: "primary",
      conversationAction: null,
    });
  });
});

describe("shouldRefreshManagerRead", () => {
  it("refreshes a pre-release Read when a split confirmation changes", () => {
    expect(shouldRefreshManagerRead({ mode: "pre_release", event: "split_confirmation_changed" })).toBe(true);
  });

  it("does not refresh a released catalog Read for a historical split update", () => {
    expect(shouldRefreshManagerRead({ mode: "released", event: "split_confirmation_changed" })).toBe(false);
  });

  it("does not spend a Read refresh on cosmetic metadata edits", () => {
    expect(shouldRefreshManagerRead({ mode: "pre_release", event: "metadata_title_casing_changed" })).toBe(false);
  });
});
