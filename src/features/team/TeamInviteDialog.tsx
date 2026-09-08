import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Link2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button, IconButton } from "../../design-system/desktopPrimitives";
import { createTeamInviteLink } from "../../services/teamInviteRoute";
import type { TeamInvitationDeliveryStatus, TeamInvitationMutation, TeamResponsibilities } from "../../types/workspaceTeam";
import { TeamRolePicker } from "./TeamRolePicker";

type InviteDraft = TeamResponsibilities & { email: string };

export type TeamInviteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamName: string;
  artistName: string;
  remainingSeats: number;
  onInvite: (input: InviteDraft) => Promise<TeamInvitationMutation>;
  onInviteCreated?: (result: TeamInvitationMutation, link: string) => void;
  onDone?: () => void;
};

const emptyResponsibilities: TeamResponsibilities = { operatingTitle: null, responsibilityTags: [] };

export function TeamInviteDialog({
  open,
  onOpenChange,
  teamName,
  artistName,
  remainingSeats,
  onInvite,
  onInviteCreated,
  onDone,
}: TeamInviteDialogProps) {
  const emailRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  const [draft, setDraft] = useState<InviteDraft>({ email: "", ...emptyResponsibilities });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ mutation: TeamInvitationMutation; link: string } | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (open && !wasOpen.current) resetForm();
    wasOpen.current = open;
  }, [open]);

  function resetForm() {
    setDraft({ email: "", ...emptyResponsibilities });
    setDetailsOpen(false);
    setPending(false);
    setError(null);
    setResult(null);
    setCopyStatus(null);
  }

  function close() {
    if (!pending) onOpenChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (remainingSeats <= 0) return;
    const email = draft.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter the email for the person you want to invite.");
      return;
    }
    try {
      setPending(true);
      setError(null);
      const mutation = await onInvite({
        email,
        operatingTitle: draft.operatingTitle?.trim() || null,
        responsibilityTags: [...new Set(draft.responsibilityTags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12),
      });
      const link = createTeamInviteLink(typeof window === "undefined" ? "" : window.location.origin, mutation.token);
      setResult({ mutation, link });
      onInviteCreated?.(mutation, link);
    } catch (inviteError) {
      setError(readInviteError(inviteError));
    } finally {
      setPending(false);
    }
  }

  async function copyLink() {
    if (!result) return;
    try {
      await navigator.clipboard?.writeText(result.link);
      setCopyStatus("Copied.");
    } catch {
      setCopyStatus("Copy failed. Select the link and copy it manually.");
    }
  }

  const deliveryStatus = result?.mutation.emailStatus ?? "skipped";

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-foreground/25 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out motion-reduce:animate-none" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            emailRef.current?.focus();
          }}
          className="fixed inset-x-3 bottom-3 z-[81] max-h-[min(88svh,44rem)] overflow-y-auto rounded-[20px] border border-foreground/10 bg-background p-5 text-foreground shadow-[0_32px_90px_rgba(17,19,24,0.24)] outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom-3 motion-reduce:animate-none sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:w-[min(calc(100vw-2rem),28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[18px] sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.025em]">{result ? "Invitation ready" : "Invite someone"}</Dialog.Title>
              <Dialog.Description className="mt-1 text-[12px] font-medium text-muted-foreground">
                {result ? `${teamName} · ${artistName}` : `Join ${teamName} for ${artistName}.`}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label="Close invite dialog" size="md" variant="ghost" disabled={pending}>
                <X className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </Dialog.Close>
          </div>

          {result ? (
            <InviteResult deliveryStatus={deliveryStatus} email={result.mutation.invitation.email} link={result.link} copyStatus={copyStatus} onCopy={() => void copyLink()} onDone={() => { close(); onDone?.(); }} onInviteAnother={resetForm} />
          ) : (
            <form className="mt-6 grid gap-4" aria-label="Invite teammate" onSubmit={submit}>
              {remainingSeats <= 0 ? (
                <p className="rounded-[12px] bg-foreground/[0.04] px-3 py-2.5 text-[12px] font-semibold text-muted-foreground">All seats are filled.</p>
              ) : null}
              <label className="grid gap-2 text-[11px] font-semibold text-foreground" htmlFor="team-invite-dialog-email">
                Email address
                <input
                  ref={emailRef}
                  id="team-invite-dialog-email"
                  aria-label="Email address"
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  autoComplete="email"
                  required
                  disabled={pending || remainingSeats <= 0}
                  className="h-11 rounded-[9px] border border-foreground/12 bg-background px-3 text-[13px] font-medium outline-none transition-colors placeholder:text-muted-foreground/48 focus:border-brand-accent/55 focus:ring-2 focus:ring-brand-accent/10 disabled:opacity-55"
                  placeholder="teammate@example.com"
                />
              </label>

              {!detailsOpen ? (
                <button type="button" onClick={() => setDetailsOpen(true)} disabled={pending || remainingSeats <= 0} className="inline-flex w-fit items-center gap-1.5 rounded-[8px] px-1 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-foreground/[0.045] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25 disabled:pointer-events-none disabled:opacity-45">
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Add role details
                </button>
              ) : (
                <TeamRolePicker
                  key="team-invite-role-details"
                  value={{ operatingTitle: draft.operatingTitle, responsibilityTags: draft.responsibilityTags }}
                  onChange={(next) => setDraft((current) => ({ ...current, ...next }))}
                  disabled={pending}
                  titleLabel="Their role"
                  responsibilitiesLabel="What they handle"
                  detailsInitiallyOpen
                />
              )}

              {error ? <p role="alert" className="text-[12px] font-semibold text-destructive">{error}</p> : null}
              <div className="flex items-center justify-between gap-3 border-t border-foreground/8 pt-4">
                <p className="text-[11px] font-medium text-muted-foreground">{remainingSeats} {remainingSeats === 1 ? "seat" : "seats"} left</p>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={close} disabled={pending}>Cancel</Button>
                  <Button type="submit" size="sm" pending={pending} disabled={pending || remainingSeats <= 0}>Send invitation</Button>
                </div>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InviteResult({
  deliveryStatus,
  email,
  link,
  copyStatus,
  onCopy,
  onDone,
  onInviteAnother,
}: {
  deliveryStatus: TeamInvitationDeliveryStatus;
  email: string;
  link: string;
  copyStatus: string | null;
  onCopy: () => void;
  onDone: () => void;
  onInviteAnother: () => void;
}) {
  const failed = deliveryStatus === "failed";
  const title = failed ? "Invite created, but the email did not send" : deliveryStatus === "sent" ? `Invitation sent to ${email}` : "Invite link ready";
  const body = failed ? "Copy the link and send it another way." : deliveryStatus === "sent" ? "They can use the email to join." : "Copy the link and send it to them.";

  return (
    <div className="mt-6" aria-live="polite">
      <div className="flex items-start gap-2.5 border-y border-foreground/8 py-4">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">{body}</p>
        </div>
      </div>
      {failed ? (
        <div className="mt-4 grid gap-2">
          <input aria-label="Invite link" value={link} readOnly className="h-10 min-w-0 rounded-[9px] border border-foreground/10 bg-background px-3 text-[11px] font-medium text-foreground outline-none" />
          <Button type="button" size="sm" onClick={onCopy} leadingIcon={<Copy className="h-3.5 w-3.5" aria-hidden="true" />}>Copy invite link</Button>
          {copyStatus ? <p role="status" className="text-[11px] font-semibold text-brand-accent">{copyStatus}</p> : null}
        </div>
      ) : null}
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onInviteAnother}>Invite another</Button>
        <Button type="button" size="sm" onClick={onDone}>Done</Button>
      </div>
    </div>
  );
}

function readInviteError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/seat|conflict|changed/i.test(message)) return "The team changed or has no room. Refresh and try again.";
  if (/rate/i.test(message)) return "Too many invitations. Try again later.";
  return message || "The invitation could not be created. Try again.";
}
