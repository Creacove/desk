import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, CreditCard, Loader2, X } from "lucide-react";
import { BorderBeam } from "border-beam";
import { AppThinkingOrb } from "../design-system/AppThinkingOrb";
import { BrandMark, DeskRail, Field, MobileChrome, ProductButton, sectionForView } from "../design-system/components";
import { splitAttentionItems } from "../features/desk/deskAttention";
import { DeskHQScreen } from "../features/desk/DeskHQ";
import { ProductionDrawers } from "../features/drawers/ProductionDrawers";
import {
  activityCursorKey,
  countUnreadActivity,
  readActivityCursor,
  WorkspaceActivityCenter,
} from "../features/notifications/WorkspaceActivityCenter";
import {
  ConversationWorkspace,
  DecisionPackageScreen,
  InvestigationScreen,
  ManagerOfficeScreen,
} from "../features/manager/ManagerScreens";
import { MissionsWorkspace } from "../features/missions/MissionScreens";
import { MusicWorkspace } from "../features/music/MusicScreens";
import { ConnectArtistScreen, PaywallPreviewScreen, SetupScreen } from "../features/onboarding/FrontDoorScreens";
import {
  FrontDoorAuthScreen,
  FrontDoorMessageScreen,
  FrontDoorPaymentReturnScreen,
  FrontDoorTransitionScreen,
} from "../features/onboarding/FrontDoorAuth";
import { runFrontDoorTransition } from "../features/onboarding/frontDoorTransition";
import { SetupActivityScreen } from "../features/onboarding/SetupActivityScreen";
import { enterDeskWithProgressiveTransition } from "../features/onboarding/setup-presentation/setupPresentationTransition";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { LockedAgentWorkspace, StaffWorkspace } from "../features/staff/StaffScreens";
import {
  identifyAnalyticsUser,
  isTestUserEmail,
  resetAnalyticsUser,
  trackEvent,
  trackEventOnce,
} from "../lib/analytics";
import { createBrowserSupabaseClient } from "../lib/supabaseClient";
import { reportBrowserServiceError } from "../lib/errorTelemetry";
import { createFixtureProductionRuntime, createFixtureRepositories } from "../services/fixtureRepositories";
import {
  createSupabaseAuthAdapter,
  createSupabaseBillingService,
  createSupabaseProductionRepositories,
  createSupabaseProfileSetupService,
  createSupabaseSpotifyArtistAdapter,
  createSupabaseWorkspaceLoader,
} from "../services/productionSupabase";
import { createActiveRunFallback } from "../services/activeRunFallback";
import { createResourceRequestCoordinator, type ResourceKey } from "../services/resourceRequestCoordinator";
import { invalidationsFromManagerRefreshHint, mergeReleaseSuccessArtifacts } from "../services/managerConversationStream";
import {
  loadWorkspaceActivityPage,
  type WorkspaceEventCursor,
  type WorkspaceInvalidation,
  type WorkspaceOperatingEvent,
} from "../services/workspaceLiveSync";
import { useWorkspaceLiveSync } from "./useWorkspaceLiveSync";
import { useTheme } from "./theme";
import type {
  AgentViewModel,
  AttentionItem,
  ArtistProfileViewModel,
  CleanProductionRepositories,
  CleanProductionView,
  ConversationViewModel,
  DrawerKind,
  EvidenceItemViewModel,
  ManagerConversationContextAnswer,
  ManagerConversationMusicSubject,
  ManagerConversationRefreshHint,
  ManagerConversationStreamEvent,
  ManagerRunStepViewModel,
  MissionGenesisResultViewModel,
  MissionViewModel,
  MovementItem,
  MusicObjectViewModel,
  MusicReadTarget,
  PublicContextRefreshResult,
  ReleaseDateChangeRequestViewModel,
  ReleaseOpportunityArtifactViewModel,
  ReleaseOpportunityTargetViewModel,
  ReleaseSuccessArtifactViewModel,
  TodayBriefGenerationMode,
  TodayBriefGenerationResponse,
  TodayBriefViewModel,
} from "../types/cleanProduction";
import type {
  ProductionAuthAdapter,
  ProductionBillingCheckoutPreview,
  ProductionBillingProviderPreference,
  ProductionBillingService,
  ProductionMusicLibraryLoader,
  ProductionProfileSetupService,
  ProductionSession,
  ProductionSpotifyArtistAdapter,
  ProductionSpotifyArtistCandidate,
  ProductionSpotifyCatalogPreview,
  ProductionUser,
  ProductionWorkspace,
  ProductionWorkspaceLoader,
} from "../types/productionApp";

const CREATE_FIRST_MISSION_PROMPT = "Create the first mission for this workspace.";

type ProductionAppProps = {
  authAdapter?: ProductionAuthAdapter;
  workspaceLoader?: ProductionWorkspaceLoader;
  billingService?: ProductionBillingService;
  musicLibraryLoader?: ProductionMusicLibraryLoader;
  spotifyArtistAdapter?: ProductionSpotifyArtistAdapter;
  profileSetupService?: ProductionProfileSetupService;
  repositories?: CleanProductionRepositories;
  initialView?: CleanProductionView;
  fixtureMode?: boolean;
};

type MissionRoomTab = "pulse" | "tasks" | "checkpoints" | "activity";
type PaymentReturnState = {
  reference: string;
  status: "checking" | "waiting" | "ready" | "mismatch" | "error" | "timed-out";
  message?: string;
};

export function ProductionApp({
  authAdapter,
  workspaceLoader,
  billingService,
  spotifyArtistAdapter,
  profileSetupService,
  repositories,
  initialView = "connectArtist",
  fixtureMode = false,
}: ProductionAppProps) {
  const shouldUseFixtureRuntime = fixtureMode || import.meta.env.VITE_PRODUCTION_FIXTURES === "true";
  const liveUpdatesEnabled = !shouldUseFixtureRuntime && import.meta.env.VITE_WORKSPACE_LIVE_UPDATES === "true";
  const paymentReturnReference = useMemo(() => readPaymentReturnReference(), []);

  const runtime = useMemo(() => {
    if (shouldUseFixtureRuntime) {
      const fixtureRuntime = createFixtureProductionRuntime();
      const repositoriesForWorkspace = () => {
        if (repositories) {
          return repositories;
        }

        return createFixtureRepositories();
      };

      return {
        ...fixtureRuntime,
        supabaseClient: null,
        billingService,
        spotifyArtistAdapter,
        profileSetupService,
        repositoriesForWorkspace,
      };
    }

    let client: ReturnType<typeof createBrowserSupabaseClient> | null = null;
    const getClient = () => {
      client = client ?? createBrowserSupabaseClient();
      return client;
    };

    return {
      supabaseClient: liveUpdatesEnabled ? getClient() : null,
      authAdapter: authAdapter ?? createSupabaseAuthAdapter(getClient()),
      workspaceLoader: workspaceLoader ?? createSupabaseWorkspaceLoader(getClient()),
      billingService: billingService ?? createSupabaseBillingService(getClient()),
      spotifyArtistAdapter:
        spotifyArtistAdapter ??
        ({
            searchArtists: (query) => createSupabaseSpotifyArtistAdapter(getClient()).searchArtists(query),
            previewCatalog: (candidate) => createSupabaseSpotifyArtistAdapter(getClient()).previewCatalog(candidate),
            connectArtist: (nextWorkspace, candidate) =>
            createSupabaseSpotifyArtistAdapter(getClient()).connectArtist(nextWorkspace, candidate),
          bootstrapCatalog: (nextWorkspace, candidate) =>
            createSupabaseSpotifyArtistAdapter(getClient()).bootstrapCatalog(nextWorkspace, candidate),
        } satisfies ProductionSpotifyArtistAdapter),
      profileSetupService:
        profileSetupService ??
        ({
          saveSetupContext: (nextWorkspace, profile) =>
            createSupabaseProfileSetupService(getClient()).saveSetupContext(nextWorkspace, profile),
          updateArtistProfile: (nextWorkspace, profile) =>
            createSupabaseProfileSetupService(getClient()).updateArtistProfile!(nextWorkspace, profile),
        } satisfies ProductionProfileSetupService),
      repositoriesForWorkspace: (nextWorkspace: ProductionWorkspace) =>
        repositories ?? createSupabaseProductionRepositories(getClient(), nextWorkspace),
    };
  }, [authAdapter, billingService, liveUpdatesEnabled, profileSetupService, repositories, shouldUseFixtureRuntime, spotifyArtistAdapter, workspaceLoader]);

  const [status, setStatus] = useState<"loading" | "signed-out" | "missing-workspace" | "ready" | "payment-return" | "error">("loading");
  const [session, setSession] = useState<ProductionSession | null>(null);
  const [workspace, setWorkspace] = useState<ProductionWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [paymentReturn, setPaymentReturn] = useState<PaymentReturnState | null>(
    paymentReturnReference ? { reference: paymentReturnReference, status: "checking" } : null,
  );
  const setupResumeAttempts = useRef(new Set<string>());
  const sessionUser = session?.user ?? null;
  const activeWorkspaceId = workspace?.artistWorkspaceId ?? null;
  const activeCatalogSyncStatus = workspace?.latestCatalogSyncStatus;
  const activeRepositories = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return runtime.repositoriesForWorkspace(workspace);
  }, [runtime, workspace?.accountId, workspace?.artistWorkspaceId, workspace?.artistId]);

  const loadProductionState = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      const nextSession = await runtime.authAdapter.getSession();
      setSession(nextSession);

      if (!nextSession.user) {
        setWorkspace(null);
        if (paymentReturnReference) {
          setPaymentReturn({
            reference: paymentReturnReference,
            status: "mismatch",
            message: "Sign in with the account that started this subscription to confirm payment.",
          });
          setStatus("payment-return");
        } else {
          setStatus("signed-out");
        }
        return;
      }

      if (paymentReturnReference) {
        setWorkspace(null);
        setPaymentReturn({ reference: paymentReturnReference, status: "checking" });
        setStatus("payment-return");
        await refreshPaymentReturnStatus(paymentReturnReference, runtime.billingService, setPaymentReturn, setWorkspace, setStatus, setSuccessNotice);
        return;
      }

      const nextWorkspace = await runtime.workspaceLoader.loadActiveWorkspace(nextSession.user);
      if (!nextWorkspace) {
        setWorkspace(null);
        setStatus("missing-workspace");
        return;
      }

      setWorkspace(nextWorkspace);
      setStatus("ready");
    } catch (loadError) {
      setError(readErrorMessage(loadError, "Production workspace could not load."));
      setStatus("error");
    }
  }, [paymentReturnReference, runtime]);

  const handleSignOut = useCallback(async () => {
    try {
      setError(null);
      await runtime.authAdapter.signOut?.();
      setSession({ user: null });
      setWorkspace(null);
      setStatus("signed-out");
      resetAnalyticsUser();
    } catch (signOutError) {
      setError(readErrorMessage(signOutError, "Could not sign out."));
      setStatus("error");
    }
  }, [runtime.authAdapter]);

  useEffect(() => {
    void loadProductionState();
  }, [loadProductionState]);

  useEffect(() => {
    if (sessionUser) {
      identifyAnalyticsUser(sessionUser);
    }
  }, [sessionUser?.id]);

  useEffect(() => {
    if (!sessionUser || !workspace?.artistWorkspaceId || workspace.entitlementActive !== true) return;

    trackEventOnce(
      "workspace activated",
      {
        artist_workspace_id: workspace.artistWorkspaceId,
        activation_source: paymentReturnReference ? "subscription" : "existing",
        is_test_user: isTestUserEmail(sessionUser.email),
      },
      `${sessionUser.id}:${workspace.artistWorkspaceId}`,
    );
  }, [paymentReturnReference, sessionUser?.id, workspace?.artistWorkspaceId, workspace?.entitlementActive]);

  useEffect(() => {
    if (status !== "payment-return" || !paymentReturn?.reference || !sessionUser || paymentReturn.status !== "waiting") {
      return;
    }

    let cancelled = false;
    const fallback = createActiveRunFallback({
      delaysMs: [500, 1_000, 2_000, 3_000, 5_000, 10_000, 30_000],
      deadlineMs: 5 * 60_000,
      isVisible: () => document.visibilityState !== "hidden",
      isOnline: () => navigator.onLine !== false,
      check: () => refreshPaymentReturnStatus(
        paymentReturn.reference,
        runtime.billingService,
        (next) => {
          if (!cancelled) setPaymentReturn(next);
        },
        (nextWorkspace) => {
          if (!cancelled) setWorkspace(nextWorkspace);
        },
        (nextStatus) => {
          if (!cancelled) setStatus(nextStatus);
        },
        (message) => {
          if (!cancelled) setSuccessNotice(message);
        },
      ),
      onTerminal: () => undefined,
      onError: () => undefined,
      onDeadline: () => {
        if (!cancelled) {
          setPaymentReturn({
            reference: paymentReturn.reference,
            status: "timed-out",
            message: "Confirmation is taking longer than expected. You can retry safely without starting another checkout.",
          });
        }
      },
    });
    const resume = () => fallback.resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    fallback.start();
    const unsubscribeBillingStatus = runtime.billingService.subscribeBillingStatus?.(
      paymentReturn.reference.startsWith("paddle:")
        ? { checkoutSessionId: paymentReturn.reference.slice("paddle:".length) }
        : { reference: paymentReturn.reference },
      resume,
    );

    return () => {
      cancelled = true;
      unsubscribeBillingStatus?.();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      fallback.stop();
    };
  }, [paymentReturn?.reference, paymentReturn?.status, runtime.billingService, sessionUser, status]);

  const retryPaymentConfirmation = useCallback(() => {
    if (!paymentReturn?.reference) return;
    const reference = paymentReturn.reference;
    setPaymentReturn({ reference, status: "checking" });
    void refreshPaymentReturnStatus(
      reference,
      runtime.billingService,
      setPaymentReturn,
      setWorkspace,
      setStatus,
      setSuccessNotice,
    );
  }, [paymentReturn?.reference, runtime.billingService]);

  useEffect(() => {
    if (!workspace || !sessionUser || !activeWorkspaceId || !isCatalogSyncPending(activeCatalogSyncStatus)) {
      return;
    }
    const loadCatalogSyncStatus = runtime.workspaceLoader.loadCatalogSyncStatus;
    if (!loadCatalogSyncStatus) return;

    let cancelled = false;
    const targetWorkspace = workspace;
    const fallback = createActiveRunFallback({
      delaysMs: [4_000, 4_000, 8_000, 15_000, 30_000],
      deadlineMs: 6 * 60_000,
      isVisible: () => document.visibilityState !== "hidden",
      isOnline: () => navigator.onLine !== false,
      check: async () => {
        const nextStatus = await loadCatalogSyncStatus(targetWorkspace);
        if (!nextStatus || isCatalogSyncPending(nextStatus)) return "active";
        if (!cancelled) {
          setWorkspace((currentWorkspace) => currentWorkspace?.artistWorkspaceId === targetWorkspace.artistWorkspaceId
            ? { ...currentWorkspace, latestCatalogSyncStatus: nextStatus }
            : currentWorkspace);
        }
        return "terminal";
      },
      onTerminal: () => undefined,
      onError: () => {
        // Keep the current workspace visible and retry with bounded backoff.
      },
    });
    const resume = () => fallback.resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    fallback.start();
    fallback.resume();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      fallback.stop();
    };
  }, [runtime.workspaceLoader, sessionUser, workspace, activeWorkspaceId, activeCatalogSyncStatus]);

  useEffect(() => {
    if (
      !sessionUser ||
      !workspace?.artistWorkspaceId ||
      !workspace.contextComplete ||
      !workspace.billingCheckoutSessionId ||
      !["queued", "running"].includes(workspace.setupStatus ?? "")
    ) {
      return;
    }

    let cancelled = false;
    const targetWorkspaceId = workspace.artistWorkspaceId;
    const setupResumeKey = `${sessionUser.id}:${targetWorkspaceId}:${workspace.billingCheckoutSessionId}`;
    if (!setupResumeAttempts.current.has(setupResumeKey) && runtime.billingService?.retrySetup) {
      setupResumeAttempts.current.add(setupResumeKey);
      void runtime.billingService.retrySetup({ checkoutSessionId: workspace.billingCheckoutSessionId })
        .then((result) => {
          if (!cancelled && result.workspace) {
            setWorkspace((currentWorkspace) => currentWorkspace?.artistWorkspaceId === targetWorkspaceId
              ? { ...currentWorkspace, ...result.workspace }
              : currentWorkspace);
          }
        })
        .catch(() => {
          // The persisted setup poll remains available if the resume request is interrupted.
        });
    }
    const fallback = createActiveRunFallback({
      delaysMs: [3_000, 5_000, 8_000, 15_000, 30_000],
      deadlineMs: 10 * 60_000,
      isVisible: () => document.visibilityState !== "hidden",
      isOnline: () => navigator.onLine !== false,
      check: async () => {
        const refreshed = await runtime.workspaceLoader.loadActiveWorkspace(sessionUser);
        if (!refreshed || refreshed.artistWorkspaceId !== targetWorkspaceId) return "active";
        if (!cancelled) setWorkspace(refreshed);
        return refreshed.setupStatus === "completed" || refreshed.setupStatus === "failed" ? "terminal" : "active";
      },
      onTerminal: () => undefined,
      onError: () => {
        // Keep the setup activity visible and retry with bounded backoff.
      },
    });
    const resume = () => fallback.resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    fallback.start();
    fallback.resume();

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      fallback.stop();
    };
  }, [runtime.billingService, runtime.workspaceLoader, sessionUser, workspace?.artistWorkspaceId, workspace?.billingCheckoutSessionId, workspace?.contextComplete, workspace?.setupStatus]);

  if (typeof window !== "undefined" && window.location.pathname === "/update-password") {
    return <UpdatePasswordScreen authAdapter={runtime.authAdapter} onComplete={() => { window.history.replaceState({}, "", "/"); void loadProductionState(); }} />;
  }

  if (status === "loading") {
    return <FrontDoorTransitionScreen title="Opening Desk" />;
  }

  if (status === "signed-out") {
    return <FrontDoorAuthScreen authAdapter={runtime.authAdapter} onAuthenticated={loadProductionState} />;
  }

  if (status === "payment-return" && paymentReturn) {
    return (
      <FrontDoorPaymentReturnScreen
        state={paymentReturn}
        onRetry={paymentReturn.status === "timed-out" ? retryPaymentConfirmation : undefined}
        onSignOut={sessionUser ? handleSignOut : undefined}
      />
    );
  }

  if (status === "missing-workspace") {
    return (
      <SpotifyIdentityGate
        user={session?.user ?? null}
        workspace={null}
        workspaceLoader={runtime.workspaceLoader}
        billingService={runtime.billingService}
        spotifyArtistAdapter={runtime.spotifyArtistAdapter}
        onSignOut={handleSignOut}
        onWorkspaceReady={(nextWorkspace) => {
          runFrontDoorTransition(() => {
            setWorkspace(nextWorkspace);
            setStatus("ready");
            if (nextWorkspace.accessType === "private_beta") {
              setSuccessNotice(`Code accepted — private-beta access is active until ${formatAccessDate(nextWorkspace.accessEndsAt)}.`);
            }
          });
        }}
      />
    );
  }

  if (status === "error") {
    return (
      <FrontDoorMessageScreen
        title="Couldn’t open Desk"
        body="Try again."
        action={<ProductButton onClick={loadProductionState}>Retry</ProductButton>}
      />
    );
  }

  if (workspace && (!workspace.spotifyConnected || workspace.entitlementActive !== true)) {
    return (
      <SpotifyIdentityGate
        user={session?.user ?? null}
        workspace={workspace}
        workspaceLoader={runtime.workspaceLoader}
        billingService={runtime.billingService}
        spotifyArtistAdapter={runtime.spotifyArtistAdapter}
        onSignOut={handleSignOut}
        onWorkspaceReady={(nextWorkspace) => {
          runFrontDoorTransition(() => {
            setWorkspace(nextWorkspace);
            setStatus("ready");
          });
        }}
      />
    );
  }

  return (
    <>
    {successNotice ? <SuccessToast message={successNotice} onClose={() => setSuccessNotice(null)} /> : null}
    <CleanProductionWorkspace
      analyticsUser={sessionUser as ProductionUser}
      authAdapter={runtime.authAdapter}
      workspace={workspace}
      workspaceLoader={runtime.workspaceLoader}
      supabaseClient={runtime.supabaseClient}
      liveUpdatesEnabled={liveUpdatesEnabled}
      repositories={activeRepositories as CleanProductionRepositories}
      profileSetupService={runtime.profileSetupService}
      billingService={runtime.billingService}
      spotifyArtistAdapter={runtime.spotifyArtistAdapter}
      fixtureRuntime={shouldUseFixtureRuntime}
      initialView={shouldUseFixtureRuntime ? initialView : resolveWorkspaceInitialView(workspace as ProductionWorkspace, initialView)}
      onWorkspaceChange={setWorkspace}
      onSignOut={handleSignOut}
    />
    </>
  );
}

