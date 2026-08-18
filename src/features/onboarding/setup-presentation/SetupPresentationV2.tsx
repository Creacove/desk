import {
  Check,
  Library,
  MapPin,
  Music2,
  Radar,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppThinkingOrb } from "../../../design-system/AppThinkingOrb";
import type { SetupPresentationSnapshot } from "../../../types/setupPresentation";
import { setupPresentationTiming } from "./setupPresentationTiming";

type SetupPresentationV2Props = {
  snapshot: SetupPresentationSnapshot;
};

export default function SetupPresentationV2({ snapshot }: SetupPresentationV2Props) {
  const now = usePresentationClock(snapshot.setup.status);
  const timing = setupPresentationTiming(snapshot, now);
  const headline = snapshot.activity?.label ?? fallbackHeadline(snapshot.setup.phase);
  const supporting = phaseSupportingCopy(snapshot.setup.phase);
  const hasCatchup = Boolean(
    snapshot.catalogue ||
    snapshot.intelligence?.primaryMetric ||
    snapshot.intelligence?.markets.length ||
    snapshot.intelligence?.focusMusic,
  );
  const catchupSettled = useCatchupSettled(snapshot.setup.startedAt, hasCatchup);

  return (
    <main
      data-testid="setup-presentation-v2"
      className="app-theme relative min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <AmbientGrid />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1500px] flex-col px-4 py-5 sm:px-7 lg:px-9 lg:py-7">
        <header className="flex items-center justify-between gap-4 border-b border-foreground/8 pb-4">
          <div className="min-w-0">
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.16em] text-brand-accent">Desk setup</p>
            <p className="mt-1 truncate text-[12px] font-semibold text-muted-foreground">
              {snapshot.artist?.name ? `Getting to know ${snapshot.artist.name}` : "Building your artist workspace"}
            </p>
          </div>
          <SetupTruthIndicator phase={snapshot.setup.phase} />
        </header>

        <section className="grid flex-1 items-center gap-9 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.72fr)] lg:gap-14 lg:py-10 xl:gap-20">
          <div className="min-w-0 lg:pl-[4vw]">
            <div className="setup-resolve-in flex items-center gap-3" style={{ animationDelay: hasCatchup ? "420ms" : "80ms" }}>
              <span className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full border border-foreground/8 bg-foreground/[0.025] shadow-[0_18px_50px_rgba(17,19,24,0.08)]" aria-hidden="true">
                <span className="absolute inset-2 rounded-full border border-brand-accent/12" aria-hidden="true" />
                <AppThinkingOrb size={64} />
              </span>
              <span>
                <span className="flex items-center gap-2 font-ui text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span className={`h-1.5 w-1.5 rounded-full ${snapshot.setup.phase === "ready" ? "bg-[hsl(var(--tone-success))]" : "bg-brand-accent setup-live-pulse"}`} aria-hidden="true" />
                  {snapshot.setup.phase === "ready" ? "Ready" : "Working now"}
                </span>
                <span className="mt-1 block text-[11px] font-semibold text-muted-foreground/75">{phaseLabel(snapshot.setup.phase)}</span>
              </span>
            </div>

            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="setup-resolve-in mt-8 max-w-[46rem]"
              style={{ animationDelay: hasCatchup ? "520ms" : "140ms" }}
            >
              <h1 className="font-display text-[clamp(2.2rem,5vw,4.7rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-foreground">
                {headline}
              </h1>
              <p className="mt-5 max-w-[36rem] text-[14px] font-medium leading-[1.75] text-muted-foreground sm:text-[15px]">
                {supporting}
              </p>
            </div>

            {catchupSettled && timing.message ? (
              <div
                role="status"
                aria-live="polite"
                className="setup-resolve-in mt-7 max-w-[34rem] border-l-2 border-brand-accent/30 pl-4"
              >
                <p className="text-[12px] font-semibold leading-relaxed text-foreground/72">{timing.message}</p>
              </div>
            ) : null}
          </div>

          <WhatDeskKnows snapshot={snapshot} />
        </section>

      </div>
    </main>
  );
}

