import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Clipboard, ExternalLink, FileText, Link2, RotateCcw, Sparkles, Target, X } from "lucide-react";
import type { ReleaseOpportunityArtifactViewModel, ReleaseOpportunityTargetViewModel } from "../../types/cleanProduction";

export function OpportunityArtifact({ artifact, onPreparePitch, onRecordOutcome, onOpenFiles, onOpenMission, onRetry }: {
  artifact: ReleaseOpportunityArtifactViewModel;
  onPreparePitch: (target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOutcome: (target: ReleaseOpportunityTargetViewModel, input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string }) => void | Promise<void>;
  onOpenFiles: (musicItemId: string) => void | Promise<void>;
  onOpenMission?: (missionId: string) => void | Promise<void>;
  onRetry: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
}) {
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [outcomeTargetId, setOutcomeTargetId] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<ReleaseOpportunityTargetViewModel["status"]>("submitted_manually");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [copiedTargetId, setCopiedTargetId] = useState<string | null>(null);
  const [preparingTargetId, setPreparingTargetId] = useState<string | null>(null);
  const [savingOutcome, setSavingOutcome] = useState(false);

  const allTargets = useMemo(() => [...artifact.shortlist, ...artifact.watch, ...artifact.excluded], [artifact]);
  const outcomeTarget = allTargets.find((target) => target.id === outcomeTargetId);
  const targetLabel = artifact.opportunityType === "playlist" ? "playlist" : "press";
  const primaryCount = artifact.shortlist.length || artifact.watch.length;
  const title = artifact.opportunityType === "playlist" ? "Playlist opportunities" : "Press opportunities";
  const headline = artifact.shortlist.length
    ? `${artifact.shortlist.length} ${artifact.shortlist.length === 1 ? "target is" : "targets are"} ready to pitch`
    : artifact.watch.length
      ? `${artifact.watch.length} ${artifact.watch.length === 1 ? "target is" : "targets are"} worth watching`
      : `No strong ${targetLabel} match yet`;
  const summary = artifact.shortlist.length
    ? "These have enough evidence and a usable route to prepare a pitch."
    : artifact.watch.length
      ? "None are ready to pitch yet. You can still inspect what Manager found and what is missing."
      : artifact.failure?.message ?? "Manager did not find a target strong enough to recommend.";

  useEffect(() => {
    if (expandedTargetId && !allTargets.some((target) => target.id === expandedTargetId)) setExpandedTargetId(null);
  }, [allTargets, expandedTargetId]);

  async function preparePitch(target: ReleaseOpportunityTargetViewModel) {
    if (preparingTargetId) return;
    try {
      setPreparingTargetId(target.id);
      await onPreparePitch(target);
    } finally {
      setPreparingTargetId(null);
    }
  }

  async function copyPitch(target: ReleaseOpportunityTargetViewModel) {
    const body = target.package?.pitchBody?.trim();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopiedTargetId(target.id);
      window.setTimeout(() => setCopiedTargetId((current) => current === target.id ? null : current), 1500);
    } catch {
      setCopiedTargetId(null);
    }
  }

  async function saveOutcome() {
    if (!outcomeTarget || !outcomeNote.trim() || savingOutcome) return;
    try {
      setSavingOutcome(true);
      await onRecordOutcome(outcomeTarget, { status: outcomeStatus, manualOutcome: outcomeNote.trim() });
      setOutcomeTargetId(null);
      setOutcomeNote("");
    } finally {
      setSavingOutcome(false);
    }
  }

  const details = (target: ReleaseOpportunityTargetViewModel) => (
    <TargetDetails
      artifact={artifact}
      target={target}
      preparing={preparingTargetId === target.id}
      copied={copiedTargetId === target.id}
      outcomeTarget={outcomeTarget}
      outcomeStatus={outcomeStatus}
      outcomeNote={outcomeNote}
      savingOutcome={savingOutcome}
      onPrepare={() => void preparePitch(target)}
      onCopy={() => void copyPitch(target)}
      onOpenFiles={() => void onOpenFiles(artifact.musicItemId)}
      onStartOutcome={() => { setOutcomeTargetId(target.id); setOutcomeNote(target.manualOutcome ?? ""); }}
      onCloseOutcome={() => setOutcomeTargetId(null)}
      onOutcomeStatus={setOutcomeStatus}
      onOutcomeNote={setOutcomeNote}
      onSaveOutcome={() => void saveOutcome()}
    />
  );

  return (
    <article data-testid="release-opportunity-artifact" className="mt-5 border-t border-foreground/8 pt-5">
      <header>
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">{title}</p>
        <h3 className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{headline}</h3>
        <p className="mt-2 max-w-[44rem] text-[13px] font-medium leading-relaxed text-muted-foreground">{summary}</p>
      </header>

      {primaryCount ? (
        <div className="mt-5 grid gap-6">
          <OpportunitySection title="Ready to pitch" targets={artifact.shortlist} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} />
          <OpportunitySection title="Worth watching" targets={artifact.watch} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} />
        </div>
      ) : null}

      {artifact.excluded.length ? (
        <div className="mt-5 border-t border-foreground/8 pt-4">
          <button type="button" aria-expanded={showSkipped} onClick={() => setShowSkipped((current) => !current)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
            {showSkipped ? "Hide skipped" : `Show skipped (${artifact.excluded.length})`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSkipped ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {showSkipped ? <div className="mt-3"><OpportunitySection title="Skipped" targets={artifact.excluded} expandedTargetId={expandedTargetId} onToggle={(target) => setExpandedTargetId((current) => current === target.id ? null : target.id)} renderDetails={details} muted /></div> : null}
        </div>
      ) : null}

      {artifact.failure ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-danger pl-3" role="alert">
          <p className="text-[12px] font-medium leading-relaxed text-danger">{artifact.failure.message}</p>
          {artifact.failure.retryable ? <button type="button" onClick={() => void onRetry(artifact)} className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-semibold text-danger"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button> : null}
        </div>
      ) : null}

      {artifact.missionId && onOpenMission ? <button type="button" onClick={() => void onOpenMission(artifact.missionId!)} className="mt-5 text-[12px] font-semibold text-muted-foreground underline decoration-foreground/15 underline-offset-4 hover:text-foreground">View related mission</button> : null}
    </article>
  );
}