function CleanProductionWorkspace({
  analyticsUser,
  authAdapter,
  workspace,
  workspaceLoader,
  supabaseClient,
  liveUpdatesEnabled,
  repositories,
  profileSetupService,
  billingService,
  spotifyArtistAdapter,
  fixtureRuntime,
  initialView,
  onWorkspaceChange,
  onSignOut,
}: {
  analyticsUser: ProductionUser;
  authAdapter: ProductionAuthAdapter;
  workspace: ProductionWorkspace | null;
  workspaceLoader: ProductionWorkspaceLoader;
  supabaseClient: ReturnType<typeof createBrowserSupabaseClient> | null;
  liveUpdatesEnabled: boolean;
  repositories: CleanProductionRepositories;
  profileSetupService?: ProductionProfileSetupService;
  billingService?: ProductionBillingService;
  spotifyArtistAdapter?: ProductionSpotifyArtistAdapter;
  fixtureRuntime: boolean;
  initialView: CleanProductionView;
  onWorkspaceChange?: (workspace: ProductionWorkspace) => void;
  onSignOut?: () => void;
}) {
  const isTestUser = isTestUserEmail(analyticsUser.email);
  const { mode: themeMode, resolvedMode: resolvedThemeMode, setMode: setThemeMode } = useTheme();
  const [view, setView] = useState<CleanProductionView>(initialView);
  const [profile, setProfile] = useState<ArtistProfileViewModel | null>(null);
  const [attention, setAttention] = useState<AttentionItem[]>([]);
  const [movement, setMovement] = useState<MovementItem[]>([]);
  const [todayBrief, setTodayBrief] = useState<TodayBriefViewModel | null>(null);
  const [agents, setAgents] = useState<AgentViewModel[]>([]);
  const [music, setMusic] = useState<MusicObjectViewModel[]>([]);
  const [conversations, setConversations] = useState<ConversationViewModel[]>([]);
  const [missions, setMissions] = useState<MissionViewModel[]>([]);
  const [evidence, setEvidence] = useState<EvidenceItemViewModel[]>([]);
  const [conversationDetailPending, setConversationDetailPending] = useState(false);
  const [conversationDetailError, setConversationDetailError] = useState<string | null>(null);
  const [conversationListPending, setConversationListPending] = useState(false);
  const [conversationListError, setConversationListError] = useState<string | null>(null);
  const [missionDetailPending, setMissionDetailPending] = useState(false);
  const [evidencePending, setEvidencePending] = useState(false);
  const resourceRequestsRef = useRef<ReturnType<typeof createResourceRequestCoordinator> | null>(null);
  if (!resourceRequestsRef.current) resourceRequestsRef.current = createResourceRequestCoordinator();
  const resourceRequests = resourceRequestsRef.current;
  const resourceWorkspaceId = workspace?.artistWorkspaceId ?? `setup:${analyticsUser.id}`;
  const evidenceLoaded = useRef(false);
  const evidenceLoadInFlight = useRef(false);
  const evidenceRequest = useRef(0);
  const conversationListLoaded = useRef(false);
  const conversationDetailRequest = useRef(0);
  const missionDetailRequest = useRef(0);
  const [viewModelError, setViewModelError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentViewModel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationViewModel | null>(null);
  const [managerTaskContextId, setManagerTaskContextId] = useState<string | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [missionRoomOpenRequestKey, setMissionRoomOpenRequestKey] = useState(0);
  const [missionRoomOpenTab, setMissionRoomOpenTab] = useState<MissionRoomTab>("pulse");
  const [missionRoomOpenTaskId, setMissionRoomOpenTaskId] = useState<string | null>(null);
  const [missionListOpenRequestKey, setMissionListOpenRequestKey] = useState(0);
  const [musicListOpenRequestKey, setMusicListOpenRequestKey] = useState(0);
  const [targetMusicObjectId, setTargetMusicObjectId] = useState<string | null>(null);
  const [targetSongRoomTab, setTargetSongRoomTab] = useState<"overview" | "files">("overview");
  const [targetSongDocumentId, setTargetSongDocumentId] = useState<string | null>(null);
  const [musicRoomOpenRequestKey, setMusicRoomOpenRequestKey] = useState(0);
  const [musicDetailOpen, setMusicDetailOpen] = useState(false);
  const [missionRoomOpen, setMissionRoomOpen] = useState(false);
  const [managerAnswers, setManagerAnswers] = useState<Record<string, string>>({});
  const [setupPending, setSetupPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupActivityPending, setSetupActivityPending] = useState(false);
  const [setupActivityError, setSetupActivityError] = useState<string | null>(null);
  const [todayBriefPending, setTodayBriefPending] = useState(false);
  const [todayBriefError, setTodayBriefError] = useState<string | null>(null);
  const [activeTodayBriefRun, setActiveTodayBriefRun] = useState<{ id: string; mode: TodayBriefGenerationMode } | null>(null);
  const todayBriefRefreshInFlight = useRef(false);
  const [publicContextPending, setPublicContextPending] = useState(false);
  const [activityCenterOpen, setActivityCenterOpen] = useState(false);
  const [workspaceEvents, setWorkspaceEvents] = useState<WorkspaceOperatingEvent[]>([]);
  const [activitySeenCursor, setActivitySeenCursor] = useState<WorkspaceEventCursor | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityHistoryPending, setActivityHistoryPending] = useState(false);
  const [activityHasMore, setActivityHasMore] = useState(false);
  const [activityToast, setActivityToast] = useState<string | null>(null);
  const activityLoadedWorkspace = useRef<string | null>(null);
  const legacyActivityEpoch = useRef(Date.now());
  const [missionGenesisResult, setMissionGenesisResult] = useState<MissionGenesisResultViewModel | null>(null);
  const [missionGenesisAnswers, setMissionGenesisAnswers] = useState<Record<string, string>>({});
  const [missionGenesisPending, setMissionGenesisPending] = useState(false);
  const [missionGenesisError, setMissionGenesisError] = useState<string | null>(null);
  const [managerSendPending, setManagerSendPending] = useState(false);
  const [managerSendError, setManagerSendError] = useState<string | null>(null);

  const loadDeskAggregate = () => resourceRequests.load(resourceWorkspaceId, "workspace", () => repositories.desk.loadDesk());
  const loadActivityResource = () => resourceRequests.load(resourceWorkspaceId, "activity", () =>
    repositories.desk.loadActivity?.()
      ?? loadDeskAggregate().then(({ priority, attention, movement }) => ({ priority, attention, movement }))
  );
  const loadBriefResource = () => resourceRequests.load(resourceWorkspaceId, "desk-brief", () =>
    repositories.desk.loadBrief?.() ?? loadDeskAggregate().then((snapshot) => snapshot.todayBrief)
  );
  const loadMusicListResource = () => resourceRequests.load(resourceWorkspaceId, "music-list", () => repositories.music.loadMusicList());
  const loadMissionListResource = () => resourceRequests.load(resourceWorkspaceId, "mission-list", () =>
    repositories.missions.loadMissionList?.() ?? repositories.missions.loadMissions()
  );
  const loadConversationListResource = () => resourceRequests.load(resourceWorkspaceId, "conversation-list", () =>
    repositories.manager.loadConversationList?.() ?? repositories.manager.loadConversations()
  );

  const handleWorkspaceEvent = useCallback((event: WorkspaceOperatingEvent) => {
    if (!event.displayMode) return;
    setWorkspaceEvents((current) => mergeWorkspaceEvents(current, [event]));
    if (event.displayMode === "toast") setActivityToast(event.summary);
    if (event.eventType === "todays_brief_failed" && activeTodayBriefRun && event.targetId === activeTodayBriefRun.id) {
      setTodayBriefError(event.summary || "Today's Brief could not be generated.");
      setTodayBriefPending(false);
      setActiveTodayBriefRun(null);
    }
  }, [activeTodayBriefRun]);

  const activeWorkspaceRuns = useMemo(() => {
    if (!activeTodayBriefRun || !repositories.desk.loadTodaysBriefRunStatus) return [];
    return [{
      id: activeTodayBriefRun.id,
      check: async () => {
        const run = await repositories.desk.loadTodaysBriefRunStatus!(activeTodayBriefRun.id);
        if (["queued", "running"].includes(run.status)) return "active" as const;
        if (run.status === "failed" || run.status === "cancelled") {
          setTodayBriefError(run.error ?? "Today's Brief could not be generated.");
          setTodayBriefPending(false);
          setActiveTodayBriefRun(null);
          return "terminal" as const;
        }
        await handleWorkspaceInvalidations([{ scope: "desk-brief" }, { scope: "activity" }]);
        setTodayBriefPending(false);
        setActiveTodayBriefRun(null);
        return "terminal" as const;
      },
    }];
  }, [activeTodayBriefRun, repositories.desk]);

  const { status: liveUpdateStatus } = useWorkspaceLiveSync({
    enabled: Boolean(workspace?.artistWorkspaceId) && (liveUpdatesEnabled || activeWorkspaceRuns.length > 0),
    client: supabaseClient,
    userId: analyticsUser.id,
    workspaceId: workspace?.artistWorkspaceId ?? "",
    coordinator: resourceRequests,
    onInvalidations: handleWorkspaceInvalidations,
    onEvent: handleWorkspaceEvent,
    activeRuns: activeWorkspaceRuns,
  });

  useEffect(() => {
    const workspaceId = workspace?.artistWorkspaceId;
    activityLoadedWorkspace.current = null;
    setActiveTodayBriefRun(null);
    setTodayBriefPending(false);
    setWorkspaceEvents([]);
    setActivityError(null);
    setActivityHasMore(false);
    setActivitySeenCursor(workspaceId
      ? readActivityCursor(window.localStorage, analyticsUser.id, workspaceId)
      : null);
  }, [analyticsUser.id, workspace?.artistWorkspaceId]);

  useEffect(() => {
    if (!activityToast) return;
    const timer = window.setTimeout(() => setActivityToast(null), 4_500);
    return () => window.clearTimeout(timer);
  }, [activityToast]);

  useEffect(() => {
    if (view !== "setup" || !workspace?.contextComplete || isWorkspaceReadyForDesk(workspace)) return;
    let disposed = false;
    async function rehydrateAfterReconnect() {
      const refreshed = await workspaceLoader.loadActiveWorkspace(analyticsUser);
      if (disposed || !refreshed) return;
      onWorkspaceChange?.(refreshed);
      if (isWorkspaceReadyForDesk(refreshed)) enterDeskWithProgressiveTransition(() => setView("labelHQ"));
    }
    window.addEventListener("online", rehydrateAfterReconnect);
    return () => {
      disposed = true;
      window.removeEventListener("online", rehydrateAfterReconnect);
    };
  }, [analyticsUser, onWorkspaceChange, view, workspace, workspaceLoader]);

  useEffect(() => {
    if (
      view === "setup" &&
      workspace?.billingCheckoutSessionId &&
      workspace.setupStatus === "completed" &&
      isWorkspaceReadyForDesk(workspace)
    ) {
      enterDeskWithProgressiveTransition(() => setView("labelHQ"));
    }
  }, [view, workspace?.contextComplete, workspace?.entitlementActive, workspace?.billingCheckoutSessionId, workspace?.setupStatus]);

  useEffect(() => {
    let isMounted = true;
    evidenceLoaded.current = false;
    evidenceLoadInFlight.current = false;
    evidenceRequest.current += 1;
    conversationDetailRequest.current += 1;
    missionDetailRequest.current += 1;
    conversationListLoaded.current = false;
    setEvidence([]);
    setConversations([]);

    async function loadViewModels() {
      try {
        setViewModelError(null);
        const [nextProfile, [nextActivity, nextBrief], nextAgents, nextMusic, nextMissions] = await Promise.all([
          repositories.artistProfile.loadProfile(),
          Promise.all([loadActivityResource(), loadBriefResource()]),
          repositories.staff.loadAgents(),
          loadMusicListResource(),
          loadMissionListResource(),
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        setAttention(nextActivity.attention);
        setMovement(nextActivity.movement);
        setTodayBrief(nextBrief);
        setAgents(nextAgents);
        setMusic(nextMusic);
        setMissions(nextMissions);
        setSelectedMissionId((current) => {
          if (current && nextMissions.some((mission) => mission.id === current)) {
            return current;
          }

          return nextMissions[0]?.id ?? "";
        });
      } catch (loadError) {
        if (isMounted) {
          setViewModelError(readErrorMessage(loadError, "Production view data could not load."));
        }
      }
    }

    void loadViewModels();

    return () => {
      isMounted = false;
      resourceRequests.clearWorkspace(resourceWorkspaceId);
    };
  }, [repositories, resourceRequests, resourceWorkspaceId, workspace?.setupStatus]);

  useEffect(() => {
    if (view !== "managerOffice" || conversationListLoaded.current) return;
    let cancelled = false;
    setConversationListPending(true);
    setConversationListError(null);
    void loadConversationListResource()
      .then((nextConversations) => {
        if (!cancelled) {
          conversationListLoaded.current = true;
          setConversations(nextConversations);
        }
      })
      .catch((loadError) => {
        if (!cancelled) setConversationListError(readErrorMessage(loadError, "Manager conversations could not load."));
      })
      .finally(() => {
        if (!cancelled) setConversationListPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repositories.manager, resourceWorkspaceId, view]);

  function retryManagerConversationList() {
    conversationListLoaded.current = false;
    setConversationListPending(true);
    setConversationListError(null);
    void loadConversationListResource()
      .then((nextConversations) => {
        conversationListLoaded.current = true;
        setConversations(nextConversations);
      })
      .catch((loadError) => setConversationListError(readErrorMessage(loadError, "Manager conversations could not load.")))
      .finally(() => setConversationListPending(false));
  }

  useEffect(() => {
    if (view !== "labelHQ" || !todayBrief || !workspace) return;

    const briefId = briefAnalyticsId(todayBrief, workspace.artistWorkspaceId);
    trackEventOnce(
      "first brief viewed",
      {
        brief_id: briefId,
        artist_id: workspace.artistId,
        is_test_user: isTestUser,
      },
      `${analyticsUser.id}:${workspace.artistWorkspaceId}:${briefId}`,
    );
  }, [analyticsUser.id, isTestUser, todayBrief, view, workspace?.artistId, workspace?.artistWorkspaceId]);

  const activeSection = sectionForView(view);
  const mobileTitle =
    activeSection === "labelHQ" ? "Home" :
    activeSection === "music" ? "Catalog" :
    activeSection === "manager" ? "Manager" :
    activeSection === "missions" ? "Missions" :
    "Settings";
  const legacyWorkspaceEvents = useMemo(
    () => buildLegacyWorkspaceEvents(attention, movement, resourceWorkspaceId, legacyActivityEpoch.current),
    [attention, movement, resourceWorkspaceId],
  );
  const visibleWorkspaceEvents = liveUpdatesEnabled ? workspaceEvents : legacyWorkspaceEvents;
  const notificationCount = countUnreadActivity(visibleWorkspaceEvents, activitySeenCursor);
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null;
  const activeAgent = selectedAgent ?? agents[1] ?? agents[0] ?? null;
  const activeConversation = selectedConversation ?? conversations[0] ?? null;
  const showMobileTopbar =
    view === "labelHQ" ||
    view === "staffWorkspace" ||
    view === "managerOffice" ||
    view === "artistProfileWorkspace" ||
    (view === "musicWorkspace" && !musicDetailOpen) ||
    (view === "missionsWorkspace" && !missionRoomOpen);
  const showMobileTabbar = view !== "conversationWorkspace" && view !== "investigation" && view !== "decisionPackage" && !(view === "musicWorkspace" && musicDetailOpen) && !(view === "missionsWorkspace" && missionRoomOpen);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [view]);

  function navigate(nextView: CleanProductionView) {
    if (workspace && !isWorkspaceReadyForDesk(workspace) && nextView !== "setup" && nextView !== "connectArtist") {
      setView("setup");
      return;
    }

    if (nextView !== "musicWorkspace") setMusicDetailOpen(false);
    if (nextView !== "missionsWorkspace") setMissionRoomOpen(false);
    setView(nextView);
    setDrawer(null);
    setActivityCenterOpen(false);
  }

  const markActivitySeen = useCallback((cursor: WorkspaceEventCursor) => {
    const workspaceId = workspace?.artistWorkspaceId;
    if (!workspaceId) return;
    setActivitySeenCursor((current) => {
      if (current && (current.createdAt > cursor.createdAt || (current.createdAt === cursor.createdAt && current.id >= cursor.id))) {
        return current;
      }
      window.localStorage.setItem(activityCursorKey(analyticsUser.id, workspaceId), JSON.stringify(cursor));
      return cursor;
    });
  }, [analyticsUser.id, workspace?.artistWorkspaceId]);

  function openActivityCenter() {
    setActivityCenterOpen(true);
    const workspaceId = workspace?.artistWorkspaceId;
    if (!liveUpdatesEnabled || !supabaseClient || !workspaceId || activityLoadedWorkspace.current === workspaceId) return;
    activityLoadedWorkspace.current = workspaceId;
    setActivityHistoryPending(true);
    setActivityError(null);
    void loadWorkspaceActivityPage(supabaseClient, workspaceId)
      .then((events) => {
        setWorkspaceEvents((current) => mergeWorkspaceEvents(current, events));
        setActivityHasMore(events.length === 20);
      })
      .catch((error) => {
        activityLoadedWorkspace.current = null;
        setActivityError(readErrorMessage(error, "Activity could not load."));
      })
      .finally(() => setActivityHistoryPending(false));
  }

  function loadOlderActivity() {
    const workspaceId = workspace?.artistWorkspaceId;
    const oldest = workspaceEvents.at(-1);
    if (!liveUpdatesEnabled || !supabaseClient || !workspaceId || !oldest || activityHistoryPending) return;
    setActivityHistoryPending(true);
    setActivityError(null);
    void loadWorkspaceActivityPage(supabaseClient, workspaceId, { createdAt: oldest.createdAt, id: oldest.id })
      .then((events) => {
        setWorkspaceEvents((current) => mergeWorkspaceEvents(current, events));
        setActivityHasMore(events.length === 20);
      })
      .catch((error) => setActivityError(readErrorMessage(error, "Earlier activity could not load.")))
      .finally(() => setActivityHistoryPending(false));
  }

  async function openWorkspaceEvent(event: WorkspaceOperatingEvent) {
    setActivityCenterOpen(false);
    if (!event.targetId) {
      if (event.targetType === "view" && isCleanProductionView(event.eventType)) navigate(event.eventType);
      return;
    }
    if (event.targetType === "mission") {
      openMissionRoom(event.targetId);
      return;
    }
    if (event.targetType === "task") {
      await openCreatedWork("task", event.targetId);
      return;
    }
    if (event.targetType === "music_item" || event.targetType === "music_project") {
      setTargetSongRoomTab("overview");
      setTargetSongDocumentId(null);
      setTargetMusicObjectId(event.targetId);
      setMusicRoomOpenRequestKey((current) => current + 1);
      navigate("musicWorkspace");
      return;
    }
    if (event.targetType === "conversation") {
      const existing = conversations.find((conversation) => conversation.id === event.targetId);
      if (existing) {
        await openConversation(existing);
        return;
      }
      const loaded = await repositories.manager.loadConversation?.(event.targetId);
      if (loaded) await openConversation(loaded);
      return;
    }
    if (event.targetType === "drawer" && event.targetId === "evidence") {
      openDrawer("evidence");
      return;
    }
    if (event.targetType === "view" && isCleanProductionView(event.targetId)) navigate(event.targetId);
  }

  function navigateFromMenu(nextView: CleanProductionView) {
    if (nextView === "musicWorkspace") {
      setTargetSongRoomTab("overview");
      setTargetSongDocumentId(null);
      setTargetMusicObjectId(null);
      setMusicDetailOpen(false);
      setMusicListOpenRequestKey((current) => current + 1);
    }
    if (nextView === "missionsWorkspace") {
      setMissionRoomOpen(false);
      setMissionListOpenRequestKey((current) => current + 1);
    }
    navigate(nextView);
  }

  function openManager() {
    setManagerTaskContextId(null);
    navigate("managerOffice");
  }

  async function openMusicManagerConversation(subject: MusicObjectViewModel, starterPrompt?: string) {
    const musicSubject: ManagerConversationMusicSubject = {
      type: subject.kind === "project" ? "music_project" : "music_item",
      id: subject.id,
    };
    const linkedConversationId = subject.managerConversationId;
    if (linkedConversationId) {
      const existing = conversations.find((conversation) => conversation.id === linkedConversationId)
        ?? await repositories.manager.loadConversation?.(linkedConversationId)
        ?? null;
      if (existing) {
        await openConversation(existing);
        return;
      }
    }

    await sendManagerMessage(
      starterPrompt ?? `Work on ${subject.title} from its current state. Use what you already know about the song and take the most useful next step.`,
      undefined,
      `Manage ${subject.title}`,
      { musicSubject },
    );
  }

  function openMusicFocus(musicObjectId?: string) {
    setTargetSongRoomTab("overview");
    setTargetSongDocumentId(null);
    setTargetMusicObjectId(musicObjectId ?? null);
    setMusicRoomOpenRequestKey((current) => current + 1);
    navigate("musicWorkspace");
  }

  function updateReleaseSuccessArtifact(
    artifactId: string,
    updater: (artifact: ReleaseSuccessArtifactViewModel) => ReleaseSuccessArtifactViewModel,
  ) {
    updateActiveConversation((conversation) => ({
      ...conversation,
      releaseSuccessArtifacts: (conversation.releaseSuccessArtifacts ?? []).map((artifact) =>
        artifact.id === artifactId ? updater(artifact) : artifact,
      ),
    }));
  }

  function releaseErrorReference(error: unknown) {
    if (!error || typeof error !== "object") return undefined;
    const details = error as { errorEventId?: unknown; requestId?: unknown; code?: unknown };
    if (typeof details.errorEventId === "string" && details.errorEventId) return details.errorEventId;
    if (typeof details.requestId === "string" && details.requestId) return details.requestId;
    if (typeof details.code === "string" && details.code) return details.code;
    return undefined;
  }

  async function approveReleaseDateChange(request: ReleaseDateChangeRequestViewModel) {
    const artifact = selectedConversation?.releaseSuccessArtifacts?.find((item) =>
      (request.requestId && item.requestId === request.requestId) || item.musicItemId === request.musicItemId,
    );
    if (!artifact) return;

    updateReleaseSuccessArtifact(artifact.id, (current) => ({ ...current, state: "applying", error: undefined }));
    try {
      if (!repositories.manager.approveReleaseDateChange) throw new Error("Release date approval is unavailable.");
      const receipt = await repositories.manager.approveReleaseDateChange({
        requestId: request.requestId,
        previewHash: request.previewHash,
        idempotencyKey: request.idempotencyKey,
      });
      updateReleaseSuccessArtifact(artifact.id, (current) => ({
        ...current,
        state: "applied",
        receipt,
        error: undefined,
      }));
      try {
        await refreshFromManagerHint({
          music: true,
          missions: Boolean(receipt.missionId),
          missionIds: receipt.missionId ? [receipt.missionId] : [],
          taskIds: receipt.moved.map((item) => item.taskId),
          desk: true,
        });
      } catch (refreshError) {
        reportBrowserServiceError(refreshError, {
          stage: "realtime_refresh",
          musicItemId: request.musicItemId,
          releasePlanId: request.releasePlanId,
          requestId: request.requestId,
          missionId: receipt.missionId,
        });
        updateReleaseSuccessArtifact(artifact.id, (current) => ({
          ...current,
          state: "applied",
          error: {
            message: "Release date updated, but the workspace refresh needs a retry.",
            retryable: true,
            ...(releaseErrorReference(refreshError) ? { reference: releaseErrorReference(refreshError) } : {}),
          },
        }));
      }
    } catch (error) {
      if (!releaseErrorReference(error)) {
        reportBrowserServiceError(error, {
          stage: "reschedule_approval",
          musicItemId: request.musicItemId,
          releasePlanId: request.releasePlanId,
          requestId: request.requestId,
        });
      }
      updateReleaseSuccessArtifact(artifact.id, (current) => ({
        ...current,
        state: "failed",
        error: {
          message: readErrorMessage(error, "The release date change could not be applied."),
          retryable: true,
          ...(releaseErrorReference(error) ? { reference: releaseErrorReference(error) } : {}),
        },
      }));
    }
  }

  function keepReleaseDateAndShowRecoveryPlan(artifact: ReleaseSuccessArtifactViewModel) {
    const conversation = selectedConversation;
    if (!conversation) return;
    const currentDate = artifact.subject.approvedReleaseDate ?? artifact.preview?.fromDate ?? "the current release date";
    void sendManagerMessage(
      `Keep ${currentDate} for ${artifact.subject.title} and show me the recovery plan for release success. Do not approve a date change.`,
      conversation.id,
      conversation.topic,
      conversation.musicSubject ? { musicSubject: { type: conversation.musicSubject.type, id: conversation.musicSubject.id } } : {},
    );
  }

  function retryReleaseSuccessReview(artifact: ReleaseSuccessArtifactViewModel) {
    const conversation = selectedConversation;
    const lastArtistMessage = conversation?.messages.filter((message) => message.speaker === "artist").at(-1);
    if (!conversation || !lastArtistMessage) return Promise.resolve();
    return sendManagerMessage(lastArtistMessage.body, conversation.id, conversation.topic, conversation.musicSubject
      ? { musicSubject: { type: conversation.musicSubject.type, id: conversation.musicSubject.id } }
      : {});
  }

  function managerConversationSubjectInput(conversation: ConversationViewModel) {
    return conversation.musicSubject
      ? { musicSubject: { type: conversation.musicSubject.type, id: conversation.musicSubject.id } }
      : {};
  }

  function prepareOpportunityPitch(artifact: ReleaseOpportunityArtifactViewModel, target: ReleaseOpportunityTargetViewModel) {
    const conversation = selectedConversation;
    if (!conversation) return;
    void sendManagerMessage(
      `Prepare a ${artifact.opportunityType} pitch for ${target.targetName}. Use the attached song metadata and verified target evidence. Create the canonical ${artifact.opportunityType === "press" ? "press_pitch" : "playlist_pitch"} document in the song Files, show me the draft for review, and do not send or submit it.`,
      conversation.id,
      conversation.topic,
      managerConversationSubjectInput(conversation),
    );
  }

  function recordOpportunityOutcome(
    artifact: ReleaseOpportunityArtifactViewModel,
    target: ReleaseOpportunityTargetViewModel,
    input: { status: ReleaseOpportunityTargetViewModel["status"]; manualOutcome: string },
  ) {
    const conversation = selectedConversation;
    if (!conversation) return;
    void sendManagerMessage(
      `Record the manual ${input.status} outcome for release ${artifact.opportunityType} target ${target.targetName} (opportunity ${target.id}). Outcome note: ${input.manualOutcome}`,
      conversation.id,
      conversation.topic,
      managerConversationSubjectInput(conversation),
    );
  }

  function retryOpportunityResearch(artifact: ReleaseOpportunityArtifactViewModel) {
    const conversation = selectedConversation;
    if (!conversation) return;
    void sendManagerMessage(
      `Retry only the failed ${artifact.opportunityType} release research stage for the attached song. Preserve verified targets and do not send outreach.`,
      conversation.id,
      conversation.topic,
      managerConversationSubjectInput(conversation),
    );
  }

  async function hydrateCompletedConversationArtifacts(conversationId: string) {
    if (!repositories.manager.loadConversation) return;
    try {
      const detail = await repositories.manager.loadConversation(conversationId);
      if (!detail) return;
      setSelectedConversation((current) => {
        if (!current || current.id !== conversationId) return current;
        const releaseOpportunityArtifacts = detail.releaseOpportunityArtifacts ?? [];
        const merged = mergeCompletedConversation(
          current,
          releaseOpportunityArtifacts.length ? { ...detail, releaseOpportunityArtifacts } : detail,
          true,
        );
        setConversations((items) => [merged, ...items.filter((item) => item.id !== merged.id)]);
        return merged;
      });
    } catch (error) {
      reportBrowserServiceError(error, { stage: "receipt_render", conversationId });
      // The streamed conversation remains usable; a later conversation open retries hydration.
    }
  }

  async function openConversation(conversation: ConversationViewModel) {
    setManagerTaskContextId(conversation.taskContextId ?? null);
    setSelectedConversation(conversation);
    setConversationDetailError(null);
    navigate("conversationWorkspace");
    const request = ++conversationDetailRequest.current;
    setConversationDetailPending(true);
    try {
      const detail = await resourceRequests.load(resourceWorkspaceId, `conversation:${conversation.id}`, () =>
        repositories.manager.loadConversation?.(conversation.id)
          ?? repositories.manager.loadConversations().then((items) => items.find((item) => item.id === conversation.id) ?? null)
      );
      if (request !== conversationDetailRequest.current || !detail) return;
      setSelectedConversation(detail);
      setConversations((current) => [detail, ...current.filter((item) => item.id !== detail.id)]);
      setManagerTaskContextId(detail.taskContextId ?? null);
    } catch (loadError) {
      if (request === conversationDetailRequest.current) {
        setConversationDetailError(readErrorMessage(loadError, "Conversation detail could not load."));
      }
    } finally {
      if (request === conversationDetailRequest.current) setConversationDetailPending(false);
    }
  }

  async function hydrateMission(missionId: string, force = false) {
    const request = ++missionDetailRequest.current;
    setMissionDetailPending(true);
    try {
      if (force) resourceRequests.invalidate(resourceWorkspaceId, `mission:${missionId}`);
      const detail = await resourceRequests.load(resourceWorkspaceId, `mission:${missionId}`, () =>
        repositories.missions.loadMission?.(missionId)
          ?? repositories.missions.loadMissions().then((items) => items.find((mission) => mission.id === missionId) ?? null)
      );
      if (request !== missionDetailRequest.current || !detail) return;
      setMissions((current) => [detail, ...current.filter((mission) => mission.id !== detail.id)]);
    } catch (loadError) {
      if (request === missionDetailRequest.current) {
        setViewModelError(readErrorMessage(loadError, "Mission detail could not load."));
      }
    } finally {
      if (request === missionDetailRequest.current) setMissionDetailPending(false);
    }
  }

  async function reloadMissionList() {
    resourceRequests.invalidate(resourceWorkspaceId, "mission-list");
    return loadMissionListResource();
  }

  function selectMissionForDetail(missionId: string) {
    setSelectedMissionId(missionId);
    void hydrateMission(missionId);
  }

  function openDrawer(nextDrawer: DrawerKind) {
    setDrawer(nextDrawer);
    if (nextDrawer !== "evidence" || evidenceLoaded.current || evidenceLoadInFlight.current) return;
    const request = ++evidenceRequest.current;
    evidenceLoadInFlight.current = true;
    setEvidencePending(true);
    void repositories.evidence.loadEvidence()
      .then((nextEvidence) => {
        if (request !== evidenceRequest.current) return;
        evidenceLoaded.current = true;
        setEvidence(nextEvidence);
      })
      .catch((loadError) => {
        if (request === evidenceRequest.current) {
          setViewModelError(readErrorMessage(loadError, "Evidence could not load."));
        }
      })
      .finally(() => {
        if (request === evidenceRequest.current) {
          evidenceLoadInFlight.current = false;
          setEvidencePending(false);
        }
      });
  }

  async function sendManagerMessage(
    body: string,
    conversationId?: string,
    stableTopic?: string,
    options: {
      contextRequestId?: string;
      contextAnswers?: ManagerConversationContextAnswer[];
      attachmentIds?: string[];
      taskId?: string;
      musicSubject?: ManagerConversationMusicSubject;
    } = {},
  ) {
    const trimmedBody = body.trim();
    if (!trimmedBody) return;

    const sourceConversation = conversationId
      ? conversations.find((conversation) => conversation.id === conversationId) ??
        (selectedConversation?.id === conversationId ? selectedConversation : undefined)
      : undefined;
    const effectiveMusicSubject = options.musicSubject ?? (sourceConversation?.musicSubject
      ? { type: sourceConversation.musicSubject.type, id: sourceConversation.musicSubject.id }
      : undefined);
    const resolvedMusicSubject = sourceConversation?.musicSubject ?? (effectiveMusicSubject
      ? music.find((item) =>
          item.id === effectiveMusicSubject.id &&
          item.kind === (effectiveMusicSubject.type === "music_project" ? "project" : "song"),
        )
      : undefined);
    const musicSubjectView = resolvedMusicSubject
      ? "kind" in resolvedMusicSubject
        ? {
            type: resolvedMusicSubject.kind === "project" ? "music_project" as const : "music_item" as const,
            id: resolvedMusicSubject.id,
            title: resolvedMusicSubject.title,
            lifecycleStage: resolvedMusicSubject.lifecycleStage ?? resolvedMusicSubject.lifecycle,
          }
        : resolvedMusicSubject
      : undefined;
    const optimisticConversation = conversationId
      ? withOptimisticManagerMessage(sourceConversation, trimmedBody)
      : createOptimisticManagerConversation(trimmedBody, musicSubjectView);
    const optimisticId = optimisticConversation?.id;
    const lockedTopic = stableTopic ?? sourceConversation?.topic;
    let streamCompleted = false;

    try {
      setManagerSendPending(true);
      setManagerSendError(null);
      if (optimisticConversation) {
        setSelectedConversation(optimisticConversation);
        setConversations((current) => [optimisticConversation, ...current.filter((item) => item.id !== optimisticConversation.id)]);
        navigate("conversationWorkspace");
      }

      const managerInput = {
        body: trimmedBody,
        ...(conversationId ? { conversationId } : {}),
        ...(options.contextRequestId ? { contextRequestId: options.contextRequestId } : {}),
        ...(options.contextAnswers?.length ? { contextAnswers: options.contextAnswers } : {}),
        ...(options.attachmentIds?.length ? { attachmentIds: options.attachmentIds } : {}),
        ...(options.taskId ? { taskId: options.taskId } : {}),
        ...(effectiveMusicSubject ? { musicSubject: effectiveMusicSubject } : {}),
      };

      if (repositories.manager.sendMessageStream) {
        await repositories.manager.sendMessageStream(
          managerInput,
          {
            onEvent: (event) => {
              if (streamCompleted) return;
              handleManagerConversationStreamEvent(event, {
                optimisticId,
                conversationId,
                lockedTopic,
                userBody: trimmedBody,
                musicSubject: effectiveMusicSubject,
                musicSubjectView,
              });
              if (event.type === "conversation.completed") {
                streamCompleted = true;
              }
            },
          },
        );
        return;
      }

      const conversation = await repositories.manager.sendMessage(managerInput);
      const mergedConversation = {
        ...conversation,
        ...(lockedTopic ? { topic: lockedTopic } : {}),
        ...(conversation.musicSubject || musicSubjectView ? { musicSubject: conversation.musicSubject ?? musicSubjectView } : {}),
      };
      setConversations((current) => [mergedConversation, ...current.filter((item) => item.id !== mergedConversation.id && item.id !== optimisticId)]);
      setSelectedConversation(mergedConversation);
      invalidateConversationCache(mergedConversation.id);
      if (effectiveMusicSubject) {
        setMusic((items) => applyManagerConversationLink(items, effectiveMusicSubject, mergedConversation.id));
        await refreshMusicObject(effectiveMusicSubject.id, effectiveMusicSubject.type);
      }
      trackEvent("chat message sent", { agent_type: "manager", is_test_user: isTestUser });
      const createdWork = conversationWorkItems(conversation);
      const workspaceMusicCreated = createdWork.some((work) => work.type === "music_item");
      if (workspaceMusicCreated) {
        await refreshFromManagerHint({
          music: true,
          missions: true,
          missionIds: createdWork.filter((work) => work.type === "mission").flatMap((work) => work.id ? [work.id] : []),
          taskIds: createdWork.filter((work) => work.type === "task").flatMap((work) => work.id ? [work.id] : []),
        });
      } else if (conversationHasMissionWork(conversation)) {
        const nextMissions = await reloadMissionList();
        setMissions(nextMissions);
        setSelectedMissionId(selectCreatedMissionId(conversation, nextMissions));
      }
      navigate("conversationWorkspace");
      if (shouldHydrateCompletedConversationArtifacts(mergedConversation, trimmedBody)) {
        void hydrateCompletedConversationArtifacts(mergedConversation.id);
      }
    } catch (error) {
      if (streamCompleted) {
        return;
      }
      const errorMessage = readErrorMessage(error, "Manager conversation failed.");
      setManagerSendError(errorMessage);
      applyManagerStreamError(errorMessage);
    } finally {
      setManagerSendPending(false);
    }
  }

  function handleManagerConversationStreamEvent(
    event: ManagerConversationStreamEvent,
    context: {
      optimisticId?: string;
      conversationId?: string;
      lockedTopic?: string;
      userBody: string;
      musicSubject?: ManagerConversationMusicSubject;
      musicSubjectView?: ConversationViewModel["musicSubject"];
    },
  ) {
    if (event.type === "conversation.started") {
      const nextConversation = conversationFromStartedEvent(event, context);
      reconcileStartedConversationState(context.optimisticId, nextConversation);
      if (context.musicSubject) {
        setMusic((items) => applyManagerConversationLink(items, context.musicSubject!, nextConversation.id));
      }
      return;
    }

    if (event.type === "conversation.workspace_ready") {
      updateActiveConversation((conversation) => ({
        ...conversation,
        topic: event.topic || conversation.topic,
        musicSubject: event.musicSubject,
        createdWork: mergeCreatedWorkItems(conversation.createdWork, event.createdWork),
      }));
      void refreshFromManagerHint(event.refresh);
      return;
    }

    if (event.type === "run.step") {
      updateActiveConversation((conversation) => appendManagerRunStep(conversation, {
        id: event.stepId ?? normalizeStepId(event.label),
        label: event.label,
        status: event.status,
        detail: event.detail,
      }, event.runId));
      return;
    }

    if (event.type === "tool.started" || event.type === "tool.completed") {
      updateActiveConversation((conversation) => appendManagerRunStep(conversation, {
        id: normalizeStepId(event.tool),
        label: event.label,
        status: event.status ?? (event.type === "tool.completed" ? "completed" : "running"),
        detail: event.detail,
      }, event.runId));
      return;
    }

    if (event.type === "assistant.delta") {
      updateActiveConversation((conversation) => appendManagerDelta(conversation, event.delta, event.runId));
      return;
    }

    if (event.type === "release_success.changed") {
      updateActiveConversation((conversation) => ({
        ...conversation,
        releaseSuccessArtifacts: mergeReleaseSuccessArtifacts(
          conversation.releaseSuccessArtifacts ?? [],
          [event.artifact],
        ),
      }));
      void refreshFromManagerHint(event.refresh);
      return;
    }

    if (event.type === "artifact.changed") {
      updateActiveConversation((conversation) => ({
        ...conversation,
        createdWork: upsertCreatedWork(conversation.createdWork, event.artifact),
        messages: conversation.messages.map((message, index, messages) =>
          index === messages.length - 1 && message.speaker === "manager"
            ? { ...message, createdWork: upsertCreatedWork(message.createdWork ?? [], event.artifact) }
            : message,
        ),
      }));
      void refreshFromManagerHint(event.refresh);
      return;
    }

    if (event.type === "conversation.completed") {
      const completedConversation = context.lockedTopic ? { ...event.conversation, topic: context.lockedTopic } : event.conversation;
      updateCompletedManagerConversation(context.optimisticId, completedConversation, Boolean(context.lockedTopic));
      invalidateConversationCache(completedConversation.id);
      trackEvent("chat message sent", { agent_type: "manager", is_test_user: isTestUser });
      if (shouldHydrateCompletedConversationArtifacts(completedConversation, context.userBody)) {
        void hydrateCompletedConversationArtifacts(completedConversation.id);
      }
      void refreshFromManagerHint(event.refresh ?? { missions: conversationHasMissionWork(completedConversation) });
      return;
    }

    if (event.type === "error") {
      applyManagerStreamError(event.message);
    }
  }

  function reconcileStartedConversationState(previousId: string | undefined, nextConversation: ConversationViewModel) {
    setSelectedConversation((current) => {
      const merged = mergeStartedConversation(current, nextConversation);
      setConversations((items) => {
        const existing = items.find((item) => item.id === previousId || item.id === nextConversation.id);
        const fromList = existing && existing !== current ? mergeStartedConversation(existing, merged) : merged;
        return [fromList, ...items.filter((item) => item.id !== previousId && item.id !== nextConversation.id)];
      });
      return merged;
    });
  }

  function updateActiveConversation(updater: (conversation: ConversationViewModel) => ConversationViewModel) {
    setSelectedConversation((current) => {
      if (!current) return current;
      const nextConversation = updater(current);
      setConversations((items) => [nextConversation, ...items.filter((item) => item.id !== current.id && item.id !== nextConversation.id)]);
      return nextConversation;
    });
  }

  function updateCompletedManagerConversation(previousId: string | undefined, completedConversation: ConversationViewModel, preserveCurrentTopic = false) {
    setSelectedConversation((current) => {
      const merged = mergeCompletedConversation(current, completedConversation, preserveCurrentTopic);
      setConversations((items) => [merged, ...items.filter((item) => item.id !== previousId && item.id !== merged.id)]);
      return merged;
    });
  }

  function invalidateConversationCache(conversationId: string) {
    resourceRequests.invalidate(resourceWorkspaceId, `conversation:${conversationId}`);
    resourceRequests.invalidate(resourceWorkspaceId, "conversation-list");
  }

  function applyManagerStreamError(message: string) {
    setManagerSendError(message);
    updateActiveConversation((conversation) => ({
      ...conversation,
      status: "Manager failed",
      activeRun: conversation.activeRun ? { ...conversation.activeRun, status: "failed", error: message } : undefined,
      messages: [
        ...conversation.messages.filter((item) => item.status !== "streaming"),
        {
          id: `manager-error-${Date.now()}`,
          speaker: "manager",
          label: "Manager",
          body: message,
          status: "failed",
        },
      ],
    }));
  }

  async function handleWorkspaceInvalidations(invalidations: WorkspaceInvalidation[]) {
    for (const invalidation of invalidations) {
      resourceRequests.invalidate(resourceWorkspaceId, workspaceResourceKey(invalidation));
    }

    const scopes = new Set(invalidations.map((invalidation) => invalidation.scope));
    const baseLoads: Promise<void>[] = [];
    let loadedMissions: MissionViewModel[] | undefined;

    if (scopes.has("workspace")) {
      baseLoads.push(workspaceLoader.loadActiveWorkspace(analyticsUser).then((nextWorkspace) => {
        if (!nextWorkspace) return;
        onWorkspaceChange?.(nextWorkspace);
        if (isWorkspaceReadyForDesk(nextWorkspace)) setView("labelHQ");
      }));
    }
    if (scopes.has("activity")) {
      baseLoads.push(loadActivityResource().then((nextActivity) => {
        setAttention(nextActivity.attention);
        setMovement(nextActivity.movement);
      }));
    }
    if (scopes.has("desk-brief")) {
      baseLoads.push(loadBriefResource().then((brief) => {
        setTodayBrief(brief);
        if (activeTodayBriefRun && brief.managerSynthesisRunId === activeTodayBriefRun.id) {
          setTodayBriefPending(false);
          setActiveTodayBriefRun(null);
          trackBriefGenerated(brief, activeTodayBriefRun.mode);
        }
      }));
    }
    if (scopes.has("music-list")) {
      baseLoads.push(loadMusicListResource().then(setMusic));
    }
    if (scopes.has("mission-list")) {
      baseLoads.push(loadMissionListResource().then((nextMissions) => {
        loadedMissions = nextMissions;
        setMissions(nextMissions);
        setSelectedMissionId((current) => current || nextMissions[0]?.id || "");
      }));
    }
    if (scopes.has("conversation-list")) {
      baseLoads.push(loadConversationListResource().then((nextConversations) => {
        conversationListLoaded.current = true;
        setConversations(nextConversations);
      }));
    }
    await Promise.all(baseLoads);

    for (const invalidation of invalidations) {
      if (invalidation.scope === "music-object") {
        const current = music.find((item) => item.id === invalidation.id);
        if (!current) continue;
        const subjectType = current.kind === "project" ? "music_project" : "music_item";
        const refreshed = await resourceRequests.load(resourceWorkspaceId, `music-object:${invalidation.id}`, () =>
          repositories.music.loadMusicObject(invalidation.id, subjectType)
        );
        if (refreshed) setMusic((items) => items.map((item) => item.id === refreshed.id ? refreshed : item));
      }
      if (invalidation.scope === "mission") await hydrateMission(invalidation.id);
      if (invalidation.scope === "conversation" && selectedConversation?.id === invalidation.id) {
        const refreshed = await resourceRequests.load(resourceWorkspaceId, `conversation:${invalidation.id}`, () =>
          repositories.manager.loadConversation?.(invalidation.id)
            ?? repositories.manager.loadConversations().then((items) => items.find((item) => item.id === invalidation.id) ?? null)
        );
        if (refreshed) {
          setSelectedConversation(refreshed);
          setConversations((items) => [refreshed, ...items.filter((item) => item.id !== refreshed.id)]);
        }
      }
    }

    return { missions: loadedMissions };
  }

  async function refreshFromManagerHint(hint?: ManagerConversationRefreshHint) {
    if (!hint) return;
    const result = await handleWorkspaceInvalidations(invalidationsFromManagerRefreshHint(hint));
    if (hint.missions && result.missions) {
      setSelectedMissionId((current) => selectTargetMissionId(hint, result.missions!) || current || result.missions![0]?.id || "");
    }
  }

  async function openCreatedWork(type: "music_item" | "mission" | "task", id?: string, destination?: "files", artifactId?: string) {
    if (type === "music_item") {
      setTargetSongRoomTab(destination === "files" ? "files" : "overview");
      setTargetSongDocumentId(destination === "files" ? artifactId ?? null : null);
      setTargetMusicObjectId(id ?? null);
      setMusicRoomOpenRequestKey((current) => current + 1);
      navigate("musicWorkspace");
      return;
    }

    if (type === "mission" || type === "task") {
      navigate("missionsWorkspace");
      const nextMissions = await reloadMissionList();
      setMissions(nextMissions);
      const targetMissionId = type === "task"
        ? selectMissionIdForTask(id, nextMissions) ?? selectMissionId(id, nextMissions)
        : selectMissionId(id, nextMissions);
      setSelectedMissionId(targetMissionId);
      setMissionRoomOpenTab(type === "task" ? "tasks" : "pulse");
      setMissionRoomOpenTaskId(type === "task" ? id ?? null : null);
      if (targetMissionId) {
        await hydrateMission(targetMissionId, true);
        setMissionRoomOpenRequestKey((current) => current + 1);
      } else {
        setMissionListOpenRequestKey((current) => current + 1);
      }
    }
  }

  function openMissionRoom(missionId: string, tab: MissionRoomTab = "pulse") {
    setSelectedMissionId(missionId);
    setMissionRoomOpenTab(tab);
    setMissionRoomOpenTaskId(null);
    setMissionRoomOpenRequestKey((current) => current + 1);
    navigate("missionsWorkspace");
    void hydrateMission(missionId);
  }

  async function reloadMusic() {
    resourceRequests.invalidate(resourceWorkspaceId, "music-list");
    const nextMusic = await resourceRequests.load(resourceWorkspaceId, "music-list", () => repositories.music.loadMusic());
    setMusic(nextMusic);
    return nextMusic;
  }

  async function handleSongWorkspaceCreated(result: import("../types/cleanProduction").ManualSongWorkspaceResult) {
    setMusic((current) => [result.song, ...current.filter((item) => item.id !== result.song.id)]);
    setConversations((current) => [result.conversation, ...current.filter((item) => item.id !== result.conversation.id)]);
    void reloadMissionList().then(setMissions).catch(() => undefined);
  }

  const refreshMusicObject = useCallback(async (
    subjectId: string,
    subjectType: "music_item" | "music_project",
  ) => {
    const resourceKey = `music-object:${subjectId}` as const;
    resourceRequests.invalidate(resourceWorkspaceId, resourceKey);
    const refreshed = await resourceRequests.load(resourceWorkspaceId, resourceKey, () => repositories.music.loadMusicObject(subjectId, subjectType));
    const expectedKind = subjectType === "music_project" ? "project" : "song";
    if (!refreshed || refreshed.id !== subjectId || refreshed.kind !== expectedKind) return null;
    setMusic((current) => current.map((item) =>
      item.id === subjectId && item.kind === expectedKind ? refreshed : item
    ));
    return refreshed;
  }, [repositories.music, resourceRequests, resourceWorkspaceId]);

  async function generateTodaysBrief(mode: TodayBriefGenerationMode = "operating") {
    let continuesInBackground = false;
    try {
      setTodayBriefPending(true);
      setTodayBriefError(null);
      const result = await repositories.desk.generateTodaysBrief(mode);
      if (isTodayBriefProcessingResult(result)) {
        continuesInBackground = true;
        setActiveTodayBriefRun({ id: result.runId, mode });
        return result;
      }
      const nextBrief = briefFromGenerationResult(result);
      resourceRequests.invalidate(resourceWorkspaceId, "desk-brief");
      setTodayBrief(nextBrief);
      trackBriefGenerated(nextBrief, mode);
      return result;
    } catch (error) {
      setTodayBriefError(readErrorMessage(error, "Today's Brief could not be generated."));
      throw error;
    } finally {
      if (!continuesInBackground) setTodayBriefPending(false);
    }
  }

  async function refreshTodaysBrief() {
    if (todayBriefRefreshInFlight.current || todayBriefPending || activeTodayBriefRun) return;
    todayBriefRefreshInFlight.current = true;
    try {
      await generateTodaysBrief("operating");
    } catch {
      // generateTodaysBrief owns the local error state; keep the existing brief visible.
    } finally {
      todayBriefRefreshInFlight.current = false;
    }
  }

  async function refreshPublicContext() {
    if (!repositories.desk.refreshPublicContext) {
      setTodayBriefError("Public context refresh is not available in this runtime.");
      return;
    }

    try {
      setPublicContextPending(true);
      setTodayBriefError(null);
      const result = await repositories.desk.refreshPublicContext();
      addPublicContextMovement(result);
    } catch (error) {
      setTodayBriefError(readErrorMessage(error, "Public context could not be refreshed."));
    } finally {
      setPublicContextPending(false);
    }
  }

  function addPublicContextMovement(result: PublicContextRefreshResult) {
    const title = result.findingsInserted
      ? `Public context added ${result.findingsInserted} sourced signal${result.findingsInserted === 1 ? "" : "s"}`
      : "Public context refresh found no new sourced signals";
    setMovement((current) => [
      { label: "Public web", title, time: "Just now" },
      ...current.filter((item) => item.title !== title),
    ]);
  }

  async function completeSetupActivity(nextWorkspace: ProductionWorkspace) {
    const generationStartedAt = Date.now();
    try {
      setSetupActivityPending(true);
      setSetupActivityError(null);
      let setupGeneration: TodayBriefGenerationResponse | null = null;
      const checkoutSessionId = nextWorkspace.billingCheckoutSessionId;
      if (!checkoutSessionId || !billingService?.runSetupPhase) {
        setupGeneration = await generateTodaysBrief("setup-map");
      } else {
        const result = await billingService.runSetupPhase({ checkoutSessionId, phase: "contextualize" });
        if (result.brief) {
          setTodayBrief(result.brief);
          trackBriefGenerated(result.brief, "setup-map");
          setupGeneration = { brief: result.brief, setupMusicReadTargets: result.setupMusicReadTargets ?? [] };
          onWorkspaceChange?.({
            ...nextWorkspace,
            setupStatus: "completed",
            setupStage: "music_reads",
            setupStageStatus: {
              ...nextWorkspace.setupStageStatus,
              setup_brief: { status: "completed" },
              music_reads: { status: result.setupMusicReadTargets?.length ? "running" : "completed" },
            },
          });
        } else {
          const refreshedWorkspace = await workspaceLoader.loadActiveWorkspace(analyticsUser);
          if (refreshedWorkspace) onWorkspaceChange?.(refreshedWorkspace);
          return;
        }
      }
      if (!setupGeneration) return;
      if (isTodayBriefProcessingResult(setupGeneration)) return;
      const setupBrief = briefFromGenerationResult(setupGeneration);
      if (setupBrief.state === "fallback" || setupBrief.state === "failed") {
        throw new Error("Setup map needs a live Manager read. Retry to regenerate it.");
      }
      const setupBriefId = briefAnalyticsId(setupBrief, nextWorkspace.artistWorkspaceId);
      trackEventOnce(
        "manager memory generated",
        {
          artist_id: nextWorkspace.artistId,
          generation_time_seconds: Math.max(0, (Date.now() - generationStartedAt) / 1000),
          is_test_user: isTestUser,
        },
        `${analyticsUser.id}:${nextWorkspace.artistWorkspaceId}:${setupBriefId}`,
      );

      trackEventOnce(
        "onboarding completed",
        { artist_id: nextWorkspace.artistId, setup_mode: "setup-map", is_test_user: isTestUser },
        `${analyticsUser.id}:${nextWorkspace.artistWorkspaceId}`,
      );
      enterDeskWithProgressiveTransition(() => setView("labelHQ"));
    } catch (error) {
      setSetupActivityError(readErrorMessage(error, "Setup map could not be generated."));
    } finally {
      setSetupActivityPending(false);
    }
  }

  async function retryPersistedSetup() {
    if (!workspace) return;
    try {
      setSetupActivityPending(true);
      setSetupActivityError(null);
      if (workspace.billingCheckoutSessionId && billingService?.retrySetup) {
        const result = await billingService.retrySetup({ checkoutSessionId: workspace.billingCheckoutSessionId });
        if (result.workspace) onWorkspaceChange?.(result.workspace);
        const refreshedWorkspace = await workspaceLoader.loadActiveWorkspace(analyticsUser);
        if (refreshedWorkspace) onWorkspaceChange?.(refreshedWorkspace);
        return;
      }
      await completeSetupActivity(workspace);
    } catch (error) {
      setSetupActivityError(readErrorMessage(error, "Setup could not be retried."));
    } finally {
      setSetupActivityPending(false);
    }
  }

  async function runMissionGenesis() {
    try {
      setMissionGenesisPending(true);
      setMissionGenesisError(null);
      const result = await repositories.missionGenesis.runMissionGenesis();
      setMissionGenesisResult(result);
      setMissionGenesisAnswers({});
      if (result.outcome === "candidate_needs_context" && result.questions.length) {
        addMissionGenesisAttention();
        navigate("managerOffice");
      }
      if (shouldOpenMissionGenesisMissions(result)) {
        clearMissionGenesisAttention();
        const nextMissions = await reloadMissionList();
        trackCreatedMissions(result, nextMissions);
        setMissions(nextMissions);
        const missionId = selectMissionGenesisMissionId(result, nextMissions);
        setSelectedMissionId(missionId);
        if (missionId) void hydrateMission(missionId);
        setMissionListOpenRequestKey((current) => current + 1);
        navigate("missionsWorkspace");
      }
    } catch (error) {
      setMissionGenesisError(readErrorMessage(error, "Mission Genesis failed."));
    } finally {
      setMissionGenesisPending(false);
    }
  }

  function createFirstMissionWithManager() {
    void sendManagerMessage(CREATE_FIRST_MISSION_PROMPT);
  }

  async function submitMissionGenesisAnswers(candidateMissionId?: string) {
    const targetCandidateMissionId = candidateMissionId ?? missionGenesisResult?.candidateMissionId ?? missionGenesisResult?.candidateMissionIds?.[0];
    if (!targetCandidateMissionId) return;
    try {
      setMissionGenesisPending(true);
      setMissionGenesisError(null);
      const result = await repositories.missionGenesis.answerMissionGenesisContext({
        candidateMissionId: targetCandidateMissionId,
        answers: missionGenesisResult.questions.map((question) => ({
          questionKey: question.key,
          answer: missionGenesisAnswers[question.key] ?? "",
        })),
      });
      setMissionGenesisResult(result);
      const nextMissions = await reloadMissionList();
      trackCreatedMissions(result, nextMissions);
      setMissions(nextMissions);
      const selectedMissionId = selectMissionGenesisMissionId(result, nextMissions);
      setSelectedMissionId(selectedMissionId);
      if (selectedMissionId) {
        void hydrateMission(selectedMissionId);
        clearMissionGenesisAttention();
        setMissionListOpenRequestKey((current) => current + 1);
        navigate("missionsWorkspace");
      }
    } catch (error) {
      setMissionGenesisError(readErrorMessage(error, "Mission Genesis failed."));
    } finally {
      setMissionGenesisPending(false);
    }
  }

  function addMissionGenesisAttention() {
    setAttention((current) => {
      const filtered = current.filter((item) => item.title !== "Mission Genesis needs context");
      return [
        {
          title: "Mission Genesis needs context",
          body: "The Manager has questions to answer before creating this artist's next mission.",
          tone: "warning",
          target: "managerOffice",
        },
        ...filtered,
      ];
    });
    setMovement((current) => [
      { label: "Manager", title: "Mission Genesis opened a context request", time: "Just now" },
      ...current.filter((item) => item.title !== "Mission Genesis opened a context request"),
    ]);
  }

  function clearMissionGenesisAttention() {
    setAttention((current) => current.filter((item) => item.title !== "Mission Genesis needs context"));
  }

  function openCreatedMissionFromManager() {
    const activatedMissionId = firstMissionGenesisMissionId(missionGenesisResult);
    if (activatedMissionId) {
      setSelectedMissionId(activatedMissionId);
    }
    setMissionListOpenRequestKey((current) => current + 1);
    navigate("missionsWorkspace");
  }

  async function approveMissionTask(taskId: string) {
    await repositories.missions.approveTask(taskId);
    const nextMissions = await reloadMissionList();
    setMissions(nextMissions);
    setSelectedMissionId((current) => current || nextMissions[0]?.id || "");
    if (selectedMissionId) await hydrateMission(selectedMissionId, true);
  }

  async function uploadMissionTaskDeliverable(taskId: string, input: { title: string; file: File }) {
    if (!repositories.missions.uploadTaskDeliverable) {
      throw new Error("Document upload is not available for this workspace.");
    }
    const deliverable = await repositories.missions.uploadTaskDeliverable(taskId, input);
    const nextMissions = await reloadMissionList();
    setMissions(nextMissions);
    setSelectedMissionId((current) => current || nextMissions[0]?.id || "");
    if (selectedMissionId) await hydrateMission(selectedMissionId, true);
    return deliverable;
  }

  function workWithManagerOnTask(taskId: string) {
    const mission = missions.find((item) => item.tasks?.some((task) => task.id === taskId));
    const task = mission?.tasks?.find((item) => item.id === taskId);
    if (!task) return;
    setManagerTaskContextId(taskId);
    setSelectedMissionId(mission?.id ?? "");
    void sendManagerMessage(
      `Help me complete "${task.title}". Use the task's completion contract and current mission context. ${
        task.managerDraft ? "Continue revising the current draft." : "Start a strong first draft and ask only for context that materially changes it."
      }`,
      undefined,
      `Task: ${task.title}`,
      { taskId },
    );
  }

  async function returnToManagerTask() {
    if (!managerTaskContextId) return;
    const mission = missions.find((item) => item.tasks?.some((task) => task.id === managerTaskContextId));
    if (mission) {
      setSelectedMissionId(mission.id);
      await hydrateMission(mission.id, true);
    }
    setMissionRoomOpenTaskId(managerTaskContextId);
    setMissionRoomOpenTab("tasks");
    setMissionRoomOpenRequestKey((current) => current + 1);
    navigate("missionsWorkspace");
  }

  async function completeMissionTask(taskId: string, status: "completed" | "blocked", note: string, documentIds?: string[], managerOutputId?: string) {
    const updatedMission = await repositories.missions.completeTask(taskId, {
      status,
      note,
      documentIds,
      managerOutputId,
    });
    setMissions((current) => current.map((mission) => mission.id === updatedMission.id ? updatedMission : mission));
    setSelectedMissionId(updatedMission.id);
    if (status === "completed") {
      trackEventOnce(
        "mission task completed",
        { mission_id: updatedMission.id, task_id: taskId, is_test_user: isTestUser },
        `${analyticsUser.id}:${updatedMission.id}:${taskId}`,
      );
    }
  }

  function trackBriefGenerated(brief: TodayBriefViewModel, mode: TodayBriefGenerationMode) {
    if (!workspace) return;
    trackEvent("brief generated", {
      brief_id: briefAnalyticsId(brief, workspace.artistWorkspaceId),
      artist_id: workspace.artistId,
      generation_mode: mode,
      state: brief.state,
      confidence: brief.confidence,
      is_test_user: isTestUser,
    });
  }

  function trackCreatedMissions(result: MissionGenesisResultViewModel, persistedMissions: MissionViewModel[]) {
    if (result.outcome !== "activate_mission") return;

    const persistedIds = new Set(persistedMissions.map((mission) => mission.id));
    for (const missionId of activatedMissionGenesisIds(result).filter((id) => persistedIds.has(id))) {
      trackEventOnce(
        "mission created",
        { mission_id: missionId, mission_type: "mission_genesis", is_test_user: isTestUser },
        `${analyticsUser.id}:${missionId}`,
      );
    }
  }

  if (viewModelError) {
    return (
      <AuthFrame>
        <AuthMessageCard eyebrow="View data failed" title="Workspace data could not load" body={viewModelError} />
      </AuthFrame>
    );
  }

  if (!profile) {
    return (
      <BrandedLoader
        title="Loading workspace data"
        body="Preparing artist, music, mission, and manager views."
        steps={["Artist", "Music", "Missions", "Manager"]}
        logoTestId="auth-brand-logo"
      />
    );
  }

  if (view === "connectArtist") {
    return <ConnectArtistScreen profile={profile} onContinue={() => navigate("setup")} onSignOut={onSignOut} />;
  }

  if (view === "setup") {
    const showPersistedSetup = Boolean(workspace?.contextComplete && !isWorkspaceReadyForDesk(workspace));
    if (showPersistedSetup || setupActivityPending || setupActivityError) {
      return (
        <SetupActivityScreen
          artistWorkspaceId={workspace?.artistWorkspaceId}
          setupRunId={workspace?.setupRunId}
          status={setupActivityError ? "failed" : workspace?.setupStatus ?? "running"}
          stage={workspace?.setupStage}
          stageStatus={workspace?.setupStageStatus}
          error={setupActivityError ?? workspace?.setupLastError}
          retrying={setupActivityPending}
          onRetry={() => void retryPersistedSetup()}
          onComplete={() => {
            if (workspace) onWorkspaceChange?.({ ...workspace, setupStatus: "completed" });
            enterDeskWithProgressiveTransition(() => setView("labelHQ"));
          }}
        />
      );
    }

    return (
      <>
        <SetupScreen
          profile={profile}
          onChange={setProfile}
          onBack={() => navigate("connectArtist")}
          pending={setupPending}
          catalogSyncStatus={workspace?.latestCatalogSyncStatus}
          onSignOut={onSignOut}
          onContinue={async (nextProfile) => {
            if (!workspace || !profileSetupService) {
              navigate("labelHQ");
              return;
            }

            try {
              setSetupPending(true);
              setSetupError(null);
              const savedWorkspace = await profileSetupService.saveSetupContext(workspace, nextProfile);
              const nextWorkspace = { ...workspace, ...savedWorkspace };
              onWorkspaceChange?.(nextWorkspace);
              setDrawer(null);
              if (nextWorkspace.contextComplete) {
                await completeSetupActivity(nextWorkspace);
              } else {
                setView("setup");
              }
            } catch (saveError) {
              setSetupError(readErrorMessage(saveError, "Artist context could not be saved."));
            } finally {
              setSetupPending(false);
            }
          }}
        />
        {setupError ? (
          <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2">
            <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4 text-sm font-semibold text-muted-foreground">Couldn’t save this yet. Try again.</div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="app-theme min-h-screen bg-background text-foreground selection:bg-brand-accent/15">
      <div className="relative z-20 mx-auto grid min-h-screen w-full max-w-[1760px] gap-0 px-3 pb-28 pt-0 sm:px-5 lg:grid-cols-[216px_minmax(0,1fr)] lg:px-0 lg:py-0 lg:pb-0">
        <DeskRail
          active={activeSection}
          activeMissionCount={missions.filter((mission) => mission.status !== "complete").length}
          recentManagerConversations={conversations.slice(0, 3).map((conversation) => ({ id: conversation.id, topic: conversation.topic }))}
          onOpenManagerConversation={(conversationId) => {
            const conversation = conversations.find((candidate) => candidate.id === conversationId);
            if (conversation) void openConversation(conversation);
          }}
          onNavigate={navigateFromMenu}
          onSignOut={onSignOut}
        />
        <main className="min-w-0 py-0 lg:px-8 lg:py-7">
          <MobileChrome
            active={activeSection}
            title={mobileTitle}
            activeMissionCount={missions.filter((mission) => mission.status !== "complete").length}
            notificationCount={notificationCount}
            onOpenNotifications={openActivityCenter}
            onNavigate={navigateFromMenu}
            avatarUrl={profile.imageUrl ?? workspace?.spotifyImageUrl}
            showTopbar={showMobileTopbar}
            showTabbar={showMobileTabbar}
          />
          {view === "labelHQ" ? (
            <DeskHQScreen
              profile={profile}
              todayBrief={todayBrief}
              todayBriefError={todayBriefError}
              attention={attention}
              movement={movement}
              agents={agents}
              missions={missions}
              music={music}
              onNavigate={navigate}
              onManager={openManager}
              onOpenMission={openMissionRoom}
              onLockedAgent={(agent) => {
                setSelectedAgent(agent);
                navigate("lockedAgentWorkspace");
              }}
              onDrawer={openDrawer}
              onOpenMusicFocus={openMusicFocus}
              onAskManager={(body) => void sendManagerMessage(body)}
              activityCount={notificationCount}
              onOpenActivityCenter={openActivityCenter}
              briefPending={todayBriefPending}
              onRefreshBrief={() => void refreshTodaysBrief()}
            />
          ) : null}
          {view === "musicWorkspace" ? (
            <MusicWorkspace
              music={music}
              missions={missions}
              targetMusicObjectId={targetMusicObjectId}
              targetSongRoomTab={targetSongRoomTab}
              targetDocumentId={targetSongDocumentId}
              targetRequestKey={musicRoomOpenRequestKey}
              musicRepository={repositories.music}
              onRefreshObject={refreshMusicObject}
              onMusicChanged={reloadMusic}
              onSongWorkspaceCreated={handleSongWorkspaceCreated}
              onOpenMission={openMissionRoom}
              onOpenManager={(subject) => void openMusicManagerConversation(subject)}
              onBack={() => navigate("labelHQ")}
              onDetailModeChange={setMusicDetailOpen}
              listRequestKey={musicListOpenRequestKey}
            />
          ) : null}
          {view === "staffWorkspace" ? (
            <StaffWorkspace
              agents={agents}
              onManager={openManager}
              onLockedAgent={(agent) => {
                setSelectedAgent(agent);
                navigate("lockedAgentWorkspace");
              }}
            />
          ) : null}
          {view === "lockedAgentWorkspace" && activeAgent ? (
            <LockedAgentWorkspace agent={activeAgent} onBack={() => navigate("staffWorkspace")} />
          ) : null}
          {view === "managerOffice" ? (
            <ManagerOfficeScreen
              conversations={conversations}
              missionGenesisResult={missionGenesisResult}
              missionGenesisAnswers={missionGenesisAnswers}
              missionGenesisPending={missionGenesisPending}
              missionGenesisError={missionGenesisError}
              onMissionGenesisAnswerChange={(key, value) => setMissionGenesisAnswers((current) => ({ ...current, [key]: value }))}
              onSubmitMissionGenesisAnswers={submitMissionGenesisAnswers}
              onOpenCreatedMission={openCreatedMissionFromManager}
              onBack={() => navigate("labelHQ")}
              onConversation={openConversation}
              onAskManager={(body) => void sendManagerMessage(body)}
              askManagerPending={managerSendPending}
              askManagerError={managerSendError}
              conversationsPending={conversationListPending}
              conversationsError={conversationListError}
              onRetryConversations={retryManagerConversationList}
            />
          ) : null}
          {view === "conversationWorkspace" && activeConversation ? (
            <div aria-busy={conversationDetailPending}>
              <ConversationWorkspace
                conversation={activeConversation}
                onBack={() => navigate("managerOffice")}
                taskContext={managerTaskContextId
                  ? missions.flatMap((mission) => mission.tasks ?? []).find((task) => task.id === managerTaskContextId)
                  : undefined}
                onBackToTask={managerTaskContextId ? returnToManagerTask : undefined}
                onOpenCreatedWork={openCreatedWork}
                onOpenDecisionPackage={() => navigate("decisionPackage")}
                onApproveReleaseDateChange={approveReleaseDateChange}
                onKeepReleaseDate={keepReleaseDateAndShowRecoveryPlan}
                onReviewReleaseSuccess={() => undefined}
                onRetryReleaseSuccess={retryReleaseSuccessReview}
                onPrepareOpportunityPitch={prepareOpportunityPitch}
                onRecordOpportunityOutcome={recordOpportunityOutcome}
                onRetryOpportunityResearch={retryOpportunityResearch}
                onOpenMusicSubject={(subject) => openMusicFocus(subject.id)}
                musicRepository={repositories.music}
                onRefreshMusicObject={async (musicItemId) => {
                  await refreshMusicObject(musicItemId, "music_item");
                }}
                onSendMessage={(body, conversationId, attachmentIds) => void sendManagerMessage(body, conversationId, activeConversation.topic, {
                   taskId: managerTaskContextId ?? undefined,
                   attachmentIds,
                   ...(activeConversation.musicSubject ? { musicSubject: { type: activeConversation.musicSubject.type, id: activeConversation.musicSubject.id } } : {}),
                 })}
                onSendContextAnswers={(body, conversationId, contextRequestId, contextAnswers) =>
                  void sendManagerMessage(body, conversationId, activeConversation.topic, {
                    contextRequestId,
                    contextAnswers,
                    taskId: managerTaskContextId ?? undefined,
                    ...(activeConversation.musicSubject ? { musicSubject: { type: activeConversation.musicSubject.type, id: activeConversation.musicSubject.id } } : {}),
                  })
                }
                onRetryLastMessage={() => {
                  const lastArtistMessage = activeConversation.messages.filter((message) => message.speaker === "artist").at(-1);
                  if (lastArtistMessage) {
                    void sendManagerMessage(lastArtistMessage.body, activeConversation.id, activeConversation.topic, {
                      taskId: managerTaskContextId ?? undefined,
                      ...(activeConversation.musicSubject ? { musicSubject: { type: activeConversation.musicSubject.type, id: activeConversation.musicSubject.id } } : {}),
                    });
                  }
                }}
                sendPending={managerSendPending}
                sendError={managerSendError}
                detailPending={conversationDetailPending}
                detailError={conversationDetailError}
                onRetryDetail={() => void openConversation(activeConversation)}
              />
            </div>
          ) : null}
          {view === "investigation" && activeConversation?.decisionPackage ? <InvestigationScreen onBack={() => navigate("managerOffice")} onDecision={() => navigate("decisionPackage")} /> : null}
          {view === "decisionPackage" ? <DecisionPackageScreen conversation={activeConversation} onBack={() => navigate("managerOffice")} onNavigate={navigate} /> : null}
          {view === "missionsWorkspace" ? (
            <div aria-busy={missionDetailPending}>
              <MissionsWorkspace
                missions={missions}
                selectedMissionId={selectedMissionId}
                detailPending={missionDetailPending}
                onSelectMission={selectMissionForDetail}
                onCreateFirstMission={createFirstMissionWithManager}
                onOpenManager={openManager}
                onOpenMusicSubject={(subject) => openMusicFocus(subject.id)}
                onWorkWithManager={workWithManagerOnTask}
                firstMissionPending={managerSendPending}
                onApproveTask={approveMissionTask}
                onCompleteTask={completeMissionTask}
                onUploadTaskDeliverable={uploadMissionTaskDeliverable}
                onDrawer={openDrawer}
                openRoomRequestKey={missionRoomOpenRequestKey}
                openRoomTab={missionRoomOpenTab}
                openTaskId={missionRoomOpenTaskId}
                listRequestKey={missionListOpenRequestKey}
                onRoomModeChange={setMissionRoomOpen}
              />
            </div>
          ) : null}
          {view === "artistProfileWorkspace" ? (
            <SettingsScreen
              profile={profile}
              accountEmail={analyticsUser.email}
              onChange={setProfile}
              onSaveProfile={
                workspace && profileSetupService?.updateArtistProfile
                  ? (nextProfile) => profileSetupService.updateArtistProfile!(workspace, nextProfile)
                  : undefined
              }
              onBack={() => navigate("labelHQ")}
              onSignOut={onSignOut}
              workspace={workspace ?? undefined}
              onUpdatePassword={authAdapter.updatePassword}
              onManageBilling={
                workspace && billingService?.openCustomerPortal
                  ? () => billingService.openCustomerPortal!(workspace)
                  : undefined
              }
              themeMode={themeMode}
              resolvedThemeMode={resolvedThemeMode}
              onThemeModeChange={setThemeMode}
            />
          ) : null}
        </main>
      </div>
      <div aria-busy={evidencePending}>
        <ProductionDrawers drawer={drawer} evidence={evidence} mission={selectedMission} onClose={() => setDrawer(null)} />
      </div>
      <WorkspaceActivityCenter
        open={activityCenterOpen}
        events={visibleWorkspaceEvents}
        error={activityError}
        hasMore={liveUpdatesEnabled && activityHasMore}
        loadingOlder={activityHistoryPending}
        onOpenChange={setActivityCenterOpen}
        onSelect={(event) => void openWorkspaceEvent(event)}
        onLoadOlder={loadOlderActivity}
        onSeen={markActivitySeen}
      />
      {activityToast ? <SuccessToast message={activityToast} onClose={() => setActivityToast(null)} /> : null}
      <span className="sr-only">{workspace?.workspaceName ?? "Ordersounds workspace"}</span>
      {liveUpdatesEnabled ? <span className="sr-only" aria-live="polite">{liveUpdateStatus}</span> : null}
    </div>
  );
}

function AuthScreen({
  authAdapter,
  onAuthenticated,
}: {
  authAdapter: ProductionAuthAdapter;
  onAuthenticated: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "forgot">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!authAdapter.requestPasswordReset) {
      setMessage("Password recovery is not configured.");
      return;
    }
    try {
      setPending(true);
      setMessage(null);
      await authAdapter.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/update-password` });
      setMessage("If that email belongs to an account, a recovery link is on its way.");
    } catch (recoveryError) {
      setMessage(readErrorMessage(recoveryError, "Password recovery could not be started."));
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
      const handler = isSignUp ? authAdapter.signUpWithPassword : authAdapter.signInWithPassword;
      if (!handler) {
        setMessage("Email/password authentication is not configured for this environment.");
        return;
      }

      const result = await handler({ email: email.trim(), password });
      setMessage(result.message ?? (isSignUp ? "Account created." : "Signed in."));
      if (result.user) {
        if (isSignUp) {
          identifyAnalyticsUser(result.user);
          trackEvent("user signed up", {
            signup_method: "email",
            is_test_user: isTestUserEmail(result.user.email),
          });
        }
        await onAuthenticated();
      }
    } catch (authError) {
      setMessage(readErrorMessage(authError, "Authentication failed."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame logoTestId="auth-brand-logo">
      <section className="w-full rounded-[18px] border border-foreground/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] backdrop-blur-xl sm:p-6">
        <div className="mb-5 flex items-center gap-3 lg:hidden">
          <BrandMark size="sm" />
          <div>
            <p className="font-display text-[14px] font-bold leading-none text-foreground">Ordersounds</p>
            <p className="mt-1 font-ui text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Artist operating desk</p>
          </div>
        </div>
        {/* Kept in DOM for test query and screen reader accessibility */}
        <h1 className="sr-only">Sign in to Ordersounds</h1>

        {mode === "forgot" ? (
          <form className="mt-6 space-y-4" onSubmit={handleForgotPassword}>
            <div>
              <p className="font-display text-[22px] font-bold text-foreground">Reset your password</p>
              <p className="mt-2 text-[12px] font-semibold text-muted-foreground">We will send a secure recovery link to your email.</p>
            </div>
            <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required disabled={pending} />
            {message ? <p className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-3 text-sm font-semibold text-muted-foreground">{message}</p> : null}
            <ProductButton type="submit" disabled={pending}>{pending ? "Sending recovery link" : "Send recovery link"}</ProductButton>
            <ProductButton variant="secondary" onClick={() => { setMode("sign-in"); setMessage(null); }}>Back to sign in</ProductButton>
          </form>
        ) : <>
        <div data-testid="auth-mode-switch" className="mt-6 grid grid-cols-2 rounded-[12px] border border-foreground/10 bg-foreground/[0.035] p-1">
          <button
            type="button"
            aria-label="Use sign in mode"
            onClick={() => {
              setMode("sign-in");
              setMessage(null);
            }}
            className={`h-9 rounded-[9px] font-ui text-[12px] font-bold transition-all ${
              !isSignUp ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-label="Use sign-up mode"
            onClick={() => {
              setMode("sign-up");
              setMessage(null);
            }}
            className={`h-9 rounded-[9px] font-ui text-[12px] font-bold transition-all ${
              isSignUp ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" required disabled={pending} />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            disabled={pending}
          />
          {message ? <p className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-3 text-sm font-semibold text-muted-foreground">{message}</p> : null}
          <div className="flex flex-col gap-3">
            <ProductButton type="submit" disabled={pending}>
              {pending ? (isSignUp ? "Creating account" : "Signing in") : isSignUp ? "Create account" : "Sign in"}
            </ProductButton>
            <ProductButton
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setMode(isSignUp ? "sign-in" : "sign-up");
                setMessage(null);
              }}
            >
              {isSignUp ? "Use existing account" : "Create account"}
            </ProductButton>
            {!isSignUp ? (
              <button type="button" onClick={() => { setMode("forgot"); setMessage(null); }} className="text-[12px] font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground">
                Forgot password?
              </button>
            ) : null}
          </div>
        </form>
        </>}

      </section>
    </AuthFrame>
  );
}

function PaymentReturnScreen({
  state,
  onRetry,
  onSignOut,
}: {
  state: PaymentReturnState;
  onRetry?: () => void;
  onSignOut?: () => void;
}) {
  const body =
    state.message ??
    (state.status === "checking"
      ? "Checking secure checkout confirmation."
      : state.status === "waiting"
        ? "Waiting for secure payment confirmation. Keep this tab open."
        : state.status === "ready"
          ? "Payment confirmed. Opening Desk HQ."
          : "This payment could not be matched to the signed-in account.");

  return (
    <AuthFrame logoTestId="auth-brand-logo">
      <section className="w-full rounded-[18px] border border-foreground/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] backdrop-blur-xl sm:p-6">
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-foreground/10 bg-foreground/[0.035] text-foreground">
          {state.status === "ready" ? <Check className="h-5 w-5" aria-hidden="true" /> : <CreditCard className="h-5 w-5" aria-hidden="true" />}
        </div>
        <p className="font-ui mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Secure checkout</p>
        <h1 className="font-display mt-3 text-[24px] font-bold tracking-tight text-foreground">Confirming payment</h1>
        <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{body}</p>
        <p className="mt-3 break-all rounded-[12px] border border-foreground/8 bg-foreground/[0.025] p-3 font-ui text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Reference {state.reference}
        </p>
        {state.status === "checking" || state.status === "waiting" ? (
          <div className="mt-5 inline-flex items-center gap-2 text-[12px] font-bold text-muted-foreground">
            <AppThinkingOrb state="solving" size={20} />
            Checking payment status
          </div>
        ) : null}
        {onRetry ? (
          <div className="mt-5">
            <ProductButton onClick={onRetry}>Retry payment confirmation</ProductButton>
          </div>
        ) : null}
        {onSignOut ? (
          <div className="mt-5">
            <ProductButton variant="secondary" onClick={onSignOut}>
              Use another account
            </ProductButton>
          </div>
        ) : null}
      </section>
    </AuthFrame>
  );
}

function SpotifyIdentityGate({
  user,
  workspace,
  workspaceLoader,
  billingService,
  spotifyArtistAdapter,
  onSignOut,
  onWorkspaceReady,
}: {
  user: ProductionUser | null;
  workspace: ProductionWorkspace | null;
  workspaceLoader: ProductionWorkspaceLoader;
  billingService?: ProductionBillingService;
  spotifyArtistAdapter?: ProductionSpotifyArtistAdapter;
  onSignOut?: () => void;
  onWorkspaceReady: (workspace: ProductionWorkspace) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ProductionSpotifyArtistCandidate[]>([]);
  const [checkoutPreview, setCheckoutPreview] = useState<ProductionBillingCheckoutPreview | null>(null);
  const [catalogPreview, setCatalogPreview] = useState<ProductionSpotifyCatalogPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [selectPending, setSelectPending] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const [billingProviderPreference, setBillingProviderPreference] = useState<ProductionBillingProviderPreference>("auto");
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<"monthly" | "yearly">("monthly");
  const pricingRequestRef = useRef(0);

  useEffect(() => {
    if (!billingService?.loadLatestCheckoutPreview || checkoutPreview) {
      return;
    }

    let cancelled = false;
    billingService
      .loadLatestCheckoutPreview()
      .then(async (preview) => {
        if (!cancelled && preview) {
          setCheckoutPreview(preview);
          setSelectedBillingInterval(preview.interval);
          if (spotifyArtistAdapter?.previewCatalog) {
            void spotifyArtistAdapter.previewCatalog(preview.artist).then((catalog) => {
              if (!cancelled) setCatalogPreview(catalog);
            }).catch(() => undefined);
          }
        } else if (!cancelled && workspace?.spotifyArtistId && workspace.spotifyArtistUrl && user) {
          const candidate: ProductionSpotifyArtistCandidate = {
            spotifyArtistId: workspace.spotifyArtistId,
            name: workspace.artistName,
            spotifyUrl: workspace.spotifyArtistUrl,
            imageUrl: workspace.spotifyImageUrl,
            genres: [],
          };
          const [renewalPreview, catalog] = await Promise.all([
            billingService.createCheckoutPreview({ user, candidate, existingWorkspace: workspace }),
            spotifyArtistAdapter?.previewCatalog?.(candidate).catch(() => null) ?? Promise.resolve(null),
          ]);
          if (!cancelled) {
            setCheckoutPreview(renewalPreview);
            setSelectedBillingInterval(renewalPreview.interval);
            setCatalogPreview(catalog);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCheckoutPreview(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [billingService, checkoutPreview, spotifyArtistAdapter, user, workspace]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!spotifyArtistAdapter || normalizedQuery.length < 2) {
      setCandidates([]);
      setSearchPending(false);
      return;
    }

    let cancelled = false;
    setSearchPending(true);
    const handle = window.setTimeout(() => {
      spotifyArtistAdapter
        .searchArtists(normalizedQuery)
        .then((artists) => {
          if (!cancelled) {
            setCandidates(artists);
            setMessage(artists.length ? null : "No artists matched that search.");
          }
        })
        .catch((searchError) => {
          if (!cancelled) {
            setCandidates([]);
            setMessage(readErrorMessage(searchError, "Artist search failed."));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setSearchPending(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, spotifyArtistAdapter]);

  async function selectCandidate(candidate: ProductionSpotifyArtistCandidate) {
    if (!billingService) {
      setMessage("Billing checkout is not configured for this environment.");
      return;
    }

    if (!user) {
      setMessage("Sign in before subscribing to an artist desk.");
      return;
    }

    try {
      setSelectPending(true);
      setSelectedArtistName(candidate.name);
      setSelectedArtistId(candidate.spotifyArtistId);
      setBillingProviderPreference("auto");
      setMessage(null);
      const catalog = spotifyArtistAdapter?.previewCatalog
        ? await spotifyArtistAdapter.previewCatalog(candidate).catch(() => ({
            artist: {
              spotifyArtistId: candidate.spotifyArtistId,
              name: candidate.name,
              spotifyUrl: candidate.spotifyUrl,
              imageUrl: candidate.imageUrl,
            },
            standaloneSingles: [],
          }))
        : null;
      const requestId = ++pricingRequestRef.current;
      const preview = billingService.prepareProviderCheckout
        ? await billingService.prepareProviderCheckout({ user, candidate, interval: "monthly", providerPreference: "auto" })
        : await billingService.createCheckoutPreview({ user, candidate });
      if (requestId !== pricingRequestRef.current) return;
      trackEvent("artist selected", {
        artist_id: candidate.spotifyArtistId,
        selection_source: "spotify search",
        is_test_user: isTestUserEmail(user.email),
      });
      runFrontDoorTransition(() => {
        setCatalogPreview(catalog);
        setCheckoutPreview(preview);
        setSelectedBillingInterval(preview.interval);
      });
    } catch (connectError) {
      setMessage(readErrorMessage(connectError, "Checkout preview could not be prepared."));
      setSelectedArtistName(null);
      setSelectedArtistId(null);
    } finally {
      setSelectPending(false);
    }
  }

  async function subscribeToPreview(interval: "monthly" | "yearly") {
    if (!checkoutPreview || !billingService) {
      return;
    }

    if (billingService.openProviderCheckout && user) {
      try {
        setSelectPending(true);
        setMessage(null);
        let payablePreview = checkoutPreview;
        if (checkoutPreview.interval !== interval) {
          if (!billingService.prepareProviderCheckout) {
            throw new Error("The selected billing interval could not be prepared.");
          }
          payablePreview = await billingService.prepareProviderCheckout({
            user,
            candidate: checkoutPreview.artist,
            existingWorkspace: workspace ?? undefined,
            interval,
            providerPreference: billingProviderPreference,
          });
          setCheckoutPreview(payablePreview);
        }
        await billingService.openProviderCheckout({ user, preview: payablePreview });
      } catch (checkoutError) {
        setMessage(readErrorMessage(checkoutError, "Secure checkout could not be opened."));
      } finally {
        setSelectPending(false);
      }
      return;
    }

    try {
      setSelectPending(true);
      setMessage(null);
      const status = await billingService.loadBillingStatus({ reference: checkoutPreview.reference });
      if (status.workspace) {
        onWorkspaceReady(status.workspace);
        return;
      }
      if (status.authorizationUrl) {
        window.location.assign(status.authorizationUrl);
        return;
      }
      setMessage(status.message ?? "Secure checkout is being prepared. Try again in a moment.");
    } catch (statusError) {
      setMessage(readErrorMessage(statusError, "Billing status could not be loaded."));
    } finally {
      setSelectPending(false);
    }
  }

  function changeBillingInterval(interval: "monthly" | "yearly") {
    setSelectedBillingInterval(interval);
    setMessage(null);
  }

  async function changeBillingProvider(
    providerPreference: "paddle" | "paystack",
    interval: "monthly" | "yearly" = selectedBillingInterval,
  ) {
    if (!checkoutPreview || !billingService?.prepareProviderCheckout || !user || checkoutPreview.provider === providerPreference) return;
    const requestId = ++pricingRequestRef.current;
    try {
      setSelectPending(true);
      setMessage(null);
      const preview = await billingService.prepareProviderCheckout({
        user,
        candidate: checkoutPreview.artist,
        existingWorkspace: workspace ?? undefined,
        interval,
        providerPreference,
      });
      if (requestId !== pricingRequestRef.current) return;
      setBillingProviderPreference(providerPreference);
      setSelectedBillingInterval(interval);
      setCheckoutPreview(preview);
    } catch (pricingError) {
      if (requestId === pricingRequestRef.current) {
        setMessage(readErrorMessage(pricingError, "Alternative checkout could not be prepared."));
      }
    } finally {
      if (requestId === pricingRequestRef.current) setSelectPending(false);
    }
  }

  async function redeemPrivateBetaCode(code: string) {
    if (!checkoutPreview || !billingService?.redeemPrivateBetaCode) return;
    try {
      setSelectPending(true);
      setMessage(null);
      trackEvent("beta code submitted", { is_test_user: isTestUserEmail(user?.email) });
      const result = await billingService.redeemPrivateBetaCode({ checkoutSessionId: checkoutPreview.checkoutSessionId, code });
      trackEvent("beta invitation activated", {
        artist_workspace_id: result.workspace.artistWorkspaceId,
        access_source: "private_beta",
        is_test_user: isTestUserEmail(user?.email),
      });
      onWorkspaceReady(result.workspace);
    } catch (redemptionError) {
      setMessage(readErrorMessage(redemptionError, "Private-beta access could not be activated."));
    } finally {
      setSelectPending(false);
    }
  }

  if (checkoutPreview) {
    return (
      <PaywallPreviewScreen
        preview={checkoutPreview}
        catalogPreview={catalogPreview}
        pending={selectPending}
        error={message}
        onBack={() => {
          runFrontDoorTransition(() => {
            setCheckoutPreview(null);
            setCatalogPreview(null);
            setMessage(null);
            setSelectedArtistName(null);
            setSelectedArtistId(null);
            setBillingProviderPreference("auto");
            setSelectedBillingInterval("monthly");
          });
        }}
        onSubscribe={subscribeToPreview}
        onIntervalChange={changeBillingInterval}
        onProviderChange={changeBillingProvider}
        privateBetaEnabled={import.meta.env.VITE_PRIVATE_BETA_ENABLED === "true"}
        onRedeemPrivateBeta={redeemPrivateBetaCode}
        onSignOut={onSignOut}
      />
    );
  }

  if (selectPending && selectedArtistName) {
    return (
      <ConnectArtistScreen
        query={query}
        candidates={candidates}
        pending
        selectedArtistName={selectedArtistName}
        selectedArtistId={selectedArtistId}
        onQueryChange={setQuery}
        onSelectCandidate={selectCandidate}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <ConnectArtistScreen
      query={query}
      candidates={candidates}
      pending={searchPending || selectPending}
      message={message}
      selectedArtistName={selectedArtistName}
      selectedArtistId={selectedArtistId}
      onQueryChange={setQuery}
      onSelectCandidate={selectCandidate}
      onSignOut={onSignOut}
    />
  );
}

function AuthFrame({ children, logoTestId }: { children: ReactNode; logoTestId?: string }) {
  return (
    <div data-testid="auth-shell" className="app-theme relative min-h-screen overflow-hidden bg-background px-5 py-5 text-foreground sm:px-7 lg:px-9">
      <div className="pointer-events-none absolute inset-0 opacity-[0.38] [background-image:linear-gradient(rgba(17,19,24,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,24,0.045)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(22rem,0.72fr)]">
        <aside className="hidden max-w-xl lg:block">
          <div className="flex items-center gap-3">
            <BrandMark size="lg" testId={logoTestId} />
            <div>
              <p className="font-display text-[18px] font-bold leading-none text-foreground">Ordersounds</p>
              <p className="mt-1 font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Artist operating desk</p>
            </div>
          </div>
          <h2 className="mt-12 max-w-[31rem] font-display text-[46px] font-semibold leading-[0.98] tracking-tight text-foreground">
            Open the artist's operating read.
          </h2>
          <p className="mt-5 max-w-[28rem] text-[15px] font-semibold leading-relaxed text-foreground/72">
            Return to the signals, blockers, tasks, and Manager decisions that need the team's attention today.
          </p>
        </aside>
        <div className="mx-auto w-full max-w-[27.5rem]">{children}</div>
      </div>
    </div>
  );
}

function BrandedLoader({
  title,
  body,
  steps,
  logoTestId,
}: {
  title: string;
  body: string;
  steps: string[];
  logoTestId?: string;
}) {
  const isWorkspaceLoader = title.toLowerCase().includes("workspace");
  const statusLabel = isWorkspaceLoader ? "PREPARING WORKSPACE" : "CONNECTING DESK";

  return (
    <>
      <style>{`
        @keyframes red-antler-float-pulse {
          0%, 100% {
            transform: translateY(0px) scale(0.97) rotate(0deg);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
          }
          50% {
            transform: translateY(-6px) scale(1.03) rotate(2deg);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
          }
        }
      `}</style>
      
      <div
        data-testid="branded-loader"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen w-screen bg-background select-none"
      >
        <div className="relative flex flex-col items-center justify-center">
          {/* Centered Brand Icon Tile */}
          <div className="relative">
            <BorderBeam size="md" colorVariant="mono" active={true} />
            <span
              aria-hidden="true"
              data-testid={logoTestId}
              className="relative inline-flex h-16 w-16 md:h-[72px] md:w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-foreground/10 bg-[#111] transition-all duration-300"
              style={{
                animation: "red-antler-float-pulse 4s ease-in-out infinite",
              }}
            >
              <img src="/logo.png" alt="" className="h-full w-full object-cover" />
            </span>
          </div>

          {/* wide-tracked elegant uppercase status text */}
          <p className="font-ui mt-10 text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground/60 leading-none">
            {statusLabel}
          </p>

          {/* ThinkingOrb progress indicator */}
          <div className="mt-5">
            <AppThinkingOrb state="working" size={64} />
          </div>
        </div>

        {/* Accessibility & Vitest compatibility layer */}
        <div className="sr-only">
          <h1>{title}</h1>
          <p>{body}</p>
          {steps.map((step) => (
            <div key={step}>{step}</div>
          ))}
        </div>
      </div>
    </>
  );
}

function AuthMessageCard({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string | null;
  action?: ReactNode;
}) {
  return (
    <section className="w-full rounded-[18px] border border-foreground/10 bg-white/88 p-5 shadow-[0_24px_70px_rgba(17,19,24,0.12)] backdrop-blur-xl sm:p-6">
      <BrandMark size="md" />
      <p className="font-ui mt-6 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">{eyebrow}</p>
      <h1 className="font-display mt-3 text-[20px] font-bold tracking-tight text-foreground">{title}</h1>
      <p className="mt-3 text-[13px] font-semibold leading-relaxed text-muted-foreground/82">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

function readPaymentReturnReference() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const reference =
    params.get("reference") ??
    params.get("trxref") ??
    params.get("checkout_ref") ??
    params.get("paystack_reference");

  const normalized = reference?.trim();
  if (normalized) return normalized;
  if (window.location.pathname === "/welcome") {
    const checkoutSessionId = sessionStorage.getItem("ordersounds.paddleCheckoutSessionId")?.trim();
    if (checkoutSessionId) return `paddle:${checkoutSessionId}`;
  }
  return null;
}

async function refreshPaymentReturnStatus(
  pointer: string,
  billingService: ProductionBillingService | undefined,
  setPaymentReturn: (state: PaymentReturnState | null) => void,
  setWorkspace: (workspace: ProductionWorkspace | null) => void,
  setStatus: (status: "loading" | "signed-out" | "missing-workspace" | "ready" | "payment-return" | "error") => void,
  setSuccessNotice: (message: string | null) => void,
): Promise<"active" | "terminal"> {
  if (!billingService) {
    setPaymentReturn({
      reference: pointer,
      status: "error",
      message: "Billing confirmation is not configured for this environment.",
    });
    return "terminal";
  }

  try {
    const billingStatus = await billingService.loadBillingStatus(
      pointer.startsWith("paddle:")
        ? { checkoutSessionId: pointer.slice("paddle:".length) }
        : { reference: pointer },
    );
    if (billingStatus.workspace && billingStatus.entitlementActive) {
      setWorkspace(billingStatus.workspace);
      setPaymentReturn({
        reference: pointer,
        status: "ready",
        message: "Payment confirmed. Opening Desk HQ.",
      });
      clearPaymentReturnUrl();
      setSuccessNotice(`Payment successful — ${billingStatus.workspace.artistName}'s Desk is unlocked.`);
      setStatus("ready");
      return "terminal";
    }

    if (billingStatus.checkoutStatus === "missing") {
      setPaymentReturn({
        reference: pointer,
        status: "mismatch",
        message: billingStatus.message ?? "This payment is not linked to the signed-in session in this browser.",
      });
      return "terminal";
    }

    if (billingStatus.checkoutStatus === "failed" || billingStatus.checkoutStatus === "expired" || billingStatus.checkoutStatus === "abandoned") {
      setPaymentReturn({
        reference: pointer,
        status: "error",
        message: billingStatus.message ?? "This checkout is no longer payable. Return to artist search and start a new subscription.",
      });
      return "terminal";
    }

    setPaymentReturn({
      reference: pointer,
      status: "waiting",
      message: billingStatus.message ?? "Waiting for secure payment confirmation. Desk access opens only after billing is verified.",
    });
    return "active";
  } catch {
    setPaymentReturn({
      reference: pointer,
      status: "waiting",
      message: "Desk could not reach the confirmation service. Retrying automatically.",
    });
    return "active";
  }
}

function UpdatePasswordScreen({ authAdapter, onComplete }: { authAdapter: ProductionAuthAdapter; onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) return setMessage("Use at least eight characters.");
    if (password !== confirmation) return setMessage("The passwords do not match.");
    if (!authAdapter.updatePassword) return setMessage("Password updates are not configured.");
    try {
      setPending(true);
      setMessage(null);
      await authAdapter.updatePassword({ password });
      setMessage("Password updated. Returning to OrderSounds.");
      window.setTimeout(onComplete, 800);
    } catch (updateError) {
      setMessage(readErrorMessage(updateError, "This recovery link is invalid or expired."));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame logoTestId="auth-brand-logo">
      <section className="w-full rounded-[18px] border border-foreground/10 bg-white/88 p-6 shadow-xl">
        <h1 className="font-display text-[24px] font-bold">Choose a new password</h1>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <Field label="New password" value={password} onChange={setPassword} type="password" autoComplete="new-password" required disabled={pending} />
          <Field label="Confirm new password" value={confirmation} onChange={setConfirmation} type="password" autoComplete="new-password" required disabled={pending} />
          {message ? <p className="rounded-[12px] bg-foreground/[0.04] p-3 text-[12px] font-semibold text-muted-foreground">{message}</p> : null}
          <ProductButton type="submit" disabled={pending}>{pending ? "Updating password" : "Update password"}</ProductButton>
        </form>
      </section>
    </AuthFrame>
  );
}

function SuccessToast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timeout);
  }, [onClose]);
  return (
    <div role="status" aria-live="polite" className="fixed right-4 top-4 z-[100] flex max-w-md items-start gap-3 rounded-[14px] border border-emerald-500/20 bg-[#102018] px-4 py-3 text-white shadow-2xl">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
      <p className="text-[12px] font-bold leading-relaxed">{message}</p>
      <button type="button" aria-label="Close notification" onClick={onClose} className="ml-1 rounded p-0.5 text-white/70 hover:text-white"><X className="h-4 w-4" /></button>
    </div>
  );
}

function formatAccessDate(value?: string) {
  if (!value) return "the stated expiry date";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(value));
}

function clearPaymentReturnUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  ["reference", "trxref", "checkout_ref", "paystack_reference"].forEach((param) => url.searchParams.delete(param));
  sessionStorage.removeItem("ordersounds.paddleCheckoutSessionId");
  const pathname = url.pathname === "/welcome" ? "/" : url.pathname;
  window.history.replaceState({}, "", `${pathname}${url.search}${url.hash}`);
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
  }

  return fallback;
}

