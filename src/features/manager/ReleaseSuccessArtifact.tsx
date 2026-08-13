import { Check, ChevronDown, ChevronRight, Loader2, Music2, RefreshCw, Route, Sparkles } from "lucide-react";
import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { ProductButton } from "../../design-system/components";
import { reportBrowserServiceError } from "../../lib/errorTelemetry";
import type {
  ReleaseDateChangeRequestViewModel,
  ReleaseGateResult,
  ReleaseSuccessArtifactViewModel,
} from "../../types/cleanProduction";

type ArtifactWithRequest = ReleaseSuccessArtifactViewModel & {
  request?: ReleaseDateChangeRequestViewModel;
};

export type ReleaseSuccessArtifactProps = {
  artifact: ArtifactWithRequest;
  onApprove(request: ReleaseDateChangeRequestViewModel): Promise<void>;
  onKeepDate(artifact: ReleaseSuccessArtifactViewModel): void;
  onReviewAll(artifact: ReleaseSuccessArtifactViewModel): void;
  onOpenSong(musicItemId: string): void;
  onOpenMission(missionId: string): void;
  onRetry(artifact: ReleaseSuccessArtifactViewModel): Promise<void>;
};

export function ReleaseSuccessArtifact({
  ...props
}: ReleaseSuccessArtifactProps) {
  return (
    <ReleaseSuccessArtifactBoundary artifact={props.artifact}>
      <ReleaseSuccessArtifactContent {...props} />
    </ReleaseSuccessArtifactBoundary>
  );
}

class ReleaseSuccessArtifactBoundary extends Component<{
  artifact: ArtifactWithRequest;
  children: ReactNode;
}, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportBrowserServiceError(error, {
      stage: "receipt_render",
      musicItemId: this.props.artifact.musicItemId,
      missionId: this.props.artifact.missionId,
      requestId: this.props.artifact.requestId,
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <section role="alert" className="rounded-[18px] border border-red-600/15 bg-red-50/70 p-4 text-[13px] text-red-800">
          Release details could not be displayed. Refresh this conversation and try again.
        </section>
      );
    }
    return this.props.children;
  }
}

