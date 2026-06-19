import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Headphones,
  Megaphone,
  Route,
} from "lucide-react";
import type {
  CleanProductionRepositories,
  MissionCheckpointViewModel,
  MissionEventViewModel,
  MissionNoteViewModel,
  MissionRecapViewModel,
  MissionTaskViewModel,
  ProductionFixtureData,
} from "../types/cleanProduction";
import type { ProductionAuthAdapter, ProductionUser, ProductionWorkspace, ProductionWorkspaceLoader } from "../types/productionApp";

const nightBusMissionCheckpoints: MissionCheckpointViewModel[] = [
  {
    id: "cp-1-foundation",
    phase: 1,
    title: "Release Foundation",
    status: "Needs revision",
    question: "Is the release safe to build a real rollout on?",
    requiredTaskIds: ["confirm-release-positioning", "confirm-split-sheet", "submit-distributor-package"],
    dependsOnCheckpointIds: [],
    unlocks: ["Campaign Build"],
    blockedReason: "Split sheet approval is missing.",
    dependencyImpact: "Distributor package stays conditional until rights clear.",
    watchedSignals: ["release date", "split sheet", "distributor delivery", "budget guardrail"],
    decisionRule: "Do not clear this phase until distributor delivery is confirmed and split approval is written.",
    recommendation: "Fix split sheet before clearing this phase.",
    resultSummary: "Release date is locked. Split sheet is blocking rights clearance. Distributor package cannot be marked done until rights clear.",
    nextAction: "Get the producer split sheet signed and uploaded.",
  },
  {
    id: "cp-2-campaign",
    phase: 2,
    title: "Campaign Build",
    status: "Waiting on tasks",
    question: "Are the platform pitch, creator targets, press package, and owned content ready?",
    requiredTaskIds: ["submit-spotify-pitch", "build-creator-list", "prepare-press-epk", "approve-launch-content"],
    dependsOnCheckpointIds: ["cp-1-foundation"],
    unlocks: ["Outreach & Activation"],
    blockedReason: "Waiting on Release Foundation to clear.",
    dependencyImpact: "Campaign assets can be prepared but outreach stays conditional.",
    watchedSignals: ["Spotify pitch", "creator list", "EPK", "content approval"],
    decisionRule: "Do not start the outreach wave until all four build tasks are complete.",
    recommendation: "Prepare campaign assets now. Keep outreach conditional.",
    resultSummary: "Spotify pitch is submitted. Creator list, EPK, and content approval are still pending.",
    nextAction: "Complete the creator list, EPK, and content approval.",
  },
  {
    id: "cp-3-outreach",
    phase: 3,
    title: "Outreach & Activation",
    status: "Waiting on tasks",
    question: "Have creators, curators, and press received targeted outreach?",
    requiredTaskIds: ["send-outreach-wave"],
    dependsOnCheckpointIds: ["cp-2-campaign"],
    unlocks: ["Release Day"],
    blockedReason: "Waiting on Campaign Build to complete.",
    dependencyImpact: "Release day work cannot start until outreach commitments are tracked.",
    watchedSignals: ["creator replies", "curator replies", "press replies", "commitments"],
    decisionRule: "Do not send the outreach wave without the EPK, creator briefs, and posting windows ready.",
    recommendation: "Wait for all campaign assets before sending outreach.",
    resultSummary: "Outreach wave is not yet sent.",
    nextAction: "Send once creator list, EPK, and content approval are done.",
  },
  {
    id: "cp-4-release-day",
    phase: 4,
    title: "Release Day",
    status: "Watching signal",
    question: "Is the song live, linked correctly, and mapped to the right profiles?",
    requiredTaskIds: ["verify-release-live"],
    dependsOnCheckpointIds: ["cp-3-outreach"],
    unlocks: ["Post-Release Signal"],
    blockedReason: "Waiting on Outreach & Activation and distributor delivery.",
    dependencyImpact: "Post-release signal reads cannot start until release is verified live.",
    watchedSignals: ["Spotify", "Apple Music", "YouTube Music", "TikTok sound", "smart-link", "profile mapping"],
    decisionRule: "If links, profiles, or sounds are wrong, stop outbound pushes until logged and routed.",
    recommendation: "Hold until the release is confirmed live on June 12.",
    resultSummary: "Release-day verification starts when the song is live.",
    nextAction: "Verify links, profiles, and sounds before pushing traffic.",
  },
  {
    id: "cp-5-signal",
    phase: 5,
    title: "Post-Release Signal",
    status: "Watching signal",
    question: "Is early demand strong enough to keep pushing, change angle, spend, or pause?",
    requiredTaskIds: ["pull-48-hour-read"],
    dependsOnCheckpointIds: ["cp-4-release-day"],
    unlocks: [],
    blockedReason: "Waiting on Release Day verification.",
    dependencyImpact: "Next push decision waits for the 48-hour signal read.",
    watchedSignals: ["saves", "smart-link clicks", "comments", "shares", "playlist adds", "creator performance"],
    decisionRule: "Continue or spend only if listener behavior moves with creator and content response.",
    recommendation: "Wait for the 48-hour signal read before scaling spend.",
    resultSummary: "Post-release signal review happens after launch on June 14.",
    nextAction: "Run the 48-hour and 7-day reads before scaling spend.",
  },
];

