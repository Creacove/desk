import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clipboard, ExternalLink, FileText, Link2, RotateCcw, Sparkles, Target, X } from "lucide-react";
import type { ReleaseOpportunityArtifactViewModel, ReleaseOpportunityTargetViewModel } from "../../types/cleanProduction";

export function OpportunityArtifact({
  artifact,
  onPreparePitch,
  onRecordOutcome,
  onOpenFiles,
  onOpenMission,
  onRetry,
}: {
  artifact: ReleaseOpportunityArtifactViewModel;
  onPreparePitch: (target: ReleaseOpportunityTargetViewModel) => void | Promise<void>;
  onRecordOutcome: (target: ReleaseOpportunityTargetViewModel, input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string }) => void | Promise<void>;
  onOpenFiles: (musicItemId: string) => void | Promise<void>;
  onOpenMission?: (missionId: string) => void | Promise<void>;
  onRetry: (artifact: ReleaseOpportunityArtifactViewModel) => void | Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(artifact.shortlist[0]?.id ?? artifact.watch[0]?.id ?? artifact.excluded[0]?.id ?? "");
  const [outcomeTargetId, setOutcomeTargetId] = useState<string | null>(null);
  const [outcomeStatus, setOutcomeStatus] = useState<ReleaseOpportunityTargetViewModel["status"]>("submitted_manually");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  const allTargets = useMemo(() => [...artifact.shortlist, ...artifact.watch, ...artifact.excluded], [artifact]);
  const selectedTarget = allTargets.find((target) => target.id === selectedId) ?? allTargets[0];
  const outcomeTarget = allTargets.find((target) => target.id === outcomeTargetId);
  const isSpotifyEditorial = selectedTarget ? /spotify\s+(?:editorial|for artists)|editorial\s+playlist/i.test(`${selectedTarget.platform ?? ""} ${selectedTarget.targetName}`) : false;

  useEffect(() => {
    if (!allTargets.some((target) => target.id === selectedId)) setSelectedId(allTargets[0]?.id ?? "");
  }, [allTargets, selectedId]);

  async function copyPitch() {
    const body = selectedTarget?.package?.pitchBody?.trim();
    if (!body) return;
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  }

  async function saveOutcome() {
    if (!outcomeTarget || !outcomeNote.trim()) return;
    await onRecordOutcome(outcomeTarget, { status: outcomeStatus, manualOutcome: outcomeNote.trim() });
    setOutcomeTargetId(null);
    setOutcomeNote("");
  }

  return (
    <article data-testid="release-opportunity-artifact" className="mt-5 border-l-2 border-foreground/12 py-1 pl-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-muted-foreground">Best match · {allTargets.length} {allTargets.length === 1 ? "match" : "matches"} reviewed</p>
          <p className="mt-1 truncate text-[14px] font-semibold text-foreground">{allTargets[0]?.targetName ?? "No actionable match yet"}</p>
        </div>
        {allTargets.length ? <button type="button" aria-expanded={detailsExpanded} onClick={() => setDetailsExpanded((expanded) => !expanded)} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-foreground/75 hover:bg-foreground/[0.05]">{detailsExpanded ? "Hide matches" : "View all matches"}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${detailsExpanded ? "rotate-180" : ""}`} aria-hidden="true" /></button> : null}
      </div>
      {detailsExpanded ? <>
      <header className="border-b border-foreground/8 bg-foreground/[0.02] px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-brand-accent/10 text-brand-accent"><Target className="h-4 w-4" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Release targets · {artifact.opportunityType}</p>
            <h3 className="mt-1 text-[16px] font-bold text-foreground">{artifact.subject.title}</h3>
            <p className="mt-1 text-[12px] font-semibold text-muted-foreground">Evidence-backed targets for this song. Preparation only — no outreach is sent.</p>
          </div>
          {artifact.missionId && onOpenMission ? <button type="button" onClick={() => void onOpenMission(artifact.missionId!)} className="shrink-0 rounded-lg border border-foreground/10 px-2.5 py-2 text-[10px] font-bold text-foreground hover:bg-foreground/[0.04]">Open mission</button> : null}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Opportunity result counts">
          <Count label="Shortlisted" value={artifact.shortlist.length} tone="accent" />
          <Count label="Watchlist" value={artifact.watch.length} tone="muted" />
          <Count label="Excluded" value={artifact.excluded.length} tone="danger" />
        </div>
      </header>

      <div className="grid gap-4 p-4 sm:p-5">
        <TargetSection title={`${artifact.shortlist.length} shortlisted`} targets={artifact.shortlist} selectedId={selectedId} onSelect={setSelectedId} />
        <TargetSection title="Watchlist" targets={artifact.watch} selectedId={selectedId} onSelect={setSelectedId} muted />
        <TargetSection title="Excluded" targets={artifact.excluded} selectedId={selectedId} onSelect={setSelectedId} excluded />

        {selectedTarget ? (
          <section className="rounded-[15px] border border-foreground/10 bg-foreground/[0.018] p-4" aria-label={`Details for ${selectedTarget.targetName}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-ui text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">Target detail</p>
                <h4 className="mt-1 text-[17px] font-bold text-foreground">{selectedTarget.targetName}</h4>
                <p className="mt-1 text-[11px] font-semibold capitalize text-muted-foreground">{selectedTarget.platform ?? artifact.opportunityType} · {selectedTarget.confidence} confidence</p>
              </div>
              <SafetyBadge state={selectedTarget.safetyState} />
            </div>

            {isSpotifyEditorial ? (
              <div className="mt-4 rounded-[12px] border border-[#1ed760]/20 bg-[#1ed760]/[0.07] p-3">
                <p className="text-[11px] font-bold text-foreground">Spotify editorial handoff</p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Use Spotify for Artists' official route. The Manager does not expose editor emails or claim a submission was made.</p>
                {selectedTarget.targetUrl ? <ExternalAnchor href={selectedTarget.targetUrl} label="Open Spotify for Artists" /> : null}
              </div>
            ) : null}

            <DetailGrid target={selectedTarget} />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void onPreparePitch(selectedTarget)} className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-bold text-background hover:bg-foreground/85"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />Prepare pitch for {selectedTarget.targetName}</button>
              {selectedTarget.package?.shareUrl ? <ExternalAnchor href={selectedTarget.package.shareUrl} label="Open share link" icon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />} /> : <button type="button" onClick={() => void onOpenFiles(artifact.musicItemId)} className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-bold text-foreground hover:bg-foreground/[0.04]"><FileText className="h-3.5 w-3.5" aria-hidden="true" />Open Files to create share link</button>}
              <button type="button" onClick={() => { setOutcomeTargetId(selectedTarget.id); setOutcomeNote(selectedTarget.manualOutcome ?? ""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-3 py-2 text-[11px] font-bold text-foreground hover:bg-foreground/[0.04]"><Check className="h-3.5 w-3.5" aria-hidden="true" />Record outcome for {selectedTarget.targetName}</button>
            </div>

            {outcomeTarget ? (
              <div className="mt-3 rounded-[12px] border border-brand-accent/20 bg-brand-accent/[0.045] p-3">
                <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-bold text-foreground">Manual outcome</p><button type="button" aria-label="Close manual outcome" onClick={() => setOutcomeTargetId(null)} className="rounded-md p-1 text-muted-foreground hover:bg-foreground/5"><X className="h-3.5 w-3.5" aria-hidden="true" /></button></div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <select aria-label={`Outcome status for ${outcomeTarget.targetName}`} value={outcomeStatus} onChange={(event) => setOutcomeStatus(event.target.value as ReleaseOpportunityTargetViewModel["status"])} className="h-9 rounded-lg border border-foreground/10 bg-background px-2 text-[11px] font-semibold text-foreground">
                    {(["submitted_manually", "replied", "accepted", "declined", "watch"] as const).map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}
                  </select>
                  <input aria-label={`Outcome note for ${outcomeTarget.targetName}`} value={outcomeNote} onChange={(event) => setOutcomeNote(event.target.value)} placeholder="What happened?" className="h-9 min-w-0 rounded-lg border border-foreground/10 bg-background px-2.5 text-[11px] font-semibold text-foreground outline-none" />
                  <button type="button" aria-label={`Save outcome for ${outcomeTarget.targetName}`} disabled={!outcomeNote.trim()} onClick={() => void saveOutcome()} className="h-9 rounded-lg bg-foreground px-3 text-[11px] font-bold text-background disabled:opacity-40">Save outcome</button>
                </div>
              </div>
            ) : null}

            {selectedTarget.package ? <TargetPackage target={selectedTarget} copied={copied} onCopy={() => void copyPitch()} onOpenFiles={() => void onOpenFiles(artifact.musicItemId)} /> : null}
          </section>
        ) : <p className="rounded-[12px] border border-dashed border-foreground/12 px-4 py-5 text-center text-[12px] font-semibold text-muted-foreground">No target is ready to inspect yet.</p>}

        {artifact.failure ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-danger/20 bg-danger/[0.045] px-3.5 py-3" role="alert">
            <div><p className="text-[11px] font-bold text-danger">Research paused at {artifact.failure.stage.replace(/_/g, " ")}</p><p className="mt-1 text-[11px] font-semibold text-muted-foreground">{artifact.failure.message}</p></div>
            {artifact.failure.retryable ? <button type="button" onClick={() => void onRetry(artifact)} className="inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-3 py-2 text-[11px] font-bold text-danger hover:bg-danger/5"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Retry {artifact.failure.stage.replace(/_/g, " ")}</button> : null}
          </div>
        ) : null}
      </div>
      </> : null}
    </article>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone: "accent" | "muted" | "danger" }) {
  const colors = tone === "accent" ? "border-brand-accent/20 bg-brand-accent/[0.05] text-brand-accent" : tone === "danger" ? "border-danger/15 bg-danger/[0.04] text-danger" : "border-foreground/8 bg-background text-muted-foreground";
  return <div className={`rounded-[11px] border px-2.5 py-2 ${colors}`}><p className="text-[16px] font-bold leading-none">{value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.08em]">{label}</p></div>;
}

function TargetSection({ title, targets, selectedId, onSelect, muted = false, excluded = false }: { title: string; targets: ReleaseOpportunityTargetViewModel[]; selectedId: string; onSelect: (id: string) => void; muted?: boolean; excluded?: boolean }) {
  if (!targets.length) return null;
  return <section aria-label={title}><div className="mb-2 flex items-center justify-between gap-2"><h4 className={`font-ui text-[10px] font-bold uppercase tracking-[0.12em] ${excluded ? "text-danger" : muted ? "text-muted-foreground" : "text-foreground"}`}>{title}</h4><span className="text-[10px] font-bold text-muted-foreground">{targets.length}</span></div><div className="grid gap-2">{targets.map((target) => <button key={target.id} type="button" aria-label={`Open ${target.targetName}`} onClick={() => onSelect(target.id)} className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition ${target.id === selectedId ? "border-brand-accent/35 bg-brand-accent/[0.045]" : "border-foreground/8 bg-background hover:bg-foreground/[0.025]"}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] ${excluded ? "bg-danger/10 text-danger" : muted ? "bg-foreground/[0.05] text-muted-foreground" : "bg-brand-accent/10 text-brand-accent"}`}><Target className="h-3.5 w-3.5" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-foreground">{target.targetName}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-muted-foreground">{target.platform ?? "Target"} · {target.confidence} confidence</span></span><ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition ${target.id === selectedId ? "rotate-180" : "-rotate-90"}`} aria-hidden="true" /></button>)}</div></section>;
}

function DetailGrid({ target }: { target: ReleaseOpportunityTargetViewModel }) {
  return <div className="mt-4 grid gap-3 border-t border-foreground/8 pt-4 sm:grid-cols-2">
    <Detail label="Source"><ExternalAnchor href={target.sourceUrl} label={`Open source for ${target.targetName}`} /></Detail>
    <Detail label="Contact route">{target.publicContact ? <span className="flex flex-wrap items-center gap-1.5">{target.publicContact.kind === "email" ? <a href={`mailto:${target.publicContact.value}`} className="break-all text-brand-accent underline underline-offset-2">{target.publicContact.value}</a> : <ExternalAnchor href={target.publicContact.value} label="Open public contact route" />} {target.publicContact.verifiedAt ? <span className="text-[10px] text-muted-foreground">verified {target.publicContact.verifiedAt.slice(0, 10)}</span> : null}</span> : <span className="text-muted-foreground">No verified public route</span>}</Detail>
    <Detail label="Fit explanation" wide><p>{target.fit.explanation}</p>{target.fit.songCriteria.length ? <p className="mt-1 text-muted-foreground">Song: {target.fit.songCriteria.join(" · ")}</p> : null}{target.fit.targetCriteria.length ? <p className="mt-1 text-muted-foreground">Target: {target.fit.targetCriteria.join(" · ")}</p> : null}</Detail>
    <Detail label="Source evidence" wide><div className="flex flex-wrap gap-x-3 gap-y-1">{target.sourceEvidence.map((evidence, index) => evidence.ref ? <ExternalAnchor key={`${evidence.source}-${index}`} href={evidence.ref} label={evidence.source} /> : <span key={`${evidence.source}-${index}`} className="text-muted-foreground">{evidence.source}</span>)}</div></Detail>
    {target.limitations.length ? <Detail label="Limitations" wide><ul className="space-y-1">{target.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}</ul></Detail> : null}
  </div>;
}

function Detail({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground/70">{label}</p><div className="mt-1 text-[11px] font-semibold leading-relaxed text-foreground">{children}</div></div>;
}

function SafetyBadge({ state }: { state: ReleaseOpportunityTargetViewModel["safetyState"] }) {
  const label = state === "clear" ? "Verified route" : state === "excluded" ? "Excluded" : "Watch";
  return <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] ${state === "clear" ? "bg-success/10 text-success" : state === "excluded" ? "bg-danger/10 text-danger" : "bg-foreground/[0.06] text-muted-foreground"}`}>{label}</span>;
}

function TargetPackage({ target, copied, onCopy, onOpenFiles }: { target: ReleaseOpportunityTargetViewModel; copied: boolean; onCopy: () => void; onOpenFiles: () => void }) {
  return <section className="mt-4 rounded-[13px] border border-foreground/10 bg-background p-3.5" aria-label="Target package"><div className="flex items-center justify-between gap-2"><div><p className="font-ui text-[9px] font-bold uppercase tracking-[0.12em] text-brand-accent">Target package</p><p className="mt-1 text-[12px] font-bold text-foreground">Ready to review and share</p></div><span className="rounded-full bg-success/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-success">No sending</span></div><div className="mt-3 flex flex-wrap gap-1.5">{target.package?.selectedFiles.map((file) => <span key={file} className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[10px] font-bold text-foreground"><FileText className="h-3 w-3" aria-hidden="true" />{file}</span>)}</div>{target.package?.pitchBody ? <div className="mt-3 rounded-[10px] border border-foreground/8 bg-foreground/[0.018] p-3"><p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground">{target.package.pitchBody}</p><button type="button" onClick={onCopy} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-foreground/10 px-2.5 py-1.5 text-[10px] font-bold text-foreground hover:bg-foreground/[0.04]"><Clipboard className="h-3 w-3" aria-hidden="true" />{copied ? "Copied" : "Copy pitch"}</button></div> : null}{!target.package?.shareUrl ? <button type="button" onClick={onOpenFiles} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-accent hover:underline"><FileText className="h-3 w-3" aria-hidden="true" />Open Files to create share link</button> : null}</section>;
}

function ExternalAnchor({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" aria-label={label} className="mt-1 inline-flex max-w-full items-center gap-1 text-[11px] font-bold text-brand-accent underline decoration-brand-accent/30 underline-offset-2 hover:decoration-brand-accent">{icon ?? <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />}<span className="truncate">{label}</span></a>;
}
