import { Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DeskRail, Field, MobileChrome, ProductButton, sectionForView } from "../design-system/components";
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
  MissionViewModel,
  MovementItem,
  MusicObjectViewModel,
  PriorityItem,
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
      <AuthFrame>
        <div className="w-[min(100%,28rem)] rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-4">Loading Ordersounds</p>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Checking session and active artist workspace.</p>
        </div>
      </AuthFrame>
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
        <div className="w-[min(100%,28rem)] rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Load failed</p>
          <h1 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-3">Production workspace could not load</h1>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">{error}</p>
          <div className="mt-5">
            <ProductButton onClick={loadProductionState}>Retry</ProductButton>
          </div>
        </div>
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
  const [priority, setPriority] = useState<PriorityItem[]>([]);
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
  const [targetMusicObjectId, setTargetMusicObjectId] = useState<string | null>(null);
  const [managerAnswers, setManagerAnswers] = useState<Record<string, string>>({});
  const [setupPending, setSetupPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [todayBriefPending, setTodayBriefPending] = useState(false);
  const [todayBriefError, setTodayBriefError] = useState<string | null>(null);

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
        setPriority(nextDesk.priority);
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
  }

  function openManager() {
    navigate("managerOffice");
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
      navigate("missionsWorkspace");
    }
  }

  async function reloadMusic() {
    const nextMusic = await repositories.music.loadMusic();
    setMusic(nextMusic);
  }

  async function generateTodaysBrief() {
    try {
      setTodayBriefPending(true);
      setTodayBriefError(null);
      const nextBrief = await repositories.desk.generateTodaysBrief();
      setTodayBrief(nextBrief);
    } catch (error) {
      setTodayBriefError(readErrorMessage(error, "Today's Brief could not be generated."));
    } finally {
      setTodayBriefPending(false);
    }
  }

  if (viewModelError) {
    return (
      <AuthFrame>
        <div className="w-[min(100%,28rem)] rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">View data failed</p>
          <h1 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-3">Workspace data could not load</h1>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">{viewModelError}</p>
        </div>
      </AuthFrame>
    );
  }

  if (!profile) {
    return (
      <AuthFrame>
        <div className="w-[min(100%,28rem)] rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="font-display text-[18px] font-bold tracking-tight text-foreground mt-4">Loading workspace data</p>
          <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-2">Preparing artist, music, mission, and manager views.</p>
        </div>
      </AuthFrame>
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
          <MobileChrome active={activeSection} title={mobileTitle} onNavigate={navigate} onSignOut={onSignOut} />
          {view === "labelHQ" ? (
            <DeskHQScreen
              profile={profile}
              todayBrief={todayBrief}
              todayBriefPending={todayBriefPending}
              todayBriefError={todayBriefError}
              priority={priority}
              attention={attention}
              movement={movement}
              agents={agents}
              missions={missions}
              onNavigate={navigate}
              onManager={openManager}
              onGenerateTodaysBrief={generateTodaysBrief}
              onLockedAgent={(agent) => {
                setSelectedAgent(agent);
                navigate("lockedAgentWorkspace");
              }}
              onDrawer={setDrawer}
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
              answers={managerAnswers}
              setAnswers={setManagerAnswers}
              conversations={conversations}
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
              onSelectMission={setSelectedMissionId}
              onDrawer={setDrawer}
            />
          ) : null}
          {view === "artistProfileWorkspace" ? (
            <SettingsScreen profile={profile} onChange={setProfile} onBack={() => navigate("labelHQ")} onSignOut={onSignOut} />
          ) : null}
        </main>
      </div>
      <ProductionDrawers drawer={drawer} evidence={evidence} mission={selectedMission} onClose={() => setDrawer(null)} />
      <span className="sr-only">{workspace?.workspaceName ?? "Ordersounds workspace"}</span>
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
    <AuthFrame>
      <section className="w-[min(100%,28rem)] rounded-[24px] border border-foreground/8 bg-background/80 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">Ordersounds</p>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Artist operating desk</p>
          </div>
        </div>
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent mt-6">Session required</p>
        <h1 className="font-display text-[18px] font-bold tracking-tight text-foreground mt-2">Sign in to Ordersounds</h1>
        <p className="text-[13px] font-semibold leading-relaxed text-muted-foreground/82 mt-3">Use your account to open the production workspace.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <Field label="Email" value={email} onChange={setEmail} type="email" />
          <Field label="Password" value={password} onChange={setPassword} type="password" />
          {message ? <p className="rounded-xl border border-foreground/8 bg-foreground/[0.025] p-3 text-sm font-semibold text-muted-foreground">{message}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <ProductButton type="submit" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {isSignUp ? "Create account" : "Sign in"}
            </ProductButton>
            <ProductButton
              variant="secondary"
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

function AuthFrame({ children }: { children: ReactNode }) {
  return <div className="app-light grid min-h-screen place-items-center bg-background px-5 py-5 text-foreground">{children}</div>;
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
