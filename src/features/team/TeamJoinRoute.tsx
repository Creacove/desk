import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import { BrandMark } from "../../design-system/components";
import { Button } from "../../design-system/desktopPrimitives";
import {
  FrontDoorAuthScreen,
  FrontDoorMessageScreen,
  FrontDoorTransitionScreen,
} from "../onboarding/FrontDoorAuth";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import { ACTIVE_WORKSPACE_STORAGE_KEY, consumeTeamInviteToken, createTeamInviteLink, TEAM_INVITE_TOKEN_STORAGE_KEY } from "../../services/teamInviteRoute";
import type { ProductionAuthAdapter, ProductionUser } from "../../types/productionApp";
import type { TeamInvitationPreview, WorkspaceScope } from "../../types/workspaceTeam";
import { AcceptTeamInvitation } from "./AcceptTeamInvitation";

export function TeamJoinRoute({
  service,
  authAdapter,
  onAccepted,
}: {
  service: Pick<WorkspaceTeamService, "acceptInvitation"> & Partial<Pick<WorkspaceTeamService, "previewInvitation">>;
  authAdapter: ProductionAuthAdapter;
  onAccepted?: (scope: WorkspaceScope) => void;
}) {
  const [user, setUser] = useState<ProductionUser | null | undefined>(undefined);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<TeamInvitationPreview | null>(null);
  const [authError, setAuthError] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [acceptedScope, setAcceptedScope] = useState<WorkspaceScope | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authAdapter.getSession();
      setUser(session.user);
      setAuthError(false);
      setShowAuth(false);
    } catch {
      setAuthError(true);
    }
  }, [authAdapter]);

  useLayoutEffect(() => {
    let cancelled = false;
    let nextToken: string | null = null;
    try {
      nextToken = consumeTeamInviteToken(window.location, window.history);
      if (nextToken) window.sessionStorage.setItem(TEAM_INVITE_TOKEN_STORAGE_KEY, nextToken);
      nextToken = nextToken ?? window.sessionStorage.getItem(TEAM_INVITE_TOKEN_STORAGE_KEY);
    } catch {
      // The invitation component will render a safe missing-link state if storage is unavailable.
    }
    setInviteToken(nextToken);
    if (nextToken && service.previewInvitation) {
      void service.previewInvitation(nextToken)
        .then((nextPreview) => {
          if (!cancelled) setPreview(nextPreview);
        })
        .catch(() => {
          if (!cancelled) setPreview(null);
        });
    }
    void refreshSession();
    return () => { cancelled = true; };
  }, [refreshSession, service]);

  if (cancelled) {
    return <FrontDoorMessageScreen title="Invitation closed" body="Open the invitation link again when you’re ready to join." />;
  }
  if (user === undefined) return <FrontDoorTransitionScreen title="Preparing invitation" />;
  if (authError) {
    return (
      <FrontDoorMessageScreen
        title="Couldn’t open invitation"
        body="Try again. Your invitation link is still in this tab."
        action={<button type="button" className="font-semibold text-foreground underline underline-offset-4" onClick={() => { setAuthError(false); void refreshSession(); }}>Retry</button>}
      />
    );
  }
  if (showAuth) {
    return (
      <FrontDoorAuthScreen
        authAdapter={authAdapter}
        onAuthenticated={refreshSession}
        invitation={preview && inviteToken ? { preview, emailRedirectTo: createTeamInviteLink(window.location.origin, inviteToken) } : undefined}
      />
    );
  }
  if (acceptedScope) {
    return (
      <MemberArrival
        preview={preview}
        onOpenToday={() => window.location.replace("/?view=labelHQ")}
      />
    );
  }

  return (
    <AcceptTeamInvitation
      service={service}
      user={user}
      preview={preview}
      onAuthenticationRequired={() => setShowAuth(true)}
      onCancel={() => setCancelled(true)}
      onAccepted={(scope) => {
        try {
          window.sessionStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, scope.artistWorkspaceId);
        } catch {
          // The workspace loader can still resolve membership if storage is unavailable.
        }
        setAcceptedScope(scope);
        onAccepted?.(scope);
      }}
    />
  );
}

function MemberArrival({ preview, onOpenToday }: { preview: TeamInvitationPreview | null; onOpenToday: () => void }) {
  return (
    <main className="app-theme flex min-h-screen items-center justify-center bg-background px-5 py-12 text-foreground">
      <div className="w-full max-w-[28rem]">
        <div className="mb-10 flex items-center gap-2.5">
          <BrandMark size="sm" />
          <span className="font-display text-[17px] font-semibold tracking-[-0.025em] text-foreground">Desk</span>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-accent">Team joined</p>
        <h1 className="mt-3 font-display text-[36px] font-semibold leading-none tracking-[-0.04em]">You&rsquo;re in.</h1>
        {preview ? (
          <div className="mt-7 border-y border-foreground/8 py-5">
            <p className="font-display text-[22px] font-semibold tracking-[-0.025em]">{preview.artistName}</p>
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">{preview.teamName}</p>
            {preview.operatingTitle ? (
              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Desk knows you as</p>
                <p className="mt-1 text-[14px] font-semibold">{preview.operatingTitle}</p>
              </div>
            ) : null}
            {preview.responsibilityTags.length ? (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">You handle</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.responsibilityTags.map((tag) => <span key={tag} className="rounded-md bg-foreground/[0.05] px-2 py-1 text-[11px] font-medium">{tag}</span>)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <p className="mt-5 text-[13px] font-medium leading-relaxed text-muted-foreground">Desk will put work that needs you in Today.</p>
        <Button className="mt-7" onClick={onOpenToday}>Open Today</Button>
      </div>
    </main>
  );
}
