import { Check, MessageSquareText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
        <div className="rounded-[22px] border border-foreground/10 bg-background p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] sm:p-7">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Ordersounds · Song rights</p>
          <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-foreground">Review your shares</h1>

          {error ? <p role="alert" className="mt-4 rounded-[14px] border border-danger/20 bg-danger/10 px-3 py-2.5 text-[13px] font-semibold leading-relaxed text-danger">{error}</p> : null}
          {!confirmation && !error ? <p className="mt-4 text-[13px] font-semibold text-muted-foreground">Loading your split proposal…</p> : null}

          {confirmation && !done ? (
            <div className="mt-5 grid gap-5">
              <div>
                <p className="font-display text-[22px] font-bold text-foreground">{confirmation.songTitle}</p>
                <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted-foreground">For {confirmation.contributorName} · {confirmation.contributorRole}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SplitShare label="Your publishing share" value={confirmation.publishingShare} detail="Publishing covers the song’s composition and songwriting ownership." />
                <SplitShare label="Your master share" value={confirmation.masterShare} detail="Master covers ownership of this specific recording." />
              </div>

              <div className="rounded-[18px] border border-foreground/8 bg-foreground/[0.015] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Complete allocation</p>
                <div className="mt-3 grid gap-1">
                  {confirmation.contributors.map((contributor) => (
                    <div key={`${contributor.name}-${contributor.role}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-foreground/5 py-2.5 text-[12px] last:border-b-0">
                      <span className={cn("min-w-0", contributor.name === confirmation.contributorName ? "text-brand-accent" : "text-foreground/90")}>
                        <strong className="block truncate">{contributor.name}{contributor.name === confirmation.contributorName ? " (You)" : ""}</strong>
                        <span className="block truncate text-[10px] font-semibold text-muted-foreground">{contributor.role}</span>
                      </span>
                      <span className="font-bold text-foreground">{contributor.publishingShare} pub.</span>
                      <span className="font-bold text-foreground">{contributor.masterShare} master</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-foreground/8 pt-3 text-[11px] font-bold text-muted-foreground">
                  <span>Publishing total: {totals.publishing}%</span>
                  <span>Master total: {totals.master}%</span>
                </div>
              </div>

              {!correctionOpen ? (
                <>
                  <label className="flex cursor-pointer select-none items-start gap-2.5 py-1">
                    <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border border-foreground/20 bg-background text-brand-accent" />
                    <span className="text-[12px] font-semibold leading-relaxed text-muted-foreground">I confirm these split details are correct for my contribution.</span>
                  </label>
                  <div className="grid gap-2 border-t border-foreground/8 pt-4 sm:grid-cols-2">
                    <button type="button" disabled={!agreed || pending} onClick={() => void submitConfirmation()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-foreground px-4 py-3 text-[12px] font-bold text-background disabled:opacity-40"><span>{pending ? "Saving…" : "Confirm my shares"}</span><Check className="h-4 w-4" /></button>
                    <button type="button" disabled={pending} onClick={() => setCorrectionOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-foreground/10 px-4 py-3 text-[12px] font-bold text-muted-foreground hover:text-foreground"><span>Request a correction</span><MessageSquareText className="h-4 w-4" /></button>
                  </div>
                </>
              ) : (
                <div className="rounded-[16px] border border-warning/18 bg-warning/[0.035] p-4">
                  <label htmlFor="split-correction-reason" className="text-[12px] font-bold text-foreground">What needs to change?</label>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">Be specific so the artist team can correct the proposal and send a new link.</p>
                  <textarea id="split-correction-reason" rows={4} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-3 w-full resize-none rounded-[12px] border border-foreground/12 bg-background px-3 py-2.5 text-[13px] font-semibold text-foreground outline-none focus:border-foreground" />
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" disabled={pending} onClick={() => { setCorrectionOpen(false); setCorrectionReason(""); }} className="min-h-10 rounded-[10px] border border-foreground/10 px-4 text-[12px] font-semibold text-muted-foreground">Back</button>
                    <button type="button" disabled={!correctionReason.trim() || pending} onClick={() => void submitCorrection()} className="min-h-10 rounded-[10px] bg-foreground px-4 text-[12px] font-bold text-background disabled:opacity-40">{pending ? "Sending…" : "Send correction request"}</button>
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
              <h2 className="mt-4 font-display text-[24px] font-bold text-foreground">{done === "confirmed" ? "Split details confirmed" : "Correction requested"}</h2>
              <p className="mt-2 max-w-sm text-[14px] font-semibold leading-relaxed text-muted-foreground">
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

function SplitShare({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-brand-accent/15 bg-brand-accent/[0.03] p-4">
      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">{label}</span>
      <span className="mt-1 block font-display text-[30px] font-bold text-foreground">{value}</span>
      <span className="mt-2 block text-[11px] font-semibold leading-relaxed text-muted-foreground">{detail}</span>
    </div>
  );
}

function sumShares(values: string[]) {
  return Number(values.reduce((sum, value) => sum + (Number.parseFloat(value.replace("%", "")) || 0), 0).toFixed(2));
}