function OpportunitySection({ title, targets, expandedTargetId, onToggle, renderDetails, muted = false }: {
  title: string;
  targets: ReleaseOpportunityTargetViewModel[];
  expandedTargetId: string | null;
  onToggle: (target: ReleaseOpportunityTargetViewModel) => void;
  renderDetails: (target: ReleaseOpportunityTargetViewModel) => ReactNode;
  muted?: boolean;
}) {
  if (!targets.length) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center justify-between gap-3"><h4 className="text-[11px] font-semibold text-muted-foreground">{title}</h4><span className="text-[10px] tabular-nums text-muted-foreground/55">{targets.length}</span></div>
      <div className="divide-y divide-foreground/8 border-y border-foreground/8">
        {targets.map((target) => {
          const expanded = expandedTargetId === target.id;
          return (
            <div key={target.id}>
              <button type="button" aria-label={`Open ${target.targetName}`} aria-expanded={expanded} onClick={() => onToggle(target)} className="group flex w-full items-start gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${muted ? "bg-foreground/[0.035] text-muted-foreground" : "bg-foreground/[0.055] text-foreground/70"}`} aria-hidden="true"><Target className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold leading-snug text-foreground">{target.targetName}</span>
                  <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">{target.platform ?? "Target"}</span>
                  {target.fit?.explanation ? <span className="mt-1.5 line-clamp-2 block text-[12px] font-medium leading-relaxed text-muted-foreground/85">{target.fit.explanation}</span> : null}
                </span>
                <ChevronDown className={`mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground/45 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
              {expanded ? <div className="pb-4 pl-11">{renderDetails(target)}</div> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TargetDetails({ artifact, target, preparing, copied, outcomeTarget, outcomeStatus, outcomeNote, savingOutcome, onPrepare, onCopy, onOpenFiles, onStartOutcome, onCloseOutcome, onOutcomeStatus, onOutcomeNote, onSaveOutcome }: {
  artifact: ReleaseOpportunityArtifactViewModel;
  target: ReleaseOpportunityTargetViewModel;
  preparing: boolean;
  copied: boolean;
  outcomeTarget?: ReleaseOpportunityTargetViewModel;
  outcomeStatus: ReleaseOpportunityTargetViewModel["status"];
  outcomeNote: string;
  savingOutcome: boolean;
  onPrepare: () => void;
  onCopy: () => void;
  onOpenFiles: () => void;
  onStartOutcome: () => void;
  onCloseOutcome: () => void;
  onOutcomeStatus: (status: ReleaseOpportunityTargetViewModel["status"]) => void;
  onOutcomeNote: (note: string) => void;
  onSaveOutcome: () => void;
}) {
  const isSpotifyEditorial = /spotify\s+(?:editorial|for artists)|editorial\s+playlist/i.test(`${target.platform ?? ""} ${target.targetName}`);
  return (
    <div className="border-l border-foreground/10 pl-4">
      <div className="flex flex-wrap items-center gap-2"><SafetyBadge state={target.safetyState} /><span className="text-[10px] font-medium capitalize text-muted-foreground">{target.confidence} confidence</span></div>
      {target.requirements?.length ? <div className="mt-3"><p className="text-[11px] font-semibold text-foreground">Before you pitch</p><ul className="mt-1.5 grid gap-1 text-[11px] font-medium leading-relaxed text-muted-foreground">{target.requirements.slice(0, 4).map((item) => <li key={item}>• {item}</li>)}</ul></div> : null}
      {isSpotifyEditorial ? <p className="mt-3 text-[11px] font-medium leading-relaxed text-muted-foreground">Spotify editorial pitches go through Spotify for Artists. Manager will prepare the pitch, not submit it for you.</p> : null}
      {target.publicContact ? <p className="mt-3 text-[11px] font-medium text-muted-foreground">Public contact: <ContactLink contact={target.publicContact} /> {target.publicContact.verifiedAt ? <span className="text-muted-foreground/60">· verified {target.publicContact.verifiedAt.slice(0, 10)}</span> : null}</p> : null}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-semibold">{target.targetUrl ? <ExternalAnchor href={target.targetUrl} label="Open submission route" /> : null}{target.sourceUrl ? <ExternalAnchor href={target.sourceUrl} label="View source" /> : null}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onPrepare} disabled={preparing} aria-busy={preparing} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 disabled:opacity-45"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{preparing ? "Preparing..." : "Prepare pitch"}</button>
        {target.package?.shareUrl ? <ExternalAnchor href={target.package.shareUrl} label="Open share link" icon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />} buttonLike /> : <button type="button" onClick={onOpenFiles} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Open Files to create share link</button>}
        <button type="button" onClick={onStartOutcome} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]"><Check className="h-3.5 w-3.5" aria-hidden="true" />Record outcome</button>
      </div>
      {target.package?.pitchBody ? <div className="mt-4 border-t border-foreground/8 pt-3"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-foreground">Pitch draft</p><button type="button" onClick={onCopy} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"><Clipboard className="h-3.5 w-3.5" aria-hidden="true" />{copied ? "Copied" : "Copy"}</button></div><p className="mt-2 whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-muted-foreground">{target.package.pitchBody}</p></div> : null}
      {outcomeTarget?.id === target.id ? <div className="mt-4 border-t border-foreground/8 pt-3"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-foreground">What happened?</p><button type="button" aria-label="Close outcome form" onClick={onCloseOutcome} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" aria-hidden="true" /></button></div><div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"><select value={outcomeStatus} onChange={(event) => onOutcomeStatus(event.target.value as ReleaseOpportunityTargetViewModel["status"])} className="h-10 rounded-lg border border-foreground/10 bg-background px-2.5 text-[12px] font-medium text-foreground">{(["submitted_manually", "replied", "accepted", "declined", "watch"] as const).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select><input value={outcomeNote} onChange={(event) => onOutcomeNote(event.target.value)} placeholder="Add a short note" className="h-10 min-w-0 rounded-lg border border-foreground/10 bg-background px-3 text-[12px] font-medium text-foreground outline-none focus:border-brand-accent/35" /><button type="button" onClick={onSaveOutcome} disabled={!outcomeNote.trim() || savingOutcome} className="h-10 rounded-lg bg-foreground px-3 text-[11px] font-semibold text-background disabled:opacity-40">{savingOutcome ? "Saving..." : "Save"}</button></div></div> : null}
      {target.limitations?.length ? <p className="mt-3 text-[10px] font-medium leading-relaxed text-muted-foreground/65">{target.limitations.slice(0, 2).join(" · ")}</p> : null}
      <span className="sr-only">{artifact.subject.title}</span>
    </div>
  );
}

function ContactLink({ contact }: { contact: NonNullable<ReleaseOpportunityTargetViewModel["publicContact"]> }) {
  const isEmail = contact.kind === "email";
  const href = isEmail ? `mailto:${contact.value}` : contact.value;
  return <a href={href} target={isEmail ? undefined : "_blank"} rel={isEmail ? undefined : "noreferrer"} className="font-semibold text-foreground underline decoration-foreground/20 underline-offset-2">{contact.value}</a>;
}

function ExternalAnchor({ href, label, icon, buttonLike = false }: { href: string; label: string; icon?: ReactNode; buttonLike?: boolean }) {
  return <a href={href} target="_blank" rel="noreferrer" className={buttonLike ? "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.035]" : "inline-flex items-center gap-1 text-[11px] font-semibold text-foreground underline decoration-foreground/15 underline-offset-3"}>{icon ?? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}{label}</a>;
}

function SafetyBadge({ state }: { state: ReleaseOpportunityTargetViewModel["safetyState"] }) {
  const label = state === "clear" ? "Route verified" : state === "caution" ? "Needs checking" : "Not recommended";
  return <span className="rounded-full bg-foreground/[0.055] px-2 py-1 text-[9px] font-semibold text-muted-foreground">{label}</span>;
}