const nightBusMissionTasks: MissionTaskViewModel[] = [
  {
    id: "confirm-release-positioning",
    checkpointId: "cp-1-foundation",
    title: "Confirm release date, positioning, and budget",
    owner: "Artist / manager",
    deadline: "D-21 / Fri May 22",
    approvalState: "not_required",
    purpose: "Lock the professional release path after the Manager moved the drop from next Friday to June 12.",
    steps: ["Confirm Friday, June 12, 2026 as the new date", "Approve the song story: late-night transit confession", "Confirm the $5,000 budget guardrail and no rushed next-Friday drop"],
    evidenceIds: ["EV-ART-0007"],
    dependency: "Artist accepts the date move and single positioning.",
    riskIfLate: "The team keeps planning against two different dates and every later gate becomes unreliable.",
    result: {
      status: "completed",
      summary: "Release date moved and positioning accepted.",
      userNote: "Artist accepted Friday, June 12, 2026 and the late-night transit story.",
      interpretation: "The release strategy gate is clean. The Manager can build a real rollout instead of a rushed next-Friday drop.",
      missionEffect: "Strengthened thesis: the mission now has enough runway for DSP, creator, press, and owned-audience work.",
      followUp: "Run rights and distributor gates before public announcement.",
    },
  },
  {
    id: "confirm-split-sheet",
    checkpointId: "cp-1-foundation",
    title: "Confirm split sheet",
    owner: "Manager / producer rep",
    deadline: "D-20 / Sat May 23",
    approvalState: "blocked",
    purpose: "Get written split approval before distributor submission is treated as safe.",
    steps: ["Send the final split sheet to writers and producer", "Confirm master ownership and publishing/admin notes", "Upload written approval or mark the rights gate blocked"],
    evidenceIds: ["EV-RGT-0612"],
    dependency: "Producer has to sign before the Manager clears the release.",
    riskIfLate: "The Manager keeps the release conditional and may move the date again.",
    result: {
      status: "blocked",
      summary: "Split sheet is not signed.",
      userNote: "Producer has not signed.",
      interpretation: "Rights gate failed. Release should not proceed until split approval is written.",
      missionEffect: "Created risk: the release remains conditional and may need another date change.",
      followUp: "Create urgent split approval task and keep release date conditional.",
    },
  },
  {
    id: "submit-distributor-package",
    checkpointId: "cp-1-foundation",
    title: "Submit distributor package",
    owner: "Label ops",
    deadline: "D-19 / Sun May 24",
    approvalState: "active",
    purpose: "Deliver the master, artwork, metadata, profile mapping, territories, and release date to the distributor.",
    steps: ["Upload final master and approved artwork", "Verify title, explicit flag, version, ISRC/UPC, territories, and artist profile mapping", "Save distributor confirmation or issue log"],
    evidenceIds: ["EV-DSP-0612"],
    dependency: "Final master, artwork, and metadata are ready.",
    riskIfLate: "DSP availability and profile mapping may break on release day.",
  },
  {
    id: "submit-spotify-pitch",
    checkpointId: "cp-2-campaign",
    title: "Submit Spotify for Artists pitch",
    owner: "Manager",
    deadline: "D-18 / Mon May 25",
    approvalState: "active",
    purpose: "Preserve the editorial and Release Radar opportunity that would have been damaged by a next-Friday rush.",
    steps: ["Open the upcoming release in Spotify for Artists", "Pitch one unreleased song with genre, mood, instruments, culture/story context, and marketing plan", "Log the pitch copy and submit confirmation"],
    evidenceIds: ["EV-SP-3302", "EV-DSP-0612"],
    dependency: "Distributor delivery appears in Spotify for Artists.",
    riskIfLate: "The team loses practical DSP preparation time and weakens playlist/editor context.",
    result: {
      status: "completed",
      summary: "Spotify pitch is submitted.",
      userNote: "Pitch submitted Monday with story, genre, mood, marketing plan.",
      interpretation: "DSP gate improved. Pitch window preserved because release moved to June 12.",
      missionEffect: "Strengthened thesis: the Manager protected a platform window that next Friday would have weakened.",
      followUp: "Prepare independent curator outreach using the same positioning.",
    },
  },
  {
    id: "build-creator-list",
    checkpointId: "cp-2-campaign",
    title: "Build TikTok creator target list",
    owner: "Marketing Lead",
    deadline: "D-17 / Tue May 26",
    approvalState: "active",
    purpose: "Choose specific creators who can use the song naturally instead of asking for generic promo.",
    steps: ["Find 20 micro creators across night-drive, lyric-caption, fan-edit, transition, and Atlanta culture niches", "Pick the hook timestamp and caption angle for each niche", "Mark target status: not contacted, sent, replied, committed, posted"],
    evidenceIds: ["EV-TTK-0426", "EV-YT-1190"],
    dependency: "Song hook timestamp and creator budget are known.",
    riskIfLate: "Creators post too late or use the wrong moment of the song.",
  },
  {
    id: "prepare-press-epk",
    checkpointId: "cp-2-campaign",
    title: "Prepare press angle and EPK",
    owner: "Manager / publicist",
    deadline: "D-16 / Wed May 27",
    approvalState: "active",
    purpose: "Give blogs, DJs, newsletters, college radio, and local culture pages a real reason to care.",
    steps: ["Write the short release story", "Package artwork, private stream, credits, contact, bio, and photos", "Build the press and tastemaker target list by fit"],
    evidenceIds: ["EV-ART-0007", "EV-YT-1190"],
    dependency: "Release story and assets are approved.",
    riskIfLate: "Outreach becomes a cold release-day blast with low response quality.",
  },
  {
    id: "approve-launch-content",
    checkpointId: "cp-2-campaign",
    title: "Approve launch-week content pack",
    owner: "Artist / marketing",
    deadline: "D-14 / Fri May 29",
    approvalState: "needs approval",
    purpose: "Prepare enough owned content to convert attention into streams during release week.",
    steps: ["Approve announcement copy", "Approve three short-form concepts", "Prepare caption bank, bio-link copy, email/SMS copy, and pinned post plan"],
    evidenceIds: ["EV-TTK-0426"],
    dependency: "Artist can approve the final public voice.",
    riskIfLate: "Release week starts without enough controlled demand creation.",
  },
  {
    id: "send-outreach-wave",
    checkpointId: "cp-3-outreach",
    title: "Send creator, curator, and tastemaker outreach",
    owner: "Manager / marketing",
    deadline: "D-10 / Tue Jun 2",
    approvalState: "active",
    purpose: "Move the target lists from strategy into actual commitments and replies.",
    steps: ["Send creator briefs with hook timestamp and posting window", "Send independent curator notes with fit rationale", "Send press/tastemaker pitch with private stream link"],
    evidenceIds: ["EV-TTK-0426", "EV-YT-1190"],
    dependency: "Creator list, EPK, and pitch language are ready.",
    riskIfLate: "The launch loses third-party touchpoints before the song is live.",
  },
  {
    id: "verify-release-live",
    checkpointId: "cp-4-release-day",
    title: "Verify release live across platforms",
    owner: "Label ops",
    deadline: "Release day / Fri Jun 12",
    approvalState: "active",
    purpose: "Confirm the song is live, linked correctly, and mapped to the right profiles.",
    steps: ["Check Spotify, Apple Music, YouTube Music, TikTok/Instagram sound, and smart-link", "Update bio links and pinned posts", "Log wrong artwork, wrong profile, missing sound, or broken link issues"],
    evidenceIds: ["EV-DSP-0612"],
    dependency: "Distributor delivery completed.",
    riskIfLate: "The team sends traffic to broken or incorrect release destinations.",
  },
  {
    id: "pull-48-hour-read",
    checkpointId: "cp-5-signal",
    title: "Pull 48-hour signal read",
    owner: "Manager",
    deadline: "D+2 / Sun Jun 14",
    approvalState: "active",
    purpose: "Decide whether the first push should continue, change angle, add spend, or pause.",
    steps: ["Review smart-link clicks, Spotify saves, comments, shares, playlist adds, creator posts, and source-of-stream if available", "Compare response by creator niche and content angle", "Create the next Manager recommendation"],
    evidenceIds: ["EV-SP-3302", "EV-TTK-0426"],
    dependency: "Release is live and early signals are available.",
    riskIfLate: "The team keeps pushing the wrong angle or spends before signal quality is clear.",
  },
];

