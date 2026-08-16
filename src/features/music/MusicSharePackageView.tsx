import { Download, FileText, Image as ImageIcon, Music2 } from "lucide-react";
import type { ReactNode } from "react";
import type { PublicMusicShareDocument, PublicMusicSharePackage } from "../../services/publicMusicShare";
import { cn } from "../../lib/utils";

export function MusicSharePackageView({
  sharePackage,
  compact = false,
}: {
  sharePackage: PublicMusicSharePackage;
  compact?: boolean;
}) {
  const title = sharePackage.title || sharePackage.label;
  const artwork = sharePackage.assets.find(isCoverAsset) ?? sharePackage.assets.find(isImageAsset);
  const primaryAudio = sharePackage.assets.find(isPrimaryAudioAsset) ?? sharePackage.assets.find(isAudioAsset);
  const supportingImages = sharePackage.assets.filter((asset) => isImageAsset(asset) && asset.id !== artwork?.id);
  const documents = sharePackage.documents ?? [];
  const details = sharePackage.information ?? [];
  const releaseDate = details.find((field) => field.key === "release_date")?.value;
  const downloadable = sharePackage.assets;

  return (
    <article className={cn("overflow-hidden bg-background text-foreground", compact ? "rounded-[18px] border border-foreground/10" : "rounded-[24px] border border-foreground/10 shadow-[0_24px_70px_rgba(17,19,24,0.10)]")}>
      <div className={cn("grid gap-0", artwork ? "sm:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)] sm:items-stretch" : "grid-cols-1")}>
        {artwork ? (
          <div className={cn("overflow-hidden bg-foreground/[0.04]", compact ? "aspect-square sm:aspect-auto" : "aspect-square sm:min-h-[350px] sm:aspect-auto")}>
            <img src={artwork.inlineUrl || artwork.downloadUrl} alt={`${title} artwork`} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className={cn("flex min-w-0 flex-col justify-center", compact ? "p-5" : "p-6 sm:p-9")}>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{packagePurpose(sharePackage.preset)}</p>
          <h1 className={cn("mt-2 font-display font-bold leading-[1.02] tracking-tight text-foreground", compact ? "text-[26px]" : "text-[34px] sm:text-[44px]")}>{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-muted-foreground">
            {sharePackage.artist ? <span>{sharePackage.artist}</span> : null}
            {sharePackage.artist && releaseDate ? <span aria-hidden="true">·</span> : null}
            {releaseDate ? <span>{releaseDate}</span> : null}
          </div>
          {primaryAudio ? (
            <div className="mt-6">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                <Music2 className="h-3.5 w-3.5" aria-hidden="true" /> {primaryAudio.title}
              </div>
              <audio controls preload="metadata" aria-label={`Listen to ${sharePackage.title || primaryAudio.title}`} src={primaryAudio.inlineUrl || primaryAudio.downloadUrl} className="h-10 w-full min-w-0" />
            </div>
          ) : null}
        </div>
      </div>

      {documents.length ? (
        <section className="border-t border-foreground/8 px-5 py-7 sm:px-9 sm:py-10" aria-label="Shared documents">
          <div className="grid gap-10">
            {documents.map((document) => <SharedDocument key={document.id} document={document} />)}
          </div>
        </section>
      ) : null}

      {supportingImages.length ? (
        <section className="border-t border-foreground/8 px-5 py-7 sm:px-9" aria-label="Press images">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Press images</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Approved visuals included in this package.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {supportingImages.map((asset) => (
              <a key={asset.id} href={asset.downloadUrl} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-[14px] border border-foreground/8 bg-foreground/[0.02]">
                <div className="aspect-square overflow-hidden bg-foreground/[0.04]">
                  <img src={asset.inlineUrl || asset.downloadUrl} alt={asset.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" />
                </div>
                <div className="px-3 py-2.5"><p className="truncate text-[11px] font-semibold text-foreground">{asset.title}</p></div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {details.length ? (
        <section className="border-t border-foreground/8 px-5 py-6 sm:px-9" aria-label="Release information">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Release information</p>
          <dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map((field) => (
              <div key={field.key}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/65">{field.title}</dt>
                <dd className="mt-1 text-[13px] font-semibold text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {downloadable.length ? (
        <section className="border-t border-foreground/8 px-5 py-6 sm:px-9" aria-label="Downloads">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Files</p>
          <div className="mt-3 divide-y divide-foreground/7">
            {downloadable.map((asset) => (
              <div key={asset.id || `${asset.title}-${asset.fileName}`} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                <AssetGlyph asset={asset} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-foreground">{asset.title}</p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-muted-foreground/70">{asset.fileName}</p>
                </div>
                <a href={asset.downloadUrl} download target="_blank" rel="noreferrer" aria-label={`Download ${asset.title}`} className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-foreground/10 px-3 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden sm:inline">Download</span>
                </a>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!compact ? <footer className="border-t border-foreground/8 px-5 py-4 text-center text-[10px] font-medium text-muted-foreground/55 sm:px-9">Shared privately via Desk</footer> : null}
    </article>
  );
}

function SharedDocument({ document }: { document: PublicMusicShareDocument }) {
  return (
    <article className="mx-auto w-full max-w-3xl" data-document-type={document.documentType}>
      <div className="mb-5 flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.055] text-muted-foreground"><FileText className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="font-ui text-[9px] font-bold uppercase tracking-[0.09em] text-muted-foreground/65">{documentTypeLabel(document.documentType)}</p>
          <h2 className="mt-1 font-display text-[20px] font-bold leading-tight text-foreground sm:text-[23px]">{document.title}</h2>
        </div>
      </div>
      <DocumentBody body={document.body} />
    </article>
  );
}

function DocumentBody({ body }: { body: string }) {
  const blocks = parseDocumentBlocks(body);
  return <div className="grid gap-4">{blocks.map((block, index) => <DocumentBlock key={`${block.kind}-${index}`} block={block} />)}</div>;
}

type DocumentBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; headers: string[]; rows: string[][] };

function DocumentBlock({ block }: { block: DocumentBlock }) {
  if (block.kind === "heading") {
    if (block.level === 1) return <h3 className="font-display text-[24px] font-bold leading-tight text-foreground">{renderInline(block.text)}</h3>;
    return <h3 className="pt-2 font-ui text-[10px] font-bold uppercase tracking-[0.09em] text-muted-foreground">{renderInline(block.text)}</h3>;
  }
  if (block.kind === "quote") return <blockquote className="border-l-2 border-foreground/15 pl-4 text-[14px] font-medium leading-7 text-foreground/82">{renderInline(block.text)}</blockquote>;
  if (block.kind === "list") return <ul className="grid gap-2">{block.items.map((item, index) => <li key={`${item}-${index}`} className="flex gap-2.5 text-[14px] font-medium leading-6 text-foreground/84"><span className="mt-[0.62rem] h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/35" /><span>{renderInline(item)}</span></li>)}</ul>;
  if (block.kind === "table") return (
    <div className="overflow-x-auto rounded-[14px] border border-foreground/10">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead className="bg-foreground/[0.035]"><tr>{block.headers.map((header, index) => <th key={`${header}-${index}`} className="border-b border-foreground/10 px-3.5 py-3 text-[9px] font-bold uppercase tracking-[0.07em] text-muted-foreground">{header}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-foreground/[0.065] last:border-b-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="px-3.5 py-3 align-top text-[12px] font-medium leading-5 text-foreground/82">{renderInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
  return <p className="whitespace-pre-line text-[14px] font-medium leading-7 text-foreground/86 sm:text-[15px]">{renderInline(block.text)}</p>;
}

function parseDocumentBlocks(raw: string): DocumentBlock[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: DocumentBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) { blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] }); index += 1; continue; }
    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const headers = tableCells(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && isTableRow(lines[index])) { rows.push(tableCells(lines[index])); index += 1; }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) { items.push(lines[index].trim().replace(/^[-*]\s+/, "")); index += 1; }
      blocks.push({ kind: "list", items });
      continue;
    }
    if (line.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) { quote.push(lines[index].trim().replace(/^>\s?/, "")); index += 1; }
      blocks.push({ kind: "quote", text: quote.join(" ") });
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (!next || /^#{1,3}\s+/.test(next) || /^[-*]\s+/.test(next) || next.startsWith(">") || (isTableRow(next) && index + 1 < lines.length && isTableSeparator(lines[index + 1]))) break;
      paragraph.push(next);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

function renderInline(value: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/[^\s]+)/g;
  const output: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) output.push(value.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) output.push(<strong key={`b-${key++}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
      output.push(link ? <a key={`a-${key++}`} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-foreground/25 underline-offset-2">{link[1]}</a> : token);
    } else output.push(<a key={`u-${key++}`} href={token} target="_blank" rel="noreferrer" className="break-all underline decoration-foreground/25 underline-offset-2">{token}</a>);
    cursor = match.index + token.length;
  }
  if (cursor < value.length) output.push(value.slice(cursor));
  return output;
}

function AssetGlyph({ asset }: { asset: PublicMusicSharePackage["assets"][number] }) {
  const className = "h-4 w-4";
  const wrapper = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.055] text-muted-foreground";
  if (isAudioAsset(asset)) return <span className={wrapper}><Music2 className={className} /></span>;
  if (isImageAsset(asset)) return <span className={wrapper}><ImageIcon className={className} /></span>;
  return <span className={wrapper}><FileText className={className} /></span>;
}

function isAudioAsset(asset: PublicMusicSharePackage["assets"][number]) {
  return asset.fileType.startsWith("audio/") || asset.assetType.includes("master") || asset.assetType === "stems";
}
function isPrimaryAudioAsset(asset: PublicMusicSharePackage["assets"][number]) { return asset.assetType === "final_master"; }
function isImageAsset(asset: PublicMusicSharePackage["assets"][number]) { return asset.fileType.startsWith("image/") || asset.assetType.includes("art") || asset.assetType.includes("photo"); }
function isCoverAsset(asset: PublicMusicSharePackage["assets"][number]) { return asset.assetType === "cover_art"; }
function isTableRow(value: string) { const line = value.trim(); return line.includes("|") && (line.startsWith("|") || line.endsWith("|")); }
function isTableSeparator(value: string) { const cells = tableCells(value); return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, ""))); }
function tableCells(value: string) { return value.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()); }

function documentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    epk: "Electronic press kit",
    artist_biography: "Artist biography",
    one_sheet: "One-sheet",
    press_release: "Press release",
    credits: "Credit sheet",
    lyrics: "Lyrics",
    distributor_notes: "Distribution delivery sheet",
    spotify_editorial_pitch: "Spotify editorial pitch",
    playlist_pitch: "Playlist pitch",
    press_pitch: "Press pitch",
    press_target_brief: "Press target brief",
    content_plan: "Content plan",
    release_calendar: "Release calendar",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function packagePurpose(value: string) {
  if (value === "listen") return "Private listen";
  if (value === "epk_press") return "Press / media kit";
  if (value === "delivery") return "Distributor delivery";
  return "Private package";
}
