import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BrandMark, DeskRail, Field, MobileChrome, ProductButton, sectionForView } from "../design-system/components";
import { DeskHQScreen } from "../features/desk/DeskHQ";
import { ProductionDrawers } from "../features/drawers/ProductionDrawers";
import {
  ConversationWorkspace,
  DecisionPackageScreen,
  InvestigationScreen,
  ManagerOfficeScreen,
} from "../features/manager/ManagerScreens";
import { MissionsWorkspace } from "../features/missions/MissionScreens";
import { MusicWorkspace } from "../features/music/MusicScreens";
import { ConnectArtistScreen, SetupScreen } from "../features/onboarding/OnboardingScreens";
import { SettingsScreen } from "../features/settings/SettingsScreen";
import { LockedAgentWorkspace, StaffWorkspace } from "../features/staff/StaffScreens";
import { createBrowserSupabaseClient } from "../lib/supabaseClient";
import { createFixtureProductionRuntime, createFixtureRepositories } from "../services/fixtureRepositories";
import {
  createSupabaseAuthAdapter,
  createSupabaseProductionRepositories,
  createSupabaseProfileSetupService,
  createSupabaseSpotifyArtistAdapter,
  createSupabaseWorkspaceLoader,
} from "../services/productionSupabase";
import type {
  AgentViewModel,
  AttentionItem,
  ArtistProfileViewModel,
  CleanProductionRepositories,
  CleanProductionView,
  ConversationViewModel,
  DrawerKind,
  EvidenceItemViewModel,
  MissionGenesisResultViewModel,
  MissionViewModel,
  MovementItem,
  MusicObjectViewModel,
  TodayBriefGenerationMode,
  TodayBriefViewModel,
} from "../types/cleanProduction";
import type {
  ProductionAuthAdapter,
  ProductionMusicLibraryLoader,
  ProductionProfileSetupService,
  ProductionSession,
  ProductionSpotifyArtistAdapter,
  ProductionSpotifyArtistCandidate,
  ProductionUser,
  ProductionWorkspace,
  ProductionWorkspaceLoader,
} from "../types/productionApp";

type ProductionAppProps = {
  authAdapter?: ProductionAuthAdapter;
  workspaceLoader?: ProductionWorkspaceLoader;
  musicLibraryLoader?: ProductionMusicLibraryLoader;
  spotifyArtistAdapter?: ProductionSpotifyArtistAdapter;
  profileSetupService?: ProductionProfileSetupService;
  repositories?: CleanProductionRepositories;
  initialView?: CleanProductionView;
  fixtureMode?: boolean;
};

