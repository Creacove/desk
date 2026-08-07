import { describe, expect, it } from "vitest";
import {
  musicConversationSubjectTarget,
  parseMusicConversationSubject,
} from "../supabase/functions/_shared/manager-conversation/musicSubject";

describe("Manager conversation music subjects", () => {
  const songId = "018f3e1c-a0f4-7c0d-9f7d-6f3851f19427";

  it("accepts a scoped song and maps it to the existing artifact-link target", () => {
    const subject = parseMusicConversationSubject({ type: "music_item", id: songId });

    expect(subject).toEqual({ type: "music_item", id: songId });
    expect(musicConversationSubjectTarget(subject!)).toEqual({
      table: "music_items",
      artifactType: "music_item",
    });
  });

  it("accepts an existing music project subject without inventing a conversation column", () => {
    const subject = parseMusicConversationSubject({
      type: "music_project",
      id: "018f3e1c-a0f4-7c0d-9f7d-6f3851f19428",
    });

    expect(musicConversationSubjectTarget(subject!)).toEqual({
      table: "music_projects",
      artifactType: "music_project",
    });
  });

  it("treats an omitted subject as unscoped but rejects malformed or unsupported subjects", () => {
    expect(parseMusicConversationSubject(undefined)).toBeNull();
    expect(() => parseMusicConversationSubject({ type: "song", id: songId })).toThrow("invalid");
    expect(() => parseMusicConversationSubject({ type: "music_item", id: "not-an-id" })).toThrow("invalid");
  });
});