function workspaceResourceKey(invalidation: WorkspaceInvalidation): ResourceKey {
  switch (invalidation.scope) {
    case "music-object": return `music-object:${invalidation.id}`;
    case "mission": return `mission:${invalidation.id}`;
    case "conversation": return `conversation:${invalidation.id}`;
    default: return invalidation.scope;
  }
}

function applyManagerConversationLink(
  music: MusicObjectViewModel[],
  subject: ManagerConversationMusicSubject,
  conversationId: string,
) {
  const kind = subject.type === "music_project" ? "project" : "song";
  return music.map((item) => item.id === subject.id && item.kind === kind
    ? { ...item, managerConversationId: conversationId }
    : item,
  );
}

function createOptimisticManagerConversation(body: string, musicSubject?: ConversationViewModel["musicSubject"]): ConversationViewModel {
  const id = `pending-conversation-${Date.now()}`;
  const runId = `pending-run-${Date.now()}`;
  return {
    id,
    topic: titleFromManagerBody(body),
    status: "Manager is thinking",
    summary: body,
    prompt: body,
    ...(musicSubject ? { musicSubject } : {}),
    lastUpdate: "Now",
    activeRun: {
      id: runId,
      status: "running",
      streamedText: "",
      steps: [{ id: "start", label: "Starting Manager run", status: "running" }],
    },
    messages: [
      {
        id: `pending-user-${Date.now()}`,
        speaker: "artist",
        label: "You",
        body,
        status: "sent",
      },
    ],
    createdWork: [],
    releaseSuccessArtifacts: [],
  };
}

