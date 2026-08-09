import { Download, FileText, Image as ImageIcon, Music2 } from "lucide-react";
import type { PublicMusicSharePackage } from "../../services/publicMusicShare";
import { cn } from "../../lib/utils";

export function MusicSharePackageView({
  sharePackage,
  compact = false,
}: {
  sharePackage: PublicMusicSharePackage;
  compact?: boolean;
}) {
  const title = sharePackage.title || sharePackage.label;
  const artwork = sharePackage.assets.find(isImageAsset);
  const primaryAudio = sharePackage.assets.find(isAudioAsset);
  const documents = (sharePackage.information ?? []).filter(isDocumentField);
  const details = (sharePackage.information ?? []).filter((field) => !isDocumentField(field));
  const downloadable = sharePackage.assets;

  return (
    <article className={cn("overflow-hidden bg-background text-foreground", compact ? "rounded-[18px] border border-foreground/10" : "rounded-[24px] border border-foreground/10 shadow-[0_24px_70px_rgba(17,19,24,0.10)]")}>
      <div className={cn("grid gap-5", artwork ? "sm:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)] sm:items-stretch" : "grid-cols-1")}>
        {artwork ? (
          <div className={cn("overflow-hidden bg-foreground/[0.04]", compact ? "aspect-square sm:aspect-auto" : "aspect-square sm:min-h-[330px] sm:aspect-auto")}>
            <img src={artwork.inlineUrl || artwork.downloadUrl} alt={`${title} artwork`} className="h-full w-full object-cover" />
          </div>
        ) : null}
        <div className={cn("flex min-w-0 flex-col justify-center", compact ? "p-5" : "p-6 sm:p-8")}>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{packagePurpose(sharePackage.preset)}</p>
          <h1 className={cn("mt-2 font-display font-bold leading-[1.02] tracking-tight text-foreground", compact ? "text-[26px]" : "text-[34px] sm:text-[42px]")}>{title}</h1>
          {sharePackage.artist ? <p className="mt-2 text-[13px] font-semibold text-muted-foreground">{sharePackage.artist}</p> : null}
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
        <section className="border-t border-foreground/8 px-5 py-6 sm:px-8 sm:py-8" aria-label="Shared documents">
          <div className="grid gap-7">
            {documents.map((document) => (
              <article key={document.key} className="max-w-2xl">
                <h2 className="font-display text-[18px] font-bold text-foreground">{document.title}</h2>
                <p className="mt-3 whitespace-pre-wrap text-[13px] leading-6 text-muted-foreground">{document.value}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {downloadable.length ? (
        <section className="border-t border-foreground/8 px-5 py-5 sm:px-8" aria-label="Downloads">
          <h2 className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">Files</h2>
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

      {details.length ? (
        <section className="border-t border-foreground/8 px-5 py-5 sm:px-8" aria-label="Song details">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {details.map((field) => (
              <div key={field.key}>
                <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground/65">{field.title}</dt>
                <dd className="mt-1 text-[13px] font-semibold text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </article>
  );
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

function isImageAsset(asset: PublicMusicSharePackage["assets"][number]) {
  return asset.fileType.startsWith("image/") || asset.assetType.includes("art") || asset.assetType.includes("photo");
}

function isDocumentField(field: NonNullable<PublicMusicSharePackage["information"]>[number]) {
  return Boolean(field.documentType || field.key.startsWith("document:"));
}

function packagePurpose(value: string) {
  if (value === "listen") return "Private listen";
  if (value === "epk_press") return "Press kit";
  if (value === "delivery") return "Delivery package";
  return "Private package";
}
