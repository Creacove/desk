import {
  Activity,
  Check,
  FileText,
  Library,
  MapPin,
  Music2,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
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

const SECTION_DEFINITIONS: Array<{
  destination: SetupPresentationFindingDestination;
  index: string;
  label: string;
}> = [
  { destination: "catalogue", index: "01", label: "Catalogue" },
  { destination: "audience", index: "02", label: "Audience" },
  { destination: "markets", index: "03", label: "Markets" },
  { destination: "momentum", index: "04", label: "Momentum" },
  { destination: "manager_read", index: "05", label: "Manager read" },
];

const PLATFORM_LABELS: Record<string, string> = {
  apple_music: "Apple Music",
  deezer: "Deezer",
  instagram: "Instagram",
  shazam: "Shazam",
  spotify: "Spotify",
  tiktok: "TikTok",
  youtube: "YouTube",
};

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
  const activeDestination = queue.active?.destination ?? null;

  return (
    <main
      data-testid="manager-working-file"
      data-reduced-motion={String(queue.reducedMotion)}
      className="manager-working-file app-theme"
    >
      <div className="manager-working-file__layout">
        <aside className="manager-working-file__rail" aria-label="Setup status">
          <div className="manager-working-file__eyebrow">
            <span className="manager-working-file__eyebrow-dot" aria-hidden="true" />
            Desk setup
          </div>
          <p className="manager-working-file__artist-line">Getting to know {artistName}</p>

          <div className="manager-working-file__phase-block">
            <p className="manager-working-file__phase-label">{phaseLabel(phase)}</p>
            <h1 data-testid="manager-file-phase" className="manager-working-file__phase-title">
              {phaseCopy(phase)}
            </h1>
            <p className="manager-working-file__phase-detail">
              {phaseDetail(phase, queue.active)}
            </p>
          </div>

          <div className="manager-working-file__saved">
            <span className="manager-working-file__saved-mark" aria-hidden="true" />
            <span>{setupStatus === "completed" ? "Setup complete" : "Progress saved"}</span>
          </div>

          {timing.message ? (
            <p className="manager-working-file__reassurance" role="note">
              {timing.message}
            </p>
          ) : null}
        </aside>

        <section className="manager-working-file__stage" aria-label="Manager working file">
          {queue.active ? (
            <ActiveFinding
              finding={queue.active}
              motionPhase={queue.state.phase}
              reducedMotion={queue.reducedMotion}
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
            activeDestination={activeDestination}
          />
        </section>

        <div className="manager-working-file__quiet-rail" aria-hidden="true">
          <span>Working file</span>
          <span>Read-only view</span>
        </div>
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
  reducedMotion,
  onAnimationEnd,
}: {
  finding: SetupPresentationFinding;
  motionPhase: string;
  reducedMotion: boolean;
  onAnimationEnd: () => void;
}) {
  const platform = finding.platform ? PLATFORM_LABELS[finding.platform] : null;
  return (
    <article
      data-testid="manager-file-active-finding"
      data-motion-phase={motionPhase}
      className={`manager-working-file__active-finding ${motionPhase === "landing" ? "is-landing" : "is-entering"}`}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="manager-working-file__finding-meta">
        <span className="manager-working-file__finding-source">
          <FindingIcon finding={finding} />
          {platform ? `${platform} ${destinationNoun(finding.destination)}` : semanticFindingLabel(finding)}
        </span>
        <span>Found now</span>
      </div>

      <div className="manager-working-file__finding-body">
        {finding.artwork ? (
          <SafeArtwork
            testId="manager-file-active-artwork"
            src={finding.artwork.url}
            title={finding.artwork.alt || finding.title}
            className="manager-working-file__active-artwork"
          />
        ) : null}
        <div className="manager-working-file__finding-copy">
          <p className="manager-working-file__finding-label">{finding.title}</p>
          {finding.value ? <p className="manager-working-file__finding-value">{finding.value}</p> : null}
          {finding.detail ? <p className="manager-working-file__finding-detail">{finding.detail}</p> : null}
        </div>
      </div>

      <div className="manager-working-file__finding-footer">
        <span>For {destinationLabel(finding.destination)}</span>
        <span className="manager-working-file__finding-dot" aria-hidden="true" />
        <span>{reducedMotion ? "Filed in order" : "Working file"}</span>
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
  activeDestination,
}: {
  artistName: string;
  artistImageUrl?: string;
  genres: string[];
  activeFinding: SetupPresentationFinding | null;
  settled: SetupPresentationFinding[];
  collapsedSettledCount: number;
  activeDestination: SetupPresentationFindingDestination | null;
}) {
  return (
    <div className="manager-working-file__stack">
      <div className="manager-working-file__sheet manager-working-file__sheet--back-two" aria-hidden="true" />
      <div className="manager-working-file__sheet manager-working-file__sheet--back-one" aria-hidden="true" />
      <article className="manager-working-file__sheet manager-working-file__sheet--main">
        <div className="manager-working-file__tab">{artistName} / Manager file</div>

        <header className="manager-working-file__file-header">
          <SafeArtwork
            src={artistImageUrl}
            title={artistName}
            className="manager-working-file__artist-artwork"
          />
          <div className="manager-working-file__file-heading">
            <p className="manager-working-file__file-kicker">Artist working file</p>
            <h2>{artistName}</h2>
            {genres.length ? <p>{genres.slice(0, 2).join(" · ")}</p> : null}
          </div>
          <span className="manager-working-file__file-status">Building first read</span>
        </header>

        <div className="manager-working-file__file-rule" aria-hidden="true" />

        <div className="manager-working-file__sections">
          {SECTION_DEFINITIONS.map((section) => {
            const rows = settled.filter((finding) => finding.destination === section.destination);
            const receiving = activeDestination === section.destination;
            return (
              <section
                key={section.destination}
                data-section={section.destination}
                data-populated={rows.length > 0}
                className={`manager-working-file__section ${receiving ? "is-receiving" : ""}`}
              >
                <div className="manager-working-file__section-heading">
                  <span className="manager-working-file__section-index">{section.index}</span>
                  <h3>{section.label}</h3>
                  {receiving ? <span className="manager-working-file__receiving-label">Receiving</span> : null}
                </div>
                {rows.length ? (
                  <div data-testid={section.destination === "catalogue" ? "manager-file-settled" : undefined} className="manager-working-file__settled-rows">
                    {rows.map((finding) => <SettledFinding key={finding.id} finding={finding} />)}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        {collapsedSettledCount ? (
          <p className="manager-working-file__collapsed-count">
            {collapsedSettledCount} earlier {collapsedSettledCount === 1 ? "finding" : "findings"} filed
          </p>
        ) : null}

        {!activeFinding && settled.length === 0 ? (
          <p data-testid="manager-file-waiting" className="manager-working-file__waiting">
            Waiting for the next confirmed finding
          </p>
        ) : null}
      </article>
    </div>
  );
}

function SettledFinding({ finding }: { finding: SetupPresentationFinding }) {
  return (
    <div className="manager-working-file__settled-row">
      {finding.artwork ? (
        <SafeArtwork
          src={finding.artwork.url}
          title={finding.artwork.alt || finding.title}
          className="manager-working-file__settled-artwork"
        />
      ) : (
        <span className="manager-working-file__settled-icon" aria-hidden="true"><FindingIcon finding={finding} /></span>
      )}
      <div className="manager-working-file__settled-copy">
        <p>{finding.title}</p>
        {finding.value ? <span>{finding.value}</span> : finding.detail ? <span>{finding.detail}</span> : null}
      </div>
      <span className="manager-working-file__filed-mark" aria-label="Filed"><Check aria-hidden="true" /></span>
    </div>
  );
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

function phaseLabel(phase: SetupPresentationPhase) {
  if (phase === "catalogue") return "Working through the catalogue";
  if (phase === "discovery") return "Learning about your artist";
  if (phase === "synthesis") return "Preparing the first read";
  return "Working file complete";
}

function phaseCopy(phase: SetupPresentationPhase) {
  if (phase === "catalogue") return "Bringing the music into view.";
  if (phase === "discovery") return "Finding the signals that matter.";
  if (phase === "synthesis") return "Connecting the dots into a read.";
  return "Your Manager has the picture.";
}

function phaseDetail(phase: SetupPresentationPhase, active: SetupPresentationFinding | null) {
  if (active) return `${active.title} is joining the file now.`;
  if (phase === "catalogue") return "Confirmed catalogue facts will file here as they arrive.";
  if (phase === "discovery") return "The next confirmed signal will join the working file.";
  if (phase === "synthesis") return "The working file is being shaped into your first Manager read.";
  return "The file is ready to open in Desk.";
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
