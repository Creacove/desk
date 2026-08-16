from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


# ProductionApp: carry the canonical document id through Manager -> Catalog navigation.
path = Path("src/app/ProductionApp.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  const [targetSongRoomTab, setTargetSongRoomTab] = useState<"overview" | "files">("overview");\n  const [musicRoomOpenRequestKey, setMusicRoomOpenRequestKey] = useState(0);',
    '  const [targetSongRoomTab, setTargetSongRoomTab] = useState<"overview" | "files">("overview");\n  const [targetSongDocumentId, setTargetSongDocumentId] = useState<string | null>(null);\n  const [musicRoomOpenRequestKey, setMusicRoomOpenRequestKey] = useState(0);',
    "ProductionApp target document state",
)
text = replace_once(
    text,
    '    if (event.targetType === "music_item" || event.targetType === "music_project") {\n      setTargetSongRoomTab("overview");\n      setTargetMusicObjectId(event.targetId);',
    '    if (event.targetType === "music_item" || event.targetType === "music_project") {\n      setTargetSongRoomTab("overview");\n      setTargetSongDocumentId(null);\n      setTargetMusicObjectId(event.targetId);',
    "ProductionApp workspace-event reset",
)
text = replace_once(
    text,
    '    if (nextView === "musicWorkspace") {\n      setTargetSongRoomTab("overview");\n      setTargetMusicObjectId(null);',
    '    if (nextView === "musicWorkspace") {\n      setTargetSongRoomTab("overview");\n      setTargetSongDocumentId(null);\n      setTargetMusicObjectId(null);',
    "ProductionApp menu reset",
)
text = replace_once(
    text,
    '  function openMusicFocus(musicObjectId?: string) {\n    setTargetSongRoomTab("overview");\n    setTargetMusicObjectId(musicObjectId ?? null);',
    '  function openMusicFocus(musicObjectId?: string) {\n    setTargetSongRoomTab("overview");\n    setTargetSongDocumentId(null);\n    setTargetMusicObjectId(musicObjectId ?? null);',
    "ProductionApp focus reset",
)
text = replace_once(
    text,
    '  async function openCreatedWork(type: "music_item" | "mission" | "task", id?: string, destination?: "files") {\n    if (type === "music_item") {\n      setTargetSongRoomTab(destination === "files" ? "files" : "overview");\n      setTargetMusicObjectId(id ?? null);',
    '  async function openCreatedWork(type: "music_item" | "mission" | "task", id?: string, destination?: "files", artifactId?: string) {\n    if (type === "music_item") {\n      setTargetSongRoomTab(destination === "files" ? "files" : "overview");\n      setTargetSongDocumentId(destination === "files" ? artifactId ?? null : null);\n      setTargetMusicObjectId(id ?? null);',
    "ProductionApp created-work deep link",
)
text = replace_once(
    text,
    '              targetSongRoomTab={targetSongRoomTab}\n              targetRequestKey={musicRoomOpenRequestKey}',
    '              targetSongRoomTab={targetSongRoomTab}\n              targetDocumentId={targetSongDocumentId}\n              targetRequestKey={musicRoomOpenRequestKey}',
    "ProductionApp MusicWorkspace document prop",
)
path.write_text(text)

# Manager UI: pass the canonical document id instead of only opening generic Files.
path = Path("src/features/manager/ManagerScreensLegacy.tsx")
text = path.read_text()
signature = 'onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination) => void | Promise<void>;'
signature_next = 'onOpenCreatedWork: (type: "music_item" | "mission" | "task", id?: string, destination?: CreatedWorkDestination, artifactId?: string) => void | Promise<void>;'
count = text.count(signature)
if count < 5:
    raise SystemExit(f"Manager callback signatures: expected >=5 matches, found {count}")
text = text.replace(signature, signature_next)
text = replace_once(
    text,
    '<ResultAction pendingLabel="Opening Files…" onClick={() => onOpenCreatedWork("music_item", musicItemId, "files")}>\n            {managerDocumentOpenLabel(item.documentType)}',
    '<ResultAction pendingLabel="Opening document…" onClick={() => onOpenCreatedWork("music_item", musicItemId, "files", item.id)}>\n            {managerDocumentOpenLabel(item.documentType)}',
    "Manager document button deep link",
)
path.write_text(text)

