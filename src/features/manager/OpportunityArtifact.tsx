import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Clipboard, ExternalLink, RotateCcw, Sparkles } from "lucide-react";
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
  const [preparingTargetId, setPreparingTargetId] = useState<string | null>(null);
  const [savingOutcomeTargetId, setSavingOutcomeTargetId] = useState<string | null>(null);
  const [copiedTargetId, setCopiedTargetId] = useState<string | null>(null);

  const visibleTargets = useMemo(
    () => [...artifact.shortlist, ...artifact.watch],
    [artifact.shortlist, artifact.watch],
  );

  // A parent may currently fire-and-forget the Manager request. Do not clear the
  // visual lock merely because that callback returned void; clear it only when the
  // refreshed artifact proves the pitch exists (or the target disappears).
  useEffect(() => {
    if (!preparingTargetId) return;
    const current = visibleTargets.find((target) => target.id === preparingTargetId);
    if (!current || current.package?.pitchBody?.trim()) setPreparingTargetId(null);
  }, [visibleTargets, preparingTargetId]);

  const title = artifact.opportunityType === "playlist" ? "Playlist opportunities" : "Press opportunities";
  const headline = artifact.shortlist.length
    ? `${artifact.shortlist.length} ${artifact.shortlist.length === 1 ? "match is" : "matches are"} ready to work on`
    : artifact.watch.length
      ? `${artifact.watch.length} ${artifact.watch.length === 1 ? "match is" : "matches are"} worth watching`
      : `No strong ${artifact.opportunityType === "playlist" ? "playlist" : "press"} match yet`;
  const summary = artifact.shortlist.length
    ? "Manager found usable targets. Open one to see why it fits and the next action."
    : artifact.watch.length
      ? "These are plausible, but Manager does not have enough confidence to recommend pitching them yet."
      : artifact.failure?.message ?? "Manager did not find a target strong enough to recommend.";

  async function preparePitch(target: ReleaseOpportunityTargetViewModel) {
    if (preparingTargetId) return;
    setPreparingTargetId(target.id);
    try {
      await onPreparePitch(target);
    } catch (error) {
      setPreparingTargetId(null);
      throw error;
    }
  }

  async function copyPitch(target: ReleaseOpportunityTargetViewModel) {
    const pitch = target.package?.pitchBody?.trim();
    if (!pitch) return;
    try {
      await navigator.clipboard.writeText(pitch);
      setCopiedTargetId(target.id);
      window.setTimeout(() => setCopiedTargetId((current) => current === target.id ? null : current), 1400);
    } catch {
      setCopiedTargetId(null);
    }
  }

  async function recordSubmitted(target: ReleaseOpportunityTargetViewModel) {
    if (savingOutcomeTargetId) return;
    setSavingOutcomeTargetId(target.id);
    try {
      await onRecordOutcome(target, {
        status: "submitted_manually",
        manualOutcome: "Submitted manually by the artist/team.",
      });
    } finally {
      setSavingOutcomeTargetId(null);
    }
  }

  return (
    <article data-testid="release-opportunity-artifact" className="mt-5 border-t border-foreground/8 pt-5">
      <header>
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/65">{title}</p>
        <h3 className="mt-2 text-[18px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{headline}</h3>
        <p className="mt-2 max-w-[42rem] text-[13px] font-medium leading-relaxed text-muted-foreground">{summary}</p>
      </header>

      {visibleTargets.length ? (
        <div className="mt-5 divide-y divide-foreground/8 border-y border-foreground/8">
          {visibleTargets.map((target) => {
            const expanded = expandedTargetId === target.id;
            const preparing = preparingTargetId === target.id;
            const pitchReady = Boolean(target.package?.pitchBody?.trim());
            const submitted = ["submitted_manually", "replied", "accepted", "declined"].includes(target.status);
            const savingOutcome = savingOutcomeTargetId === target.id;
            return (
              <section key={target.id}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedTargetId((current) => current === target.id ? null : target.id)}
                  className="group flex w-full items-center gap-3 py-3.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-foreground">{target.targetName}</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground">
                      {[target.platform, fitLabel(target)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground/45 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>

                {expanded ? (
                  <div className="pb-4 pr-1">
                    {target.fit?.explanation ? (
                      <div className="max-w-[42rem] border-l border-foreground/10 pl-4">
                        <p className="text-[11px] font-semibold text-foreground">Why Manager picked it</p>
                        <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">{target.fit.explanation}</p>
                      </div>
                    ) : null}

                    {target.requirements?.length ? (
                      <p className="mt-3 max-w-[42rem] text-[11px] font-medium leading-relaxed text-muted-foreground">
                        {target.requirements.slice(0, 2).join(" · ")}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                      {!pitchReady ? (
                        <button
                          type="button"
                          onClick={() => void preparePitch(target)}
                          disabled={preparing || Boolean(preparingTargetId && preparingTargetId !== target.id)}
                          aria-busy={preparing}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <Sparkles className={`h-3.5 w-3.5 ${preparing ? "animate-pulse" : ""}`} aria-hidden="true" />
                          {preparing ? "Preparing pitch…" : "Prepare pitch"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void copyPitch(target)}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-[11px] font-semibold text-background transition-opacity hover:opacity-85"
                        >
                          <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                          {copiedTargetId === target.id ? "Copied" : "Copy pitch"}
                        </button>
                      )}

                      {target.targetUrl ? <TextLink href={target.targetUrl}>Submission route</TextLink> : null}
                      {target.sourceUrl ? <TextLink href={target.sourceUrl}>View source</TextLink> : null}

                      {pitchReady && !submitted ? (
                        <button
                          type="button"
                          onClick={() => void recordSubmitted(target)}
                          disabled={savingOutcome}
                          className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground disabled:opacity-45"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          {savingOutcome ? "Saving…" : "Mark submitted"}
                        </button>
                      ) : null}

                      {submitted ? <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><Check className="h-3.5 w-3.5" />Submitted</span> : null}
                    </div>

                    {pitchReady ? (
                      <p className="mt-3 line-clamp-3 max-w-[42rem] whitespace-pre-wrap text-[12px] font-medium leading-relaxed text-muted-foreground">{target.package?.pitchBody}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : null}

      {artifact.excluded.length ? (
        <p className="mt-3 text-[11px] font-medium text-muted-foreground/65">Manager skipped {artifact.excluded.length} weaker {artifact.excluded.length === 1 ? "match" : "matches"}.</p>
      ) : null}

      {artifact.failure ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-danger pl-3" role="alert">
          <p className="text-[12px] font-medium leading-relaxed text-danger">{artifact.failure.message}</p>
          {artifact.failure.retryable ? (
            <button type="button" onClick={() => void onRetry(artifact)} className="inline-flex min-h-9 items-center gap-1.5 text-[12px] font-semibold text-danger">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Try again
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" onClick={() => void onOpenFiles(artifact.musicItemId)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Open Files</button>
        {artifact.missionId && onOpenMission ? <button type="button" onClick={() => void onOpenMission(artifact.missionId!)} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">View related mission</button> : null}
      </div>
    </article>
  );
}

function fitLabel(target: ReleaseOpportunityTargetViewModel) {
  const confidence = target.confidence?.trim().toLowerCase();
  if (target.safetyState === "excluded") return "Skipped";
  if (confidence === "high") return "Strong fit";
  if (confidence === "medium") return "Possible fit";
  return "Needs verification";
}

function TextLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
      {children}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
