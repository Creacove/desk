import { describe, expect, it } from "vitest";
import { ReadableStream } from "node:stream/web";
import {
  hydrateReleaseSuccessArtifacts,
  mergeReleaseSuccessArtifacts,
  normalizeReleaseSuccessArtifact,
  releaseSuccessProgressLabel,
} from "./services/managerConversationStream";
import { parseManagerConversationEventStream } from "./services/managerConversationStream";
import type { ReleaseSuccessArtifactViewModel } from "./types/cleanProduction";

const states: ReleaseSuccessArtifactViewModel["state"][] = [
  "investigating",
  "assessed",
  "proposed",
  "awaiting_approval",
  "applying",
  "applied",
  "failed",
];

function artifact(state: ReleaseSuccessArtifactViewModel["state"], overrides: Record<string, unknown> = {}): ReleaseSuccessArtifactViewModel {
  return {
    id: "release-artifact-1",
    musicItemId: "song-1",
    missionId: "mission-1",
    state,
    subject: { title: "After Midnight", itemType: "song", approvedReleaseDate: "2026-08-26" },
    ...overrides,
  };
}

describe("release success conversation artifact", () => {
  it("accepts every explicit state and replaces one evolving artifact by id", async () => {
    const blocks = states.map((state, index) => `id: event-${index}\ndata: ${JSON.stringify({
      type: "release_success.changed",
      artifact: artifact(state),
    })}\n\n`).join("");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(blocks));
        controller.close();
      },
    });

    const events = await parseManagerConversationEventStream(stream);
    const merged = mergeReleaseSuccessArtifacts([], events
      .filter((event) => event.type === "release_success.changed")
      .map((event) => event.artifact));

    expect(events.filter((event) => event.type === "release_success.changed")).toHaveLength(states.length);
    expect(merged).toHaveLength(1);
    expect(merged[0].state).toBe("failed");
  });

  it("uses human-safe progress labels and never exposes reasoning text", () => {
    expect(releaseSuccessProgressLabel("read_focused_release_success")).toBe("Release materials checked");
    expect(releaseSuccessProgressLabel("propose_focused_release_date_change")).toBe("Release date impact preview ready");
    expect(releaseSuccessProgressLabel("read_focused_release_success")).not.toMatch(/chain|thought|reasoning/i);
  });

  it("hydrates only the latest valid artifact state and safely ignores malformed legacy values", () => {
    const hydrated = hydrateReleaseSuccessArtifacts([
      { id: "output-old", created_at: "2026-08-12T10:00:00.000Z", render_json: artifact("assessed") },
      { id: "output-new", created_at: "2026-08-12T11:00:00.000Z", render_json: artifact("applied", { receipt: { requestId: "request-1" } }) },
      { id: "output-invalid", created_at: "2026-08-12T12:00:00.000Z", render_json: { state: "prototype" } },
    ]);

    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]).toMatchObject({ id: "release-artifact-1", state: "applied", receipt: { requestId: "request-1" } });
    expect(normalizeReleaseSuccessArtifact({ id: "legacy", state: "assessed" })).toBeNull();
  });
});
