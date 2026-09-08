import { Check, Link2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import { consumeTeamInviteToken, TEAM_INVITE_TOKEN_STORAGE_KEY } from "../../services/teamInviteRoute";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import type { TeamInvitationPreview, WorkspaceScope } from "../../types/workspaceTeam";
import type { ProductionUser } from "../../types/productionApp";

export type AcceptTeamInvitationProps = {
  service: Pick<WorkspaceTeamService, "acceptInvitation">;
  user: ProductionUser | null;
  preview?: TeamInvitationPreview | null;
  onAccepted?: (scope: WorkspaceScope) => void;
  onCancel?: () => void;
  storage?: Storage;
  location?: Pick<Location, "hash" | "pathname" | "search">;
  history?: Pick<History, "replaceState">;
};

export function AcceptTeamInvitation({
  service,
  user,
  preview,
  onAccepted,
  onCancel,
  storage = typeof window === "undefined" ? undefined : window.sessionStorage,
  location = typeof window === "undefined" ? undefined : window.location,
  history = typeof window === "undefined" ? undefined : window.history,
}: AcceptTeamInvitationProps) {
  const [token, setToken] = useState<string | null>(null);
  const [routeReady, setRouteReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    let nextToken: string | null = null;
    try {
      if (location && history) nextToken = consumeTeamInviteToken(location, history);
      if (nextToken) storage?.setItem(TEAM_INVITE_TOKEN_STORAGE_KEY, nextToken);
      nextToken = nextToken ?? storage?.getItem(TEAM_INVITE_TOKEN_STORAGE_KEY) ?? null;
    } catch {
      nextToken = null;
    }
    setToken(nextToken);
    setRouteReady(true);
  }, [history, location, storage]);

  useEffect(() => {
    if (!routeReady || !token || !user || acceptedRef.current) return;
    let cancelled = false;
    setPending(true);
    setError(null);
    void service.acceptInvitation(token)
      .then((scope) => {
        if (cancelled) return;
        acceptedRef.current = true;
        storage?.removeItem(TEAM_INVITE_TOKEN_STORAGE_KEY);
        setToken(null);
        setAccepted(true);
        onAccepted?.(scope);
      })
      .catch((acceptError) => {
        if (cancelled) return;
        const code = readTeamErrorCode(acceptError);
        if (code === "TEAM_GONE") {
          storage?.removeItem(TEAM_INVITE_TOKEN_STORAGE_KEY);
          setToken(null);
        }
        setError(invitationErrorMessage(code));
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => { cancelled = true; };
  }, [onAccepted, routeReady, service, storage, token, user]);

  if (!routeReady) return <JoinFrame><JoinStatus icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} title="Preparing invitation" body="Securing this invitation link…" /></JoinFrame>;
  if (accepted) return <JoinFrame><JoinStatus icon={<Check className="h-5 w-5" aria-hidden="true" />} title="You're in" body="Opening Today for your shared artist workspace." /></JoinFrame>;
  if (!token && error) {
    return (
      <JoinFrame>
        <JoinStatus icon={<Link2 className="h-5 w-5" aria-hidden="true" />} title="Invitation could not be accepted" body="Try again with a new invitation link from the workspace owner." />
        <p role="alert" className="mt-6 rounded-[12px] bg-destructive/5 px-3.5 py-3 text-[12px] font-medium text-destructive">{error}</p>
        {onCancel ? <Button variant="secondary" className="mt-6" onClick={onCancel}>Back</Button> : null}
      </JoinFrame>
    );
  }
  if (!token) {
    return (
      <JoinFrame>
        <JoinStatus icon={<Link2 className="h-5 w-5" aria-hidden="true" />} title="Invitation link missing" body="Open the full invitation link again to join this workspace." />
        {onCancel ? <Button variant="secondary" className="mt-7" onClick={onCancel}>Back</Button> : null}
      </JoinFrame>
    );
  }
  if (!user) {
    return (
      <JoinFrame>
        <JoinStatus icon={<Link2 className="h-5 w-5" aria-hidden="true" />} title="Invitation ready" body="Continue with the invitation sign-in screen to join this workspace." />
        {onCancel ? <Button variant="secondary" className="mt-7" onClick={onCancel}>Cancel</Button> : null}
      </JoinFrame>
    );
  }

  return (
    <JoinFrame>
      {preview ? <InvitationPreviewCard preview={preview} /> : null}
      <JoinStatus icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} title="Joining workspace" body="Checking your verified account and opening the shared artist workspace…" />
      {pending ? <p className="sr-only" role="status">Joining workspace</p> : null}
      {error ? <p role="alert" className="mt-6 rounded-[12px] bg-destructive/5 px-3.5 py-3 text-[12px] font-medium text-destructive">{error}</p> : null}
      {onCancel ? <Button variant="secondary" className="mt-6" onClick={() => { storage?.removeItem(TEAM_INVITE_TOKEN_STORAGE_KEY); setToken(null); onCancel(); }}>Cancel</Button> : null}
    </JoinFrame>
  );
}

function JoinFrame({ children }: { children: ReactNode }) {
  return (
    <main className="app-theme flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-[28rem]">
        <div className="mb-10 flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">Desk</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function JoinStatus({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <section aria-live="polite">
      <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-[12px] bg-foreground/[0.05] text-foreground">{icon}</div>
      <h1 className="font-display text-[32px] font-semibold leading-[1] tracking-[-0.035em] text-foreground">{title}</h1>
      <p className="mt-3 max-w-sm text-[13px] font-medium leading-relaxed text-muted-foreground/72">{body}</p>
    </section>
  );
}

function InvitationPreviewCard({ preview }: { preview: TeamInvitationPreview }) {
  return (
    <div aria-label="Invitation details" className="mb-7 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] px-3.5 py-3 text-[12px] font-medium text-muted-foreground">
      <p className="font-semibold text-foreground">{preview.teamName}</p>
      <p className="mt-1">Artist: {preview.artistName}</p>
      {preview.operatingTitle ? (
        <>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/72">Role</p>
          <p className="mt-0.5 text-foreground">{preview.operatingTitle}</p>
        </>
      ) : null}
      {preview.responsibilityTags.length ? (
        <>
          <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/72">Responsibilities</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {preview.responsibilityTags.map((tag) => <span key={tag} className="rounded-md bg-foreground/[0.045] px-2 py-1 text-[11px] text-foreground">{tag}</span>)}
          </div>
        </>
      ) : null}
      <p className="mt-1">Expires {formatExpiry(preview.expiresAt)}</p>
    </div>
  );
}

function formatExpiry(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function readTeamErrorCode(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (/^TEAM_[A-Z_]+$/.test(code)) return code;
  const message = error instanceof Error ? error.message : "";
  return message.match(/\bTEAM_[A-Z_]+\b/)?.[0] ?? "TEAM_UNAVAILABLE";
}

function invitationErrorMessage(code: string) {
  if (code === "TEAM_GONE") return "This invitation has expired or was revoked.";
  if (code === "TEAM_FORBIDDEN") return "This invitation belongs to a different verified account.";
  if (code === "TEAM_CONFLICT") return "The team changed while you were joining. Try the invitation again.";
  return "This invitation could not be accepted. Try again or ask the workspace owner for a new link.";
}
