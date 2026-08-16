import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, FileText, Pencil, X } from "lucide-react";

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
  { value: "credits", label: "Credit sheet" },
  { value: "distributor_notes", label: "Distribution delivery sheet" },
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
  const internalNarrative = document?.title.trim().toLowerCase() === "release narrative";
  const initialBody = useMemo(
    () => internalNarrative ? (document?.body ?? "") : recipientSafeDocumentBody(document?.body ?? ""),
    [document?.body, internalNarrative],
  );
  const [editing, setEditing] = useState(!managerArtifact);
  const [documentType, setDocumentType] = useState<SongDocumentType>(document?.materialType ?? "press_release");
  const [title, setTitle] = useState(document?.title ?? "Press release");
  const [body, setBody] = useState(initialBody);
  const approved = document?.status === "accepted";
  const canApprove = Boolean(managerArtifact && !internalNarrative && !approved && document?.reviewState === "ready" && onApprove);
  const typeLabel = documentTypeLabel(documentType);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !body.trim() || pending) return;
    void onSave({ documentType, title: title.trim(), body: internalNarrative ? body : recipientSafeDocumentBody(body) });
  }

  function resetPreview() {
    setTitle(document?.title ?? title);
    setBody(initialBody);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/28 p-3 backdrop-blur-sm sm:p-6" role="presentation">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="song-document-editor-title" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-foreground/10 bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-foreground/8 px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-foreground/[0.055] text-muted-foreground"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{internalNarrative ? "Internal strategy" : typeLabel}</p>
              <h2 id="song-document-editor-title" className="mt-1 max-w-[34rem] font-display text-[20px] font-semibold leading-tight text-foreground sm:text-[22px]">{document ? title : "New document"}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {managerArtifact && !editing ? (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.04]"><Pencil className="h-3.5 w-3.5" /> Edit</button>
            ) : null}
            <button type="button" aria-label="Close document editor" onClick={onCancel} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </header>

        {editing ? (
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:p-7">
            <div className="grid gap-4 sm:grid-cols-[210px_minmax(0,1fr)]">
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
              <textarea aria-label="Document content" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Start writing…" className="min-h-[420px] resize-y rounded-[14px] border border-foreground/12 bg-background p-4 font-body text-[14px] leading-7 text-foreground outline-none focus:ring-2 focus:ring-brand-accent/25" />
            </label>
            {error ? <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] font-semibold text-danger">{error}</p> : null}
          </div>
        ) : (
          <DocumentPreview body={initialBody} internalNarrative={internalNarrative} documentType={documentType} />
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-foreground/8 px-5 py-3.5 sm:px-7 sm:py-4">
          {editing && managerArtifact ? <button type="button" onClick={resetPreview} className="h-9 rounded-lg border border-foreground/10 px-3 text-[12px] font-semibold text-foreground">Cancel edit</button> : null}
          <button type="button" onClick={onCancel} className="h-9 rounded-lg border border-foreground/10 px-3 text-[12px] font-semibold text-foreground">Close</button>
          {canApprove && !editing ? <button type="button" disabled={pending} onClick={() => void onApprove?.()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-[12px] font-semibold text-background disabled:opacity-40"><Check className="h-3.5 w-3.5" /> {pending ? "Approving…" : "Approve"}</button> : null}
          {editing ? <button type="submit" disabled={pending || !title.trim() || !body.trim()} className="h-9 rounded-lg bg-foreground px-4 py-2.5 text-[12px] font-semibold text-background disabled:opacity-40">{pending ? "Saving…" : "Save"}</button> : null}
        </footer>
      </form>
    </div>
  );
}

function DocumentPreview({ body, internalNarrative, documentType }: { body: string; internalNarrative: boolean; documentType: SongDocumentType }) {
  const blocks = useMemo(() => parseMarkdownBlocks(body), [body]);
  const compact = documentType === "one_sheet" || documentType === "spotify_editorial_pitch" || documentType === "playlist_pitch" || documentType === "press_pitch";

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-foreground/[0.012] px-5 py-6 sm:px-8 sm:py-9">
      <article className={`mx-auto ${compact ? "max-w-2xl" : "max-w-3xl"}`}>
        {internalNarrative ? <p className="mb-6 rounded-[12px] border border-brand-accent/14 bg-brand-accent/[0.035] px-4 py-3 text-[11px] font-medium leading-relaxed text-foreground/70">Internal campaign strategy. Not for external sharing.</p> : null}
        <div className="grid gap-5 sm:gap-6">
          {blocks.map((block, index) => <MarkdownBlockView key={`${block.kind}-${index}`} block={block} />)}
        </div>
      </article>
    </div>
  );
}

type MarkdownBlock =
  | { kind: "h1" | "h2" | "h3"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

function MarkdownBlockView({ block }: { block: MarkdownBlock }) {
  if (block.kind === "h1") return <h1 className="font-display text-[28px] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[36px]">{renderInline(block.text)}</h1>;
  if (block.kind === "h2") return <h2 className="pt-2 font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{renderInline(block.text)}</h2>;
  if (block.kind === "h3") return <h3 className="font-display text-[17px] font-semibold text-foreground">{renderInline(block.text)}</h3>;
  if (block.kind === "quote") return <blockquote className="border-l-2 border-foreground/15 pl-4 text-[15px] font-medium leading-7 text-foreground/82">{renderInline(block.text)}</blockquote>;
  if (block.kind === "list") return <ul className="grid gap-2 pl-1">{block.items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2.5 text-[14px] font-medium leading-6 text-foreground/84"><span className="mt-[0.62rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35" /><span>{renderInline(item)}</span></li>)}</ul>;
  if (block.kind === "table") {
    return (
      <div className="overflow-x-auto rounded-[14px] border border-foreground/10 bg-background">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead className="bg-foreground/[0.035]">
            <tr>{block.headers.map((header, index) => <th key={`${header}-${index}`} className="border-b border-foreground/10 px-3.5 py-3 font-ui text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{renderInline(header)}</th>)}</tr>
          </thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-foreground/[0.065] last:border-b-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="px-3.5 py-3 align-top text-[12px] font-medium leading-5 text-foreground/82">{renderInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }
  return <p className="whitespace-pre-line text-[14px] font-medium leading-7 text-foreground/88 sm:text-[15px]">{renderInline(block.text)}</p>;
}

function parseMarkdownBlocks(rawBody: string): MarkdownBlock[] {
  const body = rawBody.replace(/\r\n/g, "\n").trim();
  if (!body) return [];
  const lines = body.split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }
    if (line.startsWith("# ")) {
      blocks.push({ kind: "h1", text: line.slice(2).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3).trim() });
      index += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4).trim() });
      index += 1;
      continue;
    }
    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", text: quoteLines.join(" ") });
      continue;
    }

    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^#{1,3}\s/.test(next) || /^[-*]\s+/.test(next) || next.startsWith(">") || (isTableRow(next) && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function recipientSafeDocumentBody(rawBody: string) {
  const lines = rawBody.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  let suppressInternalSection = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+(needs verification|internal gaps)\s*$/i.test(line)) {
      suppressInternalSection = true;
      continue;
    }
    if (suppressInternalSection && /^##\s+/.test(line)) suppressInternalSection = false;
    if (suppressInternalSection) continue;
    if (/^\*\*(purpose|audience|core narrative):\*\*/i.test(line)) continue;
    if (/^>\s*internal campaign strategy/i.test(line)) continue;
    kept.push(rawLine);
  }
  return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function isTableRow(value: string) {
  const line = value.trim();
  return line.includes("|") && (line.startsWith("|") || line.endsWith("|"));
}

function isTableSeparator(value: string) {
  const cells = tableCells(value);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function tableCells(value: string) {
  return value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderInline(value: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) result.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      result.push(<strong key={`b-${key++}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      if (link) result.push(<a key={`a-${key++}`} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground">{link[1]}</a>);
      else result.push(token);
    } else {
      result.push(<a key={`u-${key++}`} href={token} target="_blank" rel="noreferrer" className="break-all underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground">{token}</a>);
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) result.push(value.slice(cursor));
  return result;
}

function documentTypeLabel(value: SongDocumentType) {
  return DOCUMENT_TYPES.find((option) => option.value === value)?.label ?? "Song document";
}
