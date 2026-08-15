import { describe, expect, it, vi } from "vitest";
import { executeManagerConversationTool } from "../supabase/functions/_shared/manager-conversation/toolExecutor";

describe("Manager release share package", () => {
  it("prepares a frozen package through the service-role RPC without sending it", async () => {
    const rawToken = "ab".repeat(32);
    const rpc = vi.fn(async () => ({
      data: {
        status: "prepared",
        shareLinkId: "share-1",
        rawToken,
        label: "Down Below · Curator A",
        preset: "epk_press",
        musicItemId: "song-1",
        opportunityId: "opp-1",
        documentCount: 3,
        assetCount: 2,
      },
      error: null,
    }));

    const result = await executeManagerConversationTool(
      { rpc, from: vi.fn() } as any,
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        runId: "run-1",
        musicSubject: { type: "music_item", id: "song-1" },
      },
      "prepare_focused_release_share_package",
      { preset: "epk_press", opportunityId: "opp-1", label: null },
    ) as Record<string, unknown>;

    expect(rpc).toHaveBeenCalledWith("prepare_focused_release_share_package_v1", {
      p_account_id: "account-1",
      p_artist_workspace_id: "workspace-1",
      p_artist_id: "artist-1",
      p_music_item_id: "song-1",
      p_preset: "epk_press",
      p_label: null,
      p_opportunity_id: "opp-1",
      p_run_id: "run-1",
    });
    expect(result.status).toBe("prepared");
    expect(result.url).toBe(`https://app.ordersounds.com/share?token=${rawToken}`);
    expect(result.rawToken).toBeUndefined();
    expect(result.note).toBe("Preparation only — nothing was sent or submitted.");
  });

  it("does not allow package preparation for an attached project", async () => {
    const result = await executeManagerConversationTool(
      { rpc: vi.fn(), from: vi.fn() } as any,
      {
        accountId: "account-1",
        artistWorkspaceId: "workspace-1",
        artistId: "artist-1",
        musicSubject: { type: "music_project", id: "project-1" },
      },
      "prepare_focused_release_share_package",
      { preset: "epk_press", opportunityId: null, label: null },
    );

    expect(result).toEqual({
      status: "not_allowed",
      reason: "Release share packages are currently scoped to an attached song.",
    });
  });
});
