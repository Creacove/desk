import { ArrowRight, Check, Link2, LogOut } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import { createTeamInviteLink } from "../../services/teamInviteRoute";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import type { TeamResponsibilities, WorkspaceScope, WorkspaceTeamCapability } from "../../types/workspaceTeam";
import { TeamRolePicker } from "./TeamRolePicker";
import { parseResponsibilityTags } from "./teamRolePresets";

type TeamFirstRunStep = "identity" | "invite";

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
  const [responsibilities, setResponsibilities] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOperatingTitle, setInviteOperatingTitle] = useState("");
  const [inviteResponsibilities, setInviteResponsibilities] = useState("");
  const [completedCapability, setCompletedCapability] = useState<WorkspaceTeamCapability | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteEmailStatus, setInviteEmailStatus] = useState<"sent" | "failed" | "skipped" | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedTags = useMemo(() => parseResponsibilityTags(responsibilities), [responsibilities]);
  const canContinue = teamName.trim().length > 0 && !pending;

  async function completeIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teamName.trim()) {
      setError("Add a team or company name to continue.");
      return;
    }
    if (countTags(responsibilities) > 12) {
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
        responsibilityTags: parsedTags,
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
    if (countTags(inviteResponsibilities) > 12) {
      setError("Use no more than 12 responsibilities.");
      return;
    }

    try {
      setPending(true);
      setError(null);
      const result = await service.invite({
        artistWorkspaceId: scope.artistWorkspaceId,
        email,
        operatingTitle: inviteOperatingTitle.trim() || null,
        responsibilityTags: parseResponsibilityTags(inviteResponsibilities),
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
          <div className="w-full max-w-[46rem]">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className={cn(step === "identity" ? "text-brand-accent" : "text-muted-foreground/55")}>1 · Team identity</span>
              <span aria-hidden="true">/</span>
              <span className={cn(step === "invite" ? "text-brand-accent" : "text-muted-foreground/55")}>2 · Invite</span>
            </div>

            {step === "identity" ? (
              <form className="mt-7 max-w-[38rem]" onSubmit={completeIdentity}>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Team workspace</p>
                <h1 className="mt-4 max-w-[13ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Set up your team</h1>
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">
                  Name the workspace, then choose the role that best describes your work with {artistName}.
                </p>

                <div className="mt-8 grid gap-4">
                  <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor="team-first-run-name">
                    Team or company name
                    <input
                      id="team-first-run-name"
                      aria-label="Team or company name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="e.g. North Star Records"
                      autoComplete="organization"
                      maxLength={120}
                      disabled={pending}
                      className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10"
                    />
                  </label>

                  <TeamRolePicker
                    value={{ operatingTitle: operatingTitle || null, responsibilityTags: parsedTags }}
                    onChange={(next: TeamResponsibilities) => {
                      setOperatingTitle(next.operatingTitle ?? "");
                      setResponsibilities(next.responsibilityTags.join(", "));
                    }}
                    disabled={pending}
                    titleLabel="Operating title"
                    responsibilitiesLabel="Responsibilities"
                  />
                </div>

                {error ? <p role="alert" className="mt-4 text-[12px] font-semibold text-destructive">{error}</p> : null}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button type="submit" pending={pending} disabled={!canContinue} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                    Continue to invites
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-7 max-w-[38rem]">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Team workspace</p>
                <h1 className="mt-4 max-w-[13ch] font-display text-[34px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[42px]">Bring in your team</h1>
                <p className="mt-3 max-w-[32rem] text-[13px] font-medium leading-relaxed text-muted-foreground/75">
                  Add a teammate now or go straight to {artistName}&rsquo;s Desk and invite people later.
                </p>

                <form className="mt-8 grid gap-3" onSubmit={createInvite}>
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
                      disabled={pending || Boolean(inviteLink)}
                      className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10"
                    />
                  </label>
                  <TeamRolePicker
                    value={{ operatingTitle: inviteOperatingTitle || null, responsibilityTags: parseResponsibilityTags(inviteResponsibilities) }}
                    onChange={(next: TeamResponsibilities) => {
                      setInviteOperatingTitle(next.operatingTitle ?? "");
                      setInviteResponsibilities(next.responsibilityTags.join(", "));
                    }}
                    disabled={pending || Boolean(inviteLink)}
                    titleLabel="Invite role"
                    responsibilitiesLabel="Invite responsibilities"
                  />
                  {error ? <p role="alert" className="text-[12px] font-semibold text-destructive">{error}</p> : null}
                  {inviteLink ? (
                    <div className="rounded-[12px] border border-brand-accent/18 bg-brand-accent/[0.04] p-3.5">
                      <div className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                        <div className="min-w-0" aria-live="polite">
                          <p className="text-[13px] font-semibold text-foreground">
                            {inviteEmailStatus === "sent" ? "Invitation sent" : inviteEmailStatus === "failed" ? "Invite created, but the email did not send" : "Invite link ready"}
                          </p>
                          <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                            {inviteEmailStatus === "failed" ? "Copy this link and send it to them another way." : inviteEmailStatus === "sent" ? "They can use the email or this link to join." : "Copy this link and send it to them."}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex min-w-0 gap-2">
                        <input aria-label="Invite link" readOnly value={inviteLink} className="min-w-0 flex-1 rounded-[8px] border border-foreground/10 bg-background px-2.5 text-[11px] font-medium text-muted-foreground outline-none" />
                        <Button type="button" variant="secondary" size="sm" leadingIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />} onClick={() => void navigator.clipboard?.writeText(inviteLink)}>
                          Copy link
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button type="submit" pending={pending} disabled={pending} leadingIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />}>
                      Send invite
                    </Button>
                  )}
                </form>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button type="button" onClick={finish} disabled={pending} trailingIcon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                    Continue to Desk
                  </Button>
                  <button type="button" onClick={finish} disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] px-3 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground disabled:pointer-events-none disabled:opacity-45">
                    I&rsquo;ll do this later
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function countTags(value: string) {
  return value.split(",").map((tag) => tag.trim()).filter(Boolean).length;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