function withOptimisticManagerMessage(conversation: ConversationViewModel | undefined, body: string): ConversationViewModel | null {
  if (!conversation) return null;
  const optimisticId = `pending-user-${Date.now()}`;
  const runId = `pending-run-${Date.now()}`;
  return {
    ...conversation,
    status: "Manager is thinking",
    lastUpdate: "Now",
    activeRun: {
      id: runId,
      status: "running",
      streamedText: "",
      steps: [{ id: "start", label: "Starting Manager run", status: "running" }],
    },
    messages: [
      ...conversation.messages,
      {
        id: optimisticId,
        speaker: "artist",
        label: "You",
        body,
        status: "sent",
      },
    ],
  };
}

function conversationFromStartedEvent(
  event: Extract<ManagerConversationStreamEvent, { type: "conversation.started" }>,
  context: { optimisticId?: string; lockedTopic?: string; userBody: string; musicSubjectView?: ConversationViewModel["musicSubject"] },
): ConversationViewModel {
  const id = event.conversation.id;
  const runId = event.run?.id ?? `run-${id}`;
  return {
    id,
    topic: context.lockedTopic ?? event.conversation.topic ?? titleFromManagerBody(context.userBody),
    status: event.conversation.status ?? "Manager is thinking",
    summary: event.conversation.summary ?? context.userBody,
    prompt: event.conversation.prompt ?? context.userBody,
    ...(event.conversation.musicSubject || context.musicSubjectView ? { musicSubject: event.conversation.musicSubject ?? context.musicSubjectView } : {}),
    lastUpdate: event.conversation.lastUpdate ?? "Now",
    messages: event.conversation.messages?.length
      ? event.conversation.messages
      : [
          {
            id: `pending-user-${id}`,
            speaker: "artist",
            label: "You",
            body: context.userBody,
            status: "sent",
          },
        ],
    activeRun: {
      id: runId,
      status: event.run?.status ?? "running",
      streamedText: "",
      steps: [{ id: "start", label: "Starting Manager run", status: "completed" }],
    },
    createdWork: event.conversation.createdWork ?? [],
    releaseSuccessArtifacts: event.conversation.releaseSuccessArtifacts ?? [],
  };
}

