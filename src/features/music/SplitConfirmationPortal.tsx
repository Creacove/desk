import { Check, MessageSquareText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, SkeletonBlock } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import type { MusicRepository, SplitConfirmationViewModel } from "../../types/cleanProduction";

export function SplitConfirmationPortal({
  token,
  musicRepository,
}: {
  token: string;
  musicRepository: Pick<MusicRepository, "loadSplitConfirmation" | "submitSplitConfirmation">;
}) {
  const [confirmation, setConfirmation] = useState<SplitConfirmationViewModel | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionReason, setCorrectionReason] = useState("");
  const [done, setDone] = useState<"confirmed" | "correction_requested" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const totals = useMemo(() => ({
    publishing: sumShares(confirmation?.contributors.map((item) => item.publishingShare) ?? []),
    master: sumShares(confirmation?.contributors.map((item) => item.masterShare) ?? []),
  }), [confirmation]);

  useEffect(() => {
    let active = true;
    setError(null);
    musicRepository
      .loadSplitConfirmation(token)
      .then((nextConfirmation) => {
        if (!active) return;
        setConfirmation(nextConfirmation);
        if (nextConfirmation.status === "confirmed") setDone("confirmed");
        if (nextConfirmation.status === "rejected") setDone("correction_requested");
      })
      .catch(() => {
        if (active) setError("This split request is no longer available. Ask the artist team for a new link.");
      });
    return () => {
      active = false;
    };
  }, [musicRepository, token]);

  async function submitConfirmation() {
    if (!agreed) return;
    setPending(true);
    setError(null);
    try {
      await musicRepository.submitSplitConfirmation(token, {
        decision: "confirmed",
        confirmationText: "I confirm these split details are correct for my contribution.",
      });
      setDone("confirmed");
    } catch {
      setError("Your response could not be saved. Please try again, or ask the artist team for a new link.");
    } finally {
      setPending(false);
    }
  }

  async function submitCorrection() {
    const reason = correctionReason.trim();
    if (!reason) return;
    setPending(true);
    setError(null);
    try {
      await musicRepository.submitSplitConfirmation(token, {
        decision: "correction_requested",
        correctionReason: reason,
      });
      setDone("correction_requested");
    } catch {
      setError("Your correction request could not be sent. Please try again, or ask the artist team for a new link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-theme min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <section className="mx-auto grid w-[min(100%,44rem)] gap-4">
        <div className="rounded-[20px] border border-foreground/10 bg-background p-5 shadow-[0_24px_70px_hsl(var(--foreground)/0.10)] sm:p-7">
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-accent">Ordersounds · Song rights</p>
          <h1 className="mt-2 font-display text-[26px] font-semibold tracking-[-0.025em] text-foreground">Review your shares</h1>

          {error ? <p role="alert" className="mt-4 rounded-[12px] border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-[13px] font-medium leading-[1.55] text-destructive">{error}</p> : null}
          {!confirmation && !error ? <SplitConfirmationSkeleton /> : null}

          {confirmation && !done ? (
            <div className="mt-5 grid gap-5">
              <div>
                <p className="font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">{confirmation.songTitle}</p>
                <p className="mt-1 text-[13px] font-medium leading-[1.55] text-muted-foreground">For {confirmation.contributorName} · {confirmation.contributorRole}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SplitShare label="Your publishing share" value={confirmation.publishingShare} detail="Publishing covers the song’s composition and songwriting ownership." />
                <SplitShare label="Your master share" value={confirmation.masterShare} detail="Master covers ownership of this specific recording." />
              </div>

              <div className="rounded-[16px] border border-foreground/8 bg-foreground/[0.015] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">Complete allocation</p>
                <div className="mt-3 grid gap-1">
                  {confirmation.contributors.map((contributor) => (
                    <div key={`${contributor.name}-${contributor.role}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-foreground/5 py-2.5 text-[12px] last:border-b-0">
                      <span className={cn("min-w-0", contributor.name === confirmation.contributorName ? "text-brand-accent" : "text-foreground/90")}>
                        <strong className="block truncate font-semibold">{contributor.name}{contributor.name === confirmation.contributorName ? " (You)" : ""}</strong>
                        <span className="block truncate text-[11px] font-medium text-muted-foreground">{contributor.role}</span>
                      </span>
                      <span className="font-semibold text-foreground">{contributor.publishingShare} pub.</span>
                      <span className="font-semibold text-foreground">{contributor.masterShare} master</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-foreground/8 pt-3 text-[11px] font-semibold text-muted-foreground">
                  <span>Publishing total: {totals.publishing}%</span>
                  <span>Master total: {totals.master}%</span>
                </div>
              </div>

              {!correctionOpen ? (
                <>
                  <label className="flex cursor-pointer select-none items-start gap-2.5 py-1">
                    <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border border-foreground/20 bg-background text-brand-accent" />
                    <span className="text-[13px] font-medium leading-[1.55] text-muted-foreground">I confirm these split details are correct for my contribution.</span>
                  </label>
                  <div className="grid gap-2 border-t border-foreground/8 pt-4 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="lg"
                      disabled={!agreed}
                      pending={pending}
                      onClick={() => void submitConfirmation()}
                      leadingIcon={<Check className="h-4 w-4" aria-hidden="true" />}
                      className="w-full"
                    >
                      Confirm my shares
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      disabled={pending}
                      onClick={() => setCorrectionOpen(true)}
                      leadingIcon={<MessageSquareText className="h-4 w-4" aria-hidden="true" />}
                      className="w-full"
                    >
                      Request a correction
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-[16px] border border-warning/18 bg-warning/[0.035] p-4">
                  <label htmlFor="split-correction-reason" className="text-[13px] font-semibold text-foreground">What needs to change?</label>
                  <p className="mt-1 text-[12px] font-medium leading-[1.5] text-muted-foreground">Be specific so the artist team can correct the proposal and send a new link.</p>
                  <textarea
                    id="split-correction-reason"
                    rows={4}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    className="mt-3 w-full resize-none rounded-[12px] border border-foreground/12 bg-background px-3 py-2.5 text-[14px] font-medium text-foreground outline-none transition-colors duration-150 focus:border-brand-accent/40 focus:ring-2 focus:ring-brand-accent/8"
                  />
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" disabled={pending} onClick={() => { setCorrectionOpen(false); setCorrectionReason(""); }}>
                      Back
                    </Button>
                    <Button type="button" disabled={!correctionReason.trim()} pending={pending} onClick={() => void submitCorrection()}>
                      Send correction request
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {confirmation && done ? (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-full border", done === "confirmed" ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning")}>
                {done === "confirmed" ? <Check className="h-7 w-7" /> : <MessageSquareText className="h-7 w-7" />}
              </span>
              <h2 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.02em] text-foreground">{done === "confirmed" ? "Split details confirmed" : "Correction requested"}</h2>
              <p className="mt-2 max-w-sm text-[14px] font-medium leading-[1.6] text-muted-foreground">
                {done === "confirmed"
                  ? `${confirmation.songTitle}: you confirmed ${confirmation.publishingShare} publishing and ${confirmation.masterShare} master.`
                  : "The artist team received your note. They will need to send a revised proposal before confirmation continues."}
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function SplitConfirmationSkeleton() {
  return (
    <div className="mt-5 grid gap-5" aria-label="Loading split proposal">
      <div>
        <SkeletonBlock className="h-5 w-[42%]" />
        <SkeletonBlock className="mt-2 h-3 w-[32%]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonBlock className="h-28 rounded-[16px]" />
        <SkeletonBlock className="h-28 rounded-[16px]" />
      </div>
      <SkeletonBlock className="h-40 rounded-[16px]" />
      <SkeletonBlock className="h-11 rounded-[11px]" />
    </div>
  );
}

function SplitShare({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[16px] border border-brand-accent/15 bg-brand-accent/[0.03] p-4">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.09em] text-brand-accent">{label}</span>
      <span className="mt-1 block font-display text-[30px] font-semibold tracking-[-0.025em] text-foreground">{value}</span>
      <span className="mt-2 block text-[12px] font-medium leading-[1.55] text-muted-foreground">{detail}</span>
    </div>
  );
}

function sumShares(values: string[]) {
  return Number(values.reduce((sum, value) => sum + (Number.parseFloat(value.replace("%", "")) || 0), 0).toFixed(2));
}
