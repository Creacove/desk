import { CreditCard, Loader2, LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductButton } from "../../design-system/components";
import type {
  ProductionBillingCheckoutPreview,
  ProductionBillingService,
  ProductionUser,
  ProductionWorkspace,
} from "../../types/productionApp";
import { createActiveRunFallback } from "../../services/activeRunFallback";
import { SubscriptionPlanDialog } from "./SubscriptionPlanDialog";
import { openWorkspaceSubscriptionCheckout } from "./workspaceCheckout";

export function SubscriptionRecoveryGate({
  user,
  workspace,
  billingService,
  onRecovered,
  onSignOut,
}: {
  user: ProductionUser;
  workspace: ProductionWorkspace;
  billingService: ProductionBillingService;
  onRecovered: (workspace: ProductionWorkspace) => void;
  onSignOut: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stopConfirmationRef = useRef<(() => void) | null>(null);
  const betaEnded = workspace.accessType === "private_beta";

  useEffect(() => () => stopConfirmationRef.current?.(), []);

  async function restoreAccess() {
    try {
      setPending(true);
      setError(null);
      const preview = await openWorkspaceSubscriptionCheckout({ user, workspace, billingService });
      beginConfirmation(preview);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Payment could not be opened. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function beginConfirmation(preview: ProductionBillingCheckoutPreview) {
    if (preview.provider !== "paddle") return;
    setPlanDialogOpen(false);
    setConfirming(true);
    setError(null);
    stopConfirmationRef.current?.();
    stopConfirmationRef.current = watchConfirmation(
      preview,
      billingService,
      onRecovered,
      setError,
      () => setConfirming(false),
    );
  }

  const title = betaEnded ? "Your beta access has ended" : "Subscription expired";
  const body = betaEnded
    ? `Your ${workspace.artistName} workspace and everything in it are still saved. Choose a plan to continue.`
    : `Restore your subscription to continue using ${workspace.artistName}'s Desk. Everything is saved exactly where you left it.`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <LockedWorkspaceBackdrop workspace={workspace} />
      <div className="fixed inset-0 z-40 bg-background/55 backdrop-blur-[6px]" aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-foreground/10 bg-background p-7 shadow-2xl sm:p-9"
      >
        <div className="mb-6 flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
          {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
        </div>
        <h1 className="font-display text-[28px] font-semibold tracking-[-0.035em]">{confirming ? "Confirming payment…" : title}</h1>
        <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
          {confirming ? "We’ll reopen your workspace as soon as your payment is confirmed." : body}
        </p>
        {error ? <p role="alert" className="mt-4 text-[13px] font-medium text-destructive">{error}</p> : null}
        <div className="mt-7 grid gap-3">
          <ProductButton onClick={() => betaEnded ? setPlanDialogOpen(true) : void restoreAccess()} disabled={pending || confirming}>
            {pending ? "Opening payment…" : betaEnded ? "Choose a plan" : "Restore access"}
          </ProductButton>
          <button type="button" onClick={onSignOut} className="inline-flex items-center justify-center gap-2 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </section>
      <SubscriptionPlanDialog
        open={planDialogOpen}
        onClose={() => setPlanDialogOpen(false)}
        user={user}
        workspace={workspace}
        billingService={billingService}
        onCheckoutOpened={beginConfirmation}
      />
    </main>
  );
}

function LockedWorkspaceBackdrop({ workspace }: { workspace: ProductionWorkspace }) {
  return (
    <div data-testid="locked-workspace-backdrop" aria-hidden="true" className="pointer-events-none min-h-screen select-none opacity-70">
      <aside className="fixed inset-y-0 left-0 hidden w-56 border-r border-foreground/8 bg-background p-6 md:block">
        <p className="font-display text-xl font-semibold">Desk</p>
        <div className="mt-12 grid gap-5 text-sm text-muted-foreground"><span>Today</span><span>Manager</span><span>Music</span><span>Missions</span></div>
      </aside>
      <div className="px-6 py-8 md:ml-56 md:px-12">
        <div className="flex items-center gap-4 border-b border-foreground/8 pb-7">
          {workspace.spotifyImageUrl ? <img src={workspace.spotifyImageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <div className="h-12 w-12 rounded-xl bg-foreground/10" />}
          <div><p className="font-display text-2xl font-semibold">{workspace.artistName}</p><p className="text-xs text-muted-foreground">Artist workspace</p></div>
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="h-48 rounded-2xl border border-foreground/8 bg-foreground/[0.025] lg:col-span-2" />
          <div className="h-48 rounded-2xl border border-foreground/8 bg-foreground/[0.025]" />
          <div className="h-40 rounded-2xl border border-foreground/8 bg-foreground/[0.025] lg:col-span-3" />
        </div>
      </div>
    </div>
  );
}

function watchConfirmation(
  preview: ProductionBillingCheckoutPreview,
  billingService: ProductionBillingService,
  onRecovered: (workspace: ProductionWorkspace) => void,
  setError: (message: string | null) => void,
  onFinished: () => void,
) {
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    onFinished();
  };
  const check = async (): Promise<"active" | "terminal"> => {
    if (settled) return "terminal";
    try {
      const status = await billingService.loadBillingStatus({ checkoutSessionId: preview.checkoutSessionId });
      if (status.entitlementActive && status.workspace) {
        settle();
        onRecovered(status.workspace);
        return "terminal";
      }
      if (["failed", "expired", "abandoned"].includes(status.checkoutStatus)) {
        setError("Payment didn’t go through. Try again to restore access.");
        settle();
        return "terminal";
      }
    } catch {
      // Webhook confirmation can lag; keep the overlay locked and retry.
    }
    return settled ? "terminal" : "active";
  };
  const fallback = createActiveRunFallback({
    delaysMs: [500, 1_000, 2_000, 3_000, 5_000, 10_000, 30_000],
    deadlineMs: 5 * 60_000,
    isVisible: () => document.visibilityState !== "hidden",
    isOnline: () => navigator.onLine !== false,
    check,
    onTerminal: () => undefined,
    onError: () => undefined,
    onDeadline: () => {
      setError("Confirmation is taking longer than expected. You can safely try again.");
      settle();
    },
  });
  const resume = () => fallback.resume();
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", resume);
  fallback.start();
  fallback.resume();
  const unsubscribe = billingService.subscribeBillingStatus?.(
    { checkoutSessionId: preview.checkoutSessionId },
    resume,
  );
  return () => {
    settled = true;
    fallback.stop();
    unsubscribe?.();
    document.removeEventListener("visibilitychange", resume);
    window.removeEventListener("online", resume);
  };
}
