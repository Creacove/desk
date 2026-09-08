import { useCallback, useEffect, useLayoutEffect, useState } from "react";

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
  onNavigateToDesk,
}: {
  service: Pick<WorkspaceTeamService, "acceptInvitation"> & Partial<Pick<WorkspaceTeamService, "previewInvitation">>;
  authAdapter: ProductionAuthAdapter;
  onAccepted?: (scope: WorkspaceScope) => void;
  onNavigateToDesk?: () => void;
}) {
  const [user, setUser] = useState<ProductionUser | null | undefined>(undefined);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [preview, setPreview] = useState<TeamInvitationPreview | null>(null);
  const [authError, setAuthError] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const refreshSession = useCallback(async () => {
    try {
      const session = await authAdapter.getSession();
      setUser(session.user);
      setAuthError(false);
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
  if (redirecting) {
    return <FrontDoorTransitionScreen title="Opening Desk" />;
  }
  if (!user && inviteToken && preview) {
    return (
      <FrontDoorAuthScreen
        authAdapter={authAdapter}
        onAuthenticated={refreshSession}
        invitation={{ preview, invitedEmail: preview.invitedEmail, emailRedirectTo: createTeamInviteLink(window.location.origin, inviteToken) }}
      />
    );
  }

  return (
    <AcceptTeamInvitation
      service={service}
      user={user}
      preview={preview}
      onCancel={() => setCancelled(true)}
      onAccepted={(scope) => {
        try {
          window.sessionStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, scope.artistWorkspaceId);
        } catch {
          // The workspace loader can still resolve membership if storage is unavailable.
        }
        onAccepted?.(scope);
        setRedirecting(true);
        (onNavigateToDesk ?? (() => window.location.replace("/?view=labelHQ")))();
      }}
    />
  );
}