const nightBusMissionNotes: MissionNoteViewModel[] = [
  {
    id: "manager-marketing-request",
    route: "Manager -> Marketing Lead",
    briefType: "Creator seeding request",
    subject: "Build a creator lane before the June 12 release",
    message: "Build the creator target list around night-drive, lyric-caption, fan-edit, transition, and Atlanta culture niches. Do not send generic promo asks.",
    sourceBasis: "Night Bus has repeat comment language and a late-night transit story, but creator demand needs to be manufactured before release week.",
    recommendedAction: "Create creator briefs and track outreach status from not contacted to posted.",
    resultingChange: "Created task",
    status: "Prepared handoff",
  },
  {
    id: "finance-manager-update",
    route: "Finance/Rights -> Manager",
    briefType: "Rights risk",
    subject: "Split sheet blocks release clearance",
    message: "The release should remain conditional until the producer split is written and uploaded.",
    sourceBasis: "Writer/producer credits, master ownership, and publishing notes are partially known; producer signature is still missing.",
    recommendedAction: "Create urgent split approval follow-up and keep June 12 conditional until resolved.",
    resultingChange: "Updated checkpoint",
    status: "Waiting on sources",
  },
];

const nightBusMissionRecap: MissionRecapViewModel = {
  finalCall: "Move the date and run the release properly instead of rushing a soft drop.",
  currentState: "The mission is active after the Manager moved the requested next-Friday release to Friday, June 12, 2026. Strategy is clear, but Rights & Metadata is still holding because the split sheet is not signed.",
  originalRequest: "I want to drop a new song next week",
  confidence: "Medium-high",
  reviewDate: "Rights gate review",
  sections: [
    { label: "Task status summary", value: "Strategy is accepted, split sheet is blocked, Spotify pitch is submitted, and creator, press, content, distribution, release-day, and post-release tasks are staged by checkpoint." },
    { label: "Checkpoint status summary", value: "Release Strategy is met, Rights & Metadata needs revision, DSP & Playlist is ready for review, and the remaining gates wait on task results." },
    { label: "Agent notes that changed the mission", value: "Marketing opened creator seeding, DSP/playlist notes preserved the pitch window, and Finance/Rights changed the rights checkpoint to needs revision." },
    { label: "Decisions already made", value: "Move the release to June 12, reject the next-Friday rush, do not announce before rights and delivery clear, and avoid generic creator or playlist blasts." },
    { label: "Blockers and missing evidence", value: "Signed split sheet, distributor confirmation, creator commitments, EPK target list, launch content approval, live-link verification, and 48-hour signal read are still missing." },
    { label: "What would change the recommendation", value: "The Manager changes the date or mission path if splits stay blocked, distributor delivery fails, creator commitments are weak, or early post-release signal does not justify more push." },
  ],
  missingEvidence: ["Signed split sheet", "Distributor confirmation", "Creator commitments", "Press/EPK target list", "48-hour post-release signal"],
  alternativesRejected: ["Drop next Friday with no pitch window", "Blast generic creator outreach", "Announce before distributor and rights gates clear"],
  changeDecision: "Signed splits, clean distributor delivery, creator commitments, or a serious platform issue would change the next recommendation.",
  override: "None recorded",
  qualityGate: "Passed with constraint: release remains conditional until rights and distributor package are clean.",
};