function mergeStartedConversation(current: ConversationViewModel | null, started: ConversationViewModel): ConversationViewModel {
  if (!current || (current.id !== started.id && !current.id.startsWith("pending-conversation-"))) return started;
  const currentReleaseArtifacts = current.releaseSuccessArtifacts ?? [];
  const startedReleaseArtifacts = started.releaseSuccessArtifacts ?? [];
  return {
    ...current,
    ...started,
    topic: current.topic || started.topic,
    summary: started.summary || current.summary,
    prompt: current.prompt || started.prompt,
    messages: mergeConversationMessages(current.messages, started.messages),
    createdWork: started.createdWork.length ? mergeCreatedWorkItems(current.createdWork, started.createdWork) : current.createdWork,
    releaseSuccessArtifacts: startedReleaseArtifacts.length
      ? mergeReleaseSuccessArtifacts(currentReleaseArtifacts, startedReleaseArtifacts)
      : currentReleaseArtifacts,
    activeRun: started.activeRun ?? current.activeRun,
  };
}

function appendManagerRunStep(conversation: ConversationViewModel, step: ManagerRunStepViewModel, runId?: string): ConversationViewModel {
  const activeRun = conversation.activeRun ?? {
    id: runId ?? `run-${conversation.id}`,
    status: "running" as const,
    steps: [],
    streamedText: "",
  };
  const steps = upsertRunStep(activeRun.steps, step);
  return {
    ...conversation,
    activeRun: {
      ...activeRun,
      id: runId ?? activeRun.id,
      status: step.status === "failed" ? "failed" : activeRun.status === "completed" ? "completed" : "running",
      steps,
    },
  };
}

