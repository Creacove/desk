from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


def replace_in_test(path: str, title: str, replacements: list[tuple[str, str]]) -> None:
    file = Path(path)
    text = file.read_text()
    marker = f'  it("{title}"'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f"{path}: test not found: {title}")
    end = text.find('\n  it("', start + len(marker))
    if end < 0:
        end = len(text)
    block = text[start:end]
    changed = block
    for old, new in replacements:
        changed = changed.replace(old, new)
    if changed == block:
        raise SystemExit(f"{path}: no requested replacements applied in test: {title}")
    file.write_text(text[:start] + changed + text[end:])


# Release-management phrases with an explicit attached song are valid release turns.
replace_once(
    "supabase/functions/_shared/manager-conversation/agentLoop.ts",
    'const releaseManagementIntent = /\\b(release date|release readiness|readiness|ready to release|ready for release|move (?:the )?release|delay (?:the )?release|postpone|reschedule|release plan|plan this release|launch date)\\b/.test(intentText);',
    'const releaseManagementIntent = /\\b(release date|release readiness|readiness|ready to release|ready for release|release (?:this|the) (?:song|record)|move (?:the )?release|delay (?:the )?release|postpone|reschedule|release plan|plan this release|launch date)\\b/.test(intentText);',
)

# Release planning gets the release read/date tools, but no longer implicitly exposes
# servicing/document writes. Those are selected by their own intent.
replace_once(
    "src/manager-agent-loop.test.ts",
    '''    expect(names).toEqual(expect.arrayContaining([\n      "read_focused_release_success",\n      "propose_focused_release_date_change",\n      "query_focused_release_opportunities",\n      "save_focused_release_opportunities",\n      "create_focused_song_document",\n    ]));\n    expect(names).not.toContain("record_focused_release_opportunity_outcome");''',
    '''    expect(names).toEqual(expect.arrayContaining([\n      "read_focused_release_success",\n      "propose_focused_release_date_change",\n    ]));\n    expect(names).not.toEqual(expect.arrayContaining([\n      "query_focused_release_opportunities",\n      "save_focused_release_opportunities",\n      "create_focused_song_document",\n      "record_focused_release_opportunity_outcome",\n    ]));''',
)

# The focused-song loader now reads the structured v2 metadata object before
# normalizing its rendered body; keep the source-contract test aligned with that path.
replace_once(
    "src/openai-manager-conversation-function.test.ts",
    '    expect(songDocumentDraftSource).toContain("cleanLongText(version?.metadata?.body");',
    '    expect(songDocumentDraftSource).toContain("cleanLongText(metadata.body, 60_000)");',
)

# The Manager tool success test must use the v2 RPC and a quality-gated structured body.
replace_once(
    "src/release-success-manager-tools.test.ts",
    '        if (name === "persist_focused_song_document_v1") {',
    '        if (name === "persist_focused_song_document_v1" || name === "persist_focused_song_document_v2") {',
)
replace_once(
    "src/release-success-manager-tools.test.ts",
    'const subject = { type: "music_item" as const, id: "song-1" };',
    '''const subject = { type: "music_item" as const, id: "song-1" };\n\nconst validPressPitchBody = JSON.stringify({\n  purpose: "Prepare a specific review-ready press pitch for a verified music editor.",\n  audience: "Independent music editors reviewing current Afrobeats releases.",\n  coreNarrative: "After Midnight is a late-night Afrobeats record built around restrained tension and direct storytelling, giving the campaign one specific angle that can travel consistently across press outreach without unsupported claims.",\n  sections: [\n    ["subject_line", "Subject line"],\n    ["opening", "Opening"],\n    ["why_them", "Why this outlet"],\n    ["story", "Story"],\n    ["proof", "Proof"],\n    ["cta", "Call to action"],\n  ].map(([key, title], index) => ({\n    key,\n    title,\n    content: `After Midnight press section ${index + 1} uses verified workspace context to explain the late-night Afrobeats direction, intended listener context, release story, and concrete editorial relevance without inventing audience numbers, quotes, recipient history, or placement claims.`,\n    evidenceRefs: ["workspace:song-1"],\n  })),\n  claims: [{\n    text: "The workspace identifies After Midnight as an Afrobeats song with a late-night mood.",\n    basis: "workspace",\n    sourceRef: "workspace:song-1",\n    confidence: "high",\n  }],\n  missingInputs: [],\n});''',
)
replace_once(
    "src/release-success-manager-tools.test.ts",
    '{ documentType: "press_pitch", title: "After Midnight press pitch", body: "A concise song-specific press pitch draft.", opportunityId: "opportunity-1" },',
    '{ documentType: "press_pitch", title: "After Midnight press pitch", body: validPressPitchBody, opportunityId: "opportunity-1" },',
)
replace_once(
    "src/release-success-manager-tools.test.ts",
    '    expect(rpcCalls).toContainEqual(expect.objectContaining({ name: "persist_focused_song_document_v1" }));',
    '    expect(rpcCalls).toContainEqual(expect.objectContaining({ name: "persist_focused_song_document_v2" }));',
)

# Song-room labels are now title-cased and Campaign is contextual. Update only the
# affected legacy test blocks, leaving project-room and unrelated expectations alone.
shell = "src/production-app-shell.test.tsx"
common = [
    ('name: "files"', 'name: "Files"'),
    ('name: "details"', 'name: "Details"'),
    ('name: "rights"', 'name: "Rights"'),
    ('name: "Write here"', 'name: "Write manually"'),
]
for test_title in [
    "keeps the created secure link usable when its optional email delivery fails",
    "keeps selected-asset sharing inside the song Files surface",
    "rebuilds Music as a durable recorded-work area with song/project rooms",
    "keeps real upload progress inside Files instead of blocking the song room",
    "does not replay a consumed song navigation intent after repository refresh",
    "creates a native song document from the Documents section",
    "opens a chat-created song directly on its requested Files destination",
    "exposes production Catalog create and upload actions in context",
    "keeps failed uploads visible in Files and retries without reopening the picker",
    "summarizes a partially confirmed split without allocation noise",
    "uses the production split ledger flow in the Music rights tab",
]:
    replace_in_test(shell, test_title, common)

replace_in_test(
    shell,
    "uses mobile-native song and project room layouts after opening Music items",
    common + [
        ('getByTestId("song-room-mobile-tabs")).toHaveClass("grid-cols-4")', 'getByTestId("song-room-mobile-tabs")).toHaveClass("grid-cols-5")'),
    ],
)

print("Updated PR #3 compatibility contracts.")
