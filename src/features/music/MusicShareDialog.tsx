import { Check, Copy, ExternalLink, Link2, Loader2, Mail, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicMusicSharePackage } from "../../services/publicMusicShare";
import type { MusicObjectViewModel, MusicRepository, MusicShareLinkHistoryViewModel, SongMaterialViewModel } from "../../types/cleanProduction";
import { MusicSharePackageView } from "./MusicSharePackageView";
import { availableShareInformation, buildShareSelection, sharePurposeLabel, type ShareInventory, type SharePurpose, type ShareSelection } from "./musicSharePackage";

type DocumentMaterial = Extract<SongMaterialViewModel, { kind: "document" }>;
type Mode = "build" | "preview" | "ready" | "manage";

export function MusicShareDialog({
  song,
  onCancel,
  onCreate,
  onList,
  onSend,
  onRevoke,
  onRequestAssetAccess,
}: {
  song: MusicObjectViewModel;
  onCancel: () => void;
  onCreate: NonNullable<MusicRepository["createShareLink"]>;
  onList?: NonNullable<MusicRepository["listShareLinks"]>;
  onSend?: NonNullable<MusicRepository["sendShareLink"]>;
  onRevoke?: NonNullable<MusicRepository["revokeShareLink"]>;
  onRequestAssetAccess?: (assetId: string) => Promise<string>;
}) {
  const inventory = useMemo(() => buildInventory(song), [song]);
  const initialPurpose = useMemo<SharePurpose>(() => inventory.documents.some((document) => document.ready && Boolean(document.body?.trim())) ? "epk_press" : "listen", [inventory]);
  const [purpose, setPurpose] = useState<SharePurpose>(initialPurpose);
  const [selection, setSelection] = useState<ShareSelection>(() => buildShareSelection(initialPurpose, inventory));
  const [mode, setMode] = useState<Mode>("build");
  const [previewPackage, setPreviewPackage] = useState<PublicMusicSharePackage | null>(null);
  const [created, setCreated] = useState<{ id: string; url: string; label: string; preset: SharePurpose } | null>(null);
  const [history, setHistory] = useState<MusicShareLinkHistoryViewModel[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [revoked, setRevoked] = useState(false);

  useEffect(() => {
    if (!onList) return;
    let active = true;
    onList({ type: "music_item", id: song.id }).then((links) => { if (active) setHistory(links); }).catch(() => undefined);
    return () => { active = false; };
  }, [onList, song.id]);

  function choosePurpose(next: SharePurpose) {
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

  async function openPreview() {
    if (!selectionCount(selection)) return;
    setPending(true);
    setError(null);
    try {
      setPreviewPackage(await composePreview(song, inventory, selection, purpose, onRequestAssetAccess));
      setMode("preview");
    } catch {
      setError("Preview could not be prepared. Your selection is unchanged.");
    } finally {
      setPending(false);
    }
  }

  async function createLink(event?: FormEvent) {
    event?.preventDefault();
    if (!selectionCount(selection) || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await onCreate({
        musicSubject: { type: "music_item", id: song.id },
        assetIds: selection.assetIds,
        documentIds: selection.documentIds,
        informationKeys: selection.informationKeys,
        preset: purpose,
      });
      setCreated({ id: result.id, url: result.url, label: result.label, preset: result.preset });
      setHistory((current) => [{ id: result.id, label: result.label, preset: result.preset, state: "active", createdAt: result.createdAt, assetCount: selection.assetIds.length, accessCount: 0 }, ...current.filter((link) => link.id !== result.id)]);
      setCopied(false);
      setRevoked(false);
      setEmailOpen(false);
      setEmailSent(false);
      setMode("ready");
    } catch (cause) {
      setError(readError(cause, "Share link could not be created. Try again."));
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setError("Copy is unavailable here. Select the link and copy it manually.");
    }
  }

  async function sendEmail(event: FormEvent) {
    event.preventDefault();
    if (!created || !onSend || !email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      await onSend({ shareLinkId: created.id, url: created.url, recipientEmail: email.trim() });
      setEmailSent(true);
    } catch {
      setError("The link is ready, but the email could not be sent. Copy the link instead.");
    } finally {
      setPending(false);
    }
  }

  async function revoke(linkId: string) {
    if (!onRevoke || pending) return;
    setPending(true);
    setError(null);
    try {
      await onRevoke(linkId);
      setHistory((current) => current.map((link) => link.id === linkId ? { ...link, state: "revoked" } : link));
      if (created?.id === linkId) setRevoked(true);
    } catch {
      setError("Share link could not be revoked. Try again.");
    } finally {
      setPending(false);
    }
  }

  function createAnother() {
    setCreated(null);
    setPurpose(initialPurpose);
    setSelection(buildShareSelection(initialPurpose, inventory));
    setMode("build");
    setError(null);
  }

  const activeHistory = history.filter((link) => link.state === "active");
  const inactiveHistory = history.filter((link) => link.state !== "active");

  return (
    <div className="fixed inset-0 z-[80] grid bg-foreground/25 backdrop-blur-xl sm:place-items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={`Share ${song.title} files`} className="flex h-[100dvh] w-full flex-col overflow-hidden bg-background shadow-[0_24px_70px_rgba(17,19,24,0.22)] sm:h-auto sm:max-h-[min(88vh,760px)] sm:w-[min(100%,43rem)] sm:rounded-[22px] sm:border sm:border-foreground/10">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-foreground/8 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-muted-foreground">{song.title}</p>
            <h2 className="mt-0.5 font-display text-[22px] font-bold leading-tight text-foreground">{mode === "ready" ? "Link ready" : mode === "manage" ? "Manage links" : mode === "preview" ? "Package preview" : "Share song"}</h2>
          </div>
          <div className="flex items-center gap-1">
            {mode === "build" && history.length ? <button type="button" onClick={() => setMode("manage")} className="rounded-lg px-3 py-2 text-[11px] font-bold text-muted-foreground hover:bg-foreground/5 hover:text-foreground">Manage links</button> : null}
            <button type="button" onClick={onCancel} aria-label="Close" className="rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {mode === "build" ? (
            <form id="music-share-builder" onSubmit={createLink} className="px-5 py-5 sm:px-6">
              <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-foreground/[0.045] p-1" aria-label="Package type">
                {(["listen", "epk_press", "delivery", "custom"] as SharePurpose[]).map((value) => (
                  <button key={value} type="button" aria-pressed={purpose === value} onClick={() => choosePurpose(value)} className={`rounded-[9px] px-2 py-2.5 text-[11px] font-bold transition ${purpose === value ? "bg-background text-foreground shadow-sm ring-1 ring-foreground/8" : "text-muted-foreground hover:text-foreground"}`}>{sharePurposeLabel(value)}</button>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{purposeDescription(purpose)}</p>
              <SelectionGroup title="Audio & images" items={inventory.assets.map((asset) => ({ id: asset.id, label: asset.label, meta: asset.group }))} selected={selection.assetIds} onToggle={(id) => toggle("assetIds", id)} />
              {inventory.documents.length ? <SelectionGroup title="Documents" items={inventory.documents.map((document) => ({ id: document.id, label: document.title, meta: documentTypeLabel(document.documentType) }))} selected={selection.documentIds} onToggle={(id) => toggle("documentIds", id)} /> : null}
              {availableShareInformation(inventory).length ? <SelectionGroup title="Song details" items={availableShareInformation(inventory).map((field) => ({ id: field.key, label: field.label, meta: field.value }))} selected={selection.informationKeys} onToggle={(id) => toggle("informationKeys", id)} /> : null}
            </form>
          ) : null}

          {mode === "preview" && previewPackage ? <div className="p-4 sm:p-6"><MusicSharePackageView sharePackage={previewPackage} compact /></div> : null}

          {mode === "ready" && created ? (
            <section className="px-5 py-8 sm:px-8">
              <div className="mx-auto max-w-md text-center">
                <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success"><Check className="h-5 w-5" /></span>
                <p className="mt-4 text-[13px] font-semibold text-muted-foreground">{revoked ? "This package is no longer accessible." : `${sharePurposeLabel(created.preset)} is ready to share.`}</p>
              </div>
              {!revoked ? (
                <div className="mx-auto mt-6 max-w-lg">
                  <div className="flex rounded-[12px] border border-foreground/10 bg-foreground/[0.02] p-1.5">
                    <input aria-label="Secure share link" readOnly value={created.url} className="min-w-0 flex-1 bg-transparent px-2 text-[11px] font-semibold text-foreground outline-none" />
                    <button type="button" aria-label="Copy link" onClick={() => void copyLink()} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-foreground px-3 text-[11px] font-bold text-background"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <a href={created.url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-foreground/10 text-[12px] font-bold text-foreground hover:bg-foreground/[0.035]"><ExternalLink className="h-3.5 w-3.5" />Open package</a>
                    {onSend ? <button type="button" onClick={() => setEmailOpen((value) => !value)} className="inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-foreground/10 text-[12px] font-bold text-foreground hover:bg-foreground/[0.035]"><Mail className="h-3.5 w-3.5" />Send by email</button> : null}
                  </div>
                  {emailOpen && onSend ? (
                    <form onSubmit={sendEmail} className="mt-3 flex gap-2">
                      <input type="email" required aria-label="Send by email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" className="h-10 min-w-0 flex-1 rounded-[10px] border border-foreground/10 bg-background px-3 text-[12px] font-semibold outline-none focus:border-foreground" />
                      <button type="submit" disabled={pending || emailSent} className="h-10 rounded-[10px] bg-foreground px-4 text-[11px] font-bold text-background disabled:opacity-50">{emailSent ? "Sent" : "Send"}</button>
                    </form>
                  ) : null}
                  <div className="mt-6 flex items-center justify-between border-t border-foreground/8 pt-4">
                    <button type="button" onClick={createAnother} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"><RotateCcw className="h-3.5 w-3.5" />Create another</button>
                    {onRevoke ? <button type="button" onClick={() => void revoke(created.id)} disabled={pending} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-danger disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Revoke link</button> : null}
                  </div>
                </div>
              ) : <div className="mt-6 text-center"><button type="button" onClick={createAnother} className="rounded-[10px] bg-foreground px-4 py-2.5 text-[12px] font-bold text-background">Create another</button></div>}
            </section>
          ) : null}

          {mode === "manage" ? (
            <section className="px-5 py-5 sm:px-6">
              <LinkList links={activeHistory} empty="No active links." onRevoke={onRevoke ? (id) => void revoke(id) : undefined} />
              {inactiveHistory.length ? <details className="mt-5"><summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">Past links ({inactiveHistory.length})</summary><div className="mt-3"><LinkList links={inactiveHistory} /></div></details> : null}
            </section>
          ) : null}
          {error ? <p role="alert" className="mx-5 mb-4 rounded-[10px] border border-danger/20 bg-danger/8 px-3 py-2.5 text-[11px] font-semibold text-danger sm:mx-6">{error}</p> : null}
        </div>

        {mode === "build" ? (
          <footer className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-foreground/8 bg-background/95 px-5 py-4 backdrop-blur sm:px-6">
            <button type="button" onClick={() => void openPreview()} disabled={!selectionCount(selection) || pending} className="h-10 rounded-[10px] border border-foreground/10 px-4 text-[12px] font-bold text-foreground disabled:opacity-40">Preview</button>
            <button type="submit" form="music-share-builder" disabled={!selectionCount(selection) || pending} className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-foreground px-5 text-[12px] font-bold text-background disabled:opacity-40">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}Create link</button>
          </footer>
        ) : mode === "preview" ? (
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-foreground/8 bg-background px-5 py-4 sm:px-6"><button type="button" onClick={() => setMode("build")} className="h-10 rounded-[10px] border border-foreground/10 px-4 text-[12px] font-bold">Back</button><button type="button" onClick={() => void createLink()} disabled={pending} className="h-10 rounded-[10px] bg-foreground px-5 text-[12px] font-bold text-background">Create link</button></footer>
        ) : mode === "manage" ? <footer className="flex shrink-0 justify-end border-t border-foreground/8 px-5 py-4 sm:px-6"><button type="button" onClick={() => setMode("build")} className="h-10 rounded-[10px] bg-foreground px-4 text-[12px] font-bold text-background">Done</button></footer> : null}
      </div>
    </div>
  );
}

function SelectionGroup({ title, items, selected, onToggle }: { title: string; items: Array<{ id: string; label: string; meta: string }>; selected: string[]; onToggle: (id: string) => void }) {
  if (!items.length) return null;
  return <fieldset className="mt-6"><legend className="text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground/70">{title}</legend><div className="mt-2 divide-y divide-foreground/7 rounded-[14px] border border-foreground/8">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-3 px-3.5 py-3 hover:bg-foreground/[0.025]"><input type="checkbox" aria-label={item.label} checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} className="h-4 w-4 accent-foreground" /><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-foreground">{item.label}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-muted-foreground/65">{item.meta}</span></span></label>)}</div></fieldset>;
}

function LinkList({ links, empty, onRevoke }: { links: MusicShareLinkHistoryViewModel[]; empty?: string; onRevoke?: (id: string) => void }) {
  if (!links.length) return <p className="py-8 text-center text-[12px] font-semibold text-muted-foreground">{empty}</p>;
  return <div className="divide-y divide-foreground/7 rounded-[14px] border border-foreground/8">{links.map((link) => <div key={link.id} className="flex items-center gap-3 px-3.5 py-3"><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-bold text-foreground">{link.label}</p><p className="mt-0.5 text-[10px] font-semibold text-muted-foreground/65">{sharePurposeLabel(link.preset)}{link.accessCount ? ` · opened ${link.accessCount}×` : ""}</p></div>{onRevoke && link.state === "active" ? <button type="button" onClick={() => onRevoke(link.id)} aria-label={`Revoke ${link.label}`} className="text-[10px] font-bold text-danger">Revoke</button> : <span className="text-[10px] font-bold capitalize text-muted-foreground">{link.state}</span>}</div>)}</div>;
}

function buildInventory(song: MusicObjectViewModel): ShareInventory {
  const documents = (song.materials ?? []).filter((material): material is DocumentMaterial => isShareableSongDocument(material));
  return {
    assets: (song.fileAssets ?? []).filter((asset) => Boolean(asset.assetId) && ["uploaded", "confirmed", "cleared"].includes(asset.status.toLowerCase())).map((asset) => ({ id: asset.assetId!, group: asset.group, label: asset.label, assetType: asset.assetType })),
    documents: documents.map((document) => ({ id: document.id, title: document.title, documentType: document.materialType, body: document.body, ready: true })),
    information: [
      { key: "song_title", label: "Song title", value: song.title },
      { key: "primary_artist", label: "Primary artist", value: fieldValue(song, "Primary artist") },
      { key: "release_date", label: "Release date", value: fieldValue(song, "Release date") },
      { key: "genre", label: "Genre", value: fieldValue(song, "Genre") },
      { key: "label", label: "Record label", value: fieldValue(song, "Record label") || fieldValue(song, "Label") },
    ],
  };
}

export function isShareableSongDocument(material: DocumentMaterial) {
  if (material.reviewState === "needs_review" || !material.body?.trim()) return false;
  if (material.origin === "manager_generated") {
    return ["accepted", "ready", "published"].includes(material.status.trim().toLowerCase());
  }
  return true;
}

function fieldValue(song: MusicObjectViewModel, label: string) {
  const field = [...(song.metadataFields ?? []), ...(song.releaseFields ?? []), ...(song.details ?? [])].find((entry) => entry.label.toLowerCase() === label.toLowerCase());
  return field?.status.toLowerCase() === "missing" ? "" : field?.value?.trim() ?? "";
}

async function composePreview(song: MusicObjectViewModel, inventory: ShareInventory, selection: ShareSelection, purpose: SharePurpose, access?: (assetId: string) => Promise<string>): Promise<PublicMusicSharePackage> {
  const assets = await Promise.all(inventory.assets.filter((asset) => selection.assetIds.includes(asset.id)).map(async (asset) => {
    const url = access ? await access(asset.id) : song.coverImageUrl && asset.group === "Artwork" ? song.coverImageUrl : "https://preview.ordersounds.local/file";
    return { id: asset.id, title: asset.label, assetType: asset.assetType ?? "asset", fileName: asset.label, fileType: asset.group === "Audio" ? "audio/mpeg" : asset.group === "Artwork" ? "image/jpeg" : "application/octet-stream", inlineUrl: url, downloadUrl: url };
  }));
  const information = [
    ...inventory.documents.filter((document) => selection.documentIds.includes(document.id)).map((document) => ({ key: `document:${document.id}`, title: document.title, value: document.body ?? "", documentType: document.documentType })),
    ...inventory.information.filter((field) => selection.informationKeys.includes(field.key)).map((field) => ({ key: field.key, title: field.label, value: field.value })),
  ];
  return { label: `${song.title} private package`, title: song.title, artist: inventory.information.find((field) => field.key === "primary_artist")?.value, preset: purpose, assets, information };
}

function purposeDescription(purpose: SharePurpose) {
  if (purpose === "listen") return "A clean private listen with the current master and artwork.";
  if (purpose === "epk_press") return "Music, approved images, and ready press materials.";
  if (purpose === "delivery") return "The current master, artwork, and completed delivery details.";
  return "Choose exactly what this person should receive.";
}

function documentTypeLabel(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function selectionCount(selection: ShareSelection) { return selection.assetIds.length + selection.documentIds.length + selection.informationKeys.length; }
function readError(value: unknown, fallback: string) { return value instanceof Error && value.message ? value.message : fallback; }
