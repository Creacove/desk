from pathlib import Path

DIALOG = Path('src/features/music/MusicShareDialog.tsx')
text = DIALOG.read_text()
text = text.replace(
    'import { Check, Copy, ExternalLink, Link2, Loader2, Mail, RotateCcw, Trash2, X } from "lucide-react";\nimport { useEffect, useMemo, useState, type FormEvent } from "react";',
    'import { ArrowLeft, Check, ChevronRight, Copy, ExternalLink, FileText, Headphones, Image as ImageIcon, Loader2, Mail, Music2, Newspaper, PackageOpen, RotateCcw, SlidersHorizontal, Trash2, X, type LucideIcon } from "lucide-react";\nimport { useEffect, useMemo, useState, type FormEvent } from "react";\nimport { createPortal } from "react-dom";',
)
text = text.replace('type Mode = "build" | "preview" | "ready" | "manage";', 'type Mode = "audience" | "build" | "preview" | "ready" | "manage";')
text = text.replace('  const [mode, setMode] = useState<Mode>("build");', '  const [mode, setMode] = useState<Mode>("audience");\n  const [editingSelection, setEditingSelection] = useState(false);')
text = text.replace(
'''  function choosePurpose(next: SharePurpose) {
    setPurpose(next);
    setSelection(buildShareSelection(next, inventory));
    setError(null);
  }

  function toggle(group: keyof ShareSelection, id: string) {
    setSelection((current) => {
      const next = current[group].includes(id) ? current[group].filter((value) => value !== id) : [...current[group], id];
      return { ...current, [group]: next };
    });
    if (purpose !== "custom") setPurpose("custom");
  }
''',
'''  function choosePurpose(next: SharePurpose) {
    setPurpose(next);
    setSelection(buildShareSelection(next, inventory));
    setEditingSelection(next === "custom");
    setMode("build");
    setError(null);
  }

  function toggle(group: keyof ShareSelection, id: string) {
    setSelection((current) => {
      const next = current[group].includes(id) ? current[group].filter((value) => value !== id) : [...current[group], id];
      return { ...current, [group]: next };
    });
  }
''')
needle = '''  useEffect(() => {
    if (!onList) return;
    let active = true;
    onList({ type: "music_item", id: song.id }).then((links) => { if (active) setHistory(links); }).catch(() => undefined);
    return () => { active = false; };
  }, [onList, song.id]);
'''
insert = needle + '''
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);
'''
if needle not in text:
    raise SystemExit('history effect anchor missing')
text = text.replace(needle, insert, 1)
text = text.replace(
'''  function createAnother() {
    setCreated(null);
    setPurpose(initialPurpose);
    setSelection(buildShareSelection(initialPurpose, inventory));
    setMode("build");
    setError(null);
  }
''',
'''  function createAnother() {
    setCreated(null);
    setPurpose(initialPurpose);
    setSelection(buildShareSelection(initialPurpose, inventory));
    setEditingSelection(false);
    setMode("audience");
    setError(null);
  }
''')