function ReleaseSuccessArtifactContent({
  artifact,
  onApprove,
  onKeepDate,
  onReviewAll,
  onOpenSong,
  onOpenMission,
  onRetry,
}: ReleaseSuccessArtifactProps) {
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const request = artifact.request ?? requestFromArtifact(artifact);
  const assessment = artifact.assessment;
  const isApplying = applying || artifact.state === "applying";
  const foundationGates = assessment?.foundation.gates ?? [];
  const campaignGates = assessment?.campaign.gates ?? [];
  const blockers = [...foundationGates, ...campaignGates].filter((gate) => gate.state === "blocked" || gate.state === "at_risk" || gate.state === "unknown");
  const visibleBlockers = showAll ? blockers : blockers.slice(0, 3);
  const canApprove = Boolean(request && (artifact.state === "proposed" || artifact.state === "awaiting_approval"));
  const title = artifact.subject.title || "Attached song";

  const status = useMemo(() => {
    if (artifact.state === "applied" && artifact.receipt) return { label: "Release date updated", tone: "success" as const };
    if (artifact.state === "failed") return { label: "Release review needs attention", tone: "error" as const };
    if (artifact.state === "applying" || applying) return { label: "Applying release date change", tone: "progress" as const };
    if (artifact.state === "awaiting_approval" || artifact.state === "proposed") return { label: "Release date impact preview ready", tone: "progress" as const };
    if (artifact.state === "assessed") return { label: "Release success review ready", tone: "progress" as const };
    return { label: "Release materials checked", tone: "progress" as const };
  }, [applying, artifact.receipt, artifact.state]);

  async function handleApprove() {
    if (!request || isApplying) return;
    setApplying(true);
    try {
      await onApprove(request);
    } finally {
      setApplying(false);
    }
  }

  return (
    <section
      data-testid="release-success-artifact"
      className="mt-5 border-l-2 border-foreground/12 py-1 pl-4"
    >
      <div className="flex items-start gap-3">
        <span className="hidden">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="sr-only">Release success</p>
              <h2 className="text-[14px] font-semibold leading-tight text-foreground">{artifact.state === "assessed" && blockers.length ? `Your release plan needs ${blockers.length} ${blockers.length === 1 ? "thing" : "things"} before launch` : status.label}</h2>
            </div>
            <span className="sr-only">
              {artifact.state.replace("_", " ")}
            </span>
          </div>

          <div className="hidden">
            <div className="flex min-w-0 items-center gap-2.5">
              <Music2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Attached song</p>
                <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenSong(artifact.musicItemId)}
              aria-label={`Open song ${title}`}
              className="shrink-0 rounded-lg border border-foreground/10 bg-background px-3 py-2 text-[11px] font-bold text-foreground transition-colors hover:bg-foreground/[0.04] focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
            >
              Open
            </button>
          </div>

          <div role="status" aria-live="polite" className={status.tone === "success" ? "mt-3 flex items-center gap-2 text-[13px] font-semibold text-emerald-700" : status.tone === "error" ? "mt-3 flex items-center gap-2 text-[13px] font-semibold text-red-700" : isApplying ? "mt-3 flex items-center gap-2 text-[13px] font-semibold text-foreground" : "sr-only"}>
            {status.tone === "success" ? <Check className="h-4 w-4" aria-hidden="true" /> : status.tone === "progress" && isApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : status.tone === "error" ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <Route className="h-4 w-4" aria-hidden="true" />}
            {status.label}
          </div>

          {assessment?.recommendation.reason ? (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{assessment.recommendation.reason}</p>
          ) : null}

          {assessment && showAll ? (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Count label={`Foundation · ${assessment.foundation.blockedCount} blocker`} tone={assessment.foundation.blockedCount ? "warning" : "normal"} />
              <Count label={`Campaign · ${assessment.campaign.atRiskCount} at risk`} tone={assessment.campaign.atRiskCount ? "warning" : "normal"} />
              <Count label={`Unknown · ${assessment.unknownCount}`} tone={assessment.unknownCount ? "muted" : "normal"} />
            </div>
          ) : null}

          {!showAll && blockers.length && !canApprove ? (
            <button
              type="button"
              onClick={() => { setShowAll(true); onReviewAll(artifact); }}
              aria-expanded={false}
              className="mt-2 inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-foreground/75 hover:bg-foreground/[0.05]"
            >
              View all {blockers.length} items
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}

          {showAll && visibleBlockers.length ? (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Top blockers</p>
                {blockers.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showAll;
                      setShowAll(next);
                      if (next) onReviewAll(artifact);
                    }}
                    aria-expanded={showAll}
                    aria-label="Hide release details"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-accent hover:underline focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                  >
                    Hide details
                    <ChevronDown className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <div className="mt-2 space-y-2">
                {visibleBlockers.map((gate) => <GateRow key={gate.key} gate={gate} />)}
              </div>
            </div>
          ) : null}

          {request?.preview ? <ImpactPreview request={request} /> : null}

          {artifact.state === "failed" && artifact.error ? (
            <div className="mt-4 rounded-[12px] border border-red-600/15 bg-red-50/70 p-3 text-[12px] leading-relaxed text-red-800">
              <p>{artifact.error.message}</p>
              {artifact.error.reference ? <p className="mt-1 font-mono text-[10px]">Reference: {artifact.error.reference}</p> : null}
            </div>
          ) : null}

          {artifact.state === "applied" && artifact.receipt ? <AppliedReceipt artifact={artifact} /> : null}

          {artifact.error && artifact.state === "applied" ? (
            <div className="mt-3 rounded-[12px] border border-amber-600/15 bg-amber-50/70 p-3 text-[12px] leading-relaxed text-amber-900">
              {artifact.error.message}
              {artifact.error.reference ? <span className="mt-1 block font-mono text-[10px]">Reference: {artifact.error.reference}</span> : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canApprove ? (
              <ProductButton onClick={() => void handleApprove()} disabled={isApplying}>
                {isApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Approve release date change
              </ProductButton>
            ) : null}
            {canApprove && request?.fromDate ? (
              <ProductButton variant="secondary" onClick={() => onKeepDate(artifact)}>
                Keep {formatShortDateLabel(request.fromDate)} and show recovery plan
              </ProductButton>
            ) : null}
            {artifact.state === "failed" && artifact.error?.retryable ? (
              <ProductButton variant="secondary" onClick={() => void onRetry(artifact)}>
                Retry release-success review
              </ProductButton>
            ) : null}
            {artifact.missionId ? (
              <button
                type="button"
                onClick={() => onOpenMission(artifact.missionId!)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2.5 font-ui text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              >
                Open mission
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Count({ label, tone }: { label: string; tone: "normal" | "warning" | "muted" }) {
  return <div className={`rounded-[11px] border px-3 py-2 text-[11px] font-semibold ${tone === "warning" ? "border-amber-600/20 bg-amber-50/60 text-amber-900" : tone === "muted" ? "border-foreground/8 bg-foreground/[0.025] text-muted-foreground" : "border-foreground/8 text-foreground"}`}>{label}</div>;
}

function GateRow({ gate }: { gate: ReleaseGateResult }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[11px] border border-foreground/8 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground">{gate.label}</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{gate.nextAction}</p>
      </div>
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{gate.state.replace("_", " ")}</span>
    </div>
  );
}

function ImpactPreview({ request }: { request: ReleaseDateChangeRequestViewModel }) {
  return (
    <section className="mt-5 rounded-[13px] border border-brand-accent/15 bg-brand-ghost/[0.45] p-3">
      <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Impact preview</p>
      <p className="mt-2 text-[13px] font-semibold text-foreground">
        {formatDateLabel(request.fromDate)} → {formatDateLabel(request.proposedDate)}
      </p>
      {request.preview.changes.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Moved deadlines</p>
          <div className="mt-1.5 space-y-1.5">
            {request.preview.changes.map((change) => <p key={change.taskId} className="text-[11px] text-foreground"><span className="font-semibold">{change.title}</span>: {formatDateLabel(change.from)} → {formatDateLabel(change.to)}</p>)}
          </div>
        </div>
      ) : null}
      {request.preview.preserved.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Preserved deadlines</p>
          <div className="mt-1.5 space-y-1.5">
            {request.preview.preserved.map((item) => <p key={item.taskId} className="text-[11px] text-foreground"><span className="font-semibold">{item.title}</span>: {formatDateLabel(item.deadline)} · {item.reason}</p>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AppliedReceipt({ artifact }: { artifact: ArtifactWithRequest }) {
  const receipt = artifact.receipt!;
  return (
    <div className="mt-4 rounded-[12px] border border-emerald-600/15 bg-emerald-50/60 p-3 text-[12px] leading-relaxed text-emerald-900">
      <p>Operational date: <strong>{receipt.approvedDate}</strong> ({formatDateLabel(receipt.approvedDate)})</p>
      <p className="mt-1">Revision {receipt.previousRevision} → {receipt.revision} · {receipt.moved.length} bound deadline moved · {receipt.preserved.length} preserved</p>
      {receipt.operatingEventId ? <p className="mt-1 font-mono text-[10px]">Operating event: {receipt.operatingEventId}</p> : null}
    </div>
  );
}

function requestFromArtifact(artifact: ReleaseSuccessArtifactViewModel): ReleaseDateChangeRequestViewModel | null {
  if (!artifact.preview || !artifact.requestId || !artifact.previewHash || !artifact.idempotencyKey) return null;
  return {
    requestId: artifact.requestId,
    idempotencyKey: artifact.idempotencyKey,
    releasePlanId: "",
    musicItemId: artifact.musicItemId,
    missionId: artifact.missionId,
    fromDate: artifact.preview.fromDate ?? undefined,
    proposedDate: artifact.preview.proposedDate,
    status: "pending",
    expectedPlanRevision: artifact.preview.expectedRevision,
    previewHash: artifact.previewHash,
    preview: artifact.preview,
    expiresAt: "",
  };
}

function formatDateLabel(value?: string | null) {
  if (!value) return "No date";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatShortDateLabel(value?: string | null) {
  if (!value) return "the current date";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