function appendManagerDelta(conversation: ConversationViewModel, delta: string, runId?: string): ConversationViewModel {
  const activeRun = conversation.activeRun ?? { id: runId ?? `run-${conversation.id}`, status: "running" as const, steps: [], streamedText: "" };
  const streamedText = `${activeRun.streamedText ?? ""}${delta}`;
  const streamingMessageId = `streaming-manager-${runId ?? activeRun.id}`;
  const existingStreamingMessage = conversation.messages.find((message) => message.id === streamingMessageId);
  const nextMessages = existingStreamingMessage
    ? conversation.messages.map((message) => message.id === streamingMessageId ? { ...message, body: streamedText, status: "streaming" as const } : message)
    : [
        ...conversation.messages,
        {
          id: streamingMessageId,
          speaker: "manager" as const,
          label: "Manager",
          body: streamedText,
          status: "streaming" as const,
          runId: runId ?? activeRun.id,
        },
      ];

  return {
    ...conversation,
    status: "Manager is thinking",
    activeRun: { ...activeRun, id: runId ?? activeRun.id, status: "running", streamedText },
    messages: nextMessages,
  };
}

function mergeCompletedConversation(current: ConversationViewModel | null, completed: ConversationViewModel, preserveCurrentTopic = false): ConversationViewModel {
  const completedReleaseArtifacts = completed.releaseSuccessArtifacts ?? [];
  if (!current) {
    return {
      ...completed,
      releaseSuccessArtifacts: completedReleaseArtifacts,
      activeRun: completed.activeRun ? { ...completed.activeRun, status: "completed" } : undefined,
    };
  }
  const currentReleaseArtifacts = current.releaseSuccessArtifacts ?? [];
  const incomingMessages = completed.messages.length ? completed.messages : [];
  return {
    ...completed,
    topic: preserveCurrentTopic && current.topic ? current.topic : completed.topic,
    messages: mergeConversationMessages(current.messages.filter((message) => message.status !== "streaming"), incomingMessages),
    createdWork: completed.createdWork.length ? mergeCreatedWorkItems(current.createdWork, completed.createdWork) : current.createdWork,
    releaseSuccessArtifacts: completedReleaseArtifacts.length
      ? mergeReleaseSuccessArtifacts(currentReleaseArtifacts, completedReleaseArtifacts)
      : currentReleaseArtifacts,
    activeRun: current.activeRun ? { ...current.activeRun, status: "completed", streamedText: "" } : completed.activeRun,
  };
}

