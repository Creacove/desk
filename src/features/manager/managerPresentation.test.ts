import { describe, expect, it } from "vitest";
import { buildManagerTurns, dedupeManagerWork, groupManagerWork } from "./managerPresentation";
import type { ConversationViewModel } from "../../types/cleanProduction";

const work = (overrides: Partial<ConversationViewModel["createdWork"][number]> = {}): ConversationViewModel["createdWork"][number] => ({
  type: "task",
  title: "Confirm the release package",
  body: "Confirm the files and information.",
  ...overrides,
});

describe("manager presentation projection", () => {
  it("deduplicates repeated work by durable identity", () => {
    expect(dedupeManagerWork([
      work({ type: "music_item", id: "song-1", title: "Summer" }),
      work({ type: "music_item", id: "song-1", title: "Summer" }),
      work({ type: "task", id: "task-1" }),
    ])).toHaveLength(2);
  });

  it("groups a song workspace, mission, and first task into one workspace result", () => {
    const groups = groupManagerWork([
      work({ type: "music_item", id: "song-1", title: "Summer" }),
      work({ type: "mission", id: "mission-1", title: "Prepare Summer for release" }),
      work({ type: "task", id: "task-1", parentMissionId: "mission-1" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ kind: "workspace", tasks: [{ id: "task-1" }] });
  });

  it("presents a canonical song document as a document rather than a Song ready receipt", () => {
    const groups = groupManagerWork([
      work({
        type: "music_item",
        id: "document-1",
        musicItemId: "song-1",
        title: "Summer — Everjamz playlist pitch",
        body: "Saved to Files.",
        artifactKind: "song_document",
        documentType: "playlist_pitch",
        readiness: "ready",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      kind: "draft",
      item: { artifactKind: "song_document", documentType: "playlist_pitch", musicItemId: "song-1" },
    });
  });

  it("keeps multiple song documents from the same song as separate work products", () => {
    const groups = groupManagerWork([
      work({ type: "music_item", id: "document-1", musicItemId: "song-1", title: "EPK", body: "Saved.", artifactKind: "song_document" }),
      work({ type: "music_item", id: "document-2", musicItemId: "song-1", title: "Everjamz pitch", body: "Saved.", artifactKind: "song_document" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.kind === "draft")).toBe(true);
  });

  it("assigns conversation-level fallback work to the last Manager turn", () => {
    const conversation: ConversationViewModel = {
      id: "conversation-1",
      topic: "Summer",
      status: "Manager responded",
      summary: "Summary",
      prompt: "Start",
      messages: [
        { id: "artist-1", speaker: "artist", label: "You", body: "Start" },
        { id: "manager-1", speaker: "manager", label: "Manager", body: "Ready." },
      ],
      createdWork: [work({ type: "music_item", id: "song-1", title: "Summer" })],
    };
    const turns = buildManagerTurns(conversation);
    expect(turns[0].work).toHaveLength(0);
    expect(turns[1].work[0]).toMatchObject({ kind: "music" });
  });
});
