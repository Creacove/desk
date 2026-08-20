import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { Component, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import { ProductButton } from "../../design-system/components";
import { reportBrowserServiceError } from "../../lib/errorTelemetry";
import type { ReleaseDateChangeRequestViewModel, ReleaseGateResult, ReleaseSuccessArtifactViewModel } from "../../types/cleanProduction";

type ArtifactWithRequest = ReleaseSuccessArtifactViewModel & { request?: ReleaseDateChangeRequestViewModel };

export type ReleaseSuccessArtifactProps = {
  artifact: ArtifactWithRequest;
  musicItemTitle?: string;
  onApprove(request: ReleaseDateChangeRequestViewModel): Promise<void>;
  onKeepDate(artifact: ReleaseSuccessArtifactViewModel): void;
  onReviewAll(artifact: ReleaseSuccessArtifactViewModel): void;
  onOpenSong(musicItemId: string): void;
  onOpenMission(missionId: string): void;
  onRetry(artifact: ReleaseSuccessArtifactViewModel): Promise<void>;
};

export function ReleaseSuccessArtifact(props: ReleaseSuccessArtifactProps) {
  return (
    <ReleaseSuccessArtifactBoundary artifact={props.artifact}>
      <ReleaseSuccessArtifactContent {...props} />
    </ReleaseSuccessArtifactBoundary>
  );
}

class ReleaseSuccessArtifactBoundary extends Component<{ artifact: ArtifactWithRequest; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, _info: ErrorInfo) {
    reportBrowserServiceError(error, {
      stage: "receipt_render",
      musicItemId: this.props.artifact.musicItemId,
      missionId: this.props.artifact.missionId,
      requestId: this.props.artifact.requestId,
    });
  }
  render() {
    if (this.state.failed) return <section role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12px] font-medium text-danger">Release details could not be displayed. Refresh this conversation and try again.</section>;
    return this.props.children;
  }
}