start = text.index('  return (\n    <div className="fixed inset-0 z-[80]')
end_marker = '\n}\n\nfunction SelectionGroup'
end = text.index(end_marker, start)
new_return = r'''  const selectedAssets = inventory.assets.filter((asset) => selection.assetIds.includes(asset.id));
  const selectedDocuments = inventory.documents.filter((document) => selection.documentIds.includes(document.id));
  const selectedInformation = availableShareInformation(inventory).filter((field) => selection.informationKeys.includes(field.key) && !isIdentityInformation(field.key));
  const editableInformation = availableShareInformation(inventory).filter((field) => !isIdentityInformation(field.key));
  const draftCount = selectedDocuments.filter((document) => !document.approved).length;
  const materialCount = selectedAssets.length + selectedDocuments.length;
  const artistName = inventory.information.find((field) => field.key === "primary_artist")?.value || "";
  const activeHistory = history.filter((link) => link.state === "active");
  const inactiveHistory = history.filter((link) => link.state !== "active");

  const dialog = (
    <div className="fixed inset-0 z-[999] bg-background text-foreground sm:grid sm:place-items-center sm:bg-foreground/28 sm:p-5 sm:backdrop-blur-xl">
      <div role="dialog" aria-modal="true" aria-label={`Share ${song.title}`} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background sm:h-auto sm:max-h-[min(92vh,860px)] sm:w-[min(100%,48rem)] sm:rounded-[26px] sm:border sm:border-foreground/10 sm:shadow-[0_28px_90px_rgba(17,19,24,0.24)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-foreground/8 px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-muted-foreground">{mode === "audience" ? song.title : sharePurposeLabel(purpose)}</p>
            <h2 className="mt-0.5 font-display text-[24px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[28px]">{shareDialogTitle(mode, song.title, purpose)}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {mode === "audience" && history.length ? <button type="button" onClick={() => setMode("manage")} className="rounded-lg px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">Links</button> : null}
            <button type="button" onClick={onCancel} aria-label="Close" className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {mode === "audience" ? (
            <section className="mx-auto w-full max-w-2xl px-5 py-7 sm:px-8 sm:py-9">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.11em] text-muted-foreground/65">Who is this for?</p>
              <p className="mt-2 max-w-xl text-[15px] font-medium leading-6 text-foreground/72 sm:text-[16px]">Desk will prepare the right version of {song.title} for the person receiving it.</p>
              <div className="mt-6 grid gap-3">
                <RecipientChoice icon={Newspaper} title="Press & media" description="A polished press kit with music, visuals, EPK and press materials." recommended={initialPurpose === "epk_press"} onClick={() => choosePurpose("epk_press")} />
                <RecipientChoice icon={Headphones} title="A&R / private listen" description="A focused private listening page with the record and essential context." onClick={() => choosePurpose("listen")} />
                <RecipientChoice icon={PackageOpen} title="Label / distributor" description="Masters, artwork, credits and delivery information for operations." onClick={() => choosePurpose("delivery")} />
              </div>
              <button type="button" onClick={() => choosePurpose("custom")} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground"><SlidersHorizontal className="h-3.5 w-3.5" /> Build a custom package</button>
            </section>
          ) : null}

          {mode === "build" ? (
            <form id="music-share-builder" onSubmit={(event) => { event.preventDefault(); void openPreview(); }} className="mx-auto w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-8">
              <div className="overflow-hidden rounded-[20px] border border-foreground/8 bg-foreground/[0.018]">
                <div className="flex min-w-0 gap-4 p-4 sm:items-center sm:p-5">
                  {song.coverImageUrl ? <img src={song.coverImageUrl} alt={`${song.title} cover artwork`} className="h-20 w-20 shrink-0 rounded-[14px] object-cover sm:h-24 sm:w-24" /> : <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] bg-foreground/[0.055] text-muted-foreground sm:h-24 sm:w-24"><Music2 className="h-5 w-5" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/65">{packageEyebrow(purpose)}</p>
                    <h3 className="mt-1 font-display text-[21px] font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-[24px]">{packageTitle(song.title, purpose)}</h3>
                    {artistName ? <p className="mt-1 text-[12px] font-medium text-muted-foreground">{artistName}</p> : null}
                    <p className="mt-3 text-[11px] font-semibold text-foreground/65">{materialCount ? `${materialCount} ${materialCount === 1 ? "item" : "items"} ready` : "Choose what to include"}{draftCount ? ` · ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}` : ""}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-foreground">{purpose === "custom" ? "Package contents" : "Desk prepared this package"}</p>
                  <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Review the contents. Edit only if you need to.</p>
                </div>
                <button type="button" onClick={() => setEditingSelection((value) => !value)} className="shrink-0 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/[0.035]">{editingSelection ? "Done" : "Edit package"}</button>
              </div>

              {editingSelection ? (
                <div className="mt-5">
                  <SelectionGroup title="Music & visuals" items={inventory.assets.map((asset) => ({ id: asset.id, label: asset.label, meta: asset.group }))} selected={selection.assetIds} onToggle={(id) => toggle("assetIds", id)} />
                  {inventory.documents.length ? <SelectionGroup title="Documents" items={inventory.documents.map((document) => ({ id: document.id, label: publicDocumentTitle(document.title), meta: `${documentTypeLabel(document.documentType)} · ${document.approved ? "Approved" : "Draft"}` }))} selected={selection.documentIds} onToggle={(id) => toggle("documentIds", id)} /> : null}
                  {editableInformation.length ? <SelectionGroup title="Release details" items={editableInformation.map((field) => ({ id: field.key, label: field.label, meta: field.value }))} selected={selection.informationKeys} onToggle={(id) => toggle("informationKeys", id)} /> : null}
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {selectedAssets.length ? <PackageSummaryGroup title="Music & visuals" items={selectedAssets.map((asset) => ({ id: asset.id, label: asset.label, meta: asset.group, kind: asset.group === "Audio" ? "audio" as const : "image" as const }))} /> : null}
                  {selectedDocuments.length ? <PackageSummaryGroup title="Documents" items={selectedDocuments.map((document) => ({ id: document.id, label: publicDocumentTitle(document.title), meta: `${documentTypeLabel(document.documentType)}${document.approved ? "" : " · Draft"}`, kind: "document" as const }))} /> : null}
                  {selectedInformation.length ? <PackageSummaryGroup title="Release details" items={selectedInformation.map((field) => ({ id: field.key, label: field.label, meta: field.value, kind: "detail" as const }))} /> : null}
                  {!materialCount && !selectedInformation.length ? <button type="button" onClick={() => setEditingSelection(true)} className="rounded-[16px] border border-dashed border-foreground/14 px-5 py-8 text-center text-[12px] font-semibold text-muted-foreground hover:bg-foreground/[0.02]">Choose files and documents</button> : null}
                </div>
              )}

              {draftCount ? <p className="mt-4 text-[10px] font-medium leading-5 text-muted-foreground">Draft labels are for you only. Preview shows exactly what the recipient will receive before a link can be created.</p> : null}
              {error ? <p role="alert" className="mt-4 rounded-[12px] border border-danger/20 bg-danger/8 px-3.5 py-3 text-[11px] font-semibold text-danger">{error}</p> : null}
            </form>
          ) : null}

          {mode === "preview" && previewPackage ? (
            <section className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-7 sm:py-7">
              <div className="mb-4 flex items-center gap-2 px-2 text-[11px] font-medium text-muted-foreground"><Check className="h-3.5 w-3.5" /> This is exactly what the recipient will see.</div>
              <MusicSharePackageView sharePackage={previewPackage} />
              {draftCount ? <p className="mx-auto mt-4 max-w-xl text-center text-[10px] font-medium leading-5 text-muted-foreground">You reviewed a package containing {draftCount} {draftCount === 1 ? "draft" : "drafts"}. Creating the link shares this exact preview.</p> : null}
              {error ? <p role="alert" className="mt-4 rounded-[12px] border border-danger/20 bg-danger/8 px-3.5 py-3 text-[11px] font-semibold text-danger">{error}</p> : null}
            </section>
          ) : null}

          {mode === "ready" && created ? (
            <section className="mx-auto w-full max-w-xl px-5 py-10 sm:px-8 sm:py-12">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-5 w-5" /></span>
              <h3 className="mt-5 font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{revoked ? "Link revoked" : `${packageTitle(song.title, created.preset)} is ready.`}</h3>
              <p className="mt-2 text-[13px] font-medium leading-6 text-muted-foreground">{revoked ? "This package can no longer be opened." : "Share the private link. The recipient sees only the package you previewed."}</p>
              {!revoked ? (
                <div className="mt-7">
                  <div className="flex rounded-[14px] border border-foreground/10 bg-foreground/[0.02] p-1.5">
                    <input aria-label="Secure share link" readOnly value={created.url} className="min-w-0 flex-1 bg-transparent px-2 text-[11px] font-semibold text-foreground outline-none" />
                    <button type="button" aria-label="Copy link" onClick={() => void copyLink()} className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-foreground px-4 text-[11px] font-bold text-background"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy link"}</button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <a href={created.url} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] border border-foreground/10 text-[12px] font-semibold text-foreground hover:bg-foreground/[0.035]"><ExternalLink className="h-3.5 w-3.5" />Open package</a>
                    {onSend ? <button type="button" onClick={() => setEmailOpen((value) => !value)} className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] border border-foreground/10 text-[12px] font-semibold text-foreground hover:bg-foreground/[0.035]"><Mail className="h-3.5 w-3.5" />Send by email</button> : null}
                  </div>
                  {emailOpen && onSend ? (
                    <form onSubmit={sendEmail} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input type="email" required aria-label="Send by email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="h-11 min-w-0 rounded-[11px] border border-foreground/10 bg-background px-3 text-[12px] font-semibold outline-none focus:border-foreground" />
                      <button type="submit" disabled={pending || emailSent} className="h-11 rounded-[11px] bg-foreground px-5 text-[11px] font-bold text-background disabled:opacity-50">{emailSent ? "Sent" : "Send"}</button>
                    </form>
                  ) : null}
                  <div className="mt-7 flex items-center justify-between border-t border-foreground/8 pt-4">
                    <button type="button" onClick={createAnother} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" />Create another</button>
                    {onRevoke ? <button type="button" onClick={() => void revoke(created.id)} disabled={pending} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-danger disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Revoke</button> : null}
                  </div>
                </div>
              ) : <button type="button" onClick={createAnother} className="mt-7 rounded-[11px] bg-foreground px-5 py-3 text-[12px] font-semibold text-background">Create another package</button>}
            </section>
          ) : null}

          {mode === "manage" ? (
            <section className="mx-auto w-full max-w-xl px-5 py-7 sm:px-8">
              <button type="button" onClick={() => setMode("audience")} className="mb-5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Back to share</button>
              <LinkList links={activeHistory} empty="No active links." onRevoke={onRevoke ? (id) => void revoke(id) : undefined} />
              {inactiveHistory.length ? <details className="mt-5"><summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Past links ({inactiveHistory.length})</summary><div className="mt-3"><LinkList links={inactiveHistory} /></div></details> : null}
            </section>
          ) : null}
        </div>

        {mode === "build" ? (
          <footer className="shrink-0 border-t border-foreground/8 bg-background/96 px-5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7 sm:py-4">
            <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
              <button type="button" onClick={() => setMode("audience")} className="hidden h-12 shrink-0 items-center px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground sm:inline-flex">Change recipient</button>
              <div className="min-w-0 flex-1 sm:text-right"><p className="text-[10px] font-semibold text-muted-foreground">{materialCount} {materialCount === 1 ? "item" : "items"}{purpose === "custom" ? " selected" : " prepared"}</p></div>
              <button data-testid="share-primary-cta" type="submit" form="music-share-builder" disabled={!selectionCount(selection) || pending} className="inline-flex h-12 min-w-[12rem] flex-1 items-center justify-center gap-2 rounded-[12px] bg-foreground px-5 text-[12px] font-semibold text-background disabled:opacity-40 sm:flex-none">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{previewActionLabel(purpose)}<ChevronRight className="h-4 w-4" /></button>
            </div>
          </footer>
        ) : mode === "preview" ? (
          <footer className="shrink-0 border-t border-foreground/8 bg-background/96 px-5 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:px-7 sm:py-4">
            <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
              <button type="button" onClick={() => setMode("build")} className="inline-flex h-12 items-center justify-center rounded-[12px] border border-foreground/10 px-4 text-[12px] font-semibold text-foreground"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Back</button>
              <button type="button" onClick={() => void createLink()} disabled={pending} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[12px] bg-foreground px-5 text-[12px] font-semibold text-background disabled:opacity-40">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create private link</button>
            </div>
          </footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}'''
