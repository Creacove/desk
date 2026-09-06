import { useCallback, useEffect, useLayoutEffect, useState } from "react";

import {
  FrontDoorAuthScreen,
  FrontDoorMessageScreen,
  FrontDoorTransitionScreen,
} from "../onboarding/FrontDoorAuth";
import type { WorkspaceTeamService } from "../../services/workspaceTeamService";
import { ACTIVE_WORKSPACE_STORAGE_KEY, consumeTeamInviteToken, TEAM_INVITE_TOKEN_STORAGE_KEY } from "../../services/teamInviteRoute";
import type { ProductionAuthAdapter, ProductionUser } from "../../types/productionApp";
import { AcceptTeamInvitation } from "./AcceptTeamInvitation";

export function TeamJoinRoute({
  service,
  authAdapter,
}: {
  service: Pick<WorkspaceTeamService, "acceptInvitation">;
  authAdapter: ProductionAuthAdapter;
}) {
  const [user, setUser] = useState<ProductionUser | null | undefined>(undefined);
  const [authError, setAuthError] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [cancelled, setCancelled] = useState(false);

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
    try {
      const token = consumeTeamInviteToken(window.location, window.history);
      if (token) window.sessionStorage.setItem(TEAM_INVITE_TOKEN_STORAGE_KEY, token);
    } catch {
      // The invitation component will render a safe missing-link state if storage is unavailable.
    }
    void refreshSession();
  }, [refreshSession]);

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
    return <FrontDoorAuthScreen authAdapter={authAdapter} onAuthenticated={refreshSession} />;
  }

  return (
    <AcceptTeamInvitation
      service={service}
      user={user}
      onAuthenticationRequired={() => setShowAuth(true)}
      onCancel={() => setCancelled(true)}
      onAccepted={(scope) => {
        window.sessionStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, scope.artistWorkspaceId);
        window.location.replace("/");
      }}
    />
  );
}