# MusicWorkspace: open the exact native document, refreshing the song first if needed.
path = Path("src/features/music/MusicScreens.tsx")
text = path.read_text()
text = replace_once(
    text,
    '  targetMusicObjectId,\n  targetSongRoomTab = "overview",\n  targetRequestKey = 0,',
    '  targetMusicObjectId,\n  targetSongRoomTab = "overview",\n  targetDocumentId,\n  targetRequestKey = 0,',
    "MusicWorkspace document destructure",
)
text = replace_once(
    text,
    '  targetMusicObjectId?: string | null;\n  targetSongRoomTab?: SongRoomTab;\n  targetRequestKey?: number;',
    '  targetMusicObjectId?: string | null;\n  targetSongRoomTab?: SongRoomTab;\n  targetDocumentId?: string | null;\n  targetRequestKey?: number;',
    "MusicWorkspace document prop type",
)
old_effect = '''  useEffect(() => {
    if (!targetMusicObjectId) return;
    const requestKey = `${targetMusicObjectId}:${targetSongRoomTab}:${targetRequestKey}`;
    if (handledTargetRequest.current === requestKey) return;
    const target = getMusicObject(targetMusicObjectId);
    if (!target) return;
    handledTargetRequest.current = requestKey;
    openObject(target, target.kind === "project" ? "projects" : "songs", targetSongRoomTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMusicObjectId, targetSongRoomTab, targetRequestKey, music]);'''
new_effect = '''  useEffect(() => {
    if (!targetMusicObjectId) return;
    const requestKey = `${targetMusicObjectId}:${targetSongRoomTab}:${targetDocumentId ?? ""}:${targetRequestKey}`;
    if (handledTargetRequest.current === requestKey) return;
    const target = getMusicObject(targetMusicObjectId);
    if (!target) return;
    handledTargetRequest.current = requestKey;
    openObject(target, target.kind === "project" ? "projects" : "songs", targetSongRoomTab);

    if (target.kind !== "song" || targetSongRoomTab !== "files" || !targetDocumentId) return;
    const localDocument = (target.materials ?? []).find(
      (material): material is Extract<SongMaterialViewModel, { kind: "document" }> =>
        material.kind === "document" && material.id === targetDocumentId,
    );
    if (localDocument) {
      setDocumentEditorTarget({ song: target, document: localDocument });
      return;
    }

    let cancelled = false;
    void onRefreshObject(target.id, "music_item")
      .then((refreshed) => {
        if (cancelled || !refreshed) return;
        const document = (refreshed.materials ?? []).find(
          (material): material is Extract<SongMaterialViewModel, { kind: "document" }> =>
            material.kind === "document" && material.id === targetDocumentId,
        );
        if (document) setDocumentEditorTarget({ song: refreshed, document });
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // The request key is the navigation contract. Object refresh is an intentional fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMusicObjectId, targetSongRoomTab, targetDocumentId, targetRequestKey, music]);'''
text = replace_once(text, old_effect, new_effect, "MusicWorkspace exact document effect")
path.write_text(text)

# A source contract guards the cross-screen wiring from regressing.
Path("src/manager-document-navigation-contract.test.ts").write_text('''import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager canonical document navigation contract", () => {
  it("carries the saved document id from Manager into the song document editor", () => {
    const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");
    const app = readFileSync("src/app/ProductionApp.tsx", "utf8");
    const music = readFileSync("src/features/music/MusicScreens.tsx", "utf8");

    expect(manager).toContain('onOpenCreatedWork("music_item", musicItemId, "files", item.id)');
    expect(app).toContain("targetSongDocumentId");
    expect(app).toContain("targetDocumentId={targetSongDocumentId}");
    expect(app).toContain("artifactId?: string");
    expect(music).toContain("targetDocumentId?: string | null");
    expect(music).toContain('material.kind === "document" && material.id === targetDocumentId');
    expect(music).toContain("setDocumentEditorTarget({ song: refreshed, document })");
  });
});
''')
