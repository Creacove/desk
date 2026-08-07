import { Disc3, Download, FileText, Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicMusicSharePackage } from "../../services/publicMusicShare";

export type { PublicMusicSharePackage } from "../../services/publicMusicShare";

export function PublicMusicSharePortal({
  token,
  loadShare,
}: {
  token: string;
  loadShare: (token: string) => Promise<PublicMusicSharePackage>;
}) {
  const [sharePackage, setSharePackage] = useState<PublicMusicSharePackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSharePackage(null);
    setError(null);
    loadShare(token)
      .then((result) => {
        if (active) setSharePackage(result);
      })
      .catch(() => {
        if (active) setError("This share link is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [loadShare, token]);

  return (
    <main className="app-theme min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <section className="mx-auto grid w-[min(100%,46rem)] gap-4">
        <header className="flex items-center justify-between px-1">
          <span className="font-display text-[16px] font-bold tracking-tight text-foreground">ordersounds</span>
          <span className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/65">Private files</span>
        </header>

        <section className="overflow-hidden rounded-[24px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.12)]">
          {error ? (
            <div className="p-6 sm:p-8">
              <p role="alert" className="rounded-[14px] border border-danger/20 bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>
            </div>
          ) : null}

          {!sharePackage && !error ? (
            <div className="p-6 sm:p-8">
              <p className="text-[13px] font-semibold text-muted-foreground">Loading shared package...</p>
            </div>
          ) : null}

          {sharePackage ? (
            <>
              <div className="border-b border-foreground/8 px-6 py-6 sm:px-8 sm:py-7">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">{presetLabel(sharePackage.preset)}</p>
                <h1 className="mt-2 font-display text-[30px] font-bold tracking-tight text-foreground sm:text-[34px]">{sharePackage.label}</h1>
                <p className="mt-3 max-w-xl text-[13px] font-semibold leading-relaxed text-muted-foreground/82">This package contains only the files selected by the artist team. Download what you need below.</p>
              </div>

              <div className="p-4 sm:p-5">
                <div className="overflow-hidden rounded-[16px] border border-foreground/8">
                  {sharePackage.assets.map((asset) => (
                    <article key={asset.id || `${asset.title}-${asset.fileName}`} className="grid gap-3 border-b border-foreground/6 p-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <AssetIcon fileType={asset.fileType} assetType={asset.assetType} />
                        <div className="min-w-0">
                          <h2 className="truncate text-[14px] font-bold text-foreground">{asset.title}</h2>
                          <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground/75">{asset.fileName}</p>
                        </div>
                      </div>
                      <a href={asset.downloadUrl} download target="_blank" rel="noreferrer" aria-label={`Download ${asset.title}`} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/25">
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                      {canListenToAsset(asset) ? (
                        <audio
                          controls
                          preload="none"
                          aria-label={`Listen to ${asset.title}`}
                          src={asset.downloadUrl}
                          className="w-full min-w-0 sm:col-span-2"
                        />
                      ) : null}
                    </article>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function AssetIcon({ fileType, assetType }: { fileType: string; assetType: string }) {
  const className = "h-4 w-4";
  const wrapper = "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-foreground/[0.055] text-muted-foreground";
  if (fileType.startsWith("image/") || assetType.includes("art")) return <span className={wrapper}><ImageIcon className={className} /></span>;
  if (fileType.startsWith("audio/") || assetType.includes("master") || assetType === "stems") return <span className={wrapper}><Disc3 className={className} /></span>;
  return <span className={wrapper}><FileText className={className} /></span>;
}

function presetLabel(value: string) {
  if (value === "listen") return "Listen-only package";
  if (value === "epk_press") return "EPK / press package";
  if (value === "delivery") return "Delivery package";
  return "Private package";
}

function canListenToAsset(asset: PublicMusicSharePackage["assets"][number]) {
  return asset.fileType.startsWith("audio/") || asset.assetType.includes("master") || asset.assetType === "stems";
}
