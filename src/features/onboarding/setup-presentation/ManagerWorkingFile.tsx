import {
  Activity,
  FileText,
  Library,
  LoaderCircle,
  MapPin,
  Music2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BrandMark } from "../../../design-system/components";
import type {
  SetupPresentationFinding,
  SetupPresentationFindingDestination,
  SetupPresentationPhase,
  SetupPresentationSnapshot,
} from "../../../types/setupPresentation";
import { setupPresentationTiming } from "./setupPresentationTiming";
import { useSetupPresentationQueue } from "./useSetupPresentationQueue";
import "./setupPresentationMotion.css";

type ManagerWorkingFileProps = {
  snapshot: SetupPresentationSnapshot;
};

const PLATFORM_LABELS: Record<string, string> = {
  apple_music: "Apple Music",
  deezer: "Deezer",
  instagram: "Instagram",
  shazam: "Shazam",
  spotify: "Spotify",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const MAX_RENDERED_EVIDENCE = 4;

export default function ManagerWorkingFile({ snapshot }: ManagerWorkingFileProps) {
  const feed = snapshot.feed;
  const findings = useMemo(
    () => feed?.findings ?? buildLegacyFindings(snapshot),
    [feed, snapshot],
  );
  const sourceKey = feed?.setup.runId ?? legacySourceKey(snapshot);
  const setupStatus = feed?.setup.status ?? snapshot.setup.status;
  const phase = feed?.setup.phase ?? snapshot.setup.phase;
  const queue = useSetupPresentationQueue({
    sourceKey,
    findings,
    status: setupStatus,
  });
  const timing = setupPresentationTiming(snapshot);
  const artistName = feed?.artist?.name ?? snapshot.artist?.name ?? "Your artist";
  const artistImageUrl = feed?.artist?.imageUrl ?? snapshot.artist?.imageUrl;
  const genres = feed?.artist?.genres ?? snapshot.artist?.genres ?? [];

  return (
    <main
      data-testid="manager-working-file"
      data-reduced-motion={String(queue.reducedMotion)}
      className="manager-working-file app-theme"
    >
      <header className="manager-working-file__header">
        <div className="manager-working-file__brand" aria-label="Ordersounds Desk">
          <BrandMark size="sm" />
          <div className="manager-working-file__brand-copy">
            <span>Ordersounds</span>
            <strong>Desk</strong>
          </div>
        </div>
        <span className="manager-working-file__mode">Setup</span>
      </header>

      <div className="manager-working-file__layout">
        <aside className="manager-working-file__rail" aria-label="Setup status">
          <p className="manager-working-file__artist-line">Getting to know {artistName}</p>

          <div className="manager-working-file__phase-block">
            <h1 data-testid="manager-file-phase" className="manager-working-file__phase-title">
              {phaseCopy(phase)}
            </h1>
            <p className="manager-working-file__phase-detail">
              {activeInvestigationCopy(phase, queue.active)}
            </p>
          </div>

          {timing.message ? (
            <p className="manager-working-file__reassurance" role="note">
              {timing.message}
            </p>
          ) : null}
        </aside>

        <section className={`manager-working-file__stage ${queue.active ? "has-active" : "is-idle"}`} aria-label="Manager working file">
          {queue.active ? (
            <ActiveFinding
              finding={queue.active}
              motionPhase={queue.state.phase}
              onAnimationEnd={queue.onLandingAnimationEnd}
            />
          ) : null}

          <WorkingFileSheet
            artistName={artistName}
            artistImageUrl={artistImageUrl}
            genres={genres}
            activeFinding={queue.active}
            settled={queue.settled}
            collapsedSettledCount={queue.collapsedSettledCount}
          />
        </section>
      </div>

      <p className="manager-working-file__live-region" role="status" aria-live="polite">
        {queue.active
          ? `Found ${findingAccessibleName(queue.active)}. Filing it under ${destinationLabel(queue.active.destination)}.`
          : queue.state.phase === "stopped"
            ? "Setup is complete."
            : "Waiting for the next confirmed finding."}
      </p>
    </main>
  );
}

function ActiveFinding({
  finding,
  motionPhase,
  onAnimationEnd,
}: {
  finding: SetupPresentationFinding;
  motionPhase: string;
  onAnimationEnd: () => void;
}) {
  const platform = finding.platform ? PLATFORM_LABELS[finding.platform] : null;
  return (
    <article
      data-testid="manager-file-active-finding"
      data-evidence-variant={evidenceVariant(finding)}
      data-motion-phase={motionPhase}
      className={`manager-working-file__active-finding ${motionPhase === "landing" ? "is-landing" : "is-entering"}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="manager-working-file__finding-meta">
        <span className="manager-working-file__finding-source">
          <FindingIcon finding={finding} />
          {platform ? `${platform} ${destinationNoun(finding.destination)}` : semanticFindingLabel(finding)}
        </span>
        <span className="manager-working-file__finding-status">
          <LoaderCircle
            data-testid="manager-file-active-spinner"
            className="manager-working-file__finding-spinner"
            aria-hidden="true"
          />
          Reading now
        </span>
      </div>

      <div className="manager-working-file__finding-body">
        {finding.artwork ? (
          <SafeArtwork
            testId="manager-file-active-artwork"
            src={finding.artwork.url}
            title={finding.artwork.alt || finding.title}
            className="manager-working-file__active-artwork"
          />
        ) : (
          <span className="manager-working-file__active-artwork manager-working-file__active-artwork--fallback" aria-hidden="true">
            <FindingIcon finding={finding} />
          </span>
        )}
        <div className="manager-working-file__finding-copy">
          <p className="manager-working-file__finding-label">{finding.title}</p>
          {finding.value ? <p className="manager-working-file__finding-value">{finding.value}</p> : null}
          {finding.detail ? <p className="manager-working-file__finding-detail">{finding.detail}</p> : null}
        </div>
      </div>
    </article>
  );
}

function WorkingFileSheet({
  artistName,
  artistImageUrl,
  genres,
  activeFinding,
  settled,
  collapsedSettledCount,
}: {
  artistName: string;
  artistImageUrl?: string;
  genres: string[];
  activeFinding: SetupPresentationFinding | null;
  settled: SetupPresentationFinding[];
  collapsedSettledCount: number;
}) {
  const visibleSettled = settled.slice(-MAX_RENDERED_EVIDENCE);
  const hiddenSettledCount = collapsedSettledCount + Math.max(0, settled.length - visibleSettled.length);

  return (
    <article className={`manager-working-file__evidence-shell ${hiddenSettledCount ? "has-overflow" : ""} ${visibleSettled.length === 0 ? "is-empty" : ""}`}>
        <header className="manager-working-file__evidence-header">
          <SafeArtwork
            src={artistImageUrl}
            title={artistName}
            className="manager-working-file__artist-artwork"
          />
          <div className="manager-working-file__evidence-heading">
            <h2>{artistName}</h2>
            {genres.length ? <p>{genres.slice(0, 2).join(" · ")}</p> : null}
          </div>
          <span className="manager-working-file__evidence-status">Manager is still looking</span>
        </header>

        <div data-testid="manager-file-evidence-board" className="manager-working-file__evidence-board">
          <div data-testid="manager-file-settled" className="manager-working-file__evidence-grid">
            {visibleSettled.map((finding) => <EvidenceModule key={finding.id} finding={finding} />)}
          </div>
        </div>

        {hiddenSettledCount ? (
          <p className="manager-working-file__collapsed-count">
            +{hiddenSettledCount} earlier {hiddenSettledCount === 1 ? "finding" : "findings"}
          </p>
        ) : null}

        {!activeFinding && settled.length === 0 ? (
          <p data-testid="manager-file-waiting" className="manager-working-file__waiting">
            Waiting for the next confirmed finding
          </p>
        ) : null}
    </article>
  );
}

function EvidenceModule({ finding }: { finding: SetupPresentationFinding }) {
  const variant = evidenceVariant(finding);
  const platform = finding.platform ? PLATFORM_LABELS[finding.platform] : semanticFindingLabel(finding);
  return (
    <article
      data-evidence-variant={variant}
      className={`manager-working-file__evidence-module manager-working-file__evidence-module--${variant}`}
    >
      <div className="manager-working-file__module-source">
        <span className="manager-working-file__platform-mark" aria-hidden="true">
          {finding.platform ? PLATFORM_LABELS[finding.platform]?.slice(0, 1) : <FindingIcon finding={finding} />}
        </span>
        <span>{platform}</span>
      </div>
      {finding.artwork ? (
        <SafeArtwork
          src={finding.artwork.url}
          title={finding.artwork.alt || finding.title}
          className="manager-working-file__module-artwork"
        />
      ) : null}
      <div className="manager-working-file__module-copy">
        <p>{finding.title}</p>
        {finding.value ? <strong>{finding.value}</strong> : null}
        {finding.detail ? <span>{finding.detail}</span> : null}
      </div>
    </article>
  );
}

type EvidenceVariant = "identity" | "market" | "metric" | "music" | "narrative";

function evidenceVariant(finding: SetupPresentationFinding): EvidenceVariant {
  if (finding.artwork || finding.kind === "music") return "music";
  if (finding.kind === "market" || finding.destination === "markets") return "market";
  if (finding.kind === "identity") return "identity";
  if (finding.kind === "manager_read" || finding.kind === "public_context") return "narrative";
  return "metric";
}

function SafeArtwork({
  src,
  title,
  className,
  testId,
}: {
  src?: string;
  title: string;
  className: string;
  testId?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        {...(testId ? { "data-testid": testId } : {})}
        src={src}
        alt=""
        decoding="async"
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      data-testid={testId ? "manager-file-artwork-fallback" : undefined}
      className={`${className} manager-working-file__artwork-fallback`}
      title={title}
      aria-hidden="true"
    >
      {title.trim().slice(0, 1).toUpperCase() || <Music2 aria-hidden="true" />}
    </span>
  );
}

function FindingIcon({ finding }: { finding: SetupPresentationFinding }) {
  const className = "manager-working-file__finding-icon";
  if (finding.destination === "catalogue") return <Library className={className} aria-hidden="true" />;
  if (finding.destination === "markets") return <MapPin className={className} aria-hidden="true" />;
  if (finding.destination === "manager_read") return <FileText className={className} aria-hidden="true" />;
  if (finding.kind === "momentum") return <TrendingUp className={className} aria-hidden="true" />;
  if (finding.kind === "music") return <Music2 className={className} aria-hidden="true" />;
  if (finding.kind === "audience" || finding.kind === "playlist") return <UsersRound className={className} aria-hidden="true" />;
  return <Activity className={className} aria-hidden="true" />;
}

function buildLegacyFindings(snapshot: SetupPresentationSnapshot): SetupPresentationFinding[] {
  const phase: Exclude<SetupPresentationPhase, "ready"> = snapshot.setup.phase === "ready" ? "synthesis" : snapshot.setup.phase;
  const persistedAt = snapshot.observedAt;
  const findings: SetupPresentationFinding[] = [];
  const add = (
    id: string,
    dedupeKey: string,
    kind: SetupPresentationFinding["kind"],
    destination: SetupPresentationFindingDestination,
    title: string,
    value?: string,
    detail?: string,
    artwork?: SetupPresentationFinding["artwork"],
  ) => findings.push({ id, dedupeKey, revision: persistedAt, persistedAt, phase, kind, destination, title, ...(value ? { value } : {}), ...(detail ? { detail } : {}), ...(artwork ? { artwork } : {}) });

  if (snapshot.artist) {
    add("legacy:artist", "identity:artist", "identity", "catalogue", "Artist profile", snapshot.artist.name, snapshot.artist.genres.join(" · "));
  }
  if (snapshot.catalogue?.trackCount !== undefined) add("legacy:tracks", "catalogue:tracks", "catalogue", "catalogue", "Tracks", String(snapshot.catalogue.trackCount), "Catalogue connected");
  if (snapshot.catalogue?.releaseCount !== undefined) add("legacy:releases", "catalogue:releases", "catalogue", "catalogue", "Releases", String(snapshot.catalogue.releaseCount), "Catalogue connected");
  snapshot.catalogue?.covers.forEach((cover, index) => {
    add(`legacy:cover:${index}`, `music:cover:${cover.title}`, "music", "catalogue", cover.title, undefined, "Music in view", cover.imageUrl ? { url: cover.imageUrl, alt: cover.title } : undefined);
  });
  if (snapshot.intelligence?.primaryMetric) {
    add("legacy:metric", "audience:primary", "audience", "audience", snapshot.intelligence.primaryMetric.label, snapshot.intelligence.primaryMetric.value);
  }
  snapshot.intelligence?.markets.forEach((market, index) => add(`legacy:market:${index}`, `market:${market}`, "market", "markets", "Listener market", market));
  if (snapshot.intelligence?.focusMusic) {
    const focus = snapshot.intelligence.focusMusic;
    add("legacy:focus-music", "music:focus", "music", "momentum", "Music in view", focus.title, undefined, focus.imageUrl ? { url: focus.imageUrl, alt: focus.title } : undefined);
  }
  if (snapshot.manager?.insight) add("legacy:manager-read", "manager-read:first", "manager_read", "manager_read", "First Manager read", snapshot.manager.insight);
  return findings;
}

function legacySourceKey(snapshot: SetupPresentationSnapshot) {
  return `legacy:${snapshot.artist?.name ?? "artist"}:${snapshot.setup.startedAt ?? snapshot.observedAt}`;
}

function phaseCopy(phase: SetupPresentationPhase) {
  if (phase === "catalogue") return "Bringing the music into view.";
  if (phase === "discovery") return "Finding the signals that matter.";
  if (phase === "synthesis") return "Connecting the dots into a read.";
  return "Your Manager has the picture.";
}

function activeInvestigationCopy(phase: SetupPresentationPhase, active: SetupPresentationFinding | null) {
  if (active?.platform) return `Checking ${PLATFORM_LABELS[active.platform] ?? active.platform}.`;
  if (active) return `Reading ${active.title.toLowerCase()}.`;
  if (phase === "synthesis") return "Shaping your first Manager read.";
  if (phase === "ready") return "Ready to open in Desk.";
  return "Looking for the next signal.";
}

function destinationLabel(destination: SetupPresentationFindingDestination) {
  if (destination === "manager_read") return "Manager read";
  return destination[0].toUpperCase() + destination.slice(1);
}

function destinationNoun(destination: SetupPresentationFindingDestination) {
  if (destination === "catalogue") return "catalogue";
  if (destination === "manager_read") return "read";
  return destination;
}

function semanticFindingLabel(finding: SetupPresentationFinding) {
  if (finding.kind === "identity") return "Artist profile";
  if (finding.kind === "manager_read") return "Manager read";
  return destinationLabel(finding.destination);
}

function findingAccessibleName(finding: SetupPresentationFinding) {
  return [finding.title, finding.value].filter(Boolean).join(" ");
}