function shouldHydrateCompletedConversationArtifacts(conversation: ConversationViewModel, userBody: string) {
  const searchableText = [
    userBody,
    conversation.topic,
    conversation.summary,
    conversation.prompt,
    conversation.messages.at(-1)?.body,
  ].filter(Boolean).join(" ");
  return /\b(?:playlist|press|opportunit(?:y|ies)|release[- ]success|release[- ]ready|release date|recovery plan|epk|pitch)\b/i.test(searchableText);
}

function mergeConversationMessages(current: ConversationViewModel["messages"], incoming: ConversationViewModel["messages"]) {
  const merged: ConversationViewModel["messages"] = [];
  const byId = new Map<string, number>();
  for (const message of current) {
    byId.set(message.id, merged.length);
    merged.push(message);
  }
  for (const message of incoming) {
    const normalized = { ...message, body: message.body ?? "", status: message.status ?? "sent" };
    const existingIndex = byId.get(message.id);
    if (existingIndex !== undefined) {
      merged[existingIndex] = normalized;
      continue;
    }
    const equivalentIndex = merged.findIndex((item) => equivalentConversationMessage(item, normalized));
    if (equivalentIndex >= 0) {
      merged[equivalentIndex] = { ...merged[equivalentIndex], ...normalized };
      byId.set(normalized.id, equivalentIndex);
      continue;
    }
    byId.set(normalized.id, merged.length);
    merged.push(normalized);
  }
  return merged;
}

