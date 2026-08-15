import { readFileSync, writeFileSync } from "node:fs";

function replaceRegex(path, pattern, replacement, label) {
  const source = readFileSync(path, "utf8");
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`))];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  writeFileSync(path, source.replace(pattern, replacement));
}

function replaceText(path, from, to, label, expected = 1) {
  const source = readFileSync(path, "utf8");
  const count = source.split(from).length - 1;
  if (count !== expected) throw new Error(`${label}: expected ${expected} match(es), found ${count}`);
  writeFileSync(path, source.replaceAll(from, to));
}

replaceRegex(
  "supabase/functions/_shared/manager-conversation/agentLoop.ts",
  /const evidenceCount = typeof value\.evidenceCount === "number" && Number\.isFinite\(value\.evidenceCount\)\s*\n\s*\? value\.evidenceCount\s*\n\s*: null;/,
  `const evidenceCount = typeof value.evidenceCount === "number" && Number.isFinite(value.evidenceCount)
      ? value.evidenceCount
      : Array.isArray(value.evidence)
        ? value.evidence.length
        : null;`,
  "Manager evidence-count fallback",
);

replaceText(
  "supabase/functions/_shared/manager-conversation/agentLoop.ts",
  '` with ${evidenceCount} supporting signal${evidenceCount === 1 ? "" : "s"}`',
  '` with ${evidenceCount} saved evidence item${evidenceCount === 1 ? "" : "s"}`',
  "Manager evidence progress copy",
  2,
);

replaceRegex(
  "src/features/music/MusicScreens.tsx",
  /  async function approveSongDocument\(\) \{.*?\n\}\n\n  async function performMusicAssetUpload/s,
  `  async function approveSongDocument() {
    if (!documentEditorTarget?.document) return;
    const target = documentEditorTarget;
    const document = target.document;
    await runMusicAction(async () => {
      if (!musicRepository.approveSongDocument) throw new Error("Document approval is not available yet.");
      await musicRepository.approveSongDocument(document.id);
      await refreshFocusedSong(target.song.id);
      setDocumentEditorTarget(null);
    }, \`${"${document.title}"} approved for sharing.\`);
  }

  async function performMusicAssetUpload`,
  "Song document approval narrowing",
);

{
  const path = "src/manager-agent-loop.test.ts";
  const source = readFileSync(path, "utf8");
  const pattern = /onToolEvent: \(event\) => ([A-Za-z_$][\w$]*)\.push\(event\),/g;
  const matches = [...source.matchAll(pattern)];
  if (!matches.length) throw new Error("Manager agent-loop tests: no push-return callbacks found");
  writeFileSync(path, source.replace(pattern, (_full, target) => `onToolEvent: (event) => { ${target}.push(event); },`));
}

replaceText(
  "scripts/chrome-production-smoke.mjs",
  'const appUrl = process.env.APP_SMOKE_URL || "http://127.0.0.1:4173";',
  'const appUrl = process.env.APP_SMOKE_URL || "http://127.0.0.1:4173/?fixtures=true";',
  "Chromium fixture URL",
);

console.log("Release-candidate fixes applied deterministically.");
