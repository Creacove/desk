import { Check, Copy, Pencil, RefreshCw, RotateCw, UserMinus, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Badge } from "../../design-system/components";
import { Button, SkeletonBlock } from "../../design-system/desktopPrimitives";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import { createTeamInviteLink } from "../../services/teamInviteRoute";
import { MemberResponsibilitiesForm } from "./MemberResponsibilitiesForm";
import { TeamRolePicker } from "./TeamRolePicker";
import type {
  TeamInvitation,
  TeamInvitationDeliveryStatus,
  TeamResponsibilities,
  WorkspaceMember,
  WorkspaceRoster,
  WorkspaceScope,
  WorkspaceTeamCapability,
} from "../../types/workspaceTeam";

const MAX_TITLE_LENGTH = 80;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 48;

export type YourTeamPanelProps = {
  service: WorkspaceTeamService;
  scope: WorkspaceScope;
  artistName: string;
  viewerUserId: string;
  capability: WorkspaceTeamCapability;
  /** Optional server snapshots let Settings avoid a duplicate first paint. */
  roster?: WorkspaceRoster;
  invitations?: TeamInvitation[];
  onRosterChanged?: () => void | Promise<void>;
};

type PanelError = { scope: "load" | "invite" | "member"; message: string };
type InviteDraft = TeamResponsibilities & { email: string };

const emptyResponsibilities: TeamResponsibilities = { operatingTitle: null, responsibilityTags: [] };