const nightBusMissionEvents: MissionEventViewModel[] = [
  { type: "manager_run", actor: "Manager", summary: "User asked: I want to drop a new song next week." },
  { type: "recommendation_changed", actor: "Manager", summary: "Manager moved the target from next Friday to Friday, June 12, 2026 to protect the release window." },
  { type: "task_created", actor: "Manager", summary: "Created release tasks across strategy, rights, distribution, DSP, creators, press, content, launch day, and post-release read." },
  { type: "task_result_added", actor: "Manager", summary: "Split sheet task was reviewed as blocked because producer signature is missing." },
  { type: "checkpoint_reached", actor: "Manager", summary: "Rights & Metadata Gate changed to Needs revision and DSP & Playlist Gate improved after pitch submission." },
];

export const productionFixtureData: ProductionFixtureData = {
  profile: {
    name: "Sable Day",
    spotify: "Sable Day - verified artist",
    genre: "Alternative R&B",
    market: "Atlanta",
    release: "Night Bus",
    goal:
      "Transition Sable Day from Atlanta's underground R&B scene to a national breakout act. Establish a dominant foothold on key DSPs by targeting Alternative R&B charts and editorial playlist support, aiming to scale monthly active listeners from 180k to 500k over the next 6 months while securing creative autonomy and solidifying her data sovereignty.",
    budget: "$5,000",
    stage: "Developing artist with breakout signals",
    tiktok: "@sableday",
    instagram: "@sableday",
    youtube: "@sableday",
    x: "@sableday",
  },
  priority: [
    { label: "Focus", value: "Night Bus", meta: "Music", actionLabel: "Open active music focus", target: "musicWorkspace" },
    { label: "Attention", value: "Split approval", meta: "Rights", actionLabel: "Open blocked rights task", target: "missionsWorkspace" },
    { label: "Next Move", value: "Clear rights", meta: "Today", actionLabel: "Open next task", target: "missionsWorkspace" },
    { label: "Missions", value: "3", meta: "Active", actionLabel: "Open active missions", target: "missionsWorkspace" },
  ],
  attention: [
    {
      title: "Split approval",
      body: "The Manager is waiting on the signed split sheet before the June 12 release can be treated as clean.",
      tone: "warning",
    },
    {
      title: "Distributor package",
      body: "Distributor confirmation is still needed before the June 12 delivery path can be treated as clean.",
      tone: "accent",
    },
  ],
  movement: [
    { label: "Milestone", title: "Started content testing", time: "2h ago" },
    { label: "Team Agents", title: "Creative brief sent to Marketing", time: "5h ago" },
    { label: "System", title: "Nigeria signal verified by Manager", time: "Yesterday" },
  ],
  todayBrief: {
    headlineRead: "Sable Day's first read has a clear current-release center.",
    intelligenceSnapshot: [
      {
        title: "Current Music In View",
        insight: "The workspace is already organized around the newest release lane, so management can start with focus instead of catalog cleanup.",
        metrics: [
          { label: "Focus record", value: "Night Bus", context: "current release", evidenceIds: ["fixture-catalog"] },
          { label: "Budget", value: "$4.1K", context: "working context", evidenceIds: ["fixture-profile"] },
        ],
      },
    ],
    snapshotSummary: "The strongest fixture signal is a focused current release with a defined budget context.",
    managerRead:
      "This is not a blank artist setup. Sable Day already has a current release lane and a budget context, so the first management decision is focus: decide whether Night Bus is the record that should organize the workspace today. If it is, every next task should protect that lane instead of opening five unrelated directions.",
    sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    confidence: "limited",
    generatedAt: "2026-06-17T08:30:00.000Z",
    managerSynthesisRunId: "fixture-brief-run",
    state: "fallback",
  },
  agents: [
    {
      id: "manager",
      name: "AI Manager",
      status: "available",
      readiness: "Available now",
      purpose: "Keeps the artist moving: priorities, decisions, missions, check-ins, and team briefs.",
      icon: BriefcaseBusiness,
      workspaceTitle: "Manager command desk",
      workspaceSubtitle: "Turns artist replies, specialist notes, and source limits into decisions and mission work.",
      sections: [
        {
          eyebrow: "Operating queue",
          title: "Manager decisions",
          actionLabel: "Open decision package",
          items: [
            {
              title: "Night Bus release call",
              meta: "Active mission",
              status: "Needs rights gate",
              detail: "Keep campaign work moving while split approval remains the next management blocker.",
              value: "June 12",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Artist profile",
          action: "Open Artist Direction",
          detail: "Goals, budget, release focus, and constraints are already in the workspace.",
          state: "active",
        },
      ],
    },
    {
      id: "marketing",
      name: "Marketing Lead",
      status: "locked",
      readiness: "Needs source",
      purpose: "Campaign planning, creator tests, paid/organic growth, and platform strategy.",
      icon: Megaphone,
      workspaceTitle: "Campaign command board",
      workspaceSubtitle: "Plans tests, creator targets, budget guardrails, and future ad generation.",
      sections: [
        {
          eyebrow: "Campaign tests",
          title: "Campaign command board",
          actionLabel: "Draft test plan",
          items: [
            {
              title: "Late-night transit hook",
              meta: "Organic test",
              status: "Ready to brief",
              detail: "Use Night Bus story, hook timestamp, and short-form captions for creator outreach.",
              value: "$500 cap",
            },
            {
              title: "AI ad lab",
              meta: "Future tool",
              status: "Conditional",
              detail: "Prepare audio-led ad concepts once campaign and conversion reports are available.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Spotify for Artists export",
          action: "Upload Spotify for Artists CSV",
          detail: "Needed for saves, source-of-stream, and listener behavior.",
          state: "needs_upload",
        },
        {
          label: "smart-link report",
          action: "Upload smart-link report",
          detail: "Needed for click paths and campaign-source evidence.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "syncDeals",
      name: "Sync & Deals",
      status: "locked",
      readiness: "Needs source",
      purpose: "Finds sync, brand, partnership, and deal opportunities when rights and pitch materials are credible.",
      icon: Headphones,
      workspaceTitle: "Sync deal pipeline",
      workspaceSubtitle: "Tracks licensing opportunities, submitted songs, rights gates, and manual deal leads.",
      sections: [
        {
          eyebrow: "Deal tracking",
          title: "Sync deal pipeline",
          actionLabel: "Track new deal",
          items: [
            {
              title: "Indie film night-drive cue",
              meta: "music supervisor brief",
              status: "Rights check",
              detail: "Night Bus matches tone, but split approval blocks submission.",
              value: "Deadline Jun 4",
            },
          ],
        },
      ],
      sources: [
        {
          label: "signed split sheet or rights document",
          action: "Upload rights document",
          detail: "Needed before outreach or availability can be treated as credible.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "touring",
      name: "Touring Agent",
      status: "locked",
      readiness: "Needs source",
      purpose: "Booking, routing, venue fit, promoter conversations, and live readiness.",
      icon: Route,
      workspaceTitle: "Booking and tour desk",
      workspaceSubtitle: "Connects live history, venue notes, demand signals, and calendar constraints.",
      sections: [
        {
          eyebrow: "Show holds",
          title: "Booking and tour desk",
          items: [
            {
              title: "The Masquerade",
              meta: "Atlanta hold",
              status: "$3,500 guarantee",
              detail: "Local demand is strong, but routing and availability need confirmation.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Google Calendar availability",
          action: "Connect calendar",
          detail: "Needed before holds and travel windows can be treated as real.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "finance",
      name: "Finance/Rights",
      status: "locked",
      readiness: "Needs source",
      purpose: "Revenue, rights, recoupment, budgets, royalty statements, and split safety.",
      icon: BadgeDollarSign,
      workspaceTitle: "Finance investigation desk",
      workspaceSubtitle: "Compares royalty statements, payouts, splits, distributor reports, and rights state.",
      sections: [
        {
          eyebrow: "Rights review",
          title: "Royalty statement comparison",
          actionLabel: "Compare statement to splits",
          items: [
            {
              title: "Night Bus split gate",
              meta: "song-level rights state",
              status: "Blocking",
              detail: "Revenue or rights conclusions require signed split sheets and distributor payout reports.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "royalty statements",
          action: "Upload royalty statement",
          detail: "Needed for revenue and payout claims.",
          state: "needs_upload",
        },
        {
          label: "signed split sheets",
          action: "Upload split sheet",
          detail: "Needed before release confidence can be treated as clean.",
          state: "needs_upload",
        },
      ],
    },
  ],
  missions: [
    {
      id: "mission-night-bus",
      title: "Release Night Bus on June 12",
      status: "blocked",
      progress: 42,
      review: "Rights & Metadata Gate",
      summary: "Coordinate every release-critical step for Night Bus without treating the rushed next-Friday drop as safe.",
      recommendation: "Move the release to Friday, June 12, 2026 and keep the rights gate active.",
      musicSubject: "Night Bus",
      nextTask: "Confirm split sheet",
      tasks: nightBusMissionTasks,
      checkpoints: nightBusMissionCheckpoints,
      notes: nightBusMissionNotes,
      recap: nightBusMissionRecap,
      events: nightBusMissionEvents,
    },
    {
      id: "mission-validation",
      title: "Validate Night Bus before scale spend",
      status: "active",
      progress: 64,
      review: "72-hour signal review",
      summary: "Use $1,850 for a 10-day validation test while holding back $2,250 until private signals are cleaner.",
      recommendation: "Run a capped test, then review saves, clicks, follows, and demand comments.",
      musicSubject: "Night Bus",
      nextTask: "Approve capped campaign test budget",
      tasks: nightBusMissionTasks.filter((task) => ["build-creator-list", "approve-launch-content", "pull-48-hour-read"].includes(task.id)),
      checkpoints: nightBusMissionCheckpoints.filter((checkpoint) => ["cp-2-campaign", "cp-5-signal"].includes(checkpoint.id)),
      notes: nightBusMissionNotes.slice(0, 1),
      recap: {
        ...nightBusMissionRecap,
        finalCall: "Run a capped validation loop before scale spend.",
        currentState: "The validation mission is active while private saves, clicks, follows, and creator response remain the proof needed for more budget.",
      },
      events: nightBusMissionEvents.slice(1),
    },
  ],
  music: [
    {
      id: "song-night-bus",
      kind: "song",
      title: "Night Bus",
      lifecycle: "Ready",
      blocker: "Confirm split sheet",
      status: "Active focus",
      lifecycleStage: "Ready",
      sourceKind: "User-supplied + public catalog setup",
      sourceLimit: "Public catalog and user-supplied details do not include private Spotify analytics.",
      managerRead: "This is the strongest current focus asset because story, hook response, and release intent are lining up.",
      nextMove: "Clear rights and delivery gaps before increasing spend or making public commitments.",
      rightsState: "Split sheet holding release clearance",
      coverImageUrl: "/logo.png",
      assets: ["Final master", "Artwork", "Metadata draft"],
      fileAssets: [
        { group: "Audio", label: "Final master", status: "Uploaded", action: "Upload final master", assetType: "final_master", canReplace: true },
        { group: "Artwork", label: "Cover art", status: "Confirmed", action: "Upload artwork", assetType: "cover_art", canReplace: true },
        { group: "Splits", label: "Split sheet document", status: "Missing", action: "Upload split sheet", assetType: "split_sheet", canUpload: true },
      ],
      linkedMissionIds: ["mission-night-bus"],
      linkedTaskIds: ["confirm-split-sheet", "submit-distributor-package", "submit-spotify-pitch"],
      linkedTaskCount: 3,
      files: [
        { label: "Final master", status: "Uploaded" },
        { label: "Cover art", status: "Confirmed" },
        { label: "Rights documents", status: "Missing" },
      ],
      details: [
        { label: "ISRC", value: "Missing", status: "Missing" },
        { label: "Producer", value: "Mara Vale", status: "Confirmed" },
        { label: "Mix engineer", value: "Lena Cruz", status: "Draft" },
      ],
      splits: {
        status: "No splits started",
        summary: "Release confidence is blocked until publishing and master splits balance and collaborators confirm.",
        contributors: [],
      },
    },
    {
      id: "song-after-hours",
      kind: "song",
      title: "After Hours Static",
      lifecycle: "Catalog",
      blocker: "None",
      status: "Released catalog",
      lifecycleStage: "Catalog",
      sourceKind: "Spotify public catalog",
      sourceLimit: "Spotify public catalog supports identity and public metadata only.",
      nextMove: "Use as a safer fit hypothesis for pitch packages once assets are confirmed.",
      linkedMissionIds: [],
      linkedTaskIds: [],
      linkedTaskCount: 0,
      splits: {
        status: "Split sheet confirmed",
        summary: "Split sheet confirmed by all collaborators.",
        contributors: [
          { name: "Sable Day", role: "Artist / writer", publishingShare: "50%", masterShare: "70%", approval: "Cleared" },
          { name: "Mara Vale", role: "Producer / writer", publishingShare: "50%", masterShare: "30%", approval: "Cleared" },
        ],
      },
    },
    {
      id: "project-glass-room",
      kind: "project",
      title: "Glass Room EP",
      lifecycle: "Scheduled",
      lifecycleStage: "Scheduled",
      status: "Unreleased body of work",
      sourceKind: "User-supplied",
      blocker: "Night Bus split sheet",
      sourceLimit: "Projects roll up blockers from their songs without duplicating song state.",
      nextMove: "Resolve inherited blocker before final release packaging.",
      coverImageUrl: "/logo.png",
      linkedMissionIds: ["mission-night-bus"],
      linkedTaskIds: ["confirm-split-sheet"],
      linkedTaskCount: 3,
      songs: ["Night Bus", "Southbound Blue"],
      songIds: ["song-night-bus"],
    },
  ],
  conversations: [
    {
      id: "conv-release",
      topic: "Night Bus release planning",
      status: "Music record and release mission prepared",
      summary: "Release-song thread that creates a Music record first, then links mission work to it.",
      prompt: "I want to drop a new song next week.",
      messages: [
        { id: "m1", speaker: "artist", label: "You asked", body: "I want to drop a new song next week." },
        {
          id: "m2",
          speaker: "manager",
          label: "Manager answered",
          body: "Treat the song as the durable recorded-work object first. Create the song record, keep files, rights, source limits, and lifecycle in Music, then create a release mission linked to that song.",
        },
      ],
      createdWork: [
        { type: "music_item", title: "Night Bus", body: "Music record for lifecycle, files, details, rights, and source limits.", id: "song-night-bus" },
        { type: "mission", title: "Release Night Bus on June 12", body: "Coordinated release mission linked to Night Bus.", id: "mission-night-bus" },
      ],
    },
  ],
  evidence: [
    {
      id: "EV-204",
      source: "Manager synthesis",
      sourceKind: "operating read",
      subject: "Night Bus momentum",
      metric: "128.4k tracked streams",
      window: "Current read",
      confidence: "Medium",
      limitation: "Private Spotify saves, source-of-stream, smart-link clicks, royalty statements, and rights metadata are missing.",
    },
  ],
};

export function createFixtureRepositories(): CleanProductionRepositories {
  let missions = productionFixtureData.missions.map((mission) => ({
    ...mission,
    checkpoints: mission.checkpoints?.map((checkpoint) => ({ ...checkpoint })),
    tasks: mission.tasks?.map((task) => ({ ...task })),
  }));
  let music = productionFixtureData.music.map((item) => ({
    ...item,
    files: item.files?.map((file) => ({ ...file })),
    fileAssets: item.fileAssets?.map((asset) => ({ ...asset })),
    details: item.details?.map((detail) => ({ ...detail })),
    metadataFields: item.metadataFields?.map((field) => ({ ...field })),
    releaseFields: item.releaseFields?.map((field) => ({ ...field })),
    credits: item.credits?.map((credit) => ({ ...credit })),
    identifiers: item.identifiers?.map((identifier) => ({ ...identifier })),
  }));

  return {
    artistProfile: {
      async loadProfile() {
        return productionFixtureData.profile;
      },
    },
    desk: {
      async loadDesk() {
        return {
          priority: productionFixtureData.priority,
          attention: productionFixtureData.attention,
          movement: productionFixtureData.movement,
          todayBrief: productionFixtureData.todayBrief,
        };
      },
      async generateTodaysBrief(_mode = "operating") {
        return productionFixtureData.todayBrief;
      },
    },
    staff: {
      async loadAgents() {
        return productionFixtureData.agents;
      },
    },
    music: {
      async loadMusic() {
        return music;
      },
      async generateMusicSummary(subjectId) {
        // In fixture mode, just return the existing music object as-is
        const found = music.find((item) => item.id === subjectId);
        if (!found) throw new Error("Fixture music item not found for brief generation.");
        return found;
      },
      async createSong(input) {
        const created = {
          id: `fixture-song-${Date.now()}`,
          kind: "song" as const,
          title: input.title,
          lifecycle: input.lifecycleStage,
          lifecycleStage: input.lifecycleStage,
          blocker: "No active blocker",
          sourceKind: "manual",
          sourceLimit: "Fixture-created song.",
          nextMove: "Add files, credits, and rights details.",
          linkedMissionIds: [],
          linkedTaskCount: 0,
        };
        music = [created, ...music];
        return created;
      },
      async createProject(input) {
        const created = {
          id: `fixture-project-${Date.now()}`,
          kind: "project" as const,
          title: input.title,
          status: input.projectType,
          lifecycle: input.lifecycleStage,
          lifecycleStage: input.lifecycleStage,
          blocker: "No inherited blockers",
          sourceKind: "manual",
          sourceLimit: "Fixture-created project.",
          nextMove: "Add songs to this project.",
          linkedMissionIds: [],
          linkedTaskCount: 0,
        };
        music = [created, ...music];
        return created;
      },
      async updateLifecycleStage() {},
      async saveDetail() {},
      async saveCredit() {},
      async saveIdentifier() {},
      async saveSplitContributor(musicItemId, input) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song") return item;
          const currentSplits = item.splits ?? {
            status: "Draft",
            summary: "Split proposal started. Balance shares before sending confirmation links.",
            contributors: [],
          };
          const contributors = [
            ...(currentSplits.contributors ?? []),
            {
              id: `fixture-contributor-${Date.now()}`,
              name: input.name,
              role: input.role,
              email: input.email,
              publishingShare: `${input.publishingShare}%`,
              masterShare: `${input.masterShare}%`,
              approval: "Draft",
            },
          ];
          return {
            ...item,
            splits: {
              ...currentSplits,
              status: "Draft",
              publishingTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.publishingShare))}%`,
              masterTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.masterShare))}%`,
              contributors,
            },
          };
        });
      },
      async removeSplitContributor(musicItemId, contributorId) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song" || !item.splits) return item;
          const contributors = item.splits.contributors.filter((contributor) => contributor.id !== contributorId);
          return {
            ...item,
            splits: {
              ...item.splits,
              status: contributors.length ? "Draft" : "Missing",
              publishingTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.publishingShare))}%`,
              masterTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.masterShare))}%`,
              contributors,
            },
          };
        });
      },
      async sendSplitConfirmationLinks(musicItemId) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song" || !item.splits) return item;
          return {
            ...item,
            splits: {
              ...item.splits,
              status: "Pending Confirmation",
              summary: "Split confirmation links sent. Waiting for collaborators to confirm their shares.",
              approvalLog: [...(item.splits.approvalLog ?? []), "Split confirmation links sent to collaborators."],
              contributors: item.splits.contributors.map((contributor) => ({ ...contributor, approval: "Pending" })),
            },
          };
        });
      },
      async loadSplitConfirmation() {
        throw new Error("Fixture split confirmations are opened from emailed links in production.");
      },
      async submitSplitConfirmation() {},
      async uploadAsset(_musicItemId, input) {
        const uploaded = {
          group: input.assetType === "cover_art" ? "Artwork" as const : input.assetType === "split_sheet" ? "Splits" as const : "Audio" as const,
          label: input.title,
          status: "Uploaded",
          action: "Uploaded",
          assetType: input.assetType,
          canReplace: true,
          canUpload: false,
        };
        music = music.map((item) => {
          if (item.id !== _musicItemId || item.kind !== "song") return item;
          const nextFileAssets = [...(item.fileAssets ?? [])];
          const existingIndex = nextFileAssets.findIndex((asset) => asset.assetType === input.assetType || asset.label === input.title);
          if (existingIndex >= 0) {
            nextFileAssets[existingIndex] = { ...nextFileAssets[existingIndex], ...uploaded };
          } else {
            nextFileAssets.push(uploaded);
          }
          return {
            ...item,
            fileAssets: nextFileAssets,
            files: nextFileAssets.map((asset) => ({ label: asset.label, status: asset.status })),
          };
        });
        return uploaded;
      },
    },
    manager: {
      async loadConversations() {
        return productionFixtureData.conversations;
      },
    },
    missions: {
      async loadMissions() {
        return missions.filter((mission) => mission.status !== "candidate");
      },
      async approveTask(taskId) {
        missions = missions.map((mission) => ({
          ...mission,
          tasks: mission.tasks?.map((task) => task.id === taskId ? { ...task, status: "approved" } : task),
        }));
      },
      async completeTask(taskId, input) {
        let updatedMission = missions[0];
        missions = missions.map((mission) => {
          const hasTask = mission.tasks?.some((task) => task.id === taskId);
          if (!hasTask) return mission;
          const nextTasks = mission.tasks?.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  status: input.status,
                  managerInterpretation: input.status === "blocked"
                    ? `Blocked: ${input.note}`
                    : `Completed: ${input.note}`,
                }
              : task,
          );
          const nextCheckpoints = mission.checkpoints?.map((checkpoint) => {
            const checkpointTasks = nextTasks?.filter((task) => task.checkpointId === checkpoint.id) ?? [];
            if (checkpointTasks.some((task) => task.status === "blocked")) {
              return { ...checkpoint, status: "needs_revision", recommendation: "A linked task is blocked; Manager review should revise the path." };
            }
            if (checkpointTasks.length && checkpointTasks.every((task) => task.status === "completed")) {
              return { ...checkpoint, status: "ready_for_manager_check", recommendation: "Required task results are ready for Manager review." };
            }
            return checkpoint;
          });
          updatedMission = { ...mission, tasks: nextTasks, checkpoints: nextCheckpoints };
          return updatedMission;
        });
        return updatedMission;
      },
    },
    missionGenesis: {
      async runMissionGenesis() {
        const candidateId = "fixture-mission-candidate";
        missions = [
          {
            id: candidateId,
            title: "Validate whether a rising market deserves focused operating attention",
            status: "candidate",
            progress: 0,
            review: "Context gate",
            summary: "The Manager sees a possible market or audience pressure, but needs operating context before activating work.",
            recommendation: "Answer Mission Genesis context questions before activation.",
            musicSubject: "Artist-wide",
            nextTask: "Answer context questions",
          },
          ...missions.filter((mission) => mission.id !== candidateId),
        ];
        return {
          outcome: "candidate_needs_context",
          title: "Mission candidate needs context",
          body: "The Manager found a possible audience or market operating pressure, but needs budget, goal, and team capacity before activating mission work.",
          reasons: ["Context could materially change the mission plan."],
          questions: [
            {
              key: "mission_90_day_goal",
              question: "What should the Manager optimize for over the next 90 days?",
              reason: "The mission changes depending on whether the artist needs audience growth, revenue, industry leverage, market entry, catalog value, or creative reset.",
              answerKind: "single_select" as const,
              options: ["Audience growth", "Revenue", "Industry leverage", "Market entry", "Catalog value", "Creative reset"],
            },
            {
              key: "mission_budget_range",
              question: "What budget range can the Manager plan around before asking for explicit spend approval?",
              reason: "Budget posture controls whether the mission recommends proof gathering, capped tests, or larger coordinated work.",
              answerKind: "money_range" as const,
            },
            {
              key: "mission_team_capacity",
              question: "Who can actually execute work this month?",
              reason: "The mission timeline and task ownership must match real capacity.",
              answerKind: "single_select" as const,
              options: ["Artist only", "Small team", "Label team", "External vendors available", "Unknown"],
            },
          ],
          evidenceNeeded: [],
          candidateMissionId: candidateId,
        };
      },
      async answerMissionGenesisContext(input) {
        const activatedId = input.candidateMissionId;
        missions = [
          {
            id: activatedId,
            title: "Validate whether a rising market deserves focused operating attention",
            status: "active",
            progress: 0,
            review: "Market signal quality",
            summary: "Use saved context, audience signal, and team capacity to test whether the rising market deserves focused work.",
            recommendation: "Organize the work internally, preserve evidence limits, and request permission before external or spend-sensitive action.",
            musicSubject: "Artist-wide",
            nextTask: "Verify geography signal quality",
            checkpoints: [
              {
                id: "fixture-checkpoint-market-signal",
                title: "Market signal quality",
                question: "Is this market signal real enough to deserve focused operating attention?",
                status: "waiting",
                recommendation: "Verify source-backed geography before spending.",
              },
              {
                id: "fixture-checkpoint-test-design",
                title: "Scoped market test",
                question: "What is the smallest credible test that can prove whether the market deserves more work?",
                status: "waiting",
                recommendation: "Keep the test inside the answered budget and team capacity.",
              },
            ],
            tasks: [
              {
                id: "fixture-task-geography",
                title: "Verify geography signal quality",
                status: "proposed",
                ownerRole: "Manager",
                checkpointId: "fixture-checkpoint-market-signal",
                purpose: "Confirm whether the market signal is source-backed and current enough to influence strategy.",
              },
              {
                id: "fixture-task-test-boundary",
                title: "Define the market test boundary",
                status: "proposed",
                ownerRole: "Manager",
                checkpointId: "fixture-checkpoint-test-design",
                purpose: "Scope the market test to the artist's budget, team capacity, and positioning.",
              },
            ],
          },
          ...missions.filter((mission) => mission.id !== activatedId),
        ];
        return {
          outcome: "activate_mission",
          title: "Mission activated",
          body: "The Manager used the new context to activate a personalized operating mission with checkpoint questions and tasks.",
          reasons: ["The candidate now has enough context to create useful managed work."],
          questions: [],
          evidenceNeeded: [],
          activatedMissionId: activatedId,
        };
      },
    },
    evidence: {
      async loadEvidence() {
        return productionFixtureData.evidence;
      },
    },
  };
}