text = text[:start] + new_return + text[end + 2:]

# Replace the checkbox-heavy selection row with a calmer edit surface.
sel_start = text.index('function SelectionGroup(')
sel_end = text.index('\n\nfunction LinkList', sel_start)
new_selection = r'''function RecipientChoice({ icon: Icon, title, description, recommended = false, onClick }: { icon: LucideIcon; title: string; description: string; recommended?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 rounded-[18px] border border-foreground/9 bg-background px-4 py-4 text-left transition-all hover:border-foreground/16 hover:bg-foreground/[0.018] sm:px-5 sm:py-5">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-foreground/[0.055] text-foreground/70"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="text-[14px] font-semibold text-foreground sm:text-[15px]">{title}</span>{recommended ? <span className="rounded-full bg-foreground/[0.055] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Recommended</span> : null}</span>
        <span className="mt-1 block text-[11px] font-medium leading-5 text-muted-foreground sm:text-[12px]">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/55 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </button>
  );
}

function PackageSummaryGroup({ title, items }: { title: string; items: Array<{ id: string; label: string; meta: string; kind: "audio" | "image" | "document" | "detail" }> }) {
  if (!items.length) return null;
  return (
    <section className="overflow-hidden rounded-[16px] border border-foreground/8 bg-background">
      <div className="border-b border-foreground/7 px-4 py-2.5"><h4 className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/65">{title}</h4></div>
      <div className="divide-y divide-foreground/7">{items.map((item) => <div key={item.id} className="flex min-w-0 items-center gap-3 px-4 py-3"><SummaryGlyph kind={item.kind} /><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-foreground">{item.label}</p><p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">{item.meta}</p></div></div>)}</div>
    </section>
  );
}

function SummaryGlyph({ kind }: { kind: "audio" | "image" | "document" | "detail" }) {
  const cls = "h-3.5 w-3.5";
  return <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.05] text-muted-foreground">{kind === "audio" ? <Music2 className={cls} /> : kind === "image" ? <ImageIcon className={cls} /> : <FileText className={cls} />}</span>;
}

function SelectionGroup({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; label: string; meta: string }>; selected: string[]; onToggle: (id: string) => void }) {
  if (!items.length) return null;
  return <fieldset className="mt-5"><legend className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/65">{title}</legend><div className="mt-2 overflow-hidden rounded-[16px] border border-foreground/8 bg-background">{items.map((item, index) => { const checked = selected.includes(item.id); return <label key={item.id} className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.02] ${index ? "border-t border-foreground/7" : ""}`}><input type="checkbox" aria-label={item.label} checked={checked} onChange={() => onToggle(item.id)} className="sr-only" /><span aria-hidden="true" className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${checked ? "border-foreground bg-foreground text-background" : "border-foreground/18 bg-background text-transparent"}`}><Check className="h-3 w-3" /></span><span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-foreground">{item.label}</span><span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">{item.meta}</span></span></label>; })}</div></fieldset>;
}'''
text = text[:sel_start] + new_selection + text[sel_end:]

