import { ArrowLeft, ArrowRight, Check, Link2, LogOut } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import { createTeamInviteLink } from "../../services/teamInviteRoute";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import type { TeamResponsibilities, WorkspaceScope, WorkspaceTeamCapability } from "../../types/workspaceTeam";
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
  const [inviteEmail, setInviteEmail] = useState("");
  const [completedCapability, setCompletedCapability] = useState<WorkspaceTeamCapability | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmailStatus, setInviteEmailStatus] = useState<"sent" | "failed" | "skipped" | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleValue = useMemo<TeamResponsibilities>(() => ({ operatingTitle: operatingTitle || null, responsibilityTags: responsibilities }), [operatingTitle, responsibilities]);
  const stepIndex = step === "identity" ? 1 : step === "role" ? 2 : step === "responsibilities" ? 3 : 4;

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

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!isEmail(email)) {
      setError("Add a valid email address to create an invite.");
      return;
    }

    try {
      setPending(true);
      setError(null);
      const result = await service.invite({
        artistWorkspaceId: scope.artistWorkspaceId,
        email,
        operatingTitle: null,
        responsibilityTags: [],
      });
      setInviteLink(createTeamInviteLink(window.location.origin, result.token));
      setInviteEmailStatus(result.emailStatus ?? "skipped");
    } catch (inviteError) {
      setError(readErrorMessage(inviteError, "Invite could not be created."));
    } finally {
      setPending(false);
    }
  }

  function finish() {
    if (completedCapability) onComplete(completedCapability);
  }

  const progressLabels = ["Team name", "Your role", "Responsibilities", "Invite"];

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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {progressLabels.map((label, index) => (
                <span key={label} className={cn(index + 1 === stepIndex ? "text-brand-accent" : index + 1 < stepIndex ? "text-foreground/60" : "text-muted-foreground/45")}>
                  {index + 1} · {label}
                </span>
              ))}
            </div>

            {step === "identity" ? (
              <form className="mt-7 max-w-[38rem]" onSubmit={continueIdentity}>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Team setup</p>
                <h1 className="mt-4 max-w-[15ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Name your team</h1>
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">This is the name everyone in the team will see.</p>
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
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">Choose the work you do for {artistName}. Team access and your work role are separate.</p>
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
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">Choose your main responsibilities. You can add or change them later.</p>
                <div className="mt-8"><TeamRolePicker value={roleValue} onChange={(next) => setResponsibilities(next.responsibilityTags)} mode="responsibilities" disabled={pending} /></div>
                {error ? <p role="alert" className="mt-4 text-[12px] font-semibold text-destructive">{error}</p> : null}
                <div className="mt-7 flex items-center gap-3">
                  <Button type="submit" pending={pending} disabled={pending} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Save and continue</Button>
                </div>
              </form>
            ) : null}

            {step === "invite" ? (
              <div className="mt-7 max-w-[38rem]">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">{teamName}</p>
                <h1 className="mt-4 max-w-[15ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Bring in your team</h1>
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">Invite the people who will work with you. You can always do this from Team settings later.</p>

                {!inviteOpen && !inviteLink ? (
                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button type="button" onClick={() => { setError(null); setInviteOpen(true); }} leadingIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />}>Invite someone</Button>
                    <button type="button" onClick={finish} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:pointer-events-none disabled:opacity-45">Skip for now</button>
                  </div>
                ) : null}

                {inviteOpen && !inviteLink ? (
                  <form className="mt-8 grid max-w-[30rem] gap-3" onSubmit={createInvite}>
                    <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor="team-first-run-invite-email">
                      Invite email
                      <input
                        id="team-first-run-invite-email"
                        aria-label="Invite email"
                        type="email"
                        value={inviteEmail}
                        onChange={(event) => setInviteEmail(event.target.value)}
                        placeholder="teammate@example.com"
                        autoComplete="email"
                        disabled={pending}
                        className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10"
                      />
                    </label>
                    {error ? <p role="alert" className="text-[12px] font-semibold text-destructive">{error}</p> : null}
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" pending={pending} disabled={pending}>Send invite</Button>
                      <button type="button" onClick={finish} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:pointer-events-none disabled:opacity-45">Skip for now</button>
                    </div>
                  </form>
                ) : null}

                {inviteLink ? (
                  <div className="mt-8 rounded-[12px] border border-brand-accent/18 bg-brand-accent/[0.04] p-3.5">
                    <div className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                      <div className="min-w-0" aria-live="polite">
                        <p className="text-[13px] font-semibold text-foreground">{inviteEmailStatus === "sent" ? "Invitation sent" : inviteEmailStatus === "failed" ? "Invite created, but the email did not send" : "Invite link ready"}</p>
                        <p className="mt-1 text-[12px] font-medium text-muted-foreground">{inviteEmailStatus === "failed" ? "Copy this link and send it to them another way." : inviteEmailStatus === "sent" ? "They can use the email or this link to join." : "Copy this link and send it to them."}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex min-w-0 gap-2">
                      <input aria-label="Invite link" readOnly value={inviteLink} className="min-w-0 flex-1 rounded-[8px] border border-foreground/10 bg-background px-2.5 text-[11px] font-medium text-muted-foreground outline-none" />
                      <Button type="button" variant="secondary" size="sm" leadingIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => void navigator.clipboard?.writeText(inviteLink)}>Copy link</Button>
                    </div>
                    <Button className="mt-4" type="button" onClick={finish} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>Continue to Desk</Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
