import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [done, setDone] = useState<"confirmed" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    musicRepository
      .loadSplitConfirmation(token)
      .then((nextConfirmation) => {
        if (active) setConfirmation(nextConfirmation);
      })
      .catch((loadError) => {
        if (active) setError(readErrorMessage(loadError, "Split confirmation link could not be loaded."));
      });
    return () => {
      active = false;
    };
  }, [musicRepository, token]);

  async function submit(decision: "confirmed" | "rejected") {
    if (decision === "confirmed" && !agreed) return;
    setPending(true);
    setError(null);
    try {
      await musicRepository.submitSplitConfirmation(token, {
        decision,
        confirmationText: decision === "confirmed" ? "I confirm these split details are correct for my contribution." : "I reject these split details.",
      });
      setDone(decision);
    } catch (submitError) {
      setError(readErrorMessage(submitError, "Split confirmation could not be submitted."));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-light min-h-screen bg-background px-4 py-6 text-foreground sm:py-10">
      <section className="mx-auto grid w-[min(100%,44rem)] gap-4">
        <div className="rounded-[22px] border border-foreground/10 bg-background p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] sm:p-6">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Ordersounds split confirmation</p>
          <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight text-foreground">Confirm split details</h1>

          {error ? <p role="alert" className="mt-4 rounded-[14px] border border-danger/20 bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger">{error}</p> : null}
          {!confirmation && !error ? <p className="mt-4 text-[13px] font-semibold text-muted-foreground">Loading split details...</p> : null}

          {confirmation && !done ? (
            <div className="mt-5 grid gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Song</p>
                <p className="mt-1 font-display text-[22px] font-bold text-foreground">{confirmation.songTitle}</p>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-muted-foreground">
                  Hi <span className="font-bold text-foreground">{confirmation.contributorName}</span>, review your proposed role and shares. Confirm only if these details are correct.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-[18px] border border-brand-accent/15 bg-brand-accent/[0.03] p-4">
                <SplitShare label="Publishing share" value={confirmation.publishingShare} detail={`${confirmation.publishingShare} publishing`} />
                <SplitShare label="Master share" value={confirmation.masterShare} detail={`${confirmation.masterShare} master`} />
              </div>

              <div className="rounded-[18px] border border-foreground/8 bg-foreground/[0.015] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Full split proposal</p>
                <div className="mt-3 grid gap-2">
                  {confirmation.contributors.map((contributor) => (
                    <div key={`${contributor.name}-${contributor.role}`} className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/5 py-2 text-[12px] last:border-b-0">
                      <span className={cn("font-bold", contributor.name === confirmation.contributorName ? "text-brand-accent" : "text-foreground/90")}>
                        {contributor.name}{contributor.name === confirmation.contributorName ? " (You)" : ""}
                      </span>
                      <span className="font-semibold text-muted-foreground">
                        Pub: <span className="font-bold text-foreground">{contributor.publishingShare}</span> | Master: <span className="font-bold text-foreground">{contributor.masterShare}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <label className="flex cursor-pointer select-none items-start gap-2.5 py-1">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border border-foreground/20 bg-background text-brand-accent"
                />
                <span className="text-[12px] font-semibold leading-relaxed text-muted-foreground">
                  I confirm these split details are correct for my contribution.
                </span>
              </label>

              <div className="grid gap-2 border-t border-foreground/8 pt-4 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={!agreed || pending}
                  onClick={() => submit("confirmed")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-foreground px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-background disabled:opacity-40"
                >
                  <span>Confirm split details</span>
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("rejected")}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-foreground/10 px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  <span>Reject details</span>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {done ? (
            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-full border", done === "confirmed" ? "border-success/20 bg-success/10 text-success" : "border-warning/20 bg-warning/10 text-warning")}>
                {done === "confirmed" ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
              </span>
              <h2 className="mt-4 font-display text-[24px] font-bold text-foreground">{done === "confirmed" ? "Split details confirmed" : "Split details rejected"}</h2>
              <p className="mt-2 max-w-sm text-[14px] font-semibold leading-relaxed text-muted-foreground">
                The artist team can now see your response from their Music rights workspace.
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
    <div>
      <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">{label}</span>
      <span className="mt-1 block font-display text-[28px] font-bold text-foreground">{value}</span>
      <span className="block text-[11px] font-semibold text-muted-foreground">{detail}</span>
    </div>
  );
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