# Update descriptions and append presentation helpers before documentTypeLabel.
text = text.replace('return "Choose exactly what this recipient should receive. Only approved, recipient-safe documents are available.";', 'return "Choose exactly what this recipient should receive. Internal campaign strategy is never available for sharing.";')
helper_anchor = 'function documentTypeLabel(value: string)'
helpers = r'''function shareDialogTitle(mode: Mode, songTitle: string, purpose: SharePurpose) {
  if (mode === "audience") return `Share ${songTitle}`;
  if (mode === "preview") return "Recipient preview";
  if (mode === "ready") return "Share link ready";
  if (mode === "manage") return "Shared links";
  return packageTitle(songTitle, purpose);
}

function packageTitle(songTitle: string, purpose: SharePurpose) {
  if (purpose === "epk_press") return `${songTitle} — Press Kit`;
  if (purpose === "listen") return `${songTitle} — Private Listen`;
  if (purpose === "delivery") return `${songTitle} — Delivery Package`;
  return `${songTitle} — Custom Package`;
}

function packageEyebrow(purpose: SharePurpose) {
  if (purpose === "epk_press") return "Press & media";
  if (purpose === "listen") return "A&R / private listen";
  if (purpose === "delivery") return "Label / distributor";
  return "Custom share";
}

function previewActionLabel(purpose: SharePurpose) {
  if (purpose === "epk_press") return "Preview press kit";
  if (purpose === "listen") return "Preview private listen";
  if (purpose === "delivery") return "Preview delivery";
  return "Preview package";
}

function isIdentityInformation(key: string) {
  return key === "song_title" || key === "primary_artist";
}

'''
text = text.replace(helper_anchor, helpers + helper_anchor, 1)
DIALOG.write_text(text)