function WhatDeskKnows({ snapshot }: { snapshot: SetupPresentationSnapshot }) {
  const knowledge = useMemo(() => buildKnowledgeBlocks(snapshot), [snapshot]);
  return (
    <aside className="min-w-0 lg:pr-[2vw]" aria-label="What Desk knows">
      <div className="flex items-end justify-between gap-4">
        <p className="font-ui text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">What Desk knows</p>
        <span className="text-[10px] font-semibold text-muted-foreground/55">{snapshot.setup.phase === "ready" ? "Ready" : "Updating"}</span>
      </div>

      <div className="mt-5 divide-y divide-foreground/8 border-y border-foreground/8">
        {knowledge.length ? knowledge.map((block, index) => (
          <div
            key={block.key}
            className="setup-knowledge-in py-4 first:pt-4"
            style={{ animationDelay: `${80 + index * 110}ms` }}
          >
            {block.node}
          </div>
        )) : (
          <div className="py-7">
            <p className="text-[12px] font-semibold text-muted-foreground">What Desk learns will appear here.</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function buildKnowledgeBlocks(snapshot: SetupPresentationSnapshot) {
  const blocks: Array<{ key: string; node: JSX.Element }> = [];

  if (snapshot.artist) {
    blocks.push({
      key: "artist",
      node: (
        <div className="flex min-w-0 items-center gap-3">
          <SafeArtwork
            src={snapshot.artist.imageUrl}
            title={snapshot.artist.name}
            className="h-11 w-11 shrink-0 rounded-[12px] object-cover shadow-sm"
            fallbackClassName="h-11 w-11 shrink-0 rounded-[12px]"
          />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-bold text-foreground">{snapshot.artist.name}</p>
            {snapshot.artist.genres.length ? (
              <p className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{snapshot.artist.genres.join(" · ")}</p>
            ) : null}
          </div>
          <ResolvedMark />
        </div>
      ),
    });
  }

  if (snapshot.catalogue) {
    blocks.push({
      key: "catalogue",
      node: (
        <div>
          <div className="flex items-center gap-2.5">
            <Library className="h-4 w-4 text-muted-foreground/70" aria-hidden="true" />
            <p className="text-[12px] font-bold text-foreground">
              {snapshot.catalogue.state === "complete"
                ? catalogueSummary(snapshot.catalogue.trackCount, snapshot.catalogue.releaseCount)
                : "Bringing your catalogue into view"}
            </p>
            {snapshot.catalogue.state === "complete" ? <ResolvedMark /> : <WorkingMark />}
          </div>
          {snapshot.catalogue.covers.length ? (
            <div className="mt-3 flex -space-x-2 pl-6">
              {snapshot.catalogue.covers.map((cover, index) => (
                <SafeArtwork
                  key={`${cover.title}-${index}`}
                  src={cover.imageUrl}
                  title={cover.title}
                  className="h-9 w-9 rounded-[9px] border-2 border-background object-cover shadow-sm"
                  fallbackClassName="h-9 w-9 rounded-[9px] border-2 border-background text-[9px] shadow-sm"
                />
              ))}
            </div>
          ) : null}
        </div>
      ),
    });
  }

  if (snapshot.intelligence?.primaryMetric || snapshot.intelligence?.markets.length) {
    const metric = snapshot.intelligence?.primaryMetric;
    const markets = snapshot.intelligence?.markets ?? [];
    blocks.push({
      key: "audience",
      node: (
        <div className="flex items-start gap-3">
          <Radar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-muted-foreground">{metric?.label ?? "Audience map"}</p>
            {metric ? (
              <p className="mt-0.5 font-display text-[22px] font-semibold tracking-[-0.03em] text-foreground">{metric.value}</p>
            ) : null}
            {markets.length ? (
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <p className="truncate text-[11px] font-bold text-foreground/80">{markets.join(" · ")}</p>
              </div>
            ) : null}
          </div>
          <ResolvedMark />
        </div>
      ),
    });
  }

  if (snapshot.intelligence?.focusMusic) {
    blocks.push({
      key: "focus",
      node: (
        <div className="flex items-center gap-3">
          <SafeArtwork
            src={snapshot.intelligence.focusMusic.imageUrl}
            title={snapshot.intelligence.focusMusic.title}
            className="h-10 w-10 rounded-[10px] object-cover"
            fallbackClassName="h-10 w-10 rounded-[10px]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-muted-foreground">Music in view</p>
            <p className="mt-0.5 truncate text-[12px] font-bold text-foreground">{snapshot.intelligence.focusMusic.title}</p>
          </div>
          <ResolvedMark />
        </div>
      ),
    });
  }


  if (snapshot.manager?.state === "ready" && snapshot.manager.insight) {
    blocks.push({
      key: "manager",
      node: (
        <div className="border-l-2 border-brand-accent/35 pl-4">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" aria-hidden="true" />
            <p className="font-ui text-[9px] font-bold uppercase tracking-[0.12em] text-brand-accent">First Manager read</p>
          </div>
          <p className="mt-3 text-[13px] font-semibold leading-[1.65] text-foreground">{snapshot.manager.insight}</p>
        </div>
      ),
    });
  }

  const managerBlock = blocks.find((block) => block.key === "manager");
  if (!managerBlock) return blocks.slice(0, 6);
  return [...blocks.filter((block) => block.key !== "manager").slice(0, 5), managerBlock];
}

function SetupTruthIndicator({ phase }: { phase: SetupPresentationSnapshot["setup"]["phase"] }) {
  const label = phase === "ready" ? "Ready" : "Progress saved";
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-foreground/8 bg-foreground/[0.025] px-3 py-1.5 text-[10px] font-semibold text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${phase === "ready" ? "bg-[hsl(var(--tone-success))]" : "bg-brand-accent"}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function ResolvedMark() {
  return (
    <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/[0.05] text-muted-foreground" aria-hidden="true">
      <Check className="h-3 w-3" />
    </span>
  );
}

function WorkingMark() {
  return (
    <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent setup-live-pulse" />
    </span>
  );
}

function AmbientGrid() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(hsl(var(--foreground)/0.035)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--foreground)/0.028)_1px,transparent_1px)] [background-size:56px_56px]" />
    </div>
  );
}