function ReleaseSuccessArtifactContent({ artifact, musicItemTitle, onApprove, onKeepDate, onReviewAll, onOpenSong, onOpenMission, onRetry }: ReleaseSuccessArtifactProps) {
  const [showAll, setShowAll] = useState(false);
  const [applying, setApplying] = useState(false);
  const request = artifact.request ?? requestFromArtifact(artifact);
  const assessment = artifact.assessment;
  const isApplying = applying || artifact.state === "applying";
  const allGates = [...(assessment?.foundation?.gates ?? []), ...(assessment?.campaign?.gates ?? [])];
  const attention = allGates.filter((gate) => gate.state === "blocked" || gate.state === "at_risk" || gate.state === "unknown");
  const actionable = attention.filter((gate) => !isPrematureIdentifierGate(gate));
  const visible = showAll ? actionable : actionable.slice(0, 2);
  const canApprove = Boolean(request && (artifact.state === "proposed" || artifact.state === "awaiting_approval"));

  const status = useMemo(() => {
    if (artifact.state === "applied" && artifact.receipt) return "Release date updated";
    if (artifact.state === "failed") return "Release review needs attention";
    if (isApplying) return "Applying release date change";
    if (canApprove) return "Release date impact preview ready";
    if (artifact.state === "assessed") return "Release success review ready";
    return "Release materials checked";
  }, [artifact.receipt, artifact.state, canApprove, isApplying]);

  const heading = useMemo(() => {
    if (artifact.state === "applied" && artifact.receipt) return "Release date updated";
    if (artifact.state === "failed") return "Release review needs attention";
    if (isApplying) return "Applying release date change";
    if (canApprove) return "Release date change ready for approval";
    if (!actionable.length) return "Release setup looks current";
    return `${actionable.length} ${actionable.length === 1 ? "thing needs" : "things need"} your attention`;
  }, [actionable.length, artifact.receipt, artifact.state, canApprove, isApplying]);

  async function handleApprove() {
    if (!request || isApplying) return;
    setApplying(true);
    try { await onApprove(request); } finally { setApplying(false); }
  }

  return (
    <section data-testid="release-success-artifact" className="mt-5 border-t border-foreground/8 pt-5">
      {musicItemTitle ? <p className="text-[11px] font-semibold text-muted-foreground">{musicItemTitle}</p> : null}
      <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{heading}</h2>
      <div role="status" aria-live="polite" className={isApplying ? "mt-2 text-[12px] font-medium text-muted-foreground" : "sr-only"}>{status}</div>
      {assessment?.recommendation?.reason ? <p className="mt-2 max-w-[42rem] text-[12px] font-medium leading-relaxed text-muted-foreground">{assessment.recommendation.reason}</p> : null}

      {visible.length ? (
        <div className="mt-4 divide-y divide-foreground/8 border-y border-foreground/8">
          {visible.map((gate) => <GateRow key={gate.key} gate={gate} />)}
        </div>
      ) : null}

      {actionable.length > 2 ? (
        <button
          type="button"
          onClick={() => { const next = !showAll; setShowAll(next); if (next) onReviewAll(artifact); }}
          aria-expanded={showAll}
          className="mt-3 inline-flex min-h-8 items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
        >
          {showAll ? "Show less" : `View all ${actionable.length} checks`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      ) : null}

      {request?.preview ? <ImpactPreview request={request} /> : null}

      {artifact.state === "applied" && artifact.receipt ? (
        <AppliedReceipt artifact={artifact} />
      ) : null}

      {artifact.state === "failed" && artifact.error ? (
        <div role="alert" className="mt-4 border-l-2 border-danger pl-3 text-[12px] font-medium leading-relaxed text-danger">
          <p>{artifact.error.message}</p>
          {artifact.error.reference ? <p className="mt-1 font-mono text-[10px]">Reference: {artifact.error.reference}</p> : null}
        </div>
      ) : null}

      {artifact.error && artifact.state === "applied" ? (
        <div role="alert" className="mt-4 border-l-2 border-amber-600/35 pl-3 text-[12px] font-medium leading-relaxed text-amber-900">
          <p>{artifact.error.message}</p>
          {artifact.error.reference ? <p className="mt-1 font-mono text-[10px]">Reference: {artifact.error.reference}</p> : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canApprove ? (
          <ProductButton ariaLabel="Approve release date change" onClick={() => void handleApprove()} disabled={isApplying}>
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Approve date change
          </ProductButton>
        ) : null}
        {canApprove && request?.fromDate ? <ProductButton variant="secondary" onClick={() => onKeepDate(artifact)}>Keep {formatShortDateLabel(request.fromDate)}</ProductButton> : null}
        {artifact.state === "failed" && artifact.error?.retryable ? <ProductButton variant="secondary" onClick={() => void onRetry(artifact)}><RefreshCw className="h-4 w-4" /> Try again</ProductButton> : null}
        <button type="button" onClick={() => onOpenSong(artifact.musicItemId)} className="min-h-9 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Open song</button>
        {artifact.missionId ? <button type="button" onClick={() => onOpenMission(artifact.missionId!)} className="min-h-9 px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">Open mission</button> : null}
      </div>
    </section>
  );
}

function GateRow({ gate }: { gate: ReleaseGateResult }) {
  const problem = gate.state === "at_risk" ? "Potential issue" : gate.state === "blocked" ? "Needs attention" : "Needs confirmation";
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground">{gate.label}</p>
        <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-muted-foreground">{gate.nextAction}</p>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground sm:pt-0.5">{problem}</span>
    </div>
  );
}

function isPrematureIdentifierGate(gate: ReleaseGateResult) {
  const key = `${gate.key} ${gate.label}`.toLowerCase();
  const copy = `${gate.nextAction ?? ""}`.toLowerCase();
  return /\bisrc\b/.test(key) && /(not assigned|distributor|assign)/.test(copy) && gate.state !== "blocked";
}

function ImpactPreview({ request }: { request: ReleaseDateChangeRequestViewModel }) {
  return (
    <section className="mt-5 border-l-2 border-brand-accent/25 pl-4">
      <p className="text-[11px] font-semibold text-foreground">Move release to {formatDateLabel(request.proposedDate)}?</p>
      {request.preview.changes.length ? (
        <div className="mt-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Moved deadlines</p>
          <div className="mt-1 space-y-1">
            {request.preview.changes.map((change) => <p key={change.taskId} className="text-[11px] font-medium leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{change.title}</span>: {formatDateLabel(change.from)} → {formatDateLabel(change.to)}</p>)}
          </div>
        </div>
      ) : <p className="mt-1 text-[11px] font-medium leading-relaxed text-muted-foreground">No bound deadlines need to move.</p>}
      {request.preview.preserved.length ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Preserved deadlines</p>
          <div className="mt-1 space-y-1">
            {request.preview.preserved.map((item) => <p key={item.taskId} className="text-[11px] font-medium leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">{item.title}</span>: {formatDateLabel(item.deadline)} · {item.reason}</p>)}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AppliedReceipt({ artifact }: { artifact: ArtifactWithRequest }) {
  const receipt = artifact.receipt!;
  return (
    <div className="mt-4 flex items-start gap-2 text-[12px] font-medium leading-relaxed text-emerald-700">
      <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p>Operational date: <strong>{receipt.approvedDate}</strong> ({formatDateLabel(receipt.approvedDate)})</p>
        <p className="mt-1">Revision {receipt.previousRevision} → {receipt.revision} · {receipt.moved.length} bound deadline moved · {receipt.preserved.length} preserved</p>
        {receipt.operatingEventId ? <p className="mt-1 font-mono text-[10px]">Operating event: {receipt.operatingEventId}</p> : null}
      </div>
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