# Custom packages still include song/artist identity automatically. Identity is structural, not a checkbox.
PACKAGE = Path('src/features/music/musicSharePackage.ts')
p = PACKAGE.read_text()
p = p.replace('  if (purpose === "custom") return { assetIds: [], documentIds: [], informationKeys: [] };\n  const availableInformation = availableShareInformation(inventory);', '  const availableInformation = availableShareInformation(inventory);\n  if (purpose === "custom") return { assetIds: [], documentIds: [], informationKeys: availableInformation.filter((field) => IDENTITY_KEYS.has(field.key)).map((field) => field.key) };')
PACKAGE.write_text(p)

# Align tests with the recipient-first flow and draft visibility.
TEST = Path('src/music-share-dialog.test.tsx')
t = TEST.read_text()
t = t.replace('''    expect(screen.getByRole("button", { name: "Press / media" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Press release" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Lyrics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Release date" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Send by email" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preview package" }));''', '''    expect(screen.getByRole("heading", { name: "Share Jam" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Press & media/ }));
    expect(screen.getByRole("heading", { name: "Jam — Press Kit" })).toBeInTheDocument();
    expect(screen.getByText("Press release")).toBeInTheDocument();
    expect(screen.getByTestId("share-primary-cta")).toHaveTextContent("Preview press kit");
    expect(screen.queryByRole("textbox", { name: "Send by email" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Preview press kit/ }));''')
