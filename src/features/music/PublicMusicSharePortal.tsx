import { useEffect, useState } from "react";
import type { PublicMusicSharePackage } from "../../services/publicMusicShare";
import { MusicSharePackageView } from "./MusicSharePackageView";

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
      .then((result) => { if (active) setSharePackage(result); })
      .catch(() => { if (active) setError("This share link is unavailable."); });
    return () => { active = false; };
  }, [loadShare, token]);

  return (
    <main className="app-theme min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto w-[min(100%,62rem)]">
        <header className="mb-5 flex items-center justify-between px-1">
          <span className="font-display text-[15px] font-bold tracking-tight text-foreground">ordersounds</span>
          <span className="text-[10px] font-semibold text-muted-foreground/70">Shared privately</span>
        </header>

        {error ? (
          <section className="grid min-h-[52vh] place-items-center rounded-[22px] border border-foreground/9 px-6 text-center">
            <p role="alert" className="text-[13px] font-semibold text-muted-foreground">{error}</p>
          </section>
        ) : null}

        {!sharePackage && !error ? <SharePackageSkeleton /> : null}
        {sharePackage ? <MusicSharePackageView sharePackage={sharePackage} /> : null}
      </div>
    </main>
  );
}

function SharePackageSkeleton() {
  return (
    <section aria-label="Loading shared package" className="overflow-hidden rounded-[24px] border border-foreground/9">
      <div className="grid sm:grid-cols-[minmax(180px,0.72fr)_minmax(0,1.28fr)]">
        <div className="aspect-square animate-pulse bg-foreground/[0.06] sm:min-h-[330px] sm:aspect-auto" />
        <div className="grid content-center gap-3 p-7">
          <span className="h-2.5 w-24 animate-pulse rounded bg-foreground/[0.06]" />
          <span className="h-9 w-2/3 animate-pulse rounded bg-foreground/[0.07]" />
          <span className="h-3 w-32 animate-pulse rounded bg-foreground/[0.05]" />
          <span className="mt-4 h-10 w-full animate-pulse rounded-full bg-foreground/[0.06]" />
        </div>
      </div>
    </section>
  );
}
