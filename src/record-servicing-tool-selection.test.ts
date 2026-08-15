import { describe, expect, it } from "vitest";
import { selectManagerConversationToolsForTurn } from "../supabase/functions/_shared/manager-conversation/agentLoop";

function functionNames(body: string, hasAttachedUnreleasedSong: boolean) {
  return selectManagerConversationToolsForTurn({ body, hasAttachedUnreleasedSong })
    .filter((tool) => tool.type === "function")
    .map((tool) => tool.name);
}

describe("record servicing tool selection", () => {
  it("keeps playlist servicing tools available for a released attached song", () => {
    const names = functionNames("Find playlist opportunities for this song", false);

    expect(names).toContain("query_focused_release_opportunities");
    expect(names).toContain("save_focused_release_opportunities");
    expect(names).toContain("create_focused_song_document");
    expect(names).not.toContain("read_focused_release_success");
    expect(names).not.toContain("propose_focused_release_date_change");
  });

  it("keeps press and outreach servicing available after release", () => {
    const names = functionNames("Find press targets and prepare outreach for this song", false);

    expect(names).toContain("query_focused_release_opportunities");
    expect(names).toContain("save_focused_release_opportunities");
    expect(names).toContain("create_focused_song_document");
  });

  it("gives the Campaign CTA the premium document write tool", () => {
    const released = functionNames("Build the campaign kit for this record", false);
    const unreleased = functionNames("Build the release kit for this song", true);

    expect(released).toContain("create_focused_song_document");
    expect(unreleased).toContain("create_focused_song_document");
    expect(released).not.toContain("propose_focused_release_date_change");
  });

  it("allows a release narrative to be built directly", () => {
    const names = functionNames("Build the release narrative for this song", true);
    expect(names).toContain("create_focused_song_document");
  });

  it("lets Manager prepare a private package for a servicing target without exposing send actions", () => {
    const released = functionNames("Prepare the package for this curator", false);
    const unreleased = functionNames("Build a private press package for this release", true);

    expect(released).toContain("prepare_focused_release_share_package");
    expect(unreleased).toContain("prepare_focused_release_share_package");
    expect(released).not.toContain("propose_focused_release_date_change");
  });

  it("does not expose servicing writes for an unrelated released-song turn", () => {
    const names = functionNames("Help me understand the audience for this song", false);

    expect(names).not.toContain("save_focused_release_opportunities");
    expect(names).not.toContain("create_focused_song_document");
    expect(names).not.toContain("prepare_focused_release_share_package");
    expect(names).not.toContain("propose_focused_release_date_change");
  });

  it("keeps release-date management exclusive to unreleased release intent", () => {
    const released = functionNames("Should we move the release date?", false);
    const unreleased = functionNames("Should we move the release date?", true);

    expect(released).not.toContain("read_focused_release_success");
    expect(released).not.toContain("propose_focused_release_date_change");
    expect(unreleased).toContain("read_focused_release_success");
    expect(unreleased).toContain("propose_focused_release_date_change");
  });

  it("does not couple an unreleased playlist request to release-date mutation", () => {
    const names = functionNames("Find playlist opportunities for this song", true);

    expect(names).toContain("query_focused_release_opportunities");
    expect(names).toContain("save_focused_release_opportunities");
    expect(names).not.toContain("propose_focused_release_date_change");
  });

  it("allows manual opportunity outcome recording for released songs", () => {
    const names = functionNames("I heard back from the curator and they accepted it", false);

    expect(names).toContain("record_focused_release_opportunity_outcome");
    expect(names).not.toContain("propose_focused_release_date_change");
  });
});