t = t.replace('''    fireEvent.click(screen.getByRole("button", { name: "Listen" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview package" }));''', '''    fireEvent.click(screen.getByRole("button", { name: /A&R \/ private listen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Preview private listen/ }));''')
t = t.replace('screen.findByRole("button", { name: "Create link" })', 'screen.findByRole("button", { name: "Create private link" })')
t = t.replace('''    render(<MusicShareDialog song={releaseDocumentsSong} onCancel={vi.fn()} onCreate={vi.fn()} />);

    expect(screen.getByRole("checkbox", { name: "Personalized press pitch" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Spotify editorial pitch" })).not.toBeChecked();''', '''    render(<MusicShareDialog song={releaseDocumentsSong} onCancel={vi.fn()} onCreate={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Build a custom package/ }));
    expect(screen.getByRole("checkbox", { name: "Personalized press pitch" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Spotify editorial pitch" })).not.toBeChecked();''')
TEST.write_text(t)

PKG_TEST = Path('src/music-share-package.test.ts')
pt = PKG_TEST.read_text()
pt = pt.replace('{ id: "draft-one-sheet", title: "One-sheet", documentType: "one_sheet", body: "Draft one-sheet", ready: false },', '{ id: "draft-one-sheet", title: "One-sheet", documentType: "one_sheet", body: "Draft one-sheet", ready: true, approved: false },')
pt = pt.replace('documentIds: ["epk", "press", "bio", "credits"],', 'documentIds: ["epk", "press", "bio", "credits", "draft-one-sheet"],')
pt = pt.replace('it("starts Custom empty and detects when a preset has been changed", () => {\n    expect(buildShareSelection("custom", inventory)).toEqual({ assetIds: [], documentIds: [], informationKeys: [] });', 'it("keeps identity structural in Custom and detects when a preset has been changed", () => {\n    expect(buildShareSelection("custom", inventory)).toEqual({ assetIds: [], documentIds: [], informationKeys: ["song_title", "primary_artist"] });')
PKG_TEST.write_text(pt)
