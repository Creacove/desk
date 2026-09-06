import { Check, Copy, Link2, Pencil, RefreshCw, RotateCw, UserMinus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Badge, Field } from "../../design-system/components";
import { Button, SkeletonBlock, Surface } from "../../design-system/desktopPrimitives";
import { cn } from "../../lib/utils";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import { createTeamInviteLink } from "../../services/teamInviteRoute";
import { MemberResponsibilitiesForm, type MemberResponsibilitiesDraft } from "./MemberResponsibilitiesForm";
import type {
  TeamInvitation,
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
  const [inviteDraft, setInviteDraft] = useState({ email: "", operatingTitle: "", responsibilityTags: "" });
  const [invitePending, setInvitePending] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteLinkStatus, setInviteLinkStatus] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [responsibilityDrafts, setResponsibilityDrafts] = useState<Record<string, MemberResponsibilitiesDraft>>({});
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
        if (loadRequestRef.current === requestId) setError({ scope: "load", message: safeTeamError(invitationError, "Your team invitations could not load.") });
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
  }

  if (!teamAccessActive) {
    return (
      <section data-testid="your-team-panel" className="w-full">
        <TeamHeading artistName={artistName} />
        <div className="border-t border-foreground/8 py-6">
          <p className="text-[13px] font-medium text-muted-foreground">Team access is unavailable for this workspace.</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground/75">Ask the workspace owner to restore Team access.</p>
        </div>
      </section>
    );
  }

  if (loading && !roster) {
    return <TeamLoadingState />;
  }

  if (error?.scope === "load" && !roster) {
    return (
      <section data-testid="your-team-panel" className="w-full">
        <TeamHeading artistName={artistName} />
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
    const responsibilities = parseResponsibilities(inviteDraft.operatingTitle, inviteDraft.responsibilityTags);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError({ scope: "invite", message: "Enter a valid email address." });
      return;
    }
    if (!responsibilities.valid) {
      setError({ scope: "invite", message: responsibilities.message });
      return;
    }
    try {
      setInvitePending(true);
      const response = await service.invite({
        artistWorkspaceId: scope.artistWorkspaceId,
        email,
        ...responsibilities.value,
      });
      const link = createTeamInviteLink(window.location.origin, response.token);
      setInviteLink(link);
      setInviteLinkStatus("Invite link ready.");
      setMutationNotice("Invite link created.");
      setInvitations((current) => [response.invitation, ...current.filter((item) => item.id !== response.invitation.id)]);
      setCurrentCapability((current) => ({ ...current, reservedSeats: current.reservedSeats + 1 }));
      setInviteDraft({ email: "", operatingTitle: "", responsibilityTags: "" });
    } catch (inviteError) {
      setError({ scope: "invite", message: safeTeamError(inviteError, "Invite link could not be created.") });
    } finally {
      setInvitePending(false);
    }
  }

  async function rotateInvitation(invitation: TeamInvitation) {
    clearMessages();
    try {
      const response = await service.rotateInvitation(invitation.id);
      setInviteLink(createTeamInviteLink(window.location.origin, response.token));
      setInviteLinkStatus("Invite link rotated.");
      setInvitations((current) => current.map((item) => item.id === invitation.id ? response.invitation : item));
    } catch (rotateError) {
      setMutationError(safeTeamError(rotateError, "Invite link could not be rotated."));
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
      setMutationError(safeTeamError(revokeError, "Invitation could not be revoked."));
    }
  }

  function beginEdit(memberToEdit: WorkspaceMember) {
    clearMessages();
    setEditingMemberId(memberToEdit.userId);
    setResponsibilityDrafts((current) => ({
      ...current,
      [memberToEdit.userId]: {
        operatingTitle: memberToEdit.operatingTitle ?? "",
        responsibilityTags: memberToEdit.responsibilityTags.join(", "),
      },
    }));
  }

  async function saveResponsibilities(memberToEdit: WorkspaceMember) {
    const draft = responsibilityDrafts[memberToEdit.userId] ?? { operatingTitle: "", responsibilityTags: "" };
    const responsibilities = parseResponsibilities(draft.operatingTitle, draft.responsibilityTags);
    if (!responsibilities.valid) {
      setMutationError(responsibilities.message);
      return;
    }
    try {
      setSavingMemberId(memberToEdit.userId);
      setMutationError(null);
      await service.updateResponsibilities({
        artistWorkspaceId: scope.artistWorkspaceId,
        memberUserId: memberToEdit.userId,
        ...responsibilities.value,
      });
      setRoster((current) => current ? {
        ...current,
        members: current.members.map((memberItem) => memberItem.userId === memberToEdit.userId
          ? { ...memberItem, ...responsibilities.value }
          : memberItem),
      } : current);
      setEditingMemberId(null);
      await onRosterChanged?.();
      setMutationNotice(`${memberToEdit.displayName}'s responsibilities were saved.`);
    } catch (saveError) {
      setMutationError(safeTeamError(saveError, "Responsibilities could not be saved."));
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
      <TeamHeading artistName={artistName} countLabel={`${currentCapability.occupiedSeats} of ${seatLimit} people`} />

      <div className="grid gap-3 border-t border-foreground/8 py-5 sm:grid-cols-2" aria-label="Team seat summary">
        <SeatSummary label="Occupied" value={currentCapability.occupiedSeats} detail="Active owners and members" />
        <SeatSummary label="Reserved" value={currentCapability.reservedSeats} detail="Pending invite links" />
      </div>

      {error ? <p role="alert" className="mb-4 text-[12px] font-medium text-destructive">{error.message}</p> : null}
      {mutationError ? <p role="alert" className="mb-4 text-[12px] font-medium text-destructive">{mutationError}</p> : null}
      {mutationNotice ? <p role="status" className="mb-4 text-[12px] font-semibold text-brand-accent">{mutationNotice}</p> : null}

      <section aria-labelledby="team-members-heading">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-foreground/8 pb-3">
          <div>
            <h3 id="team-members-heading" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">People</h3>
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">Everyone here shares {artistName}’s workspace.</p>
          </div>
          {!isOwner ? <p className="text-[12px] font-medium text-muted-foreground">Only the workspace owner can manage team access.</p> : null}
        </div>

        <div className="divide-y divide-foreground/8">
          {roster.members.map((memberItem) => {
            const draft = responsibilityDrafts[memberItem.userId] ?? { operatingTitle: memberItem.operatingTitle ?? "", responsibilityTags: memberItem.responsibilityTags.join(", ") };
            const editing = editingMemberId === memberItem.userId;
            const isRemoving = removingMemberId === memberItem.userId;
            const isCurrentViewer = memberItem.userId === viewerUserId;
            return (
              <div key={memberItem.userId} className="py-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[16px] font-semibold text-foreground">{memberItem.displayName}</p>
                      <Badge active={memberItem.accessRole === "owner"}>{memberItem.accessRole === "owner" ? "Owner" : "Member"}</Badge>
                      {isCurrentViewer ? <span className="text-[11px] font-semibold text-muted-foreground">You</span> : null}
                    </div>
                    <p className="mt-1 text-[13px] font-semibold text-foreground/78">{memberItem.operatingTitle || "Responsibilities to be set"}</p>
                    {memberItem.responsibilityTags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {memberItem.responsibilityTags.map((tag) => <span key={`${memberItem.userId}-${tag}`} className="rounded-md bg-foreground/[0.045] px-2 py-1 text-[11px] font-medium text-muted-foreground">{tag}</span>)}
                      </div>
                    ) : null}
                  </div>
                  {isOwner ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="ghost" size="sm" aria-label={editing ? undefined : `Edit responsibilities for ${memberItem.displayName}`} onClick={() => editing ? setEditingMemberId(null) : beginEdit(memberItem)} leadingIcon={editing ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Pencil className="h-3.5 w-3.5" aria-hidden="true" />}>
                        {editing ? "Cancel" : "Edit"}
                      </Button>
                      {memberItem.accessRole === "owner" ? (
                        <span className="text-[11px] font-semibold text-muted-foreground">Protected owner</span>
                      ) : confirmingRemovalId === memberItem.userId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">Their open work will need a new owner.</span>
                          <Button type="button" variant="destructive" size="sm" pending={isRemoving} onClick={() => void removeMember(memberItem)} aria-label={`Confirm removal of ${memberItem.displayName}`}>Confirm removal</Button>
                          <Button type="button" variant="ghost" size="sm" disabled={isRemoving} onClick={() => setConfirmingRemovalId(null)}>Keep member</Button>
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
                    onChange={(field, value) => setResponsibilityDrafts((current) => ({ ...current, [memberItem.userId]: { ...draft, [field]: value } }))}
                    onSave={() => void saveResponsibilities(memberItem)}
                    onCancel={() => setEditingMemberId(null)}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {isOwner ? (
        <section aria-labelledby="team-invitations-heading" className="mt-8 border-t border-foreground/8 pt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 id="team-invitations-heading" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">Pending invitations</h3>
              <p className="mt-1 text-[12px] font-medium text-muted-foreground">Link based onboarding keeps delivery in your hands.</p>
            </div>
            <span className="text-[12px] font-semibold text-muted-foreground">{pendingInvitations.length} pending</span>
          </div>

          {pendingInvitations.length ? (
            <div className="mt-3 divide-y divide-foreground/8 rounded-[14px] border border-foreground/8">
              {pendingInvitations.map((invitation) => (
                <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground">{invitation.email}</p>
                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">{invitation.status === "expired" ? "Expired" : `Expires ${formatDate(invitation.expiresAt)}`}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => void rotateInvitation(invitation)} leadingIcon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />} aria-label={`Rotate link for ${invitation.email}`}>Rotate link</Button>
                    {invitation.status === "pending" ? <Button type="button" variant="ghost" size="sm" onClick={() => void revokeInvitation(invitation)} aria-label={`Revoke invitation for ${invitation.email}`}>Revoke</Button> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 rounded-[14px] border border-dashed border-foreground/12 px-3.5 py-4 text-[12px] font-medium text-muted-foreground">No pending invitations.</p>}
        </section>
      ) : null}

      {isOwner ? (
        <section aria-labelledby="team-invite-heading" className="mt-8 border-t border-foreground/8 pt-6">
          <div>
            <h3 id="team-invite-heading" className="font-display text-[20px] font-semibold tracking-[-0.02em] text-foreground">Add someone</h3>
            <p className="mt-1 text-[12px] font-medium text-muted-foreground">Create a private link to share directly. No email is sent from Desk.</p>
          </div>
          {seatsFull ? (
            <p className="mt-4 rounded-[14px] bg-foreground/[0.035] px-3.5 py-3 text-[12px] font-semibold text-muted-foreground">All {seatLimit} seats are occupied or reserved.</p>
          ) : (
            <form className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Invite someone" onSubmit={submitInvite}>
              <Field label="Invite email" value={inviteDraft.email} onChange={(value) => setInviteDraft((current) => ({ ...current, email: value }))} type="email" autoComplete="email" required disabled={invitePending} />
              <Field label="Operating title" value={inviteDraft.operatingTitle} onChange={(value) => setInviteDraft((current) => ({ ...current, operatingTitle: value }))} helper="Optional · up to 80 characters" disabled={invitePending} />
              <div className="sm:col-span-2">
                <Field label="Responsibility tags" value={inviteDraft.responsibilityTags} onChange={(value) => setInviteDraft((current) => ({ ...current, responsibilityTags: value }))} helper="Optional · comma separated · up to 12 tags" disabled={invitePending} />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                <Button type="submit" pending={invitePending} leadingIcon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />}>Create invite link</Button>
                <span className="text-[11px] font-medium text-muted-foreground">{seatLimit - currentCapability.occupiedSeats - currentCapability.reservedSeats} seats available</span>
              </div>
            </form>
          )}

          {inviteLink ? (
            <div className="mt-4 rounded-[14px] border border-brand-accent/18 bg-brand-accent/[0.04] p-3.5">
              <div className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">Invite link ready</p>
                  <p className="mt-1 text-[12px] font-medium text-muted-foreground">Copy this link and share it with the person you want to join.</p>
                </div>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap gap-2 sm:flex-nowrap">
                <input aria-label="Invite link" value={inviteLink} readOnly className="min-h-10 min-w-0 flex-1 rounded-[10px] border border-foreground/10 bg-background px-3 text-[12px] font-medium text-foreground outline-none focus:border-brand-accent/45 focus:ring-2 focus:ring-brand-accent/8" />
                <Button type="button" variant="secondary" size="sm" aria-label="Copy invite link" onClick={() => void copyInviteLink()} leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}>Copy link</Button>
              </div>
              {inviteLinkStatus ? <p role="status" className="mt-2 text-[11px] font-semibold text-brand-accent">{inviteLinkStatus}</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {loading ? <p className="mt-5 text-[12px] font-medium text-muted-foreground">Refreshing team details…</p> : null}
    </section>
  );
}

function TeamHeading({ artistName, countLabel }: { artistName: string; countLabel?: string }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-ui text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/72">Team</p>
          <h2 className="mt-1 font-display text-[26px] font-semibold tracking-[-0.025em] text-foreground">Your team</h2>
        </div>
        {countLabel ? <p className="text-[13px] font-semibold text-brand-accent">{countLabel}</p> : null}
      </div>
      <p className="mt-2 text-[13px] font-medium text-muted-foreground">One shared workspace for {artistName}.</p>
    </div>
  );
}

function SeatSummary({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <Surface className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/72">{label}</p>
        <p className="mt-1 font-display text-[22px] font-semibold tracking-[-0.02em] text-foreground">
          <span className="sr-only">{value} {label.toLowerCase()}</span>
          {value}
        </p>
      </div>
      <p className="max-w-[12rem] text-right text-[11px] font-medium leading-relaxed text-muted-foreground">{detail}</p>
    </Surface>
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
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-20 w-full" />
        </div>
      </div>
    </section>
  );
}

function parseResponsibilities(operatingTitle: string, tagsText: string): { valid: true; value: TeamResponsibilities } | { valid: false; message: string } {
  const title = operatingTitle.trim();
  if (title.length > MAX_TITLE_LENGTH) return { valid: false, message: "Operating title must be 80 characters or fewer." };
  const tags = [...new Set(tagsText.split(",").map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > MAX_TAGS) return { valid: false, message: "Use 12 responsibility tags or fewer." };
  if (tags.some((tag) => tag.length > MAX_TAG_LENGTH)) return { valid: false, message: "Each responsibility tag must be 48 characters or fewer." };
  return { valid: true, value: { operatingTitle: title || null, responsibilityTags: tags } };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "later";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function safeTeamError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message || message.startsWith("TEAM_") || /unavailable|temporarily unavailable|could not|couldn’t/i.test(message)) return message || fallback;
  if (/expired|revoked/i.test(message)) return "This invitation has expired or was revoked.";
  if (/forbidden|permission|not allowed/i.test(message)) return "You cannot perform this team action.";
  if (/conflict|seat|changed/i.test(message)) return "The team changed. Refresh and try again.";
  return fallback;
}
