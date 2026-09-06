import { describe, expect, it } from "vitest";

import { buildTeamInvitationEmail } from "../supabase/functions/_shared/teamInvitationEmail";

describe("team invitation email", () => {
  it("contains the copy-link fallback target while keeping secrets out of delivery metadata", () => {
    const token = "A".repeat(43);
    const result = buildTeamInvitationEmail({
      origin: "https://app.example.com",
      token,
      to: "member@example.com",
      teamName: "Northstar & Co",
      artistName: "Northstar",
      operatingTitle: "Release <lead>",
      responsibilityTags: ["distribution", "DSPs"],
      expiresAt: "2026-09-12T09:00:00.000Z",
    });

    expect(result.to).toBe("member@example.com");
    expect(result.html).toContain(`https://app.example.com/join#token=${token}`);
    expect(result.html).toContain("Release &lt;lead&gt;");
    expect(result.metadata).not.toHaveProperty("token");
    expect(JSON.stringify(result.metadata)).not.toContain(token);
  });
});
