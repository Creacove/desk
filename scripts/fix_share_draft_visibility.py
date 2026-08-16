from pathlib import Path

pkg = Path('src/features/music/musicSharePackage.ts')
text = pkg.read_text()
text = text.replace('    body?: string;\n    ready: boolean;\n', '    body?: string;\n    ready: boolean;\n    approved?: boolean;\n', 1)
pkg.write_text(text)

dialog = Path('src/features/music/MusicShareDialog.tsx')
text = dialog.read_text()
text = text.replace('''            <form id="music-share-builder" onSubmit={createLink} className="px-5 py-5 sm:px-6">''', '''            <form id="music-share-builder" onSubmit={(event) => { event.preventDefault(); void openPreview(); }} className="px-5 py-5 sm:px-6">''', 1)
text = text.replace('''              {inventory.documents.length ? <SelectionGroup title="Documents" items={inventory.documents.map((document) => ({ id: document.id, label: publicDocumentTitle(document.title), meta: documentTypeLabel(document.documentType) }))} selected={selection.documentIds} onToggle={(id) => toggle("documentIds", id)} /> : null}''', '''              {inventory.documents.length ? <SelectionGroup title="Documents" items={inventory.documents.map((document) => ({ id: document.id, label: publicDocumentTitle(document.title), meta: `${documentTypeLabel(document.documentType)} · ${document.approved ? "Approved" : "Draft"}` }))} selected={selection.documentIds} onToggle={(id) => toggle("documentIds", id)} /> : null}''', 1)
text = text.replace('''            <button type="button" onClick={() => void openPreview()} disabled={!selectionCount(selection) || pending} className="h-10 rounded-[10px] border border-foreground/10 px-4 text-[12px] font-bold text-foreground disabled:opacity-40">Preview</button>\n            <button type="submit" form="music-share-builder" disabled={!selectionCount(selection) || pending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-foreground px-5 text-[12px] font-bold text-background disabled:opacity-40">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}Create link</button>''', '''            <button type="submit" form="music-share-builder" disabled={!selectionCount(selection) || pending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-foreground px-5 text-[12px] font-bold text-background disabled:opacity-40">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}Preview package</button>''', 1)
text = text.replace('''    documents: documents.map((document) => ({ id: document.id, title: document.title, documentType: document.materialType, body: document.body, ready: true })),''', '''    documents: documents.map((document) => ({ id: document.id, title: document.title, documentType: document.materialType, body: document.body, ready: true, approved: ["accepted", "ready", "published"].includes(document.status.trim().toLowerCase()) })),''', 1)
start = text.index('export function isShareableSongDocument')
end = text.index('\nfunction isInternalCampaignDocument', start)
text = text[:start] + '''export function isShareableSongDocument(material: DocumentMaterial) {\n  if (isInternalCampaignDocument(material)) return false;\n  return Boolean(material.body?.trim());\n}\n''' + text[end:]
dialog.write_text(text)

edge = Path('supabase/functions/music-share-links/index.ts')
source = edge.read_text()
source = source.replace('''    if (document.origin === "manager_generated" && document.status !== "accepted") {\n      throw new Error("Manager-built documents must be approved before sharing.");\n    }\n''', '', 1)
edge.write_text(source)

test_path = Path('src/music-share-dialog.test.tsx')
test = test_path.read_text()
test = test.replace('screen.getByRole("button", { name: "Preview" })', 'screen.getByRole("button", { name: "Preview package" })')
test = test.replace('''    fireEvent.click(screen.getByRole("button", { name: "Listen" }));\n    fireEvent.click(screen.getByRole("button", { name: "Create link" }));''', '''    fireEvent.click(screen.getByRole("button", { name: "Listen" }));\n    fireEvent.click(screen.getByRole("button", { name: "Preview package" }));\n    fireEvent.click(await screen.findByRole("button", { name: "Create link" }));''', 1)
test = test.replace('expect(screen.queryByRole("checkbox", { name: "Spotify editorial pitch" })).not.toBeInTheDocument();', 'expect(screen.getByRole("checkbox", { name: "Spotify editorial pitch" })).not.toBeChecked();', 1)
test_path.write_text(test)