export function createFixtureProductionRuntime(): {
  authAdapter: ProductionAuthAdapter;
  workspaceLoader: ProductionWorkspaceLoader;
} {
  const user: ProductionUser = {
    id: "fixture-user",
    email: "sable@example.com",
    displayName: productionFixtureData.profile.name,
  };
  const workspace: ProductionWorkspace = {
    accountId: "fixture-account",
    artistId: "fixture-artist",
    artistWorkspaceId: "fixture-workspace",
    artistName: productionFixtureData.profile.name,
    workspaceName: `${productionFixtureData.profile.name} Desk`,
    status: "active",
    spotifyConnected: true,
    spotifyArtistId: "fixture-spotify-artist",
    spotifyArtistName: productionFixtureData.profile.name,
    spotifyArtistUrl: "https://open.spotify.com/artist/fixture-spotify-artist",
    contextComplete: true,
    latestCatalogSyncStatus: "completed",
  };

  return {
    authAdapter: {
      async getSession() {
        return { user };
      },
      async signInWithPassword() {
        return { user, message: "Signed in with fixture data." };
      },
      async signUpWithPassword() {
        return { user, message: "Fixture account ready." };
      },
      async signOut() {
        return undefined;
      },
    },
    workspaceLoader: {
      async loadActiveWorkspace() {
        return workspace;
      },
      async createInitialWorkspace(_user, draft) {
        return {
          ...workspace,
          artistName: draft.artistName.trim() || workspace.artistName,
          workspaceName: draft.workspaceName?.trim() || workspace.workspaceName,
        };
      },
    },
  };
}

function sumFixtureShares(values: string[]) {
  return Number(values.reduce((sum, value) => {
    const parsed = Number.parseFloat(value.replace("%", ""));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0).toFixed(2));
}
