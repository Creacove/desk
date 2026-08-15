import { useMemo, useState, type FormEvent } from "react";
import { Check, FileText, Pencil, ShieldCheck, X } from "lucide-react";

import type { SongDocumentType, SongMaterialViewModel } from "../../types/cleanProduction";

const DOCUMENT_TYPES: Array<{ value: SongDocumentType; label: string }> = [
  { value: "epk", label: "EPK" },
  { value: "artist_biography", label: "Artist biography" },
  { value: "one_sheet", label: "One-sheet" },
  { value: "press_release", label: "Press release" },
  { value: "press_angle", label: "Press angles" },
  { value: "spotify_editorial_pitch", label: "Spotify editorial pitch" },
  { value: "playlist_pitch", label: "Playlist pitch" },
  { value: "press_target_brief", label: "Press target brief" },
  { value: "press_pitch", label: "Press pitch" },
  { value: "content_plan", label: "Content plan" },
  { value: "release_calendar", label: "Release calendar" },
  { value: "lyrics", label: "Lyrics" },
  { value: "credits", label: "Credits" },
  { value: "distributor_notes", label: "Distributor notes" },
  { value: "other", label: "Other document" },
];

export function SongDocumentEditor({
  document,
  pending,
  error,
  onCancel,
  onSave,
  onApprove,
}: {
  document?: Extract<SongMaterialViewModel, { kind: "document" }>;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (input: { documentType: SongDocumentType; title: string; body: string }) => Promise<void> | void;
  onApprove?: () => Promise<void> | void;
}) {
  const managerArtifact = Boolean(document?.origin === "manager_generated" && document.body?.trim());
  const [editing, setEditing] = useState(!managerArtifact);
  const [documentType, setDocumentType] = useState<SongDocumentType>(document?.materialType ?? "press_release");
  const [title, setTitle] = useState(document?.title ?? "Press release");
  const [body, setBody] = useState(document?.body ?? "");
  const preview = useMemo(() => parseStructuredMarkdown(body), [body]);
  const structuredArtifact = managerArtifact && Boolean(preview.purpose && preview.audience && (preview.sections.length || preview.coreNarrative));
  const internalNarrative = document?.title.trim().toLowerCase() === "release narrative";
  const approved = document?.status === "accepted";
  const canApprove = Boolean(managerArtifact && !internalNarrative && !approved && document?.reviewState === "ready" && onApprove);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || pending) return;
    void onSave({ documentType, title: title.trim(), body });
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/28 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="song-document-editor-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-foreground/10 bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-foreground/[0.055] text-muted-foreground"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{internalNarrative ? "Internal campaign spine" : managerArtifact ? "Manager-built artifact" : "Song document"}</p>
                {structuredArtifact ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/9 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-success"><ShieldCheck className="h-3 w-3" /> Quality checked</span>
                ) : null}
                {approved ? <span className="inline-flex items-center gap-1 rounded-full bg-success/9 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-success"><Check className="h-3 w-3" /> Approved</span> : null}
                {document?.reviewState === "needs_review" ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-warning">Review draft</span> : null}
              </div>
              <h2 id="song-document-editor-title" className="mt-1 truncate font-display text-[22px] font-semibold text-foreground">{document ? title : "Write here"}</h2>
              {managerArtifact && !editing ? <p className="mt-1 text-[11px] font-medium text-muted-foreground">Read the artifact first. Approve the exact canonical version when it is ready to leave Desk, or edit only when you want to take manual control of the copy.</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {managerArtifact && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.04]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            ) : null}
            <button type="button" aria-label="Close document editor" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </header>

        {editing ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:p-6">
            {structuredArtifact ? <p className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] px-3.5 py-3 text-[11px] font-medium leading-relaxed text-muted-foreground">This Manager artifact passed the structured document pipeline. Saving a manual edit creates a user-controlled revision of the readable copy.</p> : null}
            <div className="grid gap-4 sm:grid-cols-[190px_minmax(0,1fr)]">
              <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">Type
                <select aria-label="Document type" value={documentType} disabled={Boolean(document)} onChange={(event) => setDocumentType(event.target.value as SongDocumentType)} className="h-10 rounded-[10px] border border-foreground/12 bg-background px-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-brand-accent/25">
                  {DOCUMENT_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">Title
                <input aria-label="Document title" value={title} onChange={(event) => setTitle(event.target.value)} className="h-10 rounded-[10px] border border-foreground/12 bg-background px-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-brand-accent/25" />
              </label>
            </div>
            <label className="grid min-h-[320px] gap-1.5 text-[11px] font-semibold text-muted-foreground">Content
              <textarea aria-label="Document content" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Start writing…" className="min-h-[360px] resize-y rounded-[14px] border border-foreground/12 bg-background p-4 font-body text-[14px] leading-7 text-foreground outline-none focus:ring-2 focus:ring-brand-accent/25" />
            </label>
            {error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
          </div>
        ) : (
          <StructuredDocumentPreview preview={preview} internalNarrative={internalNarrative} />
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-foreground/8 px-5 py-4 sm:px-6">
          <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">{approved ? "This exact version is approved for private sharing." : managerArtifact && !editing ? "Canonical copy saved in this song’s Files." : "Changes stay attached to this song."}</p>
          <div className="ml-auto flex gap-2">
            {editing && managerArtifact ? <button type="button" onClick={() => { setTitle(document?.title ?? title); setBody(document?.body ?? body); setEditing(false); }} className="h-9 rounded-lg border border-foreground/10 px-3 text-[12px] font-semibold text-foreground">Back to preview</button> : null}
            <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-foreground/10 px-3 text-[12px] font-semibold text-foreground">Close</button>
            {canApprove && !editing ? <button type="button" disabled={pending} onClick={() => void onApprove?.()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12px] font-semibold text-background disabled:opacity-40"><Check className="h-3.5 w-3.5" /> {pending ? "Approving…" : "Approve for sharing"}</button> : null}
            {editing ? <button type="submit" disabled={pending || !title.trim() || !body.trim()} className="h-9 rounded-lg bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background disabled:opacity-40">{pending ? "Saving…" : "Save revision"}</button> : null}
          </div>
        </footer>
      </form>
    </div>
  );
}

function StructuredDocumentPreview({ preview, internalNarrative }: { preview: ReturnType<typeof parseStructuredMarkdown>; internalNarrative: boolean }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-foreground/[0.012] px-5 py-6 sm:px-8 sm:py-8">
      <article className="mx-auto max-w-3xl">
        {internalNarrative ? <div className="mb-6 rounded-[14px] border border-brand-accent/14 bg-brand-accent/[0.035] px-4 py-3 text-[11px] font-medium leading-relaxed text-foreground/75">This is the internal strategic spine for the campaign. EPKs, one-sheets, bios, press copy and pitches should inherit this story rather than inventing their own positioning.</div> : null}
        {(preview.purpose || preview.audience || preview.coreNarrative) ? (
          <div className="mb-7 grid gap-4 border-b border-foreground/8 pb-6 sm:grid-cols-2">
            {preview.purpose ? <PreviewMeta label="Purpose" value={preview.purpose} /> : null}
            {preview.audience ? <PreviewMeta label="Audience" value={preview.audience} /> : null}
            {preview.coreNarrative ? <div className="sm:col-span-2 rounded-[16px] bg-foreground/[0.035] px-4 py-4"><p className="font-ui text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">Core narrative</p><p className="mt-2 text-[14px] font-semibold leading-6 text-foreground/90">{preview.coreNarrative}</p></div> : null}
          </div>
        ) : null}

        <div className="grid gap-7">
          {preview.sections.length ? preview.sections.map((section) => (
            <section key={`${section.title}-${section.content.slice(0, 24)}`}>
              <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{section.title}</p>
              <div className="mt-2 whitespace-pre-line text-[14px] font-medium leading-7 text-foreground/88">{section.content}</div>
            </section>
          )) : <p className="whitespace-pre-line text-[14px] font-medium leading-7 text-foreground/88">{preview.fallback}</p>}
        </div>

        {preview.needsVerification.length ? (
          <section className="mt-8 rounded-[14px] border border-warning/16 bg-warning/[0.04] p-4">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.09em] text-warning">Needs verification</p>
            <div className="mt-2 grid gap-2">{preview.needsVerification.map((item) => <p key={item} className="flex items-start gap-2 text-[12px] font-medium leading-5 text-foreground/78"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />{item}</p>)}</div>
          </section>
        ) : (
          <p className="mt-8 flex items-center gap-1.5 border-t border-foreground/8 pt-4 text-[10px] font-semibold text-muted-foreground"><Check className="h-3.5 w-3.5 text-success" /> No unresolved placeholders are exposed in this artifact.</p>
        )}
      </article>
    </div>
  );
}

