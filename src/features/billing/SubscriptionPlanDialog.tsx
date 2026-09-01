import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import type { ProductionBillingCheckoutPreview, ProductionBillingProviderPreference, ProductionBillingService, ProductionUser, ProductionWorkspace } from "../../types/productionApp";
import { prepareWorkspaceSubscriptionCheckout } from "./workspaceCheckout";

export function SubscriptionPlanDialog({ open, onClose, user, workspace, billingService }: {
  open: boolean;
  onClose: () => void;
  user: ProductionUser;
  workspace: ProductionWorkspace;
  billingService: ProductionBillingService;
}) {
  const initialInterval = workspace.billingInterval ?? "monthly";
  const [interval, setInterval] = useState<"monthly" | "yearly">(initialInterval);
  const [preview, setPreview] = useState<ProductionBillingCheckoutPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  async function loadPreview(nextInterval: "monthly" | "yearly", providerPreference: ProductionBillingProviderPreference) {
    const request = ++requestRef.current;
    try {
      setLoading(true);
      setError(null);
      const next = await prepareWorkspaceSubscriptionCheckout({ user, workspace, billingService, interval: nextInterval, providerPreference });
      if (request !== requestRef.current) return;
      setInterval(nextInterval);
      setPreview(next);
    } catch (cause) {
      if (request === requestRef.current) setError(cause instanceof Error ? cause.message : "Pricing could not be loaded.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setInterval(initialInterval);
    setOpening(false);
    void loadPreview(initialInterval, workspace.billingProvider ?? "auto");
    return () => { requestRef.current += 1; };
    // The dialog intentionally resets only when it opens for a workspace.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspace.artistWorkspaceId]);

  if (!open) return null;
  const price = preview ? formatCheckoutPrice(preview) : "Loading price…";
  const payLabel = `Pay ${price}`;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md" role="presentation">
      <section role="dialog" aria-modal="true" aria-label="Choose a plan" className="relative w-full max-w-[28rem] rounded-[24px] border border-foreground/10 bg-background p-6 shadow-2xl sm:p-8">
        <button type="button" aria-label="Close plan selection" onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-foreground/5 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Keep your Desk open</p>
        <h1 className="mt-3 font-display text-[30px] font-semibold tracking-[-0.035em] text-foreground">Choose a plan</h1>
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">Your workspace and everything in it stay exactly where they are.</p>

        <div className="mt-6 grid grid-cols-2 rounded-[10px] bg-foreground/[0.045] p-1" aria-label="Billing interval">
          {(["monthly", "yearly"] as const).map((option) => (
            <button key={option} type="button" aria-pressed={interval === option} disabled={loading || opening} onClick={() => void loadPreview(option, workspace.billingProvider ?? "auto")} className={cn("min-h-10 rounded-[8px] text-[11px] font-semibold transition-colors", interval === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {option === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>

        <div className="mt-6 flex items-end justify-between gap-4 border-b border-foreground/10 pb-5">
          <p className="text-[28px] font-semibold tracking-[-0.035em] text-foreground">{price}</p>
          <p className="pb-1 text-[11px] font-medium text-muted-foreground">per {interval === "yearly" ? "year" : "month"}</p>
        </div>
        {error ? <p role="alert" className="mt-4 text-[12px] font-medium text-destructive">{error}</p> : null}

        <Button
          size="lg"
          className="mt-5 w-full"
          pending={opening}
          disabled={!preview || loading}
          onClick={async () => {
            if (!preview || !billingService.openProviderCheckout) return;
            try {
              setOpening(true);
              setError(null);
              await billingService.openProviderCheckout({ user, preview });
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Payment could not be opened.");
            } finally {
              setOpening(false);
            }
          }}
        >
          {loading ? "Loading price…" : payLabel}
        </Button>

        <p className="mt-5 text-center text-[10px] font-medium text-muted-foreground">Secure recurring payment. Cancel from Billing.</p>
      </section>
    </div>
  );
}

function formatCheckoutPrice(preview: ProductionBillingCheckoutPreview) {
  if (preview.formattedTotal) return preview.formattedTotal;
  if (typeof preview.amount === "number" && preview.currency) {
    return new Intl.NumberFormat(preview.currency === "NGN" ? "en-NG" : "en-US", {
      style: "currency", currency: preview.currency, maximumFractionDigits: 0,
    }).format(preview.amount);
  }
  return "Price unavailable";
}