function SafeArtwork({
  src,
  title,
  className,
  fallbackClassName,
}: {
  src?: string;
  title: string;
  className: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (src && !failed) {
    return <img src={src} alt="" onError={() => setFailed(true)} className={className} />;
  }

  return (
    <span
      title={title}
      className={`flex items-center justify-center bg-foreground/[0.055] font-bold text-muted-foreground ${fallbackClassName}`}
      aria-hidden="true"
    >
      {title.trim().slice(0, 1).toUpperCase() || <Music2 className="h-4 w-4" />}
    </span>
  );
}

function useCatchupSettled(setupStartedAt: string | undefined, hasCatchup: boolean) {
  const [settled, setSettled] = useState(!hasCatchup);
  useEffect(() => {
    if (!hasCatchup) {
      setSettled(true);
      return;
    }
    setSettled(false);
    const timer = window.setTimeout(() => setSettled(true), 1_100);
    return () => window.clearTimeout(timer);
  }, [hasCatchup, setupStartedAt]);
  return settled;
}

function usePresentationClock(status: SetupPresentationSnapshot["setup"]["status"]) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status === "completed" || status === "failed") return;
    let cancelled = false;
    let timer: number | undefined;
    const tick = () => {
      if (cancelled) return;
      setNow(Date.now());
      timer = window.setTimeout(tick, 5_000);
    };
    timer = window.setTimeout(tick, 5_000);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [status]);
  return now;
}

function fallbackHeadline(phase: SetupPresentationSnapshot["setup"]["phase"]) {
  if (phase === "catalogue") return "Bringing your music into focus";
  if (phase === "discovery") return "Reading the signals around your artist";
  if (phase === "synthesis") return "Your Manager is putting it together";
  return "Your workspace is ready";
}

function phaseSupportingCopy(phase: SetupPresentationSnapshot["setup"]["phase"]) {
  if (phase === "catalogue") return "Bringing your music together.";
  if (phase === "discovery") return "Reading what matters around your artist.";
  if (phase === "synthesis") return "Your Manager is connecting the dots.";
  return "Your first Manager read is ready.";
}

function phaseLabel(phase: SetupPresentationSnapshot["setup"]["phase"]) {
  if (phase === "catalogue") return "Catalogue";
  if (phase === "discovery") return "Understanding your artist";
  if (phase === "synthesis") return "Manager read";
  return "Desk ready";
}

function catalogueSummary(trackCount?: number, releaseCount?: number) {
  const pieces: string[] = [];
  if (trackCount !== undefined) pieces.push(`${trackCount} ${trackCount === 1 ? "song" : "songs"}`);
  if (releaseCount !== undefined) pieces.push(`${releaseCount} ${releaseCount === 1 ? "release" : "releases"}`);
  return pieces.length ? pieces.join(" · ") : "Catalogue connected";
}
