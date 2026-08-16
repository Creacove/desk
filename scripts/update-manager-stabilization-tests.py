from pathlib import Path

path = Path("src/release-success-manager-tools.test.ts")
text = path.read_text()
old = '''    await expect(executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject },
      "save_focused_release_opportunities",
      {
        opportunityType: "press",
        candidates: [{
          ...opportunityCandidate,
          opportunityType: "press",
          targetName: "Invented Outlet",
          sourceUrl: "",
          publicContact: { kind: "email", value: "editor@example.com", sourceUrl: "", verifiedAt: "2026-08-12T10:00:00.000Z" },
        }],
      },
    )).rejects.toThrow(/source|provenance|contact/i);
'''
new = '''    const rejected = await executeManagerConversationTool(
      db,
      { ...scope, musicSubject: subject },
      "save_focused_release_opportunities",
      {
        opportunityType: "press",
        candidates: [{
          ...opportunityCandidate,
          opportunityType: "press",
          targetName: "Invented Outlet",
          sourceUrl: "",
          publicContact: { kind: "email", value: "editor@example.com", sourceUrl: "", verifiedAt: "2026-08-12T10:00:00.000Z" },
        }],
      },
    ) as any;
    expect(rejected).toMatchObject({
      status: "rejected",
      stage: "contact_verification",
      retryable: false,
      reason: expect.stringMatching(/source|provenance|contact/i),
    });
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f"Expected one provenance test contract, found {count}")
path.write_text(text.replace(old, new, 1))
print("Updated release opportunity validation contract.")
