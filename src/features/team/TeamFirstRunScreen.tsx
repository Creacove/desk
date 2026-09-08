import { ArrowLeft, ArrowRight, LogOut } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { WorkspaceIdentity } from "../../design-system/workspaceIdentity";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import type { TeamResponsibilities, WorkspaceScope, WorkspaceTeamCapability } from "../../types/workspaceTeam";
import { TeamInviteDialog } from "./TeamInviteDialog";
import { TeamRolePicker } from "./TeamRolePicker";
import { parseResponsibilityTags } from "./teamRolePresets";

type TeamFirstRunStep = "identity" | "role" | "responsibilities" | "invite";

export type TeamFirstRunScreenProps = {
  service: WorkspaceTeamService;
  scope: WorkspaceScope;
  artistName: string;
  capability: WorkspaceTeamCapability;
  onComplete: (capability: WorkspaceTeamCapability) => void;
  onSignOut?: () => void;
};

export function TeamFirstRunScreen({
  service,
  scope,
  artistName,
  capability,
  onComplete,
  onSignOut,
}: TeamFirstRunScreenProps) {
  const [step, setStep] = useState<TeamFirstRunStep>("identity");
  const [teamName, setTeamName] = useState("");
  const [operatingTitle, setOperatingTitle] = useState("");
  const [responsibilities, setResponsibilities] = useState<string[]>([]);
  const [completedCapability, setCompletedCapability] = useState<WorkspaceTeamCapability | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleValue = useMemo<TeamResponsibilities>(() => ({ operatingTitle: operatingTitle || null, responsibilityTags: responsibilities }), [operatingTitle, responsibilities]);
  function continueIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamName.trim()) {
      setError("Add a team or company name to continue.");
      return;
    }
    setError(null);
    setStep("role");
  }

  function continueRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operatingTitle.trim()) {
      setError("Choose the role that best describes your work on this team.");
      return;
    }
    setError(null);
    setStep("responsibilities");
  }

  async function completeDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!responsibilities.length) {
      setError("Choose at least one responsibility to continue.");
      return;
    }
    if (responsibilities.length > 12) {
      setError("Use no more than 12 responsibilities.");
      return;
    }

    try {
      setPending(true);
      setError(null);
      const nextCapability = await service.completeFirstRun({
        artistWorkspaceId: scope.artistWorkspaceId,
        teamName: teamName.trim(),
        operatingTitle: operatingTitle.trim() || null,
        responsibilityTags: parseResponsibilityTags(responsibilities.join(", ")),
      });
      setCompletedCapability(nextCapability);
      setStep("invite");
    } catch (completionError) {
      setError(readErrorMessage(completionError, "Team details could not be saved."));
    } finally {
      setPending(false);
    }
  }

  function finish() {
    if (completedCapability) onComplete(completedCapability);
  }

  return (
    <main className="app-theme min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="mx-auto w-full max-w-[92rem] px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:pt-5">
        <header className="flex min-h-11 items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size="sm" />
            <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">Desk</span>
          </div>
          {onSignOut ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              Sign out
            </button>
          ) : null}
        </header>

        <section className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-[68rem] flex-col justify-center py-10 sm:py-14 lg:py-16">
          <div className="w-full max-w-[42rem]">
            {step === "identity" ? (
              <form className="mt-7 max-w-[38rem]" onSubmit={continueIdentity}>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Team setup</p>
                <h1 className="mt-4 max-w-[15ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Name your team</h1>
                <label className="mt-8 grid gap-2 text-[11px] font-semibold text-foreground" htmlFor="team-first-run-name">
                  Team or company name
                  <input
                    id="team-first-run-name"
                    aria-label="Team or company name"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="e.g. Kush House or North Star Records"
                    autoComplete="organization"
                    maxLength={120}
                    disabled={pending}
                    className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10"
                  />
                </label>
                {error ? <p role="alert" className="mt-4 text-[12px] font-semibold text-destructive">{error}</p> : null}
                <div className="mt-7 flex items-center gap-3">
                  <Button type="submit" disabled={!teamName.trim() || pending} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Continue</Button>
                </div>
              </form>
            ) : null}

            {step === "role" ? (
              <form className="mt-7 max-w-[38rem]" onSubmit={continueRole}>
                <button type="button" onClick={() => { setError(null); setStep("identity"); }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back
                </button>
                <p className="mt-7 font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">About you</p>
                <h1 className="mt-4 max-w-[16ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Your role on the team</h1>
                <div className="mt-8 max-w-[22rem]"><TeamRolePicker value={roleValue} onChange={(next) => { setOperatingTitle(next.operatingTitle ?? ""); setResponsibilities(next.responsibilityTags); }} mode="role" disabled={pending} /></div>
                {error ? <p role="alert" className="mt-4 text-[12px] font-semibold text-destructive">{error}</p> : null}
                <div className="mt-7 flex items-center gap-3">
                  <Button type="submit" disabled={!operatingTitle.trim() || pending} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Continue</Button>
                </div>
              </form>
            ) : null}

            {step === "responsibilities" ? (
              <form className="mt-7 max-w-[38rem]" onSubmit={completeDetails}>
                <button type="button" onClick={() => { setError(null); setStep("role"); }} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  Back
                </button>
                <p className="mt-7 font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">About you</p>
                <h1 className="mt-4 max-w-[15ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">What will you handle?</h1>
                <div className="mt-8"><TeamRolePicker value={roleValue} onChange={(next) => setResponsibilities(next.responsibilityTags)} mode="responsibilities" disabled={pending} /></div>
                {error ? <p role="alert" className="mt-4 text-[12px] font-semibold text-destructive">{error}</p> : null}
                <div className="mt-7 flex items-center gap-3">
                  <Button type="submit" pending={pending} disabled={pending} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Save and continue</Button>
                </div>
              </form>
            ) : null}

            {step === "invite" ? (
              <div className="mt-7 max-w-[38rem]">
                <WorkspaceIdentity variant="page" teamName={completedCapability?.teamName ?? teamName} artistName={artistName} isTeamPlan />
                {!inviteOpen ? (
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => { setError(null); setInviteOpen(true); }}>Invite people</Button>
                    <button type="button" onClick={finish} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:pointer-events-none disabled:opacity-45">Skip for now</button>
                  </div>
                ) : null}
                <TeamInviteDialog
                  open={inviteOpen}
                  onOpenChange={setInviteOpen}
                  teamName={completedCapability?.teamName ?? teamName}
                  artistName={artistName}
                  remainingSeats={Math.max(0, capability.seatLimit - capability.occupiedSeats - capability.reservedSeats)}
                  onInvite={(input) => service.invite({ artistWorkspaceId: scope.artistWorkspaceId, ...input })}
                  onDone={finish}
                />
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