export function ProductionApp({
  authAdapter,
  workspaceLoader,
  spotifyArtistAdapter,
  profileSetupService,
  repositories,
  initialView = "connectArtist",
  fixtureMode = false,
}: ProductionAppProps) {
  const shouldUseFixtureRuntime = fixtureMode || import.meta.env.VITE_PRODUCTION_FIXTURES === "true";

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
      authAdapter: authAdapter ?? createSupabaseAuthAdapter(getClient()),
      workspaceLoader: workspaceLoader ?? createSupabaseWorkspaceLoader(getClient()),
      spotifyArtistAdapter:
        spotifyArtistAdapter ??
        ({
          searchArtists: (query) => createSupabaseSpotifyArtistAdapter(getClient()).searchArtists(query),
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
        } satisfies ProductionProfileSetupService),
      repositoriesForWorkspace: (nextWorkspace: ProductionWorkspace) =>
        repositories ?? createSupabaseProductionRepositories(getClient(), nextWorkspace),
    };
  }, [authAdapter, profileSetupService, repositories, shouldUseFixtureRuntime, spotifyArtistAdapter, workspaceLoader]);

  const [status, setStatus] = useState<"loading" | "signed-out" | "missing-workspace" | "ready" | "error">("loading");
  const [session, setSession] = useState<ProductionSession | null>(null);
  const [workspace, setWorkspace] = useState<ProductionWorkspace | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProductionState = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      const nextSession = await runtime.authAdapter.getSession();
      setSession(nextSession);

      if (!nextSession.user) {
        setWorkspace(null);
        setStatus("signed-out");
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
  }, [runtime]);

  const handleSignOut = useCallback(async () => {
    try {
      setError(null);
      await runtime.authAdapter.signOut?.();
      setSession({ user: null });
      setWorkspace(null);
      setStatus("signed-out");
    } catch (signOutError) {
      setError(readErrorMessage(signOutError, "Could not sign out."));
      setStatus("error");
    }
  }, [runtime.authAdapter]);

  useEffect(() => {
    void loadProductionState();
  }, [loadProductionState]);

  useEffect(() => {
    if (!session?.user || !workspace || !isCatalogSyncPending(workspace.latestCatalogSyncStatus)) {
      return;
    }

    let cancelled = false;
    const poll = async () => {
      try {
        const nextWorkspace = await runtime.workspaceLoader.loadActiveWorkspace(session.user as ProductionUser);
        if (!cancelled && nextWorkspace) {
          setWorkspace(nextWorkspace);
        }
      } catch {
        // Catalog polling should never break the active onboarding/session view.
      }
    };

    const handle = window.setInterval(() => {
      void poll();
    }, 4000);
    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [runtime.workspaceLoader, session?.user, workspace]);

  if (status === "loading") {
    return (
      <BrandedLoader
        title="Loading Ordersounds"
        body="Checking session and active artist workspace."
        steps={["Session", "Workspace", "Sources"]}
        logoTestId="auth-brand-logo"
      />
    );
  }

  if (status === "signed-out") {
    return <AuthScreen authAdapter={runtime.authAdapter} onAuthenticated={loadProductionState} />;
  }

  if (status === "missing-workspace") {
    return (
      <SpotifyIdentityGate
        user={session?.user ?? null}
        workspace={null}
        workspaceLoader={runtime.workspaceLoader}
        spotifyArtistAdapter={runtime.spotifyArtistAdapter}
        onSignOut={handleSignOut}
        onWorkspaceReady={(nextWorkspace) => {
          setWorkspace(nextWorkspace);
          setStatus("ready");
        }}
      />
    );
  }

  if (status === "error") {
    return (
      <AuthFrame>
        <AuthMessageCard
          eyebrow="Load failed"
          title="Production workspace could not load"
          body={error}
          action={<ProductButton onClick={loadProductionState}>Retry</ProductButton>}
        />
      </AuthFrame>
    );
  }

  if (workspace && !workspace.spotifyConnected) {
    return (
      <SpotifyIdentityGate
        user={session?.user ?? null}
        workspace={workspace}
        workspaceLoader={runtime.workspaceLoader}
        spotifyArtistAdapter={runtime.spotifyArtistAdapter}
        onSignOut={handleSignOut}
        onWorkspaceReady={(nextWorkspace) => {
          setWorkspace(nextWorkspace);
          setStatus("ready");
        }}
      />
    );
  }

  return (
    <CleanProductionWorkspace
      workspace={workspace}
      repositories={runtime.repositoriesForWorkspace(workspace as ProductionWorkspace)}
      profileSetupService={runtime.profileSetupService}
      initialView={shouldUseFixtureRuntime ? initialView : resolveWorkspaceInitialView(workspace as ProductionWorkspace, initialView)}
      onWorkspaceChange={setWorkspace}
      onSignOut={handleSignOut}
    />
  );
}