export function YourTeamPanel({
  service,
  scope,
  artistName,
  viewerUserId,
  capability,
  roster: initialRoster,
  invitations: initialInvitations,
  onRosterChanged,
}: YourTeamPanelProps) {
  const [currentCapability, setCurrentCapability] = useState(capability);
  const [roster, setRoster] = useState<WorkspaceRoster | null>(initialRoster ?? null);
  const [invitations, setInvitations] = useState<TeamInvitation[]>(initialInvitations ?? []);
  const [loading, setLoading] = useState(!initialRoster || !initialInvitations);
  const [error, setError] = useState<PanelError | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteDraft, setInviteDraft] = useState<InviteDraft>({ email: "", ...emptyResponsibilities });
  const [invitePending, setInvitePending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkStatus, setInviteLinkStatus] = useState<string | null>(null);
  const [inviteDeliveryStatus, setInviteDeliveryStatus] = useState<TeamInvitationDeliveryStatus | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [responsibilityDrafts, setResponsibilityDrafts] = useState<Record<string, TeamResponsibilities>>({});
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [confirmingRemovalId, setConfirmingRemovalId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mutationNotice, setMutationNotice] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const viewer = roster?.members.find((member) => member.userId === viewerUserId);
  const isOwner = viewer?.accessRole === "owner";
  const teamAccessActive = capability.planKey === "team_6" && capability.enabled && capability.entitled;
  const seatLimit = currentCapability.seatLimit;
  const seatsFull = currentCapability.occupiedSeats + currentCapability.reservedSeats >= seatLimit;

  const loadTeam = useCallback(async () => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;
    setLoading(true);
    setError(null);
    try {
      const nextRoster = await service.loadRoster(scope.artistWorkspaceId);
      const nextViewer = nextRoster.members.find((member) => member.userId === viewerUserId);
      if (loadRequestRef.current !== requestId) return;
      setRoster(nextRoster);
      if (nextViewer?.accessRole !== "owner") {
        setInvitations([]);
        return;
      }
      try {
        const nextInvitations = await service.listInvitations(scope.artistWorkspaceId);
        if (loadRequestRef.current === requestId) setInvitations(nextInvitations);
      } catch (invitationError) {
        if (loadRequestRef.current === requestId) setError({ scope: "load", message: safeTeamError(invitationError, "Your invitations could not load.") });
      }
    } catch (loadError) {
      if (loadRequestRef.current === requestId) setError({ scope: "load", message: safeTeamError(loadError, "Your team could not load.") });
    } finally {
      if (loadRequestRef.current === requestId) setLoading(false);
    }
  }, [scope.artistWorkspaceId, service, viewerUserId]);

  useEffect(() => {
    if (initialRoster && initialInvitations) {
      setLoading(false);
      return;
    }
    if (!teamAccessActive) {
      setLoading(false);
      return;
    }
    void loadTeam();
  }, [initialInvitations, initialRoster, loadTeam, retryKey, teamAccessActive]);

  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > Date.now()),
    [invitations],
  );

  function clearMessages() {
    setError(null);
    setMutationError(null);
    setMutationNotice(null);
    setInviteLinkStatus(null);
    setInviteDeliveryStatus(null);
  }

  function openInviteForm() {
    clearMessages();
    setInviteLink(null);
    setInviteDraft({ email: "", ...emptyResponsibilities });
    setInviteOpen(true);
  }

  function closeInviteForm() {
    if (invitePending) return;
    setInviteOpen(false);
  }

  if (!teamAccessActive) {
    return (
      <section data-testid="your-team-panel" className="w-full">
        <TeamHeading teamName={currentCapability.teamName} artistName={artistName} />
        <div className="border-t border-foreground/8 py-6">
          <p className="text-[13px] font-medium text-muted-foreground">Team access is unavailable for this workspace.</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground/75">Ask the workspace owner to restore Team access.</p>
        </div>
      </section>
    );
  }

  if (loading && !roster) return <TeamLoadingState />;

  if (error?.scope === "load" && !roster) {
    return (
      <section data-testid="your-team-panel" className="w-full">
        <TeamHeading teamName={currentCapability.teamName} artistName={artistName} />
        <div className="border-t border-foreground/8 py-6">
          <p role="alert" className="text-[13px] font-medium text-destructive">{error.message}</p>
          <Button className="mt-4" variant="secondary" size="sm" onClick={() => setRetryKey((value) => value + 1)} leadingIcon={<RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}>Retry team</Button>
        </div>
      </section>
    );
  }

  if (!roster) return null;

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    const email = inviteDraft.email.trim().toLowerCase();
    const responsibilities = validateResponsibilities(inviteDraft);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError({ scope: "invite", message: "Enter the email for the person you want to invite." });
      return;
    }
    if (!responsibilities.valid) {
      setError({ scope: "invite", message: responsibilities.message });
      return;
    }
    try {
      setInvitePending(true);
      const response = await service.invite({ artistWorkspaceId: scope.artistWorkspaceId, email, ...responsibilities.value });
      const link = createTeamInviteLink(window.location.origin, response.token);
      setInviteLink(link);
      setInviteDeliveryStatus(response.emailStatus ?? "skipped");
      setInviteLinkStatus(deliveryStatusMessage(response.emailStatus));
      setMutationNotice(response.emailStatus === "sent" ? "Invitation sent." : response.emailStatus === "failed" ? "Invite created. The email did not send." : "Invite link ready.");
      setInvitations((current) => [response.invitation, ...current.filter((item) => item.id !== response.invitation.id)]);
      setCurrentCapability((current) => ({ ...current, reservedSeats: current.reservedSeats + 1 }));
      setInviteDraft({ email: "", ...emptyResponsibilities });
      setInviteOpen(false);
    } catch (inviteError) {
      setError({ scope: "invite", message: safeTeamError(inviteError, "The invitation could not be created. Try again.") });
    } finally {
      setInvitePending(false);
    }
  }

  async function rotateInvitation(invitation: TeamInvitation) {
    clearMessages();
    try {
      const response = await service.rotateInvitation(invitation.id);
      setInviteLink(createTeamInviteLink(window.location.origin, response.token));
      setInviteDeliveryStatus(response.emailStatus ?? "skipped");
      setInviteLinkStatus(response.emailStatus === "sent" ? "Invitation sent. Copy link ready." : response.emailStatus === "failed" ? "Email did not send. Copy the link." : "Invite link ready.");
      setMutationNotice(response.emailStatus === "sent" ? "Invitation sent." : response.emailStatus === "failed" ? "Invite link renewed. The email did not send." : "Invite link renewed.");
      setInvitations((current) => current.map((item) => item.id === invitation.id ? response.invitation : item));
    } catch (rotateError) {
      setMutationError(safeTeamError(rotateError, "The invitation could not be sent again."));
    }
  }

  async function revokeInvitation(invitation: TeamInvitation) {
    clearMessages();
    try {
      await service.revokeInvitation(invitation.id);
      setInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, status: "revoked" } : item));
      setCurrentCapability((current) => ({ ...current, reservedSeats: Math.max(0, current.reservedSeats - 1) }));
      setMutationNotice("Invitation revoked.");
    } catch (revokeError) {
      setMutationError(safeTeamError(revokeError, "The invitation could not be revoked."));
    }
  }

  function beginEdit(memberToEdit: WorkspaceMember) {
    clearMessages();
    setEditingMemberId(memberToEdit.userId);
    setResponsibilityDrafts((current) => ({ ...current, [memberToEdit.userId]: { operatingTitle: memberToEdit.operatingTitle, responsibilityTags: [...memberToEdit.responsibilityTags] } }));
  }

  async function saveResponsibilities(memberToEdit: WorkspaceMember) {
    const draft = responsibilityDrafts[memberToEdit.userId] ?? emptyResponsibilities;
    const responsibilities = validateResponsibilities(draft);
    if (!responsibilities.valid) {
      setMutationError(responsibilities.message);
      return;
    }
    try {
      setSavingMemberId(memberToEdit.userId);
      setMutationError(null);
      await service.updateResponsibilities({ artistWorkspaceId: scope.artistWorkspaceId, memberUserId: memberToEdit.userId, ...responsibilities.value });
      setRoster((current) => current ? { ...current, members: current.members.map((memberItem) => memberItem.userId === memberToEdit.userId ? { ...memberItem, ...responsibilities.value } : memberItem) } : current);
      setEditingMemberId(null);
      await onRosterChanged?.();
      setMutationNotice(`${memberToEdit.displayName}'s role was saved.`);
    } catch (saveError) {
      setMutationError(safeTeamError(saveError, "The role could not be saved."));
    } finally {
      setSavingMemberId(null);
    }
  }

  async function removeMember(memberToRemove: WorkspaceMember) {
    try {
      setRemovingMemberId(memberToRemove.userId);
      setMutationError(null);
      await service.removeMember(scope.artistWorkspaceId, memberToRemove.userId);
      setRoster((current) => current ? { ...current, members: current.members.filter((item) => item.userId !== memberToRemove.userId) } : current);
      setCurrentCapability((current) => ({ ...current, occupiedSeats: Math.max(0, current.occupiedSeats - 1) }));
      setConfirmingRemovalId(null);
      await onRosterChanged?.();
      setMutationNotice(`${memberToRemove.displayName} was removed from the team.`);
    } catch (removeError) {
      setMutationError(safeTeamError(removeError, "The team member could not be removed."));
    } finally {
      setRemovingMemberId(null);
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteLinkStatus("Copied to clipboard.");
    } catch {
      setInviteLinkStatus("Copy failed. Select the link and copy it manually.");
    }
  }

  return (
    <section data-testid="your-team-panel" className="w-full">
      <TeamHeading teamName={currentCapability.teamName} artistName={artistName} countLabel={`${currentCapability.occupiedSeats} of ${seatLimit} people`} />

      {error && error.scope !== "invite" ? <p role="alert" className="mb-4 text-[12px] font-medium text-destructive">{error.message}</p> : null}
      {mutationError ? <p role="alert" className="mb-4 text-[12px] font-medium text-destructive">{mutationError}</p> : null}
      {mutationNotice ? <p role="status" className="mb-4 text-[12px] font-semibold text-brand-accent">{mutationNotice}</p> : null}

      <section aria-labelledby="team-members-heading">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/8 pb-3">
          <h3 id="team-members-heading" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">People</h3>
          {isOwner && seatsFull ? <p className="text-[12px] font-medium text-muted-foreground">All {seatLimit} people are already here or invited.</p> : null}
          {isOwner && !seatsFull && !inviteOpen && !inviteLink ? <Button type="button" size="sm" onClick={openInviteForm} leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}>Invite teammate</Button> : null}
          {isOwner && !seatsFull && !inviteOpen && inviteLink ? <Button type="button" size="sm" variant="secondary" onClick={openInviteForm} leadingIcon={<UserPlus className="h-3.5 w-3.5" aria-hidden="true" />}>Invite another teammate</Button> : null}
        </div>

        <div className="divide-y divide-foreground/8">
          {roster.members.map((memberItem) => {
            const draft = responsibilityDrafts[memberItem.userId] ?? { operatingTitle: memberItem.operatingTitle, responsibilityTags: [...memberItem.responsibilityTags] };
            const editing = editingMemberId === memberItem.userId;
            const isRemoving = removingMemberId === memberItem.userId;
            const isCurrentViewer = memberItem.userId === viewerUserId;
            return (
              <div key={memberItem.userId} className="py-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span aria-hidden="true" className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06] font-ui text-[11px] font-bold text-muted-foreground">{initials(memberItem.displayName)}</span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-[16px] font-semibold text-foreground">{memberItem.displayName}</p>
                        <Badge active={memberItem.accessRole === "owner"}>{memberItem.accessRole === "owner" ? "Owner" : "Member"}</Badge>
                        {isCurrentViewer ? <span className="text-[11px] font-semibold text-muted-foreground">You</span> : null}
                      </div>
                      <p className="mt-1 text-[13px] font-semibold text-foreground/78">{memberItem.operatingTitle || "Role not set"}</p>
                      {memberItem.responsibilityTags.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {memberItem.responsibilityTags.slice(0, 4).map((tag) => (
                            <span key={`${memberItem.userId}-${tag}`} className="rounded-md bg-foreground/[0.045] px-2 py-1 text-[11px] font-medium text-muted-foreground">{tag}</span>
                          ))}
                          {memberItem.responsibilityTags.length > 4 ? <span className="px-1 py-1 text-[11px] font-medium text-muted-foreground">+{memberItem.responsibilityTags.length - 4}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {isOwner ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={editing ? `Cancel editing ${memberItem.displayName}` : `Edit responsibilities for ${memberItem.displayName}`}
                        onClick={() => editing ? setEditingMemberId(null) : beginEdit(memberItem)}
                        leadingIcon={editing ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}
                      >
                        {editing ? "Cancel" : "Edit"}
                      </Button>
                      {memberItem.accessRole === "owner" ? null : confirmingRemovalId === memberItem.userId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">Remove {memberItem.displayName}?</span>
                          <Button type="button" variant="destructive" size="sm" pending={isRemoving} onClick={() => void removeMember(memberItem)} aria-label={`Confirm removal of ${memberItem.displayName}`}>Remove</Button>
                          <Button type="button" variant="ghost" size="sm" disabled={isRemoving} onClick={() => setConfirmingRemovalId(null)}>Keep</Button>
                        </div>
                      ) : (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingRemovalId(memberItem.userId)} leadingIcon={<UserMinus className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Remove ${memberItem.displayName}`}>Remove</Button>
                      )}
                    </div>
                  ) : null}
                </div>

                {editing ? (
                  <MemberResponsibilitiesForm
                    memberName={memberItem.displayName}
                    draft={draft}
                    pending={savingMemberId === memberItem.userId}
                    onChange={(next) => setResponsibilityDrafts((current) => ({ ...current, [memberItem.userId]: next }))}
                    onSave={() => void saveResponsibilities(memberItem)}
                    onCancel={() => setEditingMemberId(null)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {isOwner && pendingInvitations.length ? (
        <section aria-labelledby="team-invitations-heading" className="mt-7 border-t border-foreground/8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 id="team-invitations-heading" className="font-display text-[18px] font-semibold tracking-[-0.02em] text-foreground">Invitations</h3>
            <span className="text-[12px] font-semibold text-muted-foreground">{pendingInvitations.length} pending</span>
          </div>
          <div className="mt-2 divide-y divide-foreground/8 border-y border-foreground/8">
            {pendingInvitations.map((invitation) => (
              <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-foreground">{invitation.email}</p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">Expires {formatDate(invitation.expiresAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => void rotateInvitation(invitation)} leadingIcon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Resend invitation to ${invitation.email}`}>Resend</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => void revokeInvitation(invitation)} aria-label={`Revoke invitation for ${invitation.email}`}>Revoke</Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isOwner && inviteOpen ? (
        <section aria-labelledby="team-invite-heading" className="mt-7 border-t border-foreground/8 pt-6">
          <div className="flex max-w-2xl flex-wrap items-start justify-between gap-3">
            <div>
              <h3 id="team-invite-heading" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">Invite someone</h3>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">They’ll get a link to join {artistName}’s team.</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={closeInviteForm}>Cancel</Button>
          </div>
          {seatsFull ? (
            <p className="mt-4 max-w-2xl rounded-[12px] bg-foreground/[0.035] px-3.5 py-3 text-[12px] font-semibold text-muted-foreground">All {seatLimit} people are already here or invited.</p>
          ) : (
            <form className="mt-5 grid max-w-2xl gap-5" aria-label="Invite teammate" onSubmit={submitInvite}>
              <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor="team-invite-email">
                Their email
                <input
                  id="team-invite-email"
                  aria-label="Email address"
                  type="email"
                  value={inviteDraft.email}
                  onChange={(event) => setInviteDraft((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                  disabled={invitePending}
                  className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
                  placeholder="teammate@example.com"
                />
              </label>
              <TeamRolePicker value={inviteDraft} onChange={(next) => setInviteDraft((current) => ({ ...current, ...next }))} disabled={invitePending} detailsInitiallyOpen={false} />
              {error?.scope === "invite" ? <p role="alert" className="text-[12px] font-semibold text-destructive">{error.message}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" pending={invitePending} disabled={invitePending}>Send invitation</Button>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {seatLimit - currentCapability.occupiedSeats - currentCapability.reservedSeats} {seatLimit - currentCapability.occupiedSeats - currentCapability.reservedSeats === 1 ? "person" : "people"} left
                </span>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {isOwner && inviteLink ? (
        <section aria-labelledby="team-invite-result-heading" className="mt-5 rounded-[14px] border border-brand-accent/18 bg-brand-accent/[0.04] p-3.5" aria-live="polite">
          <div className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
            <div className="min-w-0">
              <h3 id="team-invite-result-heading" className="text-[13px] font-semibold text-foreground">
                {inviteDeliveryStatus === "sent" ? "Invitation sent" : inviteDeliveryStatus === "failed" ? "Invite created, but the email did not send" : "Invite link ready"}
              </h3>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">
                {inviteDeliveryStatus === "failed" ? "Copy the link below and send it to them another way." : inviteDeliveryStatus === "sent" ? "They can use the email or this link to join." : "Copy the link and send it to them."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
            <input aria-label="Invite link" value={inviteLink} readOnly className="min-h-10 min-w-0 flex-1 rounded-[10px] border border-foreground/10 bg-background px-3 text-[12px] font-medium text-foreground outline-none focus:border-brand-accent/45 focus:ring-2 focus:ring-brand-accent/8" />
            <Button type="button" variant="secondary" size="sm" aria-label="Copy invite link" onClick={() => void copyInviteLink()} leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}>Copy link</Button>
          </div>
          {inviteLinkStatus ? <p role="status" className="mt-2 text-[11px] font-semibold text-brand-accent">{inviteLinkStatus}</p> : null}
        </section>
      ) : null}

      {loading ? <p className="mt-5 text-[12px] font-medium text-muted-foreground">Refreshing team details…</p> : null}
    </section>
  );
}

function TeamHeading({ teamName, artistName, countLabel }: { teamName?: string | null; artistName: string; countLabel?: string }) {
  return (
    <div className="mb-5 border-b border-foreground/8 pb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Team</p>
          <h2 className="mt-1 truncate font-display text-[26px] font-semibold tracking-[-0.025em] text-foreground">{teamName?.trim() || "Your team"}</h2>
        </div>
        {countLabel ? <p className="text-[13px] font-semibold text-brand-accent">{countLabel}</p> : null}
      </div>
      <p className="mt-2 text-[13px] font-medium text-muted-foreground">Working with {artistName}.</p>
    </div>
  );
}

function TeamLoadingState() {
  return (
    <section data-testid="your-team-panel" className="w-full" aria-busy="true">
      <TeamHeading artistName="your artist" />
      <div role="status" aria-label="Loading your team" className="border-t border-foreground/8 py-6">
        <span className="sr-only">Loading your team</span>
        <div className="grid gap-3" aria-hidden="true">
          <SkeletonBlock className="h-5 w-44" />
          <SkeletonBlock className="h-3 w-64" />
          <SkeletonBlock className="h-16 w-full" />
          <SkeletonBlock className="h-16 w-full" />
        </div>
      </div>
    </section>
  );
}

function validateResponsibilities(value: TeamResponsibilities): { valid: true; value: TeamResponsibilities } | { valid: false; message: string } {
  const title = (value.operatingTitle ?? "").trim();
  if (title.length > MAX_TITLE_LENGTH) return { valid: false, message: "Keep the title to 80 characters or fewer." };
  const tags = [...new Set(value.responsibilityTags.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return { valid: false, message: "Choose 12 responsibilities or fewer." };
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) return { valid: false, message: "Keep each responsibility to 48 characters or fewer." };
  return { valid: true, value: { operatingTitle: title || null, responsibilityTags: tags } };
}

function deliveryStatusMessage(status?: TeamInvitationDeliveryStatus) {
  if (status === "sent") return "Invitation sent. Copy link ready.";
  if (status === "failed") return "Email did not send. Copy link ready.";
  return "Invite link ready.";
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "later";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function safeTeamError(error: unknown, fallback: string) {
  const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (code === "TEAM_GONE") return "This invitation has expired or was revoked.";
  if (code === "TEAM_FORBIDDEN") return "You cannot perform this team action. Check the account email.";
  if (code === "TEAM_CONFLICT") return "The team changed or has no room. Refresh and try again.";
  if (code === "TEAM_RATE_LIMIT") return "Too many invitations. Try again later.";
  const message = error instanceof Error ? error.message : "";
  if (!message || message.startsWith("TEAM_")) return message || fallback;
  if (/expired|revoked/i.test(message)) return "This invitation has expired or was revoked.";
  if (/forbidden|permission|not allowed/i.test(message)) return "You cannot perform this team action.";
  if (/conflict|seat|changed/i.test(message)) return "The team changed or has no room. Refresh and try again.";
  if (/unavailable|temporarily unavailable|could not|couldn’t/i.test(message)) return message;
  return fallback;
}