function equivalentConversationMessage(
  current: ConversationViewModel["messages"][number],
  incoming: ConversationViewModel["messages"][number],
) {
  if (current.speaker !== incoming.speaker) return false;
  if ((current.body ?? "").trim() !== (incoming.body ?? "").trim()) return false;
  return current.id.startsWith("pending-") || incoming.id.startsWith("pending-");
}

function mergeCreatedWorkItems(
  current: ConversationViewModel["createdWork"],
  incoming: ConversationViewModel["createdWork"],
) {
  return incoming.reduce(upsertCreatedWork, current);
}

function upsertRunStep(steps: ManagerRunStepViewModel[], step: ManagerRunStepViewModel) {
  const index = steps.findIndex((item) => item.id === step.id);
  if (index < 0) return [...steps, step];
  return steps.map((item, itemIndex) => itemIndex === index ? { ...item, ...step } : item);
}

function upsertCreatedWork(
  current: ConversationViewModel["createdWork"],
  next: ConversationViewModel["createdWork"][number],
) {
  const key = `${next.type}:${next.id ?? next.title}`;
  const filtered = current.filter((item) => `${item.type}:${item.id ?? item.title}` !== key);
  return [...filtered, next];
}

function normalizeStepId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `step-${Date.now()}`;
}

function titleFromManagerBody(body: string) {
  const cleaned = body.trim().replace(/\s+/g, " ");
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned || "Manager conversation";
}

function conversationHasMissionWork(conversation: ConversationViewModel) {
  return conversationWorkItems(conversation).some((work) => work.type === "mission" || work.type === "task");
}

function selectCreatedMissionId(conversation: ConversationViewModel, missions: MissionViewModel[]) {
  const createdMissionId = conversationWorkItems(conversation)
    .find((work) => work.type === "mission" && typeof work.id === "string" && work.id.trim())?.id;
  return selectMissionId(createdMissionId, missions);
}

function selectTargetMissionId(hint: ManagerConversationRefreshHint, missions: MissionViewModel[]) {
  const missionId = hint.missionIds?.find((id) => missions.some((mission) => mission.id === id));
  if (missionId) return missionId;
  const taskId = hint.taskIds?.find(Boolean);
  return selectMissionIdForTask(taskId, missions) ?? "";
}

function selectMissionId(id: string | undefined, missions: MissionViewModel[]) {
  return id && missions.some((mission) => mission.id === id) ? id : missions[0]?.id ?? "";
}

function selectMissionIdForTask(taskId: string | undefined, missions: MissionViewModel[]) {
  if (!taskId) return undefined;
  return missions.find((mission) => (mission.tasks ?? []).some((task) => task.id === taskId))?.id;
}

function conversationWorkItems(conversation: ConversationViewModel) {
  return conversation.createdWork.length
    ? conversation.createdWork
    : conversation.messages.flatMap((message) => message.createdWork ?? []);
}

function shouldOpenMissionGenesisMissions(result: MissionGenesisResultViewModel) {
  return result.outcome === "activate_mission" || result.outcome === "update_existing_mission";
}

function selectMissionGenesisMissionId(result: MissionGenesisResultViewModel, missions: MissionViewModel[]) {
  const missionIds = missionGenesisMissionIds(result);
  return missionIds.find((missionId) => missions.some((mission) => mission.id === missionId)) ?? missions[0]?.id ?? "";
}

function firstMissionGenesisMissionId(result: MissionGenesisResultViewModel | null) {
  return result ? missionGenesisMissionIds(result)[0] : undefined;
}

function missionGenesisMissionIds(result: MissionGenesisResultViewModel) {
  return uniqueMissionGenesisIds([
    result.activatedMissionId,
    ...(result.activatedMissionIds ?? []),
    ...(result.missionIds ?? []),
    result.candidateMissionId,
    ...(result.candidateMissionIds ?? []),
  ]);
}

function activatedMissionGenesisIds(result: MissionGenesisResultViewModel) {
  return uniqueMissionGenesisIds([
    result.activatedMissionId,
    ...(result.activatedMissionIds ?? []),
    ...(result.outcome === "activate_mission" ? result.missionIds ?? [] : []),
  ]);
}

function uniqueMissionGenesisIds(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()))];
}

function briefFromGenerationResult(result: TodayBriefGenerationResponse): TodayBriefViewModel {
  if (isTodayBriefProcessingResult(result)) throw new Error("Today's Brief is still processing.");
  return isTodayBriefGenerationResult(result) ? result.brief : result;
}

function isTodayBriefProcessingResult(result: TodayBriefGenerationResponse): result is { status: "processing"; runId: string; setupMusicReadTargets?: MusicReadTarget[] } {
  return Boolean(result && typeof result === "object" && "status" in result && result.status === "processing" && "runId" in result && typeof result.runId === "string");
}

function briefAnalyticsId(brief: TodayBriefViewModel, artistWorkspaceId: string) {
  return brief.managerOutputId ?? brief.managerSynthesisRunId ?? brief.generatedAt ?? `${artistWorkspaceId}:brief`;
}

function isTodayBriefGenerationResult(result: TodayBriefGenerationResponse): result is { brief: TodayBriefViewModel; setupMusicReadTargets?: MusicReadTarget[] } {
  return Boolean(result && typeof result === "object" && "brief" in result);
}

function mergeWorkspaceEvents(current: WorkspaceOperatingEvent[], next: WorkspaceOperatingEvent[]) {
  const byId = new Map(current.map((event) => [event.id, event]));
  for (const event of next) {
    if (event.id && event.createdAt && event.displayMode) byId.set(event.id, event);
  }
  return [...byId.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
    .slice(0, 150);
}

function buildLegacyWorkspaceEvents(
  attention: AttentionItem[],
  movement: MovementItem[],
  workspaceId: string,
  epoch: number,
): WorkspaceOperatingEvent[] {
  const actionable = splitAttentionItems(attention).actionable;
  const actionEvents = actionable.map((item, index): WorkspaceOperatingEvent => ({
    id: `legacy-action:${workspaceId}:${index}:${item.title}`,
    artistWorkspaceId: workspaceId,
    eventType: "legacy_attention",
    createdAt: new Date(epoch - index * 1_000).toISOString(),
    targetType: item.target || item.tone !== "accent" ? "view" : "drawer",
    targetId: item.target ?? (item.tone === "accent" ? "evidence" : "missionsWorkspace"),
    displayMode: "action",
    refreshScope: [],
    summary: item.title,
  }));
  const activityEvents = movement.map((item, index): WorkspaceOperatingEvent => ({
    id: `legacy-activity:${workspaceId}:${index}:${item.label}:${item.title}`,
    artistWorkspaceId: workspaceId,
    eventType: "legacy_activity",
    createdAt: legacyActivityCreatedAt(item.time, index, epoch, actionEvents.length),
    displayMode: "activity",
    refreshScope: [],
    summary: item.title,
  }));
  return [...actionEvents, ...activityEvents]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id));
}

function legacyActivityCreatedAt(value: string | undefined, index: number, epoch: number, actionCount: number) {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (normalized === "yesterday") return new Date(epoch - 86_400_000 - (actionCount + index) * 1_000).toISOString();
  if (normalized === "just now" || normalized === "now") return new Date(epoch - (actionCount + index) * 1_000).toISOString();

  const relative = normalized.match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|month|months)\s+ago$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    const multiplier = /^mo|^month/.test(unit) ? 2_592_000_000 : /^m/.test(unit) ? 60_000 : /^h/.test(unit) ? 3_600_000 : /^d/.test(unit) ? 86_400_000 : /^w/.test(unit) ? 604_800_000 : 2_592_000_000;
    return new Date(epoch - amount * multiplier - (actionCount + index) * 1_000).toISOString();
  }

  const parsed = value ? new Date(value) : null;
  if (parsed && !Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date(epoch - (actionCount + index) * 1_000).toISOString();
}

const CLEAN_PRODUCTION_VIEWS = new Set<CleanProductionView>([
  "connectArtist",
  "setup",
  "labelHQ",
  "musicWorkspace",
  "staffWorkspace",
  "managerOffice",
  "conversationWorkspace",
  "investigation",
  "decisionPackage",
  "missionsWorkspace",
  "artistProfileWorkspace",
  "lockedAgentWorkspace",
]);

function isCleanProductionView(value: string): value is CleanProductionView {
  return CLEAN_PRODUCTION_VIEWS.has(value as CleanProductionView);
}


function isWorkspaceReadyForDesk(workspace: ProductionWorkspace) {
  if (!workspace.contextComplete) return false;
  if (workspace.entitlementActive === true && workspace.billingCheckoutSessionId) {
    return workspace.setupStatus === "completed";
  }
  return true;
}

function resolveWorkspaceInitialView(workspace: ProductionWorkspace, initialView: CleanProductionView) {
  if (!isWorkspaceReadyForDesk(workspace)) {
    return "setup";
  }

  return initialView === "connectArtist" || initialView === "setup" ? "labelHQ" : initialView;
}

function isCatalogSyncPending(status: ProductionWorkspace["latestCatalogSyncStatus"]) {
  return status === "queued" || status === "running";
}

function areWorkspacesEquivalent(currentWorkspace: ProductionWorkspace, nextWorkspace: ProductionWorkspace) {
  return (
    currentWorkspace.accountId === nextWorkspace.accountId &&
    currentWorkspace.artistWorkspaceId === nextWorkspace.artistWorkspaceId &&
    currentWorkspace.artistId === nextWorkspace.artistId &&
    currentWorkspace.artistName === nextWorkspace.artistName &&
    currentWorkspace.workspaceName === nextWorkspace.workspaceName &&
    currentWorkspace.status === nextWorkspace.status &&
    currentWorkspace.spotifyConnected === nextWorkspace.spotifyConnected &&
    currentWorkspace.spotifyArtistId === nextWorkspace.spotifyArtistId &&
    currentWorkspace.spotifyArtistName === nextWorkspace.spotifyArtistName &&
    currentWorkspace.spotifyArtistUrl === nextWorkspace.spotifyArtistUrl &&
    currentWorkspace.spotifyImageUrl === nextWorkspace.spotifyImageUrl &&
      currentWorkspace.contextComplete === nextWorkspace.contextComplete &&
      currentWorkspace.latestCatalogSyncStatus === nextWorkspace.latestCatalogSyncStatus &&
      currentWorkspace.entitlementActive === nextWorkspace.entitlementActive &&
      currentWorkspace.subscriptionStatus === nextWorkspace.subscriptionStatus &&
      currentWorkspace.setupStatus === nextWorkspace.setupStatus &&
      currentWorkspace.setupStage === nextWorkspace.setupStage &&
      currentWorkspace.setupRunId === nextWorkspace.setupRunId &&
      currentWorkspace.billingCheckoutSessionId === nextWorkspace.billingCheckoutSessionId
    );
}