function CleanProductionWorkspace({
  workspace,
  repositories,
  profileSetupService,
  initialView,
  onWorkspaceChange,
  onSignOut,
}: {
  workspace: ProductionWorkspace | null;
  repositories: CleanProductionRepositories;
  profileSetupService?: ProductionProfileSetupService;
  initialView: CleanProductionView;
  onWorkspaceChange?: (workspace: ProductionWorkspace) => void;
  onSignOut?: () => void;
}) {
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
  const [viewModelError, setViewModelError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentViewModel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<ConversationViewModel | null>(null);
  const [selectedMissionId, setSelectedMissionId] = useState("");
  const [missionRoomOpenRequestKey, setMissionRoomOpenRequestKey] = useState(0);
  const [targetMusicObjectId, setTargetMusicObjectId] = useState<string | null>(null);
  const [managerAnswers, setManagerAnswers] = useState<Record<string, string>>({});
  const [setupPending, setSetupPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [todayBriefPending, setTodayBriefPending] = useState(false);
  const [todayBriefError, setTodayBriefError] = useState<string | null>(null);
  const [mobileNotificationsOpen, setMobileNotificationsOpen] = useState(false);
  const [missionGenesisResult, setMissionGenesisResult] = useState<MissionGenesisResultViewModel | null>(null);
  const [missionGenesisAnswers, setMissionGenesisAnswers] = useState<Record<string, string>>({});
  const [missionGenesisPending, setMissionGenesisPending] = useState(false);
  const [missionGenesisError, setMissionGenesisError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadViewModels() {
      try {
        setViewModelError(null);
        const [nextProfile, nextDesk, nextAgents, nextMusic, nextConversations, nextMissions, nextEvidence] = await Promise.all([
          repositories.artistProfile.loadProfile(),
          repositories.desk.loadDesk(),
          repositories.staff.loadAgents(),
          repositories.music.loadMusic(),
          repositories.manager.loadConversations(),
          repositories.missions.loadMissions(),
          repositories.evidence.loadEvidence(),
        ]);

        if (!isMounted) {
          return;
        }

        setProfile(nextProfile);
        setAttention(nextDesk.attention);
        setMovement(nextDesk.movement);
        setTodayBrief(nextDesk.todayBrief);
        setAgents(nextAgents);
        setMusic(nextMusic);
        setConversations(nextConversations);
        setMissions(nextMissions);
        setEvidence(nextEvidence);
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
    };
  }, [repositories]);

  const activeSection = sectionForView(view);
  const mobileTitle = activeSection === "labelHQ" ? "Desk HQ" : activeSection === "staff" ? "Team Agents" : activeSection;
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0] ?? null;
  const activeAgent = selectedAgent ?? agents[1] ?? agents[0] ?? null;
  const activeConversation = selectedConversation ?? conversations[0] ?? null;

  function navigate(nextView: CleanProductionView) {
    if (workspace && !isWorkspaceReadyForDesk(workspace) && nextView !== "setup" && nextView !== "connectArtist") {
      setView("setup");
      return;
    }

    setView(nextView);
    setDrawer(null);
    setMobileNotificationsOpen(false);
  }

  function openManager() {
    navigate("managerOffice");
  }

  function openMusicFocus(musicObjectId?: string) {
    setTargetMusicObjectId(musicObjectId ?? null);
    navigate("musicWorkspace");
  }

  function openConversation(conversation: ConversationViewModel) {
    setSelectedConversation(conversation);
    navigate("conversationWorkspace");
  }

  function openCreatedWork(type: "music_item" | "mission" | "task", id?: string) {
    if (type === "music_item") {
      setTargetMusicObjectId(id ?? null);
      navigate("musicWorkspace");
      return;
    }

    if (type === "mission") {
      setSelectedMissionId(id ?? missions[0]?.id ?? "");
      setMissionRoomOpenRequestKey((current) => current + 1);
      navigate("missionsWorkspace");
    }
  }

  async function reloadMusic() {
    const nextMusic = await repositories.music.loadMusic();
    setMusic(nextMusic);
  }

  async function generateTodaysBrief(mode: TodayBriefGenerationMode = "operating") {
    try {
      setTodayBriefPending(true);
      setTodayBriefError(null);
      const nextBrief = await repositories.desk.generateTodaysBrief(mode);
      setTodayBrief(nextBrief);
    } catch (error) {
      setTodayBriefError(readErrorMessage(error, "Today's Brief could not be generated."));
    } finally {
      setTodayBriefPending(false);
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
      if (result.activatedMissionId) {
        clearMissionGenesisAttention();
        const nextMissions = await repositories.missions.loadMissions();
        setMissions(nextMissions);
        setSelectedMissionId(result.activatedMissionId);
        navigate("missionsWorkspace");
      }
    } catch (error) {
      setMissionGenesisError(readErrorMessage(error, "Mission Genesis failed."));
    } finally {
      setMissionGenesisPending(false);
    }
  }

  async function submitMissionGenesisAnswers() {
    if (!missionGenesisResult?.candidateMissionId) return;
    try {
      setMissionGenesisPending(true);
      setMissionGenesisError(null);
      const result = await repositories.missionGenesis.answerMissionGenesisContext({
        candidateMissionId: missionGenesisResult.candidateMissionId,
        answers: missionGenesisResult.questions.map((question) => ({
          questionKey: question.key,
          answer: missionGenesisAnswers[question.key] ?? "",
        })),
      });
      setMissionGenesisResult(result);
      const nextMissions = await repositories.missions.loadMissions();
      setMissions(nextMissions);
      setSelectedMissionId(result.activatedMissionId ?? nextMissions[0]?.id ?? "");
      if (result.activatedMissionId) {
        clearMissionGenesisAttention();
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
    if (missionGenesisResult?.activatedMissionId) {
      setSelectedMissionId(missionGenesisResult.activatedMissionId);
    }
    navigate("missionsWorkspace");
  }

  async function approveMissionTask(taskId: string) {
    await repositories.missions.approveTask(taskId);
    const nextMissions = await repositories.missions.loadMissions();
    setMissions(nextMissions);
    setSelectedMissionId((current) => current || nextMissions[0]?.id || "");
  }

  async function completeMissionTask(taskId: string, status: "completed" | "blocked", note: string) {
    const updatedMission = await repositories.missions.completeTask(taskId, {
      status,
      note,
    });
    setMissions((current) => current.map((mission) => mission.id === updatedMission.id ? updatedMission : mission));
    setSelectedMissionId(updatedMission.id);
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
              const nextWorkspace = await profileSetupService.saveSetupContext(workspace, nextProfile);
              onWorkspaceChange?.(nextWorkspace);
              setDrawer(null);
              setView(isWorkspaceReadyForDesk(nextWorkspace) ? "labelHQ" : "setup");
            } catch (saveError) {
              setSetupError(readErrorMessage(saveError, "Artist context could not be saved."));
            } finally {
              setSetupPending(false);
            }
          }}
        />
        {setupError ? (
          <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2">
            <div className="rounded-xl border border-foreground/10 bg-background shadow-sm p-4 text-sm font-semibold text-muted-foreground">{setupError}</div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="app-light min-h-screen bg-background text-foreground selection:bg-brand-accent/15">
      <div className="relative z-20 mx-auto grid min-h-screen w-full max-w-[1760px] gap-0 px-3 pb-28 pt-0 sm:px-5 lg:grid-cols-[216px_minmax(0,1fr)] lg:px-0 lg:py-0 lg:pb-0">
        <DeskRail active={activeSection} onNavigate={navigate} onSignOut={onSignOut} />
        <main className="min-w-0 py-0 lg:px-8 lg:py-7">
          <MobileChrome
            active={activeSection}
            title={mobileTitle}
            notificationCount={attention.length + movement.length}
            onOpenNotifications={() => setMobileNotificationsOpen(true)}
            onNavigate={navigate}
          />
          {view === "labelHQ" ? (
            <DeskHQScreen
              profile={profile}
              todayBrief={todayBrief}
              todayBriefPending={todayBriefPending}
              todayBriefError={todayBriefError}
              attention={attention}
              movement={movement}
              agents={agents}
              missions={missions}
              music={music}
              onNavigate={navigate}
              onManager={openManager}
              onGenerateTodaysBrief={generateTodaysBrief}
              onLockedAgent={(agent) => {
                setSelectedAgent(agent);
                navigate("lockedAgentWorkspace");
              }}
              onDrawer={setDrawer}
              onOpenMusicFocus={openMusicFocus}
            />
          ) : null}
          {view === "musicWorkspace" ? (
            <MusicWorkspace
              music={music}
              missions={missions}
              targetMusicObjectId={targetMusicObjectId}
              musicRepository={repositories.music}
              onMusicChanged={reloadMusic}
              onNavigate={navigate}
              onBack={() => navigate("labelHQ")}
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
              onInvestigation={() => navigate("investigation")}
            />
          ) : null}
          {view === "conversationWorkspace" && activeConversation ? (
            <ConversationWorkspace
              conversation={activeConversation}
              onBack={() => navigate("managerOffice")}
              onOpenCreatedWork={openCreatedWork}
            />
          ) : null}
          {view === "investigation" ? <InvestigationScreen onBack={() => navigate("managerOffice")} onDecision={() => navigate("decisionPackage")} /> : null}
          {view === "decisionPackage" ? <DecisionPackageScreen onBack={() => navigate("managerOffice")} onNavigate={navigate} /> : null}
          {view === "missionsWorkspace" ? (
            <MissionsWorkspace
              missions={missions}
              selectedMissionId={selectedMissionId}
              missionGenesisResult={missionGenesisResult}
              missionGenesisPending={missionGenesisPending}
              missionGenesisError={missionGenesisError}
              onSelectMission={setSelectedMissionId}
              onRunMissionGenesis={runMissionGenesis}
              onOpenMissionGenesisQuestions={() => navigate("managerOffice")}
              onApproveTask={approveMissionTask}
              onCompleteTask={completeMissionTask}
              onDrawer={setDrawer}
              openRoomRequestKey={missionRoomOpenRequestKey}
            />
          ) : null}
          {view === "artistProfileWorkspace" ? (
            <SettingsScreen profile={profile} onChange={setProfile} onBack={() => navigate("labelHQ")} onSignOut={onSignOut} />
          ) : null}
        </main>
      </div>
      <ProductionDrawers drawer={drawer} evidence={evidence} mission={selectedMission} onClose={() => setDrawer(null)} />
      <MobileNotificationSheet
        open={mobileNotificationsOpen}
        attention={attention}
        movement={movement}
        onNavigate={navigate}
        onDrawer={setDrawer}
        onClose={() => setMobileNotificationsOpen(false)}
      />
      <span className="sr-only">{workspace?.workspaceName ?? "Ordersounds workspace"}</span>
    </div>
  );
}

function MobileNotificationSheet({
  open,
  attention,
  movement,
  onNavigate,
  onDrawer,
  onClose,
}: {
  open: boolean;
  attention: AttentionItem[];
  movement: MovementItem[];
  onNavigate: (view: CleanProductionView) => void;
  onDrawer: (drawer: DrawerKind) => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-foreground/20 px-3 pb-3 lg:hidden" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Desk notifications"
        className="max-h-[82svh] w-full overflow-y-auto rounded-[22px] border border-foreground/10 bg-background shadow-[0_24px_70px_rgba(17,19,24,0.20)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-foreground/8 bg-background px-4 py-3">
          <div>
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Desk notifications</p>
            <h2 className="font-display mt-1 text-[18px] font-semibold leading-tight text-foreground">Attention and movement</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-lg border border-foreground/10 px-3 text-[12px] font-bold text-muted-foreground"
          >
            Close
          </button>
        </div>

        <div className="grid gap-5 px-4 py-4">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Needs Attention</p>
              <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{attention.length}</span>
            </div>
            <div className="grid gap-2">
              {attention.length ? attention.slice(0, 4).map((item) => (
                <button
                  key={item.title}
                  type="button"
                  className="rounded-[14px] border border-foreground/8 bg-white px-3.5 py-3 text-left"
                  onClick={() => {
                    onClose();
                    if (item.target) {
                      onNavigate(item.target);
                    } else if (item.tone === "accent") {
                      onDrawer("evidence");
                    } else {
                      onNavigate("missionsWorkspace");
                    }
                  }}
                >
                  <span className="block text-[13px] font-semibold text-foreground">{item.title}</span>
                  <span className="mt-1.5 block text-[12px] font-medium leading-relaxed text-muted-foreground/82">{item.body}</span>
                </button>
              )) : (
                <p className="rounded-[14px] border border-foreground/8 bg-white px-3.5 py-3 text-[12px] font-medium text-muted-foreground">No urgent items right now.</p>
              )}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">Recent Movement</p>
              <span className="rounded-full bg-foreground/[0.055] px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{movement.length}</span>
            </div>
            <div className="grid gap-2">
              {movement.length ? movement.slice(0, 6).map((item) => (
                <div key={`${item.title}-${item.time}`} className="grid grid-cols-[8px_minmax(0,1fr)] gap-3 rounded-[14px] border border-foreground/8 bg-white px-3.5 py-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-foreground/20" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight text-foreground">{item.title}</span>
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                      {item.label} / {item.time}
                    </span>
                  </span>
                </div>
              )) : (
                <p className="rounded-[14px] border border-foreground/8 bg-white px-3.5 py-3 text-[12px] font-medium text-muted-foreground">No new movement yet.</p>
              )}
            </div>
          </section>
        </div>
      </section>
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
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">Sign in to Ordersounds</h1>
          </div>
        </div>

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
          </div>
        </form>
      </section>
    </AuthFrame>
  );
}

function SpotifyIdentityGate({
  user,
  workspace,
  workspaceLoader,
  spotifyArtistAdapter,
  onSignOut,
  onWorkspaceReady,
}: {
  user: ProductionUser | null;
  workspace: ProductionWorkspace | null;
  workspaceLoader: ProductionWorkspaceLoader;
  spotifyArtistAdapter?: ProductionSpotifyArtistAdapter;
  onSignOut?: () => void;
  onWorkspaceReady: (workspace: ProductionWorkspace) => void;
}) {
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<ProductionSpotifyArtistCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [searchPending, setSearchPending] = useState(false);
  const [selectPending, setSelectPending] = useState(false);

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
            setMessage(artists.length ? null : "No Spotify artists matched that search.");
          }
        })
        .catch((searchError) => {
          if (!cancelled) {
            setCandidates([]);
            setMessage(readErrorMessage(searchError, "Spotify artist search failed."));
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
    if (!spotifyArtistAdapter) {
      setMessage("Spotify search is not configured for this environment.");
      return;
    }

    if (!user && !workspace) {
      setMessage("Sign in before connecting an artist.");
      return;
    }

    try {
      setSelectPending(true);
      setMessage(null);
      const targetWorkspace =
        workspace ??
        (await workspaceLoader.createInitialWorkspace?.(user as ProductionUser, {
          artistName: candidate.name,
          workspaceName: `${candidate.name} Desk`,
        }));

      if (!targetWorkspace) {
        setMessage("Workspace onboarding is not configured for this environment.");
        return;
      }

      const connectedWorkspace = await spotifyArtistAdapter.connectArtist(targetWorkspace, candidate);
      onWorkspaceReady(connectedWorkspace);
    } catch (connectError) {
      setMessage(readErrorMessage(connectError, "Spotify artist could not be connected."));
    } finally {
      setSelectPending(false);
    }
  }

  return (
    <ConnectArtistScreen
      query={query}
      candidates={candidates}
      pending={searchPending || selectPending}
      message={selectPending ? "Connecting Spotify identity and starting catalog import." : message}
      onQueryChange={setQuery}
      onSelectCandidate={selectCandidate}
      onSignOut={onSignOut}
    />
  );
}

function AuthFrame({ children, logoTestId }: { children: ReactNode; logoTestId?: string }) {
  return (
    <div data-testid="auth-shell" className="app-light relative min-h-screen overflow-hidden bg-background px-5 py-5 text-foreground sm:px-7 lg:px-9">
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
        @keyframes red-antler-scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}</style>
      
      <div
        data-testid="branded-loader"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen w-screen bg-background select-none"
      >
        <div className="relative flex flex-col items-center justify-center">
          {/* Centered Brand Icon Tile */}
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

          {/* wide-tracked elegant uppercase status text */}
          <p className="font-ui mt-10 text-[9px] font-bold uppercase tracking-[0.24em] text-muted-foreground/60 leading-none">
            {statusLabel}
          </p>

          {/* Minimalist ultra-thin progress bar */}
          <div className="mt-5 h-[1.5px] w-24 overflow-hidden rounded-full bg-foreground/5">
            <span
              className="block h-full w-[48px] rounded-full bg-brand-accent"
              style={{
                animation: "red-antler-scan 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite",
              }}
            />
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

function isWorkspaceReadyForDesk(workspace: ProductionWorkspace) {
  return workspace.contextComplete;
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
