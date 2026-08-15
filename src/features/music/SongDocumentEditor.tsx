import { useState, type FormEvent } from "react";
import { FileText, X } from "lucide-react";

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
}: {
  document?: Extract<SongMaterialViewModel, { kind: "document" }>;
  pending: boolean;
  error?: string | null;
  onCancel: () => void;
  onSave: (input: { documentType: SongDocumentType; title: string; body: string }) => Promise<void> | void;
}) {
  const [documentType, setDocumentType] = useState<SongDocumentType>(document?.materialType ?? "press_release");
  const [title, setTitle] = useState(document?.title ?? "Press release");
  const [body, setBody] = useState(document?.body ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || pending) return;
    void onSave({ documentType, title: title.trim(), body });
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/28 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="song-document-editor-title" className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[22px] border border-foreground/10 bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-foreground/8 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-foreground/[0.055] text-muted-foreground"><FileText className="h-4 w-4" /></span>
            <div>
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">Song document</p>
              <h2 id="song-document-editor-title" className="mt-0.5 font-display text-[20px] font-semibold text-foreground">{document ? "Edit document" : "Write here"}</h2>
            </div>
          </div>
          <button type="button" aria-label="Close document editor" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"><X className="h-4 w-4" /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:p-6">
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
            <textarea aria-label="Document content" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Start writing…" className="min-h-[300px] resize-y rounded-[14px] border border-foreground/12 bg-background p-4 font-body text-[14px] leading-7 text-foreground outline-none focus:ring-2 focus:ring-brand-accent/25" />
          </label>
          {error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
        </div>
        <footer className="flex justify-end gap-2 border-t border-foreground/8 px-5 py-4 sm:px-6">
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-foreground/10 px-3 text-[12px] font-semibold text-foreground">Cancel</button>
          <button type="submit" disabled={pending || !title.trim() || !body.trim()} className="h-9 rounded-lg bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background disabled:opacity-40">{pending ? "Saving…" : "Save document"}</button>
        </footer>
      </form>
    </div>
  );
}