function PreviewMeta({ label, value }: { label: string; value: string }) {
  return <div><p className="font-ui text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{label}</p><p className="mt-1.5 text-[12px] font-medium leading-5 text-foreground/82">{value}</p></div>;
}

function parseStructuredMarkdown(body: string) {
  const normalized = body.replace(/\r\n/g, "\n").trim();
  const purpose = normalized.match(/^\*\*Purpose:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "";
  const audience = normalized.match(/^\*\*Audience:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "";
  const coreNarrative = normalized.match(/^\*\*Core narrative:\*\*\s*(.+)$/m)?.[1]?.trim() ?? "";
  const parsedSections = normalized
    .split(/^##\s+/m)
    .slice(1)
    .map((chunk) => {
      const lineBreak = chunk.indexOf("\n");
      if (lineBreak < 0) return { title: chunk.trim(), content: "" };
      return {
        title: chunk.slice(0, lineBreak).trim(),
        content: chunk.slice(lineBreak + 1).trim(),
      };
    })
    .filter((section) => section.title);
  const needsSection = parsedSections.find((section) => section.title.toLowerCase() === "needs verification")?.content ?? "";
  const sections = parsedSections.filter((section) => section.title.toLowerCase() !== "needs verification");
  const needsVerification = needsSection.split("\n").map((line) => line.replace(/^[-*]\s*/, "").trim()).filter(Boolean);
  const fallback = normalized
    .replace(/^#\s+.*$/m, "")
    .replace(/^>\s+.*$/gm, "")
    .replace(/^\*\*(Purpose|Audience|Core narrative):\*\*.*$/gm, "")
    .trim();
  return { purpose, audience, coreNarrative, sections, needsVerification, fallback };
}