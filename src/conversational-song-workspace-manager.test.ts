import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Manager conversational song workspace", () => {
  it("uses the atomic workspace command instead of inserting a bare song", () => {
    const executor = source("supabase/functions/_shared/manager-conversation/toolExecutor.ts");
    const tools = source("supabase/functions/_shared/manager-conversation/agentLoop.ts");

    expect(tools).toContain('name: "ensure_song_release_workspace"');
    expect(executor).toContain('name === "ensure_song_release_workspace"');
    expect(executor).toContain('db.rpc("create_conversational_song_workspace_v2"');
    expect(executor).not.toContain('async function createMusicSong');
  });

  it("returns the bound subject and workspace receipts from both transports", () => {
    for (const path of [
      "supabase/functions/manager-conversation/index.ts",
      "supabase/functions/manager-conversation-stream/index.ts",
    ]) {
      const endpoint = source(path);
      expect(endpoint).toContain("toolCreatedWork");
      expect(endpoint).toContain("finalMusicSubject");
      expect(endpoint).toContain("musicSubject: conversation.musicSubject");
      expect(endpoint).toContain("preserveWorkspaceTopic");
    }
  });

  it("parses and displays the committed Song Workspace inside the conversation", () => {
    const repository = source("src/services/productionSupabase.ts");
    const screen = source("src/features/manager/ManagerScreens.tsx");

    expect(repository).toContain("musicSubject: musicConversationSubjectViewModel(input.musicSubject)");
    expect(screen).toContain("song-workspace-artifact");
    expect(screen).toContain("Song Workspace ready");
  });
});
