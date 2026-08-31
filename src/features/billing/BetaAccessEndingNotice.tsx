import { useEffect, useState } from "react";
import { Button } from "../../design-system/desktopPrimitives";
import type { ProductionWorkspace } from "../../types/productionApp";

const NOTICE_WINDOW_MS = 7 * 24 * 60 * 60 * 1_000;

export function BetaAccessEndingNotice({
  workspace,
  onChoosePlan,
}: {
  workspace: ProductionWorkspace;
  onChoosePlan: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!workspace.accessEndsAt) return;
    const end = Date.parse(workspace.accessEndsAt);
    if (!Number.isFinite(end)) return;
    const noticeStarts = end - NOTICE_WINDOW_MS;
    const nextBoundary = now < noticeStarts ? noticeStarts : end;
    const delay = nextBoundary - now;
    if (delay <= 0 || delay > 2_147_000_000) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), delay + 100);
    return () => window.clearTimeout(timeout);
  }, [now, workspace.accessEndsAt]);
  if (!shouldShowBetaAccessEndingNotice(workspace, now)) return null;

  const endDate = new Date(workspace.accessEndsAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <aside className="fixed left-1/2 top-3 z-50 flex w-[min(calc(100vw-1.5rem),38rem)] -translate-x-1/2 items-center justify-between gap-4 rounded-xl border border-foreground/10 bg-background/95 px-4 py-3 shadow-lg backdrop-blur-xl" aria-label="Beta access ending">
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground">Beta access ends {endDate}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Choose a plan to keep your Desk open.</p>
      </div>
      <Button size="sm" className="shrink-0" onClick={onChoosePlan}>
        Choose a plan
      </Button>
    </aside>
  );
}

export function shouldShowBetaAccessEndingNotice(workspace: ProductionWorkspace, now = Date.now()) {
  if (workspace.accessType !== "private_beta" || workspace.accessStatus !== "active" || !workspace.entitlementActive || !workspace.accessEndsAt) return false;
  const remaining = Date.parse(workspace.accessEndsAt) - now;
  return remaining > 0 && remaining <= NOTICE_WINDOW_MS;
}
