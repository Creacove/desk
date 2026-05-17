import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Gauge,
  Headphones,
  Lock,
  Megaphone,
  MessageSquareText,
  Mic2,
  PenLine,
  Route,
  Sparkles,
  Upload,
  X,
  Settings,
  UsersRound,
  Calendar,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type View =
  | "connectArtist"
  | "setup"
  | "labelHQ"
  | "staffWorkspace"
  | "managerOffice"
  | "conversationWorkspace"
  | "investigation"
  | "decisionPackage"
  | "missionsWorkspace"
  | "tasksWorkspace"
  | "testLabWorkspace"
  | "briefsWorkspace"
  | "artistProfileWorkspace"
  | "lockedAgentWorkspace"
  | "reviewWorkspace";

type DrawerKind = "evidence" | "decisionRecord" | "workDraft" | "intelligence" | null;

type Agent = {
  id: string;
  name: string;
  title: string;
  status: "available" | "locked";
  icon: typeof BriefcaseBusiness;
  purpose: string;
  tools: string[];
  evidence: string[];
  connectedSources: string[];
  requiredSources: string[];
  optionalSources: string[];
  sourceActions: string[];
  managerCanPrepare: string;
  color: string;
};

type ArtistProfile = {
  name: string;
  spotify: string;
  genre: string;
  market: string;
  release: string;
  goal: string;
  budget: string;
  stage: string;
  tiktok: string;
  instagram: string;
  youtube: string;
  x: string;
};

type Mission = {
  id: string;
  title: string;
  status: "active" | "review" | "blocked" | "complete";
  progress: number;
  tasks: number;
  tests: number;
  briefs: number;
  review: string;
  summary: string;
  archived?: boolean;
};

type RecentConversation = {
  id: string;
  topic: string;
  lastUpdate: string;
  status: string;
  prompt: string;
  summary: string;
  archived?: boolean;
  messages: ConversationMessage[];
};

type ConversationMessage = {
  id: string;
  speaker: "artist" | "manager";
  label: string;
  body: string;
  budgetAction?: string;
  heldBack?: string;
  reviewPoint?: string;
  whyThisCall?: string[];
  rejectedMoves?: string[];
  workCreated?: { type: "mission" | "task" | "checkpoint" | "test"; title: string; body: string; id?: string };
};

type TaskResult = {
  taskId: string;
  status: "completed" | "blocked" | "missed" | "rejected" | "revised";
  summary: string;
  userNote: string;
  interpretation: string;
  missionEffect: string;
  followUp: string;
};

type MissionReview = {
  title: string;
  outcome: string;
  recommendation: string;
  why: string;
  changes: string[];
  nextTaskCreated: string;
  nextReview: string;
};

type ArtistOperatingMemory = {
  strategyThesis: string;
  knownPatterns: string[];
  doNotRepeat: string[];
  openQuestions: string[];
};

type ReleaseTask = {
  id: string;
  checkpointId: string;
  title: string;
  owner: string;
  deadline: string;
  approvalState: "not_required" | "needs approval" | "approved" | "blocked" | "active";
  purpose: string;
  steps: string[];
  evidenceIds: string[];
  dependency: string;
  why: string;
  riskIfLate: string;
};

type MissionCheckpoint = {
  id: string;
  title: string;
  status: "Waiting on tasks" | "Ready for AI review" | "Needs revision" | "Watching signal" | "Met";
  question: string;
  requiredTaskIds: string[];
  watchedSignals: string[];
  decisionRule: string;
  recommendation: string;
  resultSummary: string;
  nextAction: string;
};

type MissionEvent = {
  type: string;
  summary: string;
  actor: string;
};

const artist = {
  name: "Sable Day",
  spotify: "Sable Day - verified artist",
  genre: "Alternative R&B",
  market: "Atlanta",
  release: "Night Bus",
  goal: "Release Night Bus on June 12",
  budget: "$5,000",
  stage: "Developing artist with breakout signals",
  tiktok: "@sableday",
  instagram: "@sableday",
  youtube: "@sableday",
  x: "@sableday",
};

const agents: Agent[] = [
  {
    id: "manager",
    name: "AI Manager",
    title: "Available now",
    status: "available",
    icon: BriefcaseBusiness,
    purpose: "Keeps the artist moving: priorities, decisions, missions, check-ins, and team briefs.",
    tools: ["Decision reviews", "Mission planner", "Artist check-ins", "Quality review"],
    evidence: ["Artist profile", "catalog signals", "social evidence", "budget context", "prior decisions"],
    connectedSources: ["Spotify public identity", "Artist profile", "TikTok public signal", "YouTube public signal"],
    requiredSources: ["Spotify artist identity"],
    optionalSources: ["Spotify for Artists export", "Smart-link clicks", "Royalty statements"],
    sourceActions: ["Connect Spotify for Artists", "Upload smart-link CSV"],
    managerCanPrepare: "Already active.",
    color: "#9A3BDC",
  },
  {
    id: "marketing",
    name: "Marketing Lead",
    title: "Locked",
    status: "locked",
    icon: Megaphone,
    purpose: "Campaign planning, content tests, creators, paid/organic growth, and platform strategy.",
    tools: ["Content test planner", "creator map", "campaign calendar", "paid spend gate"],
    evidence: ["TikTok/Instagram/YouTube analytics", "campaign history", "smart-link data", "comment themes"],
    connectedSources: ["TikTok public signal", "YouTube public signal", "Artist replies"],
    requiredSources: ["content analytics", "campaign history"],
    optionalSources: ["creator list", "smart-link clicks", "paid spend history"],
    sourceActions: ["Connect social analytics", "Upload campaign history"],
    managerCanPrepare: "Campaign brief, content test, budget recommendation.",
    color: "#ffc7a3",
  },
  {
    id: "syncDeals",
    name: "Sync & Deals",
    title: "Locked",
    status: "locked",
    icon: Headphones,
    purpose: "Finds sync, brand, partnership, and deal opportunities only when rights and pitch materials are credible.",
    tools: ["Opportunity fit map", "rights readiness gate", "pitch package builder", "deal-risk checklist"],
    evidence: ["rights clarity", "pitch assets", "catalog metadata", "audience proof", "brand-fit notes"],
    connectedSources: ["Catalog metadata", "Night Bus operating read"],
    requiredSources: ["rights clarity", "pitch assets"],
    optionalSources: ["one-sheet", "clean instrumental", "prior deal notes", "brand target list"],
    sourceActions: ["Upload pitch materials", "Add rights documents"],
    managerCanPrepare: "Sync/deals readiness brief, missing-material checklist, and pitch questions.",
    color: "#dfccff",
  },
  {
    id: "touring",
    name: "Touring Agent",
    title: "Locked",
    status: "locked",
    icon: Route,
    purpose: "City validation, show readiness, routing, and live-market opportunity.",
    tools: ["City signal map", "route planner", "show readiness gate", "partner path"],
    evidence: ["Streaming geography", "YouTube geography", "social demand", "ticketing proxies", "comment locations"],
    connectedSources: ["Streaming geography", "YouTube geography", "comment locations"],
    requiredSources: ["city demand signals", "live history"],
    optionalSources: ["ticketing proxies", "venue notes", "promoter list"],
    sourceActions: ["Connect live history", "Upload venue notes"],
    managerCanPrepare: "Market validation brief without claiming show readiness.",
    color: "#bdeecb",
  },
  {
    id: "financeRights",
    name: "Finance/Rights",
    title: "Locked",
    status: "locked",
    icon: CircleDollarSign,
    purpose: "Budget guardrails, royalty questions, payout timing, ownership, splits, metadata, and rights hygiene.",
    tools: ["Budget gate", "royalty statement intake", "split risk map", "rights checklist", "metadata review"],
    evidence: ["Royalty statements", "payout history", "split sheets", "distributor metadata", "publishing/master ownership"],
    connectedSources: ["Budget context", "Distributor metadata placeholder"],
    requiredSources: ["royalty statements", "split sheets"],
    optionalSources: ["payout history", "publishing ownership", "master ownership", "ISRC metadata"],
    sourceActions: ["Upload royalty statement", "Upload split sheet"],
    managerCanPrepare: "Finance and rights intake brief with missing-evidence checklist.",
    color: "#aee7ff",
  },
];

const managerQuestions = [
  {
    id: "date",
    question: "Is next Friday fixed, or can the Manager move the date if the release needs more runway?",
    suggested: "Move the date if needed. Protect pitching, creators, press, rights, and delivery quality.",
  },
  {
    id: "assets",
    question: "Are the final master, artwork, distributor access, and release metadata already close?",
    suggested: "Master and artwork are close. Metadata and split sheet still need final confirmation.",
  },
  {
    id: "outreach",
    question: "Do we want a real rollout with playlist, creator, press, and owned-audience outreach?",
    suggested: "Yes. Treat this as a proper release, not a rushed upload.",
  },
];

const investigationSteps = [
  "Understanding the management decision",
  "Checking artist operating profile",
  "Mapping evidence needs to source capabilities",
  "Reviewing catalog and release signals",
  "Comparing attention, participation, conversion, and leverage",
  "Checking budget, timing, rights, and team-capacity red flags",
  "Creating execution package",
  "Checking the work",
];

const baseMissions: Mission[] = [
  {
    id: "night-bus-validation",
    title: "Release Night Bus on June 12",
    status: "active",
    progress: 36,
    tasks: 10,
    tests: 9,
    briefs: 5,
    review: "Rights gate holding",
    summary: "Manager moved the rushed next-Friday drop to Friday, June 12, 2026 so delivery, rights, DSP pitching, creator seeding, press, and launch execution can be handled properly.",
  },
  {
    id: "profile-completeness",
    title: "Establish Full Data Sovereignty",
    status: "blocked",
    progress: 35,
    tasks: 3,
    tests: 0,
    briefs: 1,
    review: "Waiting on uploads",
    summary: "Unify all private artist data sources to enable high-confidence AI decisions on budget, rights, and marketing spend.",
  },
  {
    id: "rights-hygiene",
    title: "Institutionalize Artist Rights",
    status: "review",
    progress: 52,
    tasks: 2,
    tests: 0,
    briefs: 2,
    review: "Rights metadata needed",
    summary: "Standardize ownership and metadata hygiene across the catalog to prepare for professional sync and brand partnerships.",
  },
  {
    id: "march-rollout",
    title: "Consolidate Q1 Performance Records",
    status: "complete",
    progress: 100,
    tasks: 5,
    tests: 1,
    briefs: 2,
    review: "Completed Apr 04",
    summary: "Review and archive all Q1 release data to inform the next operating cycle's budget and creative strategy.",
    archived: true,
  },
];

const taskRows: ReleaseTask[] = [
  {
    id: "confirm-release-positioning",
    checkpointId: "release-strategy",
    title: "Confirm release date, positioning, and budget",
    owner: "Artist / manager",
    deadline: "D-21 / Fri May 22",
    approvalState: "not_required",
    purpose: "Lock the professional release path after the Manager moved the drop from next Friday to June 12.",
    steps: ["Confirm Friday, June 12, 2026 as the new date", "Approve the song story: late-night transit confession", "Confirm the $5,000 budget guardrail and no rushed next-Friday drop"],
    evidenceIds: ["EV-ART-0007"],
    dependency: "Artist accepts the date move and single positioning.",
    why: "A real manager protects platform windows and team execution instead of forcing a rushed release.",
    riskIfLate: "The team keeps planning against two different dates and every later gate becomes unreliable.",
  },
  {
    id: "confirm-split-sheet",
    checkpointId: "rights-metadata",
    title: "Confirm split sheet",
    owner: "Manager / producer rep",
    deadline: "D-20 / Sat May 23",
    approvalState: "blocked",
    purpose: "Get written split approval before distributor submission is treated as safe.",
    steps: ["Send the final split sheet to writers and producer", "Confirm master ownership and publishing/admin notes", "Upload written approval or mark the rights gate blocked"],
    evidenceIds: ["EV-RGT-0612"],
    dependency: "Producer has to sign before the Manager clears the release.",
    why: "Rights ambiguity can create takedowns, royalty disputes, or a release-date change.",
    riskIfLate: "The Manager keeps the release conditional and may move the date again.",
  },
  {
    id: "submit-distributor-package",
    checkpointId: "distribution",
    title: "Submit distributor package",
    owner: "Label ops",
    deadline: "D-19 / Sun May 24",
    approvalState: "active",
    purpose: "Deliver the master, artwork, metadata, profile mapping, territories, and release date to the distributor.",
    steps: ["Upload final master and approved artwork", "Verify title, explicit flag, version, ISRC/UPC, territories, and artist profile mapping", "Save distributor confirmation or issue log"],
    evidenceIds: ["EV-DSP-0612"],
    dependency: "Final master, artwork, and metadata are ready.",
    why: "Distribution has to be correct before the team can credibly pitch, seed, or announce.",
    riskIfLate: "DSP availability and profile mapping may break on release day.",
  },
  {
    id: "submit-spotify-pitch",
    checkpointId: "dsp-playlist",
    title: "Submit Spotify for Artists pitch",
    owner: "Manager",
    deadline: "D-18 / Mon May 25",
    approvalState: "active",
    purpose: "Preserve the editorial and Release Radar opportunity that would have been damaged by a next-Friday rush.",
    steps: ["Open the upcoming release in Spotify for Artists", "Pitch one unreleased song with genre, mood, instruments, culture/story context, and marketing plan", "Log the pitch copy and submit confirmation"],
    evidenceIds: ["EV-SP-3302", "EV-DSP-0612"],
    dependency: "Distributor delivery appears in Spotify for Artists.",
    why: "This is one of the few platform windows a manager can protect by moving the date.",
    riskIfLate: "The team loses practical DSP preparation time and weakens playlist/editor context.",
  },
  {
    id: "build-creator-list",
    checkpointId: "creator-seeding",
    title: "Build TikTok creator target list",
    owner: "Marketing Lead",
    deadline: "D-17 / Tue May 26",
    approvalState: "active",
    purpose: "Choose specific creators who can use the song naturally instead of asking for generic promo.",
    steps: ["Find 20 micro creators across night-drive, lyric-caption, fan-edit, transition, and Atlanta culture niches", "Pick the hook timestamp and caption angle for each niche", "Mark target status: not contacted, sent, replied, committed, posted"],
    evidenceIds: ["EV-TTK-0426", "EV-YT-1190"],
    dependency: "Song hook timestamp and creator budget are known.",
    why: "Creator seeding needs fit, timing, and follow-up, not a blast list.",
    riskIfLate: "Creators post too late or use the wrong moment of the song.",
  },
  {
    id: "prepare-press-epk",
    checkpointId: "press-tastemaker",
    title: "Prepare press angle and EPK",
    owner: "Manager / publicist",
    deadline: "D-16 / Wed May 27",
    approvalState: "active",
    purpose: "Give blogs, DJs, newsletters, college radio, and local culture pages a real reason to care.",
    steps: ["Write the short release story", "Package artwork, private stream, credits, contact, bio, and photos", "Build the press and tastemaker target list by fit"],
    evidenceIds: ["EV-ART-0007", "EV-YT-1190"],
    dependency: "Release story and assets are approved.",
    why: "Press and tastemakers need a clear angle, not a generic song announcement.",
    riskIfLate: "Outreach becomes a cold release-day blast with low response quality.",
  },
  {
    id: "approve-launch-content",
    checkpointId: "content-owned",
    title: "Approve launch-week content pack",
    owner: "Artist / marketing",
    deadline: "D-14 / Fri May 29",
    approvalState: "needs approval",
    purpose: "Prepare enough owned content to convert attention into streams during release week.",
    steps: ["Approve announcement copy", "Approve three short-form concepts", "Prepare caption bank, bio-link copy, email/SMS copy, and pinned post plan"],
    evidenceIds: ["EV-TTK-0426"],
    dependency: "Artist can approve the final public voice.",
    why: "The release needs a repeatable content system, not one announcement post.",
    riskIfLate: "Release week starts without enough controlled demand creation.",
  },
  {
    id: "send-outreach-wave",
    checkpointId: "creator-seeding",
    title: "Send creator, curator, and tastemaker outreach",
    owner: "Manager / marketing",
    deadline: "D-10 / Tue Jun 2",
    approvalState: "active",
    purpose: "Move the target lists from strategy into actual commitments and replies.",
    steps: ["Send creator briefs with hook timestamp and posting window", "Send independent curator notes with fit rationale", "Send press/tastemaker pitch with private stream link"],
    evidenceIds: ["EV-TTK-0426", "EV-YT-1190"],
    dependency: "Creator list, EPK, and pitch language are ready.",
    why: "A real rollout needs tracked outreach and follow-up, not passive hope.",
    riskIfLate: "The launch loses third-party touchpoints before the song is live.",
  },
  {
    id: "verify-release-live",
    checkpointId: "release-day",
    title: "Verify release live across platforms",
    owner: "Label ops",
    deadline: "Release day / Fri Jun 12",
    approvalState: "active",
    purpose: "Confirm the song is live, linked correctly, and mapped to the right profiles.",
    steps: ["Check Spotify, Apple Music, YouTube Music, TikTok/Instagram sound, and smart-link", "Update bio links and pinned posts", "Log wrong artwork, wrong profile, missing sound, or broken link issues"],
    evidenceIds: ["EV-DSP-0612"],
    dependency: "Distributor delivery completed.",
    why: "Launch-day mistakes waste momentum and confuse fans, creators, and press.",
    riskIfLate: "The team sends traffic to broken or incorrect release destinations.",
  },
  {
    id: "pull-48-hour-read",
    checkpointId: "post-release-signal",
    title: "Pull 48-hour signal read",
    owner: "Manager",
    deadline: "D+2 / Sun Jun 14",
    approvalState: "active",
    purpose: "Decide whether the first push should continue, change angle, add spend, or pause.",
    steps: ["Review smart-link clicks, Spotify saves, comments, shares, playlist adds, creator posts, and source-of-stream if available", "Compare response by creator niche and content angle", "Create the next Manager recommendation"],
    evidenceIds: ["EV-SP-3302", "EV-TTK-0426"],
    dependency: "Release is live and early signals are available.",
    why: "The Manager uses early evidence to change the plan instead of blindly continuing.",
    riskIfLate: "The team keeps pushing the wrong angle or spends before signal quality is clear.",
  },
];

const evidence = [
  {
    id: "EV-TTK-0426",
    source: "TikTok",
    sourceKind: "mock/demo",
    type: "Social performance",
    subject: "Night Bus hook clips",
    window: "Last 14 days",
    metric: "4.8x baseline views",
    lens: "Attention",
    freshness: "Today",
    confidence: "Medium",
    provenance: "Connected social report",
    limitation: "Views do not prove listener demand.",
    rawRef: "snapshot/tiktok/night-bus-14d",
  },
  {
    id: "EV-YT-1190",
    source: "YouTube",
    sourceKind: "mock/demo",
    type: "Comment evidence",
    subject: "Night Bus short + visualizer comments",
    window: "Last 30 days",
    metric: "Repeated release-request comments",
    lens: "Participation",
    freshness: "Today",
    confidence: "Medium",
    provenance: "Public comments",
    limitation: "Sample is noisy and not linked to streaming conversion.",
    rawRef: "snapshot/youtube/night-bus-comments",
  },
  {
    id: "EV-SP-3302",
    source: "Spotify",
    sourceKind: "real API",
    type: "Catalog metadata",
    subject: "Sable Day catalog",
    window: "Current public profile",
    metric: "Catalog identity and public metadata",
    lens: "Conversion",
    freshness: "Today",
    confidence: "Low-medium",
    provenance: "Public API",
    limitation: "Private saves, skips, source-of-stream, and listener saves are not connected.",
    rawRef: "snapshot/spotify/public-catalog",
  },
  {
    id: "EV-ART-0007",
    source: "Artist reply",
    sourceKind: "user-supplied",
    type: "Capacity context",
    subject: "launch-week content sprint",
    window: "This campaign",
    metric: "Daily posting commitment confirmed",
    lens: "Context",
    freshness: "Now",
    confidence: "High",
    provenance: "Manager question reply",
    limitation: "Applies to this campaign window only.",
    rawRef: "memory/artist-replies/may-budget",
  },
  {
    id: "EV-RGT-0612",
    source: "Rights intake",
    sourceKind: "user-supplied",
    type: "Release rights",
    subject: "Night Bus split and ownership package",
    window: "Pre-release",
    metric: "Producer signature still missing",
    lens: "Risk",
    freshness: "Today",
    confidence: "Medium",
    provenance: "Manager release intake",
    limitation: "Not legal advice; requires team confirmation.",
    rawRef: "release/night-bus-rights",
  },
  {
    id: "EV-DSP-0612",
    source: "Distributor tracker",
    sourceKind: "mock/demo",
    type: "Platform delivery",
    subject: "Night Bus June 12 release",
    window: "Pre-release",
    metric: "Delivery package pending",
    lens: "Readiness",
    freshness: "Today",
    confidence: "Medium",
    provenance: "Distributor release checklist",
    limitation: "DSP ingestion timing must be confirmed by the distributor.",
    rawRef: "release/night-bus-distribution",
  },
];

const missionCheckpoints: MissionCheckpoint[] = [
  {
    id: "release-strategy",
    title: "Release Strategy Gate",
    status: "Met",
    question: "Can this release date survive with a real manager-grade rollout?",
    requiredTaskIds: ["confirm-release-positioning"],
    watchedSignals: ["artist approval", "team capacity", "budget guardrail", "platform timing"],
    decisionRule: "If the team accepts the date move and positioning, continue. If not, create a soft-drop plan with risk labels.",
    recommendation: "Continue",
    resultSummary: "Manager moved the target from next Friday to Friday, June 12, 2026 and preserved the Spotify pitch window.",
    nextAction: "Run rights and delivery gates before public announcement.",
  },
  {
    id: "rights-metadata",
    title: "Rights & Metadata Gate",
    status: "Needs revision",
    question: "Is the release clean enough to ship without avoidable ownership or metadata risk?",
    requiredTaskIds: ["confirm-split-sheet"],
    watchedSignals: ["split sheet", "writer credits", "producer credits", "master ownership", "explicit/version flags"],
    decisionRule: "Do not clear release readiness if written split approval or ownership notes are missing.",
    recommendation: "Proceed only after split approval",
    resultSummary: "Release is not safe to ship until split approval is written.",
    nextAction: "Create urgent split approval task and keep June 12 conditional.",
  },
  {
    id: "distribution",
    title: "Distribution Gate",
    status: "Waiting on tasks",
    question: "Has the release package been delivered correctly to the distributor?",
    requiredTaskIds: ["submit-distributor-package"],
    watchedSignals: ["master", "artwork", "ISRC/UPC", "territories", "artist profile mapping"],
    decisionRule: "Continue only when distributor confirmation and issue log are clean.",
    recommendation: "Needs task result",
    resultSummary: "Distribution package is still pending.",
    nextAction: "Submit the package after rights risk is cleared or explicitly accepted.",
  },
  {
    id: "dsp-playlist",
    title: "DSP & Playlist Gate",
    status: "Ready for AI review",
    question: "Did we preserve every platform and playlist opportunity still available?",
    requiredTaskIds: ["submit-spotify-pitch"],
    watchedSignals: ["Spotify pitch status", "upcoming release visibility", "smart-link setup", "independent curator list"],
    decisionRule: "If the Spotify pitch is submitted and independent curator targets are ready, continue to outreach.",
    recommendation: "Continue to independent curator outreach",
    resultSummary: "Spotify pitch task strengthens the mission because the June 12 date keeps platform prep viable.",
    nextAction: "Prepare independent curator outreach using the same positioning.",
  },
  {
    id: "creator-seeding",
    title: "Creator Seeding Gate",
    status: "Waiting on tasks",
    question: "Do we have the right creators, asks, hook moments, and follow-up system?",
    requiredTaskIds: ["build-creator-list", "send-outreach-wave"],
    watchedSignals: ["creator fit", "hook timestamp", "reply status", "commitments", "posted links"],
    decisionRule: "Continue only when target list and outreach status are specific enough to manage.",
    recommendation: "Needs creator commitments",
    resultSummary: "Creator seeding has target categories but needs commitments and posted-link tracking.",
    nextAction: "Move from target list to confirmed creators.",
  },
  {
    id: "press-tastemaker",
    title: "Press & Tastemaker Gate",
    status: "Waiting on tasks",
    question: "Does the song have a real story and target list for press, DJs, newsletters, and culture pages?",
    requiredTaskIds: ["prepare-press-epk"],
    watchedSignals: ["EPK", "private stream", "press angle", "target list", "reply quality"],
    decisionRule: "Do not send press outreach until the angle and assets are complete.",
    recommendation: "Needs EPK",
    resultSummary: "Press path is not ready until the EPK and target list are packaged.",
    nextAction: "Package the EPK before the first outreach wave.",
  },
  {
    id: "content-owned",
    title: "Content & Owned Audience Gate",
    status: "Waiting on tasks",
    question: "Is there enough owned content to create signal across release week?",
    requiredTaskIds: ["approve-launch-content"],
    watchedSignals: ["announcement copy", "short-form concepts", "caption bank", "email/SMS", "pinned posts"],
    decisionRule: "Launch content cannot be considered ready until artist-facing copy is approved.",
    recommendation: "Ask approval",
    resultSummary: "The content pack needs artist approval before release-week scheduling.",
    nextAction: "Approve or revise the public voice.",
  },
  {
    id: "release-day",
    title: "Release-Day Gate",
    status: "Waiting on tasks",
    question: "Did the song go live correctly everywhere fans, creators, and press will click?",
    requiredTaskIds: ["verify-release-live"],
    watchedSignals: ["Spotify", "Apple Music", "YouTube Music", "TikTok/Instagram sound", "smart-link", "profile mapping"],
    decisionRule: "If links, profiles, or sounds are wrong, stop outbound pushes until the issue is logged and routed.",
    recommendation: "Pending release day",
    resultSummary: "Release-day verification starts when the song is live.",
    nextAction: "Verify links before pushing traffic.",
  },
  {
    id: "post-release-signal",
    title: "Post-Release Signal Gate",
    status: "Watching signal",
    question: "Is early demand strong enough to keep pushing, change angle, spend lightly, or pause?",
    requiredTaskIds: ["pull-48-hour-read"],
    watchedSignals: ["saves", "smart-link clicks", "comments", "shares", "playlist adds", "creator performance", "source-of-stream"],
    decisionRule: "Continue or spend only if listener behavior moves with creator/content response.",
    recommendation: "Wait for 48-hour read",
    resultSummary: "Post-release signal review happens after launch.",
    nextAction: "Run the 48-hour and 7-day reads before scaling spend.",
  },
];

const departmentBriefs = [
  {
    id: "manager-marketing-request",
    route: "Manager -> Marketing Lead",
    briefType: "Creator seeding request",
    subject: "Build a creator lane before the June 12 release",
    message: "Build the creator target list around night-drive, lyric-caption, fan-edit, transition, and Atlanta culture niches. Do not send generic promo asks; each creator needs the hook timestamp, visual idea, posting window, and status tracking.",
    sourceBasis: "Night Bus has repeat comment language and a late-night transit story, but creator demand needs to be manufactured before release week.",
    recommendedAction: "Create creator briefs and track outreach status from not contacted to posted.",
    resultingChange: "Created task",
    status: "Prepared handoff",
    linkedMission: "Release Night Bus on June 12",
  },
  {
    id: "marketing-manager-finding",
    route: "Marketing Lead -> Manager",
    briefType: "Press angle and EPK request",
    subject: "Package the story before outreach starts",
    message: "The strongest story is not 'new single out now.' It is Sable turning late-night transit anxiety into a clean alt-R&B release. Package the EPK with private stream, artwork, credits, photos, short bio, and contact before blogs, DJs, newsletters, or culture pages are touched.",
    sourceBasis: "The Manager moved the date to protect pitch time; press and tastemaker outreach needs a story and assets, not a release-day blast.",
    recommendedAction: "Prepare EPK, press angle, and target list before the first outreach wave.",
    resultingChange: "Filed to memory",
    status: "Shared with Manager",
    linkedMission: "Release Night Bus on June 12",
  },
  {
    id: "finance-manager-update",
    route: "Finance/Rights -> Manager",
    briefType: "Rights risk",
    subject: "Split sheet blocks release clearance",
    message: "The release should remain conditional until the producer split is written and uploaded. The Manager can keep building the plan, but should not mark Rights & Metadata Gate as clean.",
    sourceBasis: "Writer/producer credits, master ownership, and publishing notes are partially known; producer signature is still missing.",
    recommendedAction: "Create urgent split approval follow-up and keep June 12 conditional until resolved.",
    resultingChange: "Updated checkpoint",
    status: "Waiting on sources",
    linkedMission: "Release Night Bus on June 12",
  },
  {
    id: "manager-sync-request",
    route: "Manager -> Sync & Deals",
    briefType: "Future specialist request",
    subject: "Hold brand and sync outreach until rights gate clears",
    message: "Night Bus can become pitchable after release if rights are clean and early signal is real. Do not imply availability to brands, sync buyers, or partners until split approval and pitch assets are complete.",
    sourceBasis: "The release has a strong story, but rights clarity and post-release proof are not complete.",
    recommendedAction: "Prepare a future pitch-readiness checklist, not external deal outreach.",
    resultingChange: "No action yet",
    status: "Prepared for locked agent",
    linkedMission: "Release Night Bus on June 12",
  },
  {
    id: "manager-dsp-request",
    route: "Manager -> DSP / Playlist",
    briefType: "Playlist pitch prep",
    subject: "Use the date move to preserve the pitch window",
    message: "The Spotify pitch needs one unreleased song, clear genre/mood/instrumentation, story context, and a marketing plan. Independent playlist outreach should be based on fit and listener context, not follower count.",
    sourceBasis: "The Manager moved the release to June 12 to avoid wasting platform and curator windows.",
    recommendedAction: "Submit Spotify pitch, then prepare independent curator outreach using the same positioning.",
    resultingChange: "Updated checkpoint",
    status: "Ready for review",
    linkedMission: "Release Night Bus on June 12",
  },
];

const decisionRecord = {
  missionTitle: "Release Night Bus on June 12",
  currentState: "The mission is active after the Manager moved the requested next-Friday release to Friday, June 12, 2026. Strategy is clear, but Rights & Metadata is still holding because the split sheet is not signed.",
  finalCall: "Move the date and run the release properly instead of rushing a soft drop.",
  aiMemory: "Before answering future Night Bus release questions, the AI should remember that the Manager protected delivery, DSP pitching, creator seeding, press, and launch content by moving the date.",
  latestTestResult: "Rights gate needs revision. DSP pitch path is viable because the June 12 date preserves platform prep time.",
  alternativesRejected: ["Drop next Friday with no pitch window", "Blast generic creator outreach", "Announce before distributor and rights gates clear"],
  confidence: "Medium-high",
  missingEvidence: ["Signed split sheet", "Distributor confirmation", "Creator commitments", "Press/EPK target list", "48-hour post-release signal"],
  changeDecision: "Signed splits, clean distributor delivery, creator commitments, or a serious platform issue would change the next recommendation.",
  reviewDate: "Rights gate review",
  qualityGate: "Passed with constraint: release remains conditional until rights and distributor package are clean.",
  override: "None recorded",
};

const taskResults: TaskResult[] = [
  {
    taskId: "confirm-release-positioning",
    status: "completed",
    summary: "Release date moved and positioning accepted.",
    userNote: "Artist accepted Friday, June 12, 2026 and the late-night transit story.",
    interpretation: "The release strategy gate is clean. The Manager can build a real rollout instead of a rushed next-Friday drop.",
    missionEffect: "Strengthened thesis: the mission now has enough runway for DSP, creator, press, and owned-audience work.",
    followUp: "Run rights and distributor gates before public announcement.",
  },
  {
    taskId: "confirm-split-sheet",
    status: "blocked",
    summary: "Split sheet is not signed.",
    userNote: "Producer has not signed.",
    interpretation: "Rights gate failed. Release should not proceed until split approval is written.",
    missionEffect: "Created risk: the release remains conditional and may need another date change.",
    followUp: "Create urgent split approval task and keep release date conditional.",
  },
  {
    taskId: "submit-spotify-pitch",
    status: "completed",
    summary: "Spotify pitch is submitted.",
    userNote: "Pitch submitted Monday with story, genre, mood, marketing plan.",
    interpretation: "DSP gate improved. Pitch window preserved because release moved to June 12.",
    missionEffect: "Strengthened thesis: the Manager protected a platform window that next Friday would have weakened.",
    followUp: "Prepare independent curator outreach using the same positioning.",
  },
];

const missionReview: MissionReview = {
  title: "Release date moved to protect the rollout",
  outcome: "Move date",
  recommendation: "Move the release to Friday, June 12, 2026. Do not rush next Friday; use the extra runway to clear splits, deliver correctly, pitch DSPs, seed creators, prepare press, and build launch-week content.",
  why: "A next-Friday drop would weaken platform preparation, creator lead time, press outreach, and metadata QA. A serious manager protects the song before chasing speed.",
  changes: ["The Manager preserved the Spotify pitch window.", "Rights & Metadata is now the active blocker because the split sheet is unsigned.", "Creator, playlist, press, and owned-audience work are now tracked as release tasks."],
  nextTaskCreated: "Create urgent split approval task and keep June 12 conditional until the Rights & Metadata Gate clears.",
  nextReview: "Rights gate review",
};

const testReviewImpact = {
  setup: "The Manager moved the release to June 12 so the team can protect delivery, pitching, creator seeding, press, and launch execution.",
  signal: "Task reviews are now feeding checkpoint reviews. The rights gate needs revision, while the DSP gate improved after the Spotify pitch was submitted.",
  complete: "The Manager has enough task results to keep building the rollout, but not enough to clear the release until rights and delivery are clean.",
};

const artistOperatingMemory: ArtistOperatingMemory = {
  strategyThesis: "Sable Day should release Night Bus with professional runway instead of rushing a weak next-Friday drop.",
  knownPatterns: ["Late-night transit language is stronger than generic heartbreak copy", "Creator and press asks perform better when they include a specific story and hook moment"],
  doNotRepeat: ["Do not announce before rights and distributor gates clear", "Do not send generic playlist or creator blasts"],
  openQuestions: ["Will the producer sign the split sheet on time?", "Which creator niche creates the strongest early saves and shares?"],
};

const missionEvents: MissionEvent[] = [
  { type: "manager_run", actor: "Manager", summary: "User asked: I want to drop a new song next week." },
  { type: "recommendation_changed", actor: "Manager", summary: "Manager moved the target from next Friday to Friday, June 12, 2026 to protect the release window." },
  { type: "task_created", actor: "Manager", summary: "Created release tasks across strategy, rights, distribution, DSP, creators, press, content, launch day, and post-release read." },
  { type: "task_result_added", actor: "Manager", summary: "Split sheet task was reviewed as blocked because producer signature is missing." },
  { type: "checkpoint_reached", actor: "Manager", summary: "Rights & Metadata Gate changed to Needs revision and DSP & Playlist Gate improved after pitch submission." },
];

const workDrafts = [
  {
    type: "Creator brief",
    title: "Night Bus creator seeding brief",
    body: "Night-drive, lyric-caption, fan-edit, transition, and Atlanta culture creator lanes with hook timestamps, posting windows, and status tracking.",
  },
  {
    type: "Team task recap",
    title: "June 12 release recap",
    body: "Date moved from next Friday, rights gate conditional, DSP pitch preserved, creator/press/content lanes opened, release-day and post-release reads scheduled.",
  },
  {
    type: "DSP pitch note",
    title: "Night Bus Spotify pitch note",
    body: "One unreleased song, late-night transit story, alt-R&B mood, launch plan, creator seeding, and owned-audience support.",
  },
];

const baseConversations: RecentConversation[] = [
  {
    id: "night-bus-budget",
    topic: "Night Bus release planning",
    lastUpdate: "Today",
    status: "Release moved to June 12; rights gate holding",
    prompt: "Continue the Night Bus release planning conversation. What changed since the Manager moved the date?",
    summary: "Release thread for turning a rushed next-Friday idea into a manager-grade rollout.",
    messages: [
      {
        id: "night-bus-budget-q1",
        speaker: "artist",
        label: "You asked",
        body: "I want to drop a new song next week. What do we need to do?",
      },
      {
        id: "night-bus-budget-a1",
        speaker: "manager",
        label: "Manager answered",
        body: "Do not rush next Friday. Move Night Bus to Friday, June 12, 2026 so we can clear splits, deliver correctly, pitch DSPs, seed creators, prepare press, approve launch content, and run release-day plus post-release checks.",
        budgetAction: "Release rollout",
        heldBack: "No rushed next-Friday drop",
        reviewPoint: "Rights gate review",
        whyThisCall: [
          "Next Friday weakens the DSP pitch and creator lead-time.",
          "Rights and metadata need written confirmation before public rollout.",
          "Press, creators, playlist targets, and owned audience need real assets and follow-up."
        ],
        rejectedMoves: [
          "Drop next Friday with no pitch window",
          "Blast generic creator outreach",
          "Announce before rights and delivery clear"
        ]
      },
      {
        id: "night-bus-budget-work",
        speaker: "manager",
        label: "Work created",
        body: "Created the June 12 release mission, release tasks, checkpoints, agent notes, and mission memory.",
        workCreated: {
          type: "mission",
          title: "Release Night Bus on June 12",
          body: "Backwards release plan with rights, distribution, DSP, creator, press, content, launch-day, and post-release checkpoints.",
          id: "night-bus-validation"
        }
      },
    ],
  },
  {
    id: "tiktok-momentum",
    topic: "TikTok momentum check",
    lastUpdate: "3 days ago",
    status: "Acoustic hook flagged as the strongest demand proxy",
    prompt: "Continue the TikTok momentum check. Are the new video uses turning into listener demand?",
    summary: "Signal thread for separating empty attention from durable listener demand.",
    messages: [
      {
        id: "tiktok-q1",
        speaker: "artist",
        label: "You asked",
        body: "Is this TikTok attention real momentum?",
      },
      {
        id: "tiktok-a1",
        speaker: "manager",
        label: "Manager answered",
        body: "The attention is worth testing, but the acoustic hook needs save, click, and repeat-comment proof before it becomes a scale signal.",
      },
    ],
  },
  {
    id: "rights-gap",
    topic: "Rights and royalty evidence gap",
    lastUpdate: "Last Monday",
    status: "Needs royalty statements before revenue conclusions",
    prompt: "Continue the rights and royalty evidence gap conversation. What should we upload first?",
    summary: "Evidence thread for knowing what revenue and rights claims are currently safe.",
    messages: [
      {
        id: "rights-q1",
        speaker: "artist",
        label: "You asked",
        body: "Can we trust the revenue drop enough to change the plan?",
      },
      {
        id: "rights-a1",
        speaker: "manager",
        label: "Manager answered",
        body: "Not yet. Upload royalty statements, payout history, split sheets, and distributor metadata before making a revenue or rights conclusion.",
      },
    ],
  },
];

const statusText: Record<View, string> = {
  connectArtist: "Connect artist",
  setup: "Setup",
  labelHQ: "Label HQ",
  staffWorkspace: "Staff",
  managerOffice: "Manager office",
  conversationWorkspace: "Conversation",
  investigation: "Manager run",
  decisionPackage: "Decision",
  missionsWorkspace: "Missions",
  tasksWorkspace: "Tasks",
  testLabWorkspace: "Checkpoints",
  briefsWorkspace: "Notes",
  artistProfileWorkspace: "Artist Profile",
  lockedAgentWorkspace: "Locked department",
  reviewWorkspace: "Review",
};

const mobileTitleText: Record<View, string> = {
  connectArtist: "Connect",
  setup: "Setup",
  labelHQ: "Label HQ",
  staffWorkspace: "Team",
  managerOffice: "Manager",
  conversationWorkspace: "Conversation",
  investigation: "Manager run",
  decisionPackage: "Decision",
  missionsWorkspace: "Missions",
  tasksWorkspace: "Tasks",
  testLabWorkspace: "Checkpoints",
  briefsWorkspace: "Notes",
  artistProfileWorkspace: "Profile",
  lockedAgentWorkspace: "Specialist",
  reviewWorkspace: "Review",
};

const BrandMark = ({ size = "md" }: { size?: "sm" | "md" }) => (
  <span
    aria-hidden="true"
    className={cn(
      "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-foreground/10 bg-[#111] shadow-[0_4px_12px_rgba(0,0,0,0.1)]",
      size === "sm" ? "h-8 w-8" : "h-10 w-10",
    )}
  >
    <img src="/logo.png" alt="" className="h-full w-full object-cover" />
  </span>
);

const Badge = ({ children, active = false }: { children: React.ReactNode; active?: boolean }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-ui text-[10px] font-bold uppercase tracking-[0.12em] transition-colors duration-200",
      active ? "border-brand-accent/20 bg-brand-ghost text-brand-accent" : "border-foreground/10 bg-background/70 text-muted-foreground",
    )}
  >
    {children}
  </span>
);

const ProductButton = ({
  children,
  onClick,
  variant = "primary",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={cn(
      "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 font-ui text-[11px] font-bold uppercase tracking-[0.12em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-accent/40 disabled:pointer-events-none disabled:opacity-40",
      variant === "primary" && "bg-brand-accent text-primary-foreground shadow-[0_20px_58px_-34px_hsla(var(--brand-accent),0.75)] hover:-translate-y-0.5 hover:bg-brand-accent/90 active:translate-y-0",
      variant === "secondary" && "border border-foreground/10 bg-background/80 text-foreground hover:border-brand-accent/30 hover:bg-background",
      variant === "quiet" && "border border-transparent bg-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
    )}
  >
    {children}
  </button>
);

const ArtifactField = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-foreground/10 bg-background/70 p-4 transition-colors hover:border-foreground/20">
    <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-sm leading-6 text-foreground/80">{value}</p>
  </div>
);

const WorkspaceShell = ({
  eyebrow,
  title,
  onBack,
  children,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
    <div className="sticky top-[68px] z-30 -mx-3 mb-5 flex items-center justify-between border-b border-foreground/5 bg-background/88 px-3 py-2 backdrop-blur-xl lg:static lg:mx-0 lg:mb-10 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <button
        onClick={onBack}
        className="group flex items-center gap-3 text-[13px] font-bold text-muted-foreground/60 transition-all hover:text-foreground"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground/5 bg-foreground/[0.02] transition-all group-hover:border-foreground/10 group-hover:bg-foreground/[0.04]">
          <ArrowLeft className="h-4 w-4" />
        </div>
        Back
      </button>
    </div>
    <div className="mb-5 lg:mb-8">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">{eyebrow}</p>
      <h1 className="font-display mt-2 text-[1.65rem] font-bold leading-tight tracking-tight text-foreground sm:text-2xl lg:mt-4">{title}.</h1>
    </div>
    {children}
  </div>
);

const MobileAppTopBar = ({ title }: { title: string }) => (
  <header
    data-testid="mobile-app-topbar"
    className="sticky top-0 z-40 -mx-3 mb-4 flex items-center justify-between border-b border-foreground/8 bg-background/92 px-3 py-3 backdrop-blur-xl lg:hidden"
  >
    <div className="flex min-w-0 items-center gap-3">
      <BrandMark size="sm" />
      <div className="min-w-0">
        <p className="font-display truncate text-[14px] font-bold tracking-tight text-foreground">Ordersounds</p>
        <p className="font-ui truncate text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">{title}</p>
      </div>
    </div>
    <Badge active>{title}</Badge>
  </header>
);

const MobileBottomNav = ({
  active,
  onLabelHQ,
  onMissions,
  onManager,
  onStaff,
  onSettings,
}: {
  active: "labelHQ" | "staff" | "missions" | "settings";
  onLabelHQ: () => void;
  onMissions: () => void;
  onManager: () => void;
  onStaff: () => void;
  onSettings: () => void;
}) => {
  const items = [
    { label: "HQ", icon: Gauge, onClick: onLabelHQ, active: active === "labelHQ" },
    { label: "Missions", icon: ClipboardCheck, onClick: onMissions, active: active === "missions" },
    { label: "Manager", icon: MessageSquareText, onClick: onManager, active: false },
    { label: "Team", icon: UsersRound, onClick: onStaff, active: active === "staff" },
    { label: "Profile", icon: Settings, onClick: onSettings, active: active === "settings" },
  ];

  return (
    <nav
      aria-label="Mobile label navigation"
      className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-[22px] border border-foreground/10 bg-background/94 p-1.5 shadow-2xl shadow-black/10 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom))" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            onClick={item.onClick}
            className={cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] px-1 py-2 text-[10px] font-bold transition-colors",
              item.active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4", item.active ? "text-brand-accent" : "opacity-70")} />
            <span className="truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default function AiLabelPrototype() {
  const [view, setView] = useState<View>("connectArtist");
  const [profile, setProfile] = useState<ArtistProfile>(artist);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [agentEntryPoint, setAgentEntryPoint] = useState<"labelHQ" | "staff">("labelHQ");
  const [selectedMissionId, setSelectedMissionId] = useState(baseMissions[0].id);
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [activeQuestion, setActiveQuestion] = useState(managerQuestions[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [askText, setAskText] = useState("We have $5,000. What should we do this month?");
  const [conversations, setConversations] = useState<RecentConversation[]>(baseConversations);
  const [selectedConversationId, setSelectedConversationId] = useState(baseConversations[0].id);
  const [conversationDraft, setConversationDraft] = useState("");
  const [threadReplies, setThreadReplies] = useState<Record<string, ConversationMessage[]>>({});
  const [approvedTasks, setApprovedTasks] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [testCheckpoint, setTestCheckpoint] = useState<"setup" | "signal" | "complete">("setup");

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === managerQuestions.length;
  const missionProgress = Math.max(
    baseMissions[0].progress,
    Math.round(((completedTasks.length + (testCheckpoint === "complete" ? 2 : testCheckpoint === "signal" ? 1 : 0)) / 6) * 100),
  );
  const missions = useMemo(
    () =>
      baseMissions.map((mission) =>
        mission.id === "night-bus-validation"
          ? { ...mission, progress: missionProgress, status: testCheckpoint === "complete" ? "review" : mission.status }
          : mission,
      ),
    [missionProgress, testCheckpoint],
  );
  const selectedMission = missions.find((mission) => mission.id === selectedMissionId) ?? missions[0];
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0];
  const selectedConversationMessages = [...selectedConversation.messages, ...(threadReplies[selectedConversation.id] ?? [])];
  const activeQuestionObject = managerQuestions.find((question) => question.id === activeQuestion) ?? managerQuestions[0];
  const postSetup = !["connectArtist", "setup"].includes(view);
  const railActive =
    view === "artistProfileWorkspace"
      ? "settings"
      : view === "staffWorkspace" ||
          (agentEntryPoint === "staff" && ["managerOffice", "lockedAgentWorkspace", "conversationWorkspace", "investigation", "decisionPackage"].includes(view))
        ? "staff"
      : ["missionsWorkspace", "tasksWorkspace", "testLabWorkspace", "briefsWorkspace"].includes(view)
        ? "missions"
        : "labelHQ";

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [view]);

  const goTo = (next: View) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setView(next);
    window.setTimeout(() => window.scrollTo(0, 0), 0);
  };

  const openMission = (missionId = "night-bus-validation") => {
    setSelectedMissionId(missionId);
    goTo("missionsWorkspace");
  };

  const openManager = (entryPoint: "labelHQ" | "staff" = "labelHQ") => {
    setAgentEntryPoint(entryPoint);
    goTo("managerOffice");
  };

  const openLockedAgent = (agent: Agent, entryPoint: "labelHQ" | "staff" = "labelHQ") => {
    setSelectedAgent(agent);
    setAgentEntryPoint(entryPoint);
    goTo("lockedAgentWorkspace");
  };

  const openConversation = (conversation: RecentConversation) => {
    setSelectedConversationId(conversation.id);
    setConversationDraft("");
    goTo("conversationWorkspace");
  };

  const openCreatedWork = (work: NonNullable<ConversationMessage["workCreated"]>) => {
    if (work.type === "mission") {
      openMission(work.id);
      return;
    }

    if (work.type === "task") {
      if (work.id) setSelectedMissionId("night-bus-validation");
      goTo("tasksWorkspace");
      return;
    }

    if (work.type === "checkpoint" || work.type === "test") {
      if (work.id) setSelectedMissionId("night-bus-validation");
      goTo("testLabWorkspace");
    }
  };

  const sendThreadFollowUp = () => {
    const trimmed = conversationDraft.trim();
    if (!trimmed) return;

    const nextMessages: ConversationMessage[] = [
      {
        id: `${selectedConversation.id}-followup-${Date.now()}`,
        speaker: "artist",
        label: "You followed up",
        body: trimmed,
      },
      {
        id: `${selectedConversation.id}-answer-${Date.now()}`,
        speaker: "manager",
        label: "Manager continued",
        body: "Keep June 12 conditional until the split approval is written. If rights clear this week, move into distributor delivery, DSP pitch reuse, creator commitments, and the press/owned-audience calendar.",
      },
    ];

    setThreadReplies((current) => ({
      ...current,
      [selectedConversation.id]: [...(current[selectedConversation.id] ?? []), ...nextMessages],
    }));
    setConversationDraft("");
  };

  const startManagerRun = () => {
    if (!allAnswered) return;
    
    // Create a new conversation object
    const newId = `conv-${Date.now()}`;
    const newConv: RecentConversation = {
      id: newId,
      topic: askText.length > 30 ? askText.substring(0, 30) + "..." : askText,
      lastUpdate: "",
      status: "Analyzing...",
      prompt: "Continue this new conversation.",
      summary: "Fresh management thread initialized from the Manager Office.",
      messages: [
        {
          id: `${newId}-q1`,
          speaker: "artist",
          label: "You asked",
          body: askText,
        }
      ]
    };

    setConversations(prev => [newConv, ...prev]);
    setSelectedConversationId(newId);
    setAskText("");
    goTo("conversationWorkspace");
  };

  const saveAnswer = () => {
    const next = managerQuestions.find((question) => !answers[question.id] && question.id !== activeQuestionObject.id);
    if (next) setActiveQuestion(next.id);
  };

  return (
    <div className="app-light min-h-screen bg-background text-foreground selection:bg-brand-accent/20">
      {postSetup ? (
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_-10%,hsla(var(--brand-accent),0.08),transparent_34%),radial-gradient(circle_at_88%_10%,rgba(217,119,87,0.08),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(46,28%,94%)_100%)]" />
      ) : (
        <>
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,hsla(var(--brand-accent),0.10),transparent_28%),radial-gradient(circle_at_78%_22%,rgba(217,119,87,0.08),transparent_28%),linear-gradient(180deg,hsl(var(--background))_0%,hsl(46,28%,94%)_100%)]" />
          <div className="pointer-events-none fixed inset-0 opacity-[0.38] [background-image:linear-gradient(hsla(var(--foreground),.035)_1px,transparent_1px),linear-gradient(90deg,hsla(var(--foreground),.035)_1px,transparent_1px)] [background-size:72px_72px]" />
        </>
      )}

      {postSetup && (
        <div className="relative z-20 mx-auto grid min-h-screen w-full max-w-[1760px] gap-4 px-3 pb-28 pt-0 sm:px-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-5 lg:px-8 lg:py-4 lg:pb-4">
          <MobileAppTopBar title={mobileTitleText[view]} />
          <LabelHQRail
            active={railActive}
            onLabelHQ={() => goTo("labelHQ")}
            onStaff={() => goTo("staffWorkspace")}
            onMissions={() => goTo("missionsWorkspace")}
            onSettings={() => goTo("artistProfileWorkspace")}
          />
          <main className="min-w-0 py-0 lg:py-8">
            {view === "labelHQ" && (
              <LabelHQScreen
                profile={profile}
                missions={missions}
                conversations={conversations}
                onManager={() => openManager("labelHQ")}
                onLockedAgent={openLockedAgent}
                onMission={openMission}
                onWorkspace={goTo}
                onDrawer={setDrawer}
              />
            )}
            {view === "staffWorkspace" && (
              <StaffWorkspace
                onManager={() => openManager("staff")}
                onLockedAgent={(agent) => openLockedAgent(agent, "staff")}
              />
            )}
            {view === "managerOffice" && (
              <ManagerOfficeFocused
                answers={answers}
                setAnswers={setAnswers}
                activeQuestion={activeQuestion}
                setActiveQuestion={setActiveQuestion}
                activeQuestionObject={activeQuestionObject}
                answeredCount={answeredCount}
                allAnswered={allAnswered}
                askText={askText}
                setAskText={setAskText}
                saveAnswer={saveAnswer}
                startManagerRun={startManagerRun}
                onBack={() => goTo(agentEntryPoint === "staff" ? "staffWorkspace" : "labelHQ")}
                onConversation={openConversation}
                conversations={conversations}
              />
            )}
            {view === "conversationWorkspace" && (
              <ConversationWorkspace
                conversation={selectedConversation}
                messages={selectedConversationMessages}
                draft={conversationDraft}
                setDraft={setConversationDraft}
                onSend={sendThreadFollowUp}
                onBack={() => goTo("managerOffice")}
                onOpenCreatedWork={openCreatedWork}
              />
            )}
            {view === "investigation" && <InvestigationScreen onBack={() => goTo("managerOffice")} />}
            {view === "decisionPackage" && <DecisionPackageScreen conversations={conversations} onBack={() => goTo("managerOffice")} onMission={openMission} onWorkspace={goTo} onDrawer={setDrawer} onConversation={openConversation} />}
            {view === "missionsWorkspace" && (
              <MissionsWorkspace
                missions={missions}
                selectedMission={selectedMission}
                setSelectedMissionId={setSelectedMissionId}
                onBack={() => goTo("labelHQ")}
                onWorkspace={goTo}
                onDrawer={setDrawer}
              />
            )}
            {view === "tasksWorkspace" && (
              <TasksWorkspace
                onBack={() => openMission(selectedMissionId)}
                approvedTasks={approvedTasks}
                completedTasks={completedTasks}
                onApproveTask={(id) => setApprovedTasks((current) => Array.from(new Set([...current, id])))}
                onCompleteTask={(id) => {
                  setCompletedTasks((current) => Array.from(new Set([...current, id])));
                  if (id === "post-hooks") setTestCheckpoint("signal");
                  if (id === "track-conversion") setTestCheckpoint("complete");
                }}
              />
            )}
            {view === "testLabWorkspace" && <CheckpointsWorkspace onBack={() => openMission(selectedMissionId)} testCheckpoint={testCheckpoint} />}
            {view === "briefsWorkspace" && <NotesWorkspace onBack={() => openMission(selectedMissionId)} />}
            {view === "artistProfileWorkspace" && <ArtistProfileWorkspace profile={profile} setProfile={setProfile} onBack={() => goTo("labelHQ")} />}
            {view === "lockedAgentWorkspace" && (
              <LockedAgentWorkspace
                agent={selectedAgent ?? agents[1]}
                onBack={() => goTo(agentEntryPoint === "staff" ? "staffWorkspace" : "labelHQ")}
              />
            )}
            {view === "reviewWorkspace" && <ReviewWorkspace onBack={() => goTo("labelHQ")} onMission={openMission} />}
          </main>
          <MobileBottomNav
            active={railActive}
            onLabelHQ={() => goTo("labelHQ")}
            onMissions={() => goTo("missionsWorkspace")}
            onManager={() => openManager("labelHQ")}
            onStaff={() => goTo("staffWorkspace")}
            onSettings={() => goTo("artistProfileWorkspace")}
          />
        </div>
      )}

      {!postSetup && (
      <main className="relative z-10 mx-auto min-h-screen w-full max-w-[1500px] px-5 py-5 sm:px-7 lg:px-9">
        {
          <header className="flex items-center justify-between">
            <button onClick={() => goTo("labelHQ")} className="flex items-center gap-3 text-left">
              <BrandMark size="sm" />
              <div>
                <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/42">Ordersounds</p>
                <h1 className="font-display text-2xl font-display font-bold leading-none tracking-tight">AI Record Label</h1>
              </div>
            </button>
            <Badge>{statusText[view]}</Badge>
          </header>
        }

        {view === "connectArtist" && <ConnectArtistScreen profile={profile} onContinue={() => goTo("setup")} />}
        {view === "setup" && <SetupScreen profile={profile} setProfile={setProfile} onBack={() => goTo("connectArtist")} onContinue={() => goTo("labelHQ")} />}
      </main>
      )}

      <EvidenceDrawer drawer={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

const ConnectArtistScreen = ({ profile, onContinue }: { profile: ArtistProfile; onContinue: () => void }) => (
  <section className="mx-auto flex max-w-4xl flex-col items-center pt-[7vh] text-center">
    <p className="font-ui text-[11px] font-bold uppercase tracking-[0.15em] text-brand-accent">Artist setup</p>
    <h2 className="font-display mt-6 text-[clamp(2.8rem,6vw,4.2rem)] font-bold leading-[1.1] tracking-tight text-foreground">
      Start with the<br />artist profile.
    </h2>
    <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-foreground/60 font-medium">
      Connect the artist, confirm the basics, and give the Manager enough context to make useful calls.
    </p>

    <div className="mt-16 w-full max-w-2xl text-left">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">Artist found</p>
      <div className="surface-panel mt-4 flex items-center justify-between rounded-[24px] p-5 shadow-lg transition-all hover:border-brand-accent/20">
        <div className="flex items-center gap-6">
          <div className="surface-intelligence h-20 w-20 shrink-0 rounded-[22px] bg-foreground/5 flex items-center justify-center">
             <BrandMark size="sm" />
          </div>
          <div>
            <h3 className="font-display text-[22px] font-bold text-foreground tracking-tight">{profile.name}</h3>
            <p className="font-ui mt-1 text-[14px] font-bold text-brand-accent opacity-80">{profile.spotify}</p>
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success border border-success/10">
          <Check className="h-5 w-5" />
        </div>
      </div>
      
      <div className="mt-12 flex justify-center">
        <button 
          onClick={onContinue} 
          className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-foreground px-10 text-[15px] font-bold text-background transition-all hover:scale-105 hover:shadow-2xl active:scale-95 shadow-xl"
        >
          Continue to artist context
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  </section>
);

const SetupScreen = ({
  profile,
  setProfile,
  onBack,
  onContinue,
}: {
  profile: ArtistProfile;
  setProfile: React.Dispatch<React.SetStateAction<ArtistProfile>>;
  onBack: () => void;
  onContinue: () => void;
}) => {
  const update = (key: keyof ArtistProfile, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  return (
    <section className="mx-auto max-w-6xl py-6 lg:py-10">
      <button 
        onClick={onBack} 
        className="group inline-flex items-center gap-3 rounded-full border border-foreground/10 bg-background/50 px-5 py-2 text-[13px] font-bold text-muted-foreground transition-all hover:bg-foreground/5 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" /> 
        Back to artist
      </button>

      <div className="mt-7 grid gap-6 lg:mt-10 lg:grid-cols-[320px_1fr] lg:items-start lg:gap-8">
        {/* Left Col: Titles */}
        <div className="lg:sticky lg:top-12">
          <p className="font-ui text-[11px] font-bold uppercase tracking-[0.15em] text-brand-accent">Artist context</p>
          <h2 className="font-display mt-4 text-[2.1rem] font-bold leading-tight tracking-tight text-foreground lg:mt-5 lg:text-[2.75rem]">
            Give the Manager<br />the basics.
          </h2>
          <p className="mt-5 text-[15px] font-medium leading-relaxed text-foreground/60">
            This is the artist-level picture. The Manager uses it to shape missions, spot missing proof, and keep the team honest.
          </p>
          
          <div className="surface-intelligence mt-8 rounded-[20px] p-5">
             <p className="font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">Manager note</p>
             <p className="mt-3 text-[13px] font-medium leading-relaxed text-foreground/80">
               Better context means better calls. These details can change later as the artist, goals, and evidence change.
             </p>
          </div>
        </div>

        {/* Right Col: Forms */}
        <div className="surface-panel rounded-[22px] p-4 shadow-xl sm:p-6 lg:rounded-[28px] lg:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <SetupInput label="Artist name" value={profile.name} onChange={(v) => update("name", v)} />
            <SetupInput label="Spotify identity" value={profile.spotify} onChange={(v) => update("spotify", v)} active />
            <SetupInput label="Artist stage" value={profile.stage} onChange={(v) => update("stage", v)} />
            <SetupInput label="Home market" value={profile.market} onChange={(v) => update("market", v)} />
            <SetupInput label="Genre" value={profile.genre} onChange={(v) => update("genre", v)} />
            <ArtistDirectionField value={profile.goal} onChange={(v) => update("goal", v)} />
            <SetupInput label="Active release" value={profile.release} onChange={(v) => update("release", v)} />
            <SetupInput label="Monthly budget" value={profile.budget} onChange={(v) => update("budget", v)} />
            <SetupInput label="TikTok" value={profile.tiktok} onChange={(v) => update("tiktok", v)} />
            <SetupInput label="Instagram" value={profile.instagram} onChange={(v) => update("instagram", v)} />
            <SetupInput label="YouTube" value={profile.youtube} onChange={(v) => update("youtube", v)} />
            <SetupInput label="X" value={profile.x} onChange={(v) => update("x", v)} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-foreground/5 pt-5 lg:mt-8 lg:gap-5 lg:pt-6">
            <p className="max-w-md text-[13px] font-semibold leading-relaxed text-warning">
              Private analytics like saves, clicks, and conversion stay locked until the artist connects them.
            </p>
            
            <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
              <button onClick={onContinue} className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-foreground/10 bg-background px-8 text-[14px] font-bold text-foreground transition-all hover:bg-foreground/5">
                Skip for now
              </button>
              <button 
                onClick={onContinue} 
                className="group inline-flex h-12 items-center justify-center gap-3 rounded-full bg-foreground px-8 text-[14px] font-bold text-background transition-all hover:scale-105 shadow-xl active:scale-95"
              >
                Enter Label HQ
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const SetupInput = ({ label, value, onChange, active = false }: { label: string; value: string; onChange: (value: string) => void; active?: boolean }) => (
  <div className={cn(
    "group rounded-[14px] border bg-background p-3.5 transition-all duration-300", 
    active ? "border-brand-accent ring-4 ring-brand-accent/5 shadow-lg" : "border-foreground/10 focus-within:border-brand-accent/50 focus-within:ring-4 focus-within:ring-brand-accent/5"
  )}>
    <label className="font-ui block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 transition-colors group-focus-within:text-brand-accent">{label}</label>
    <input 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      className="mt-1.5 w-full bg-transparent text-[14px] font-bold text-foreground outline-none placeholder:text-muted-foreground/30" 
    />
  </div>
);

const LabelHQScreen = ({
  profile,
  missions,
  conversations,
  onManager,
  onLockedAgent,
  onMission,
  onWorkspace,
  onDrawer,
}: {
  profile: ArtistProfile;
  missions: Mission[];
  conversations: RecentConversation[];
  onManager: () => void;
  onLockedAgent: (agent: Agent) => void;
  onMission: (id?: string) => void;
  onWorkspace: (view: View) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) => (
  <section className="mx-auto max-w-7xl text-foreground lg:px-8">
    <div className="mb-4 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-brand-accent">Label Read</p>
        <h1 className="font-display mt-2 text-[2.25rem] font-bold leading-none tracking-tight text-foreground sm:text-[2.7rem] lg:text-[3.2rem]">Label HQ</h1>
      </div>
      <div className="flex gap-3">
        <button onClick={() => onWorkspace("artistProfileWorkspace")} className="group flex h-11 items-center gap-2 rounded-full border border-foreground/10 bg-background/50 px-5 text-[13px] font-bold text-foreground transition-all hover:bg-foreground/5 hover:border-foreground/20 active:scale-95 shadow-sm backdrop-blur-sm">
          <Settings className="h-4 w-4 opacity-40 transition-transform group-hover:rotate-45" />
          Workspace
        </button>
      </div>
    </div>

    <div className="mb-5 grid grid-cols-2 overflow-hidden rounded-[20px] border border-foreground/10 bg-background/70 shadow-sm backdrop-blur md:grid-cols-4 lg:mb-8 lg:rounded-[24px]">
      {[
        { label: "Current Focus", value: profile.goal, meta: profile.stage },
        { label: "Needs Attention", value: "Split approval", meta: "Rights gate holding" },
        { label: "Next Move", value: "Clear rights", meta: "Then update the mission plan" },
        { label: "Active Missions", value: `${missions.filter((mission) => mission.status !== "complete" && !mission.archived).length}`, meta: "Open artist workstreams" },
      ].map((item) => (
        <div key={item.label} className="min-w-0 border-b border-r border-foreground/5 px-4 py-3 even:border-r-0 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 lg:px-5 lg:py-4">
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/45">{item.label}</p>
          <p className="mt-2 line-clamp-3 text-[13px] font-bold leading-tight text-foreground lg:text-[15px]">{item.value}</p>
          <p className="mt-1 text-[12px] font-medium leading-snug text-muted-foreground/65">{item.meta}</p>
        </div>
      ))}
    </div>

    <div data-testid="mobile-priority-stack" className="mb-5 grid gap-3 lg:hidden">
      <button onClick={() => onWorkspace("tasksWorkspace")} className="flex items-center justify-between rounded-[18px] border border-[#f97316]/15 bg-[#f97316]/[0.06] p-4 text-left">
        <span>
          <span className="font-ui block text-[10px] font-bold uppercase tracking-[0.14em] text-[#c2410c]">Needs Attention</span>
          <span className="mt-1 block text-[14px] font-bold text-foreground">Split approval is holding release clearance.</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#c2410c]" />
      </button>
      <button onClick={() => onWorkspace("missionsWorkspace")} className="flex items-center justify-between rounded-[18px] border border-brand-accent/15 bg-brand-accent/[0.045] p-4 text-left">
        <span>
          <span className="font-ui block text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Active Missions</span>
          <span className="mt-1 block text-[14px] font-bold text-foreground">{missions.filter((mission) => mission.status !== "complete" && !mission.archived).length} open artist workstreams</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-brand-accent" />
      </button>
    </div>
    
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 content-start gap-6 lg:gap-8">
        <LightMorningBriefPanel profile={profile} onManager={onManager} onEvidence={() => onDrawer("evidence")} />
        
        {/* REFINED STAFF GRID */}
        <div className="space-y-5">
           <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
              <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Label Staff</p>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20">5 active AI units</span>
           </div>
           <div data-testid="mobile-team-strip" className="grid gap-2 rounded-[18px] border border-foreground/8 bg-background/82 p-3 lg:hidden">
             <div className="flex items-center justify-between">
               <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Team readiness</p>
               <span className="text-[11px] font-bold text-muted-foreground">1 ready / 4 need context</span>
             </div>
             <button onClick={onManager} className="flex items-center justify-between rounded-[14px] bg-foreground/[0.035] px-3 py-2 text-left text-[13px] font-bold text-foreground">
               Manager ready for decisions
               <ChevronRight className="h-4 w-4 text-brand-accent" />
             </button>
           </div>
           <LightAgentBench onManager={onManager} onLockedAgent={onLockedAgent} />
        </div>
        
        {/* COMPACT MISSIONS */}
        <div className="space-y-5">
           <div className="flex items-center justify-between border-b border-foreground/5 pb-4">
              <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Active Missions</p>
              <button onClick={() => onWorkspace("missionsWorkspace")} className="text-[11px] font-bold text-brand-accent hover:underline">See all missions â†’</button>
           </div>
           <LightMissionCards missions={missions.filter(m => m.status !== "complete")} onMission={onMission} onWorkspace={onWorkspace} />
        </div>
      </div>

      <div className="grid min-w-0 content-start gap-6 self-start pt-1 lg:sticky lg:top-8">
        <LightAttentionSummary onDrawer={onDrawer} onWorkspace={onWorkspace} />
      </div>
    </div>
  </section>
);

const StaffWorkspace = ({
  onManager,
  onLockedAgent,
}: {
  onManager: () => void;
  onLockedAgent: (agent: Agent) => void;
}) => {
  const onlineCount = agents.filter((agent) => agent.status === "available").length;
  const lockedCount = agents.length - onlineCount;

  return (
    <section className="text-foreground">
      <div className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-ui text-[11px] font-bold uppercase tracking-[0.15em] text-brand-accent">Team</p>
          <h1 className="font-display mt-2 text-[2.25rem] font-bold leading-tight tracking-tight text-foreground sm:text-[2.7rem] lg:text-[3.2rem]">Artist Team</h1>
          <p className="mt-2 max-w-2xl text-[16px] font-medium leading-relaxed text-muted-foreground/80">
            The people around the artist, what they can help with, and the proof they still need before their advice becomes useful.
          </p>
        </div>
        <div className="grid w-full max-w-md grid-cols-3 overflow-hidden rounded-[18px] border border-foreground/10 bg-background/80 shadow-sm">
          <StaffStat label="Team" value={`${agents.length}`} />
          <StaffStat label="Ready" value={`${onlineCount}`} />
          <StaffStat label="Needs context" value={`${lockedCount}`} />
        </div>
      </div>

      <div data-testid="mobile-staff-roster" className="grid gap-3 lg:gap-4">
        {agents.map((agent) => {
          const Icon = agent.icon;
          const available = agent.status === "available";
          const actionLabel = available ? "Open Manager Office" : "See what is missing";

          return (
            <button
              key={agent.id}
              onClick={() => (available ? onManager() : onLockedAgent(agent))}
              className={cn(
                "group grid w-full gap-3 rounded-[18px] border bg-background/85 p-4 text-left shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(0,0,0,0.07)] lg:grid-cols-[250px_minmax(0,1fr)_220px] lg:gap-5 lg:rounded-[20px] lg:p-5",
                available ? "border-brand-accent/20" : "border-foreground/10",
              )}
            >
              <div className="flex items-start gap-4">
                <span
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-foreground/5 transition-colors duration-300",
                    available ? "bg-brand-accent text-primary-foreground" : "bg-muted text-foreground/40"
                  )}
                  style={!available ? { backgroundColor: agent.color + '20', color: agent.color, borderColor: agent.color + '30' } : {}}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-[18px] font-display font-bold tracking-tight text-foreground">{agent.name}</h2>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em]",
                        available ? "bg-success/10 text-success" : "bg-foreground/5 text-muted-foreground",
                      )}
                    >
                      {available ? "Ready" : "Needs context"}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{agent.purpose}</p>
                  <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent md:hidden">Helps with {agent.tools.slice(0, 2).join(" / ")}</p>
                </div>
              </div>

              <div className="hidden gap-4 md:grid md:grid-cols-2">
                <StaffSourceBlock title="What they can help with" items={agent.tools.slice(0, 3)} accent={available} />
                <StaffSourceBlock title="Missing proof" items={agent.requiredSources} muted={!available} />
                <StaffSourceBlock title="Connected proof" items={agent.connectedSources} />
                <StaffSourceBlock title="Manager can prepare" items={[agent.managerCanPrepare]} accent />
              </div>

              <div className="flex flex-row items-center justify-between rounded-[16px] border border-foreground/5 bg-foreground/[0.035] p-3 transition-colors group-hover:bg-foreground/[0.06] lg:flex-col lg:items-stretch lg:p-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Next action</p>
                  <p className="mt-1 text-[13px] font-bold leading-snug text-foreground lg:mt-3 lg:text-[14px]">{actionLabel}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-2 text-[12px] font-bold transition-all duration-300 lg:mt-6",
                    available ? "text-brand-accent" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {available ? <MessageSquareText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {available ? "Start decision thread" : "Review unlock needs"}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

const StaffStat = ({ label, value }: { label: string; value: string }) => (
  <div className="border-r border-foreground/5 px-5 py-4 last:border-r-0">
    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{label}</p>
    <p className="mt-1 text-[22px] font-display font-bold tracking-tight text-foreground">{value}</p>
  </div>
);

const StaffSourceBlock = ({
  title,
  items,
  muted = false,
  accent = false,
}: {
  title: string;
  items: string[];
  muted?: boolean;
  accent?: boolean;
}) => (
  <div className={cn("rounded-[16px] border p-4", accent ? "border-brand-accent/15 bg-brand-accent/[0.04]" : "border-foreground/5 bg-black/[0.015]")}>
    <p className={cn("text-[10px] font-bold uppercase tracking-[0.08em]", accent ? "text-brand-accent" : "text-muted-foreground/60")}>{title}</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            accent
              ? "border-brand-accent/15 bg-white text-[#5f2489]"
              : muted
                ? "border-foreground/5 bg-white/60 text-muted-foreground/60"
                : "border-foreground/5 bg-white text-muted-foreground/80",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  </div>
);

const LabelHQRail = ({
  active,
  onLabelHQ,
  onStaff,
  onMissions,
  onSettings,
}: {
  active: "labelHQ" | "staff" | "missions" | "settings";
  onLabelHQ: () => void;
  onStaff: () => void;
  onMissions: () => void;
  onSettings: () => void;
}) => {
  const railItems = [
    { label: "Label HQ", icon: Gauge, onClick: onLabelHQ, active: active === "labelHQ" },
    { label: "Staff", icon: UsersRound, onClick: onStaff, active: active === "staff" },
    { label: "Missions", icon: ClipboardCheck, onClick: onMissions, active: active === "missions" },
  ];

  return (
    <nav
      aria-label="Record label navigation"
      className="hidden min-w-0 flex-col justify-between overflow-y-auto rounded-[20px] border border-foreground/10 bg-background p-2 shadow-2xl shadow-black/[0.05] lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-32px)]"
    >
      {/* TOP: brand + nav */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 px-3 py-3">
          <BrandMark size="sm" />
          <div className="min-w-0">
            <p className="font-display truncate text-[14px] font-display font-bold tracking-tight text-foreground">Ordersounds</p>
            <p className="font-ui text-[9px] font-bold tracking-[0.1em] text-muted-foreground uppercase opacity-70">AI RECORD LABEL</p>
          </div>
        </div>

        <div className="mx-3 h-px shrink-0 bg-foreground/5" />

        <div className="flex shrink-0 flex-col gap-0.5 py-1">
          {railItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 font-ui text-[13px] font-bold transition-all duration-200",
                  item.active
                    ? "bg-foreground text-background shadow-md"
                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-[15px] w-[15px] shrink-0", item.active ? "text-brand-accent" : "text-current opacity-60")} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM: Settings always visible */}
      <div className="mt-4 shrink-0">
        <div className="mx-3 mb-2 h-px bg-foreground/5" />
        <button
          onClick={onSettings}
          className={cn(
            "flex h-10 w-full items-center gap-2.5 rounded-xl px-3 font-ui text-[13px] font-bold transition-all duration-200",
            active === "settings"
              ? "bg-foreground text-background shadow-md"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
          )}
        >
          <Settings className={cn("h-[15px] w-[15px] shrink-0", active === "settings" ? "text-brand-accent" : "text-current opacity-60")} />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
};



const LightMorningBriefPanel = ({ profile, onManager, onEvidence }: { profile: ArtistProfile; onManager: () => void; onEvidence: () => void }) => (
  <div className="flex flex-col overflow-hidden rounded-[22px] border border-foreground/5 bg-background shadow-xl shadow-black/[0.02] lg:rounded-[28px] lg:shadow-2xl">
    {/* Header */}
    <div className="flex flex-col gap-4 border-b border-foreground/5 bg-foreground/[0.01] px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-7 lg:py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
          <Calendar className="h-4 w-4" />
        </div>
        <div>
          <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Today's Brief</p>
          <p className="text-[13px] font-bold text-foreground opacity-90">{profile.name} Â· {profile.release}</p>
        </div>
      </div>
      <button
        onClick={onManager}
        className="w-full rounded-full bg-foreground px-6 py-2.5 text-[12px] font-bold text-background shadow-md transition-all hover:opacity-90 active:scale-95 sm:w-auto"
      >
        Talk to Manager
      </button>
    </div>

    {/* Brief Body */}
      <div className="px-4 py-5 lg:px-7 lg:py-7">
      <h2 className="font-display max-w-2xl text-[1.35rem] font-bold leading-tight tracking-tight text-foreground lg:text-2xl">
        Momentum is durably building. Commitment is pending review.
      </h2>
      
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2.5">
           <p className="font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-success">Proof</p>
           <div className="rounded-2xl border border-foreground/5 bg-foreground/[0.01] p-4 lg:p-5">
              <p className="text-[15px] font-medium leading-relaxed text-foreground/80">
                128.4k tracked streams. TikTok hook uses are 4.8x above baseline. Regional growth in Chicago (+31%) and Lagos confirmed.
              </p>
           </div>
        </div>
        <div className="space-y-2.5">
           <p className="font-ui text-[11px] font-bold uppercase tracking-[0.1em] text-brand-accent">Manager Read</p>
           <div className="rounded-2xl border border-brand-accent/10 bg-brand-accent/[0.02] p-4 lg:p-5">
              <p className="text-[15px] font-medium leading-relaxed text-foreground/80">
                Signed split sheet, distributor confirmation, creator commitments, and press/EPK package are currently missing. Rights gate review is active.
              </p>
           </div>
        </div>
      </div>

      <div className="mt-5 max-w-3xl space-y-3 border-t border-foreground/5 pt-5 text-[15px] font-medium leading-relaxed text-muted-foreground/80 lg:mt-6 lg:space-y-4 lg:pt-6 lg:text-[16px]">
        <p>
          The current release plan is stronger because the Manager refused the rushed next-Friday drop and moved Night Bus to Friday, June 12, 2026.
        </p>
        <p>
          The Manager's Read: the release can become credible if rights, distribution, playlist pitching, creator seeding, press, owned content, and release-day checks stay connected in one mission loop.
        </p>
      </div>

      {/* Today's directive */}
      <div className="mt-6 rounded-[22px] border border-foreground/5 bg-foreground/[0.01] p-5">
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">Today's Directive</p>
        <p className="mt-1 font-ui text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground/35">Next Move</p>
        <p className="mt-3 text-[15px] font-bold leading-relaxed text-foreground opacity-90">
          Clear split approval first. Keep June 12 conditional until rights are written, then move distributor delivery, DSP pitching, creator seeding, press, and launch content in sequence.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onEvidence}
          className="text-[12px] font-bold text-muted-foreground/60 underline-offset-4 hover:text-brand-accent hover:underline transition-all"
        >
          View supporting evidence â†’
        </button>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/20 italic">Generated by AI Manager 08:30 AM</span>
      </div>
    </div>
  </div>
);

const LightAttentionSummary = ({ onDrawer, onWorkspace }: { onDrawer: (drawer: DrawerKind) => void; onWorkspace: (view: View) => void }) => (
  <div className="flex flex-col gap-6">
    <section className="space-y-6">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Needs Attention</p>
      <div className="flex flex-col gap-4">
        <button onClick={() => onWorkspace("tasksWorkspace")} className="group flex flex-col gap-3 rounded-[24px] border border-foreground/5 bg-background p-6 text-left transition-all hover:border-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/[0.02]">
          <div className="flex items-center gap-2.5">
             <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <BadgeDollarSign className="h-4 w-4" />
             </div>
             <p className="text-[13px] font-bold text-foreground tracking-tight">Split approval</p>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground/80 leading-relaxed">
             The Manager is waiting on the signed split sheet before the June 12 release can be treated as clean.
          </p>
        </button>
        <button onClick={() => onDrawer("evidence")} className="group flex flex-col gap-3 rounded-[24px] border border-foreground/5 bg-background p-6 text-left transition-all hover:border-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/[0.02]">
          <div className="flex items-center gap-2.5">
             <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                <Upload className="h-4 w-4" />
             </div>
             <p className="text-[13px] font-bold text-foreground tracking-tight">Distributor package</p>
          </div>
          <p className="text-[12px] font-medium text-muted-foreground/80 leading-relaxed">
             Adding a Spotify for Artists export would increase signal confidence for the Nigeria sprint.
          </p>
        </button>
      </div>
    </section>

    <section className="space-y-6">
      <p className="font-ui text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">Recent Movement</p>
      <div className="space-y-8 pl-1">
        {[
          { label: "Milestone", title: "Started content testing", time: "2h ago" },
          { label: "Staff", title: "Creative brief sent to Marketing", time: "5h ago" },
          { label: "System", title: "Nigeria signal verified by Manager", time: "Yesterday" }
        ].map((item, i) => (
          <div key={i} className="relative flex flex-col gap-2 pl-6 before:absolute before:left-0 before:top-1 before:h-2 before:w-2 before:rounded-full before:bg-foreground/5">
            <p className="text-[12px] font-bold text-foreground leading-tight tracking-tight">{item.title}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{item.label} Â· {item.time}</p>
          </div>
        ))}
      </div>
    </section>
  </div>
);

const LightAgentBench = ({
  onManager,
  onLockedAgent,
}: {
  onManager: () => void;
  onLockedAgent: (agent: Agent) => void;
}) => (
  <div className="hidden grid-cols-2 gap-4 md:grid-cols-3 lg:grid lg:grid-cols-5">
    {agents.map((agent) => {
      const Icon = agent.icon;
      const available = agent.status === "available";

      return (
        <button
          key={agent.id}
          onClick={() => (agent.id === "manager" ? onManager() : onLockedAgent(agent))}
          className={cn(
            "group relative flex flex-col items-center gap-5 rounded-[28px] border p-8 text-center transition-all duration-500",
            available 
              ? "border-foreground/10 bg-background shadow-lg shadow-black/[0.02] hover:border-brand-accent/30 hover:shadow-xl hover:shadow-brand-accent/5 hover:-translate-y-1" 
              : "border-foreground/5 bg-foreground/[0.01] opacity-60 hover:opacity-100"
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-[20px] transition-all duration-500",
              available ? "bg-foreground text-background shadow-lg" : "bg-foreground/5 text-foreground/20",
            )}
          >
            {available ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn("text-[14px] font-bold leading-tight tracking-tight", available ? "text-foreground" : "text-muted-foreground")}>{agent.name.replace("AI ", "")}</p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 leading-tight">
               {available ? "Active Now" : "Locked"}
            </p>
          </div>
          {available && (
             <div className="absolute top-4 right-4 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          )}
        </button>
      );
    })}
  </div>
);

const LightMissionCards = ({
  missions,
  onMission,
  onWorkspace,
}: {
  missions: Mission[];
  onMission: (id?: string) => void;
  onWorkspace: (view: View) => void;
}) => (
  <div className="grid gap-3">
    {missions.filter(m => !m.archived).map((mission) => {
      const statusColor = mission.status === "blocked" ? "bg-warning" : mission.status === "review" ? "bg-amber-500" : "bg-brand-accent";
      return (
        <button
          key={mission.id}
          onClick={() => onMission(mission.id)}
          className="group grid gap-4 rounded-[22px] border border-foreground/8 bg-background/80 p-5 text-left shadow-sm transition-all duration-300 hover:border-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/[0.03] md:grid-cols-[minmax(0,1fr)_170px]"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", statusColor)} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Active Mission</span>
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-warning">Blocker</span>
            </div>
            <p className="mt-3 font-display text-[17px] font-bold text-foreground tracking-tight group-hover:text-brand-accent transition-colors">
              {mission.title}
            </p>
            <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted-foreground/75 line-clamp-2">
              {mission.summary}
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-[16px] border border-foreground/5 bg-foreground/[0.025] p-4">
             <div>
               <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Progress</p>
                  <p className="text-[12px] font-bold text-foreground">{mission.progress}%</p>
               </div>
               <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/5">
                  <div className={cn("h-full rounded-full transition-all duration-1000", statusColor)} style={{ width: `${mission.progress}%` }} />
               </div>
               <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{mission.review}</p>
             </div>
             <span className="mt-4 inline-flex items-center justify-between text-[11px] font-bold text-brand-accent">
               Open mission
               <ChevronRight className="h-4 w-4 transition-all group-hover:translate-x-1" />
             </span>
          </div>
        </button>
      );
    })}
  </div>
);

const LightMissionCount = ({ label, value }: { label: string; value: number }) => (
  <div className="flex flex-col items-center">
    <span className="block text-sm font-bold text-black">{value}</span>
    <span className="block text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
  </div>
);

const OperatingState = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[18px] border border-foreground/5 bg-white/[0.045] p-3">
    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/40">{label}</p>
    <p className="mt-1 text-sm leading-5 text-foreground/70">{value}</p>
  </div>
);

const ManagerOfficeFocused = ({
  answers,
  setAnswers,
  activeQuestion,
  setActiveQuestion,
  activeQuestionObject,
  answeredCount,
  allAnswered,
  askText,
  setAskText,
  saveAnswer,
  startManagerRun,
  onBack,
  onConversation,
  conversations,
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  activeQuestion: string;
  setActiveQuestion: (id: string) => void;
  activeQuestionObject: (typeof managerQuestions)[number];
  answeredCount: number;
  allAnswered: boolean;
  askText: string;
  setAskText: (value: string) => void;
  saveAnswer: () => void;
  startManagerRun: () => void;
  onBack: () => void;
  onConversation: (conversation: RecentConversation) => void;
  conversations: RecentConversation[];
}) => (
  <WorkspaceShell eyebrow="Manager Office" title="Manager Briefing" onBack={onBack}>
    <div className="max-w-5xl">
      <ManagerDeskPanel
        answers={answers}
        setAnswers={setAnswers}
        activeQuestion={activeQuestion}
        setActiveQuestion={setActiveQuestion}
        activeQuestionObject={activeQuestionObject}
        answeredCount={answeredCount}
        allAnswered={allAnswered}
        askText={askText}
        setAskText={setAskText}
        saveAnswer={saveAnswer}
        startManagerRun={startManagerRun}
        onContinueConversation={onConversation}
        conversations={conversations}
      />
      
      {allAnswered && (
        <div className="mt-12 surface-panel rounded-[28px] p-8">
           <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl">
                 <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Manager Read</p>
                 <h4 className="font-display mt-2 text-lg font-bold text-foreground">How the Manager makes a call.</h4>
                 <p className="mt-2 text-[14px] leading-relaxed text-foreground/50 font-medium">
                    Uses multi-agent validation to cross-reference context with market signals before outputting decision packages.
                 </p>
              </div>
              <div className="flex items-center gap-6">
                 {["Context", "Signal", "Validation", "Decision"].map((step, i) => (
                    <div key={step} className="flex flex-col items-center gap-2">
                       <div className="h-9 w-9 rounded-full bg-brand-accent flex items-center justify-center text-[11px] font-bold text-primary-foreground shadow-lg shadow-brand-accent/20">
                          {i + 1}
                       </div>
                       <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">{step}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      )}
    </div>
  </WorkspaceShell>
);

const MorningBriefNarrative = ({ profile }: { profile: ArtistProfile }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-7 border-t border-foreground/5 pt-6">
      <p className="max-w-3xl text-2xl font-semibold tracking-tight leading-9 text-foreground">
        Momentum is real, but spend is not cleared yet.
      </p>
      <div className="mt-5 max-w-4xl space-y-5 text-base leading-8 text-foreground/68">
        <p>
          Across the connected hub, {profile.name} is sitting on <span className="text-brand-accent">128,400 tracked streams</span> for the current read, and the story is not flat: Atlanta is still the center, but Chicago is up <span className="text-brand-accent">31%</span> week over week and Lagos comments are starting to repeat the same Night Bus lyric. TikTok is the loudest movement right now, with video uses around the hook up <span className="text-brand-accent">4.8x above baseline</span>, while YouTube is adding release-request comments instead of just passive views.
        </p>
        {expanded && (
          <p>
            The money signal is more cautious. Public catalog and social data say attention is building, but private Spotify saves, source-of-stream, smart-link clicks, and royalty statements are still missing, so the Manager should not treat this as proof that the full {profile.budget} is ready to deploy. The practical read is that Night Bus has enough heat to test, not enough proof to scale.
          </p>
        )}
      </div>
      <div className="mt-6 rounded-[22px] border border-brand-accent/25 bg-brand-accent/10 px-5 py-4">
        <p className="text-sm leading-6 text-foreground/76">
          <span className="font-semibold text-brand-accent">What matters today:</span> clear the split sheet, confirm distributor delivery, and keep creator, press, playlist, content, and release-day work moving from task reviews.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground/40">
          Read from connected public catalog, social activity, YouTube comments, and artist replies. Evidence details stay in the source drawer.
        </p>
        <button
          onClick={() => setExpanded((current) => !current)}
          className="rounded-full border border-foreground/5 px-3 py-1.5 font-ui text-[10px] font-semibold uppercase tracking-[0.13em] text-foreground/58 hover:border-brand-accent/30 hover:text-foreground"
        >
          {expanded ? "Collapse brief" : "Read full brief"}
        </button>
      </div>
    </div>
  );
};

const ManagerDeskPanel = ({
  answers,
  setAnswers,
  activeQuestion,
  setActiveQuestion,
  activeQuestionObject,
  answeredCount,
  allAnswered,
  askText,
  setAskText,
  saveAnswer,
  startManagerRun,
  onContinueConversation,
  conversations,
}: {
  answers: Record<string, string>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  activeQuestion: string;
  setActiveQuestion: (id: string) => void;
  activeQuestionObject: (typeof managerQuestions)[number];
  answeredCount: number;
  allAnswered: boolean;
  askText: string;
  setAskText: (value: string) => void;
  saveAnswer: () => void;
  startManagerRun: () => void;
  onContinueConversation: (conversation: RecentConversation) => void;
  conversations: RecentConversation[];
}) => (
  <div className="flex flex-col gap-10">
    {!allAnswered ? (
      /* BLOCKING GATE: Questions must be answered before anything else */
      <div className="grid gap-6">
        <div className="rounded-[26px] border border-brand-accent/15 bg-brand-accent/[0.04] p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">Context needed</p>
              <h2 className="font-display mt-2 text-[22px] font-bold tracking-tight text-foreground">Manager needs these answers before making decisions.</h2>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-muted-foreground/70">
                The directive composer and prior threads unlock after the release context is complete.
              </p>
            </div>
            <div className="min-w-[180px] rounded-[18px] border border-foreground/5 bg-background/70 p-4">
              <div className="flex items-center justify-between">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/45">Context progress</p>
                <p className="text-[12px] font-bold text-foreground">{answeredCount}/{managerQuestions.length}</p>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-foreground/5">
                <div className="h-full rounded-full bg-brand-accent transition-all duration-1000" style={{ width: `${(answeredCount / managerQuestions.length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Left: Question navigator */}
        <aside className="space-y-6">
          <div className="surface-panel rounded-2xl p-5">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">Question list</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-foreground/5">
                <div className="h-full rounded-full bg-brand-accent transition-all duration-1000" style={{ width: `${(answeredCount / managerQuestions.length) * 100}%` }} />
              </div>
              <span className="text-[10px] font-bold text-foreground">{answeredCount}/{managerQuestions.length}</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            {managerQuestions.map((q, i) => {
              const isSelected = activeQuestion === q.id;
              const isAnswered = !!answers[q.id];
              return (
                <button
                  key={q.id}
                  onClick={() => setActiveQuestion(q.id)}
                  className={cn(
                    "group flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all",
                    isSelected ? "bg-foreground/5" : "hover:bg-foreground/[0.02] opacity-60 hover:opacity-100"
                  )}
                >
                  <p className={cn("truncate text-[13px] font-bold leading-tight tracking-tight", isSelected ? "text-foreground" : "text-muted-foreground")}>
                    {q.id.charAt(0).toUpperCase() + q.id.slice(1)} Context
                  </p>
                  <div className="flex items-center gap-2">
                     <span className={cn("h-1 w-1 rounded-full", isAnswered ? "bg-success" : "bg-foreground/10")} />
                     <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">{isAnswered ? "Complete" : "Pending"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right: Active question â€” fills the screen */}
        <div className="rounded-[28px] border border-foreground/5 bg-background p-8 shadow-2xl shadow-black/[0.02]">
          <div className="max-w-2xl">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-brand-accent">Active Question {managerQuestions.findIndex(q => q.id === activeQuestion) + 1} / {managerQuestions.length}</p>
            <h2 className="font-display mt-3 text-2xl font-bold tracking-tight text-foreground">
              {activeQuestionObject.question}
            </h2>
            <textarea
              value={answers[activeQuestionObject.id] ?? ""}
              onChange={(event) => setAnswers((current) => ({ ...current, [activeQuestionObject.id]: event.target.value }))}
              placeholder="Start typing your response..."
              className="mt-6 min-h-[160px] w-full resize-none rounded-2xl border border-foreground/10 bg-foreground/[0.01] p-5 font-ui text-[15px] leading-relaxed text-foreground outline-none transition-all focus:bg-background focus:border-brand-accent/40 shadow-inner"
            />
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setAnswers((current) => ({ ...current, [activeQuestionObject.id]: activeQuestionObject.suggested }))}
                className="text-[11px] font-bold text-muted-foreground/40 underline-offset-4 hover:text-brand-accent hover:underline"
              >
                Use suggested context
              </button>
              <button
                onClick={saveAnswer}
                disabled={!answers[activeQuestionObject.id]}
                className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background transition-all hover:opacity-90 disabled:opacity-20 active:scale-95 shadow-lg"
              >
                {answeredCount < managerQuestions.length - 1 ? "Next Question" : "Submit Context"}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    ) : (
      /* UNLOCKED STATE: All questions answered â€” show full interface */
      <>
        {/* Ask the Manager */}
        <div className="surface-panel rounded-[28px] p-8 shadow-2xl shadow-black/[0.02]">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-3 w-3 items-center justify-center rounded-full bg-success/20 text-success">
                <Check className="h-2 w-2" />
              </span>
              <p className="font-ui text-[9px] font-bold uppercase tracking-[0.1em] text-success/70">Context Synchronized</p>
            </div>
            
            <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
              Manager Directive
            </h2>
            <p className="mt-1 text-[13px] font-medium text-muted-foreground/50 leading-relaxed">
              The Manager is ready to process directives or review artist signals.
            </p>
            
            <div className="mt-8 flex flex-wrap gap-2">
              {["Release Plan", "Rights Blocker", "Creator Push", "Press Angle"].map((p) => (
                <button
                  key={p}
                  onClick={() => setAskText(
                    p === "Release Plan" ? "Review the June 12 release plan and tell me the next strongest move."
                    : p === "Rights Blocker" ? "The split sheet is still blocked. What should we do before continuing?"
                    : p === "Creator Push" ? "Build the creator seeding directive for the Night Bus hook."
                    : "Shape the press angle for Night Bus using the night-drive story."
                  )}
                  className="rounded-full border border-foreground/5 bg-foreground/[0.03] px-4 py-2 text-[11px] font-bold text-foreground/60 transition-all hover:border-brand-accent/20 hover:bg-brand-accent/5 hover:text-brand-accent"
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="relative mt-6">
              <textarea
                value={askText}
                onChange={(event) => setAskText(event.target.value)}
                placeholder="Ask the Manager for a directive or review..."
                className="min-h-[120px] w-full resize-none rounded-2xl border border-foreground/10 bg-foreground/[0.01] p-5 font-ui text-[15px] leading-relaxed text-foreground outline-none transition-all focus:bg-background focus:border-brand-accent/40 shadow-inner"
              />
              <div className="absolute bottom-4 right-4">
                <button
                  onClick={startManagerRun}
                  disabled={!askText}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent text-primary-foreground shadow-lg transition-all hover:scale-105 disabled:opacity-20"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Conversations â€” only visible after unlock */}
        <RecentConversationsPanel conversations={conversations} onContinueConversation={onContinueConversation} />
      </>
    )}
  </div>
);

const RecentConversationsPanel = ({
  conversations,
  onContinueConversation,
}: {
  conversations: RecentConversation[];
  onContinueConversation: (conversation: RecentConversation) => void;
}) => (
  <div className="mt-10">
    <div className="flex items-center justify-between px-2 mb-4 border-b border-foreground/5 pb-4">
      <div>
        <p className="font-ui text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40">Conversation History</p>
        <p className="mt-1 text-[12px] text-muted-foreground/50">Pick up a prior thread or start a new run.</p>
      </div>
      <button className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent hover:underline">See full history</button>
    </div>
    <div className="flex flex-col gap-1">
      {conversations.map((conversation) => (
        <button
          key={conversation.id}
          onClick={() => onContinueConversation(conversation)}
          className="group flex items-center justify-between p-4 text-left transition-all hover:bg-foreground/[0.02] rounded-xl border border-transparent hover:border-foreground/5"
        >
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-foreground/40 group-hover:bg-brand-accent/10 group-hover:text-brand-accent transition-colors">
              <MessageSquareText className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-foreground transition-colors group-hover:text-brand-accent truncate leading-tight">{conversation.topic}</p>
              <p className="mt-1 text-[12px] text-muted-foreground/50 truncate max-w-md">{conversation.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">{conversation.lastUpdate}</span>
            <ChevronRight className="h-4 w-4 text-foreground/10 group-hover:text-brand-accent transition-colors" />
          </div>
        </button>
      ))}
    </div>
  </div>
);

const MissionListPanel = ({
  missions,
  onMission,
  onWorkspace,
}: {
  missions: Mission[];
  onMission: (id?: string) => void;
  onWorkspace: (view: View) => void;
}) => (
  <div className="rounded-[28px] border border-white/12 bg-white/[0.055] p-5 lg:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/5 pb-4">
      <div>
        <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Active missions</p>
        <p className="mt-1 text-sm text-foreground/58">Compact operating list. Open a mission to see tasks, tests, briefs, and records.</p>
      </div>
      <ProductButton variant="secondary" onClick={() => onWorkspace("missionsWorkspace")}>View all missions</ProductButton>
    </div>
    <div className="mt-4 grid gap-3">
      {missions.slice(0, 3).map((mission) => (
        <button
          key={mission.id}
          onClick={() => onMission(mission.id)}
          className="rounded-[22px] border border-foreground/5 bg-foreground/5 p-4 text-left transition hover:border-brand-accent/35"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-base text-foreground">{mission.title}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-foreground/38">{mission.status} / {mission.review}</p>
            </div>
            <span className="text-sm text-foreground/62">{mission.progress}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-brand-accent" style={{ width: `${mission.progress}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground/48">
            <span>{mission.tasks} tasks</span>
            <span>{mission.tests} tests</span>
            <span>{mission.briefs} briefs</span>
          </div>
        </button>
      ))}
    </div>
  </div>
);

const AttentionPanel = ({ onDrawer, onWorkspace }: { onDrawer: (drawer: DrawerKind) => void; onWorkspace: (view: View) => void }) => (
  <div className="rounded-[28px] border border-white/12 bg-white/[0.055] p-5 lg:p-6">
    <p className="font-ui text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/40">Needs attention</p>
    <div className="mt-4 space-y-3">
      <AttentionButton icon={BadgeDollarSign} text="Split sheet approval is blocking release clearance." onClick={() => onWorkspace("tasksWorkspace")} />
      <AttentionButton icon={Upload} text="Distributor package confirmation is still missing." onClick={() => onDrawer("evidence")} />
      <AttentionButton icon={CalendarClock} text="Rights gate review is the next Manager check." onClick={() => onWorkspace("reviewWorkspace")} />
    </div>
  </div>
);

const AttentionButton = ({ icon: Icon, text, onClick }: { icon: typeof BadgeDollarSign; text: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex w-full gap-3 rounded-2xl border border-foreground/5 bg-foreground/5 p-4 text-left text-sm text-foreground/62 hover:border-brand-accent/35">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" />
    <span>{text}</span>
  </button>
);


const ConversationWorkspace = ({
  conversation,
  messages,
  draft,
  setDraft,
  onSend,
  onBack,
  onOpenCreatedWork,
}: {
  conversation: RecentConversation;
  messages: ConversationMessage[];
  draft: string;
  setDraft: (val: string) => void;
  onSend: () => void;
  onBack: () => void;
  onOpenCreatedWork: (work: NonNullable<ConversationMessage["workCreated"]>) => void;
}) => {
  return (
    <WorkspaceShell eyebrow="Direct Message" title={conversation.topic} onBack={onBack}>
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-10">
          {/* Chat Stream */}
          <div className="flex flex-col gap-10 pb-32">
             {messages.map((msg, idx) => {
                const isAI = msg.speaker === "manager";
                return (
                   <div key={msg.id} className={cn("flex flex-col gap-4", !isAI && "items-end")}>
                      <div className={cn("flex items-center gap-3", !isAI && "flex-row-reverse")}>
                         <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg shadow-sm",
                            isAI ? "bg-foreground text-background" : "bg-brand-accent text-primary-foreground"
                         )}>
                            {isAI ? <Sparkles className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
                         </div>
                         <p className="font-ui text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">{msg.label}</p>
                      </div>
                      <div className={cn(
                         "rounded-2xl border transition-all max-w-2xl",
                         idx === 0 ? "p-5" : "p-6",
                         isAI ? "rounded-tl-none border-foreground/5 bg-foreground/[0.02] text-foreground/80 shadow-sm" : "rounded-tr-none border-brand-accent/20 bg-brand-accent text-primary-foreground shadow-lg shadow-brand-accent/10"
                      )}>
                         <p className={cn("font-medium leading-relaxed", idx === 0 ? "text-[14px]" : "text-[15px]")}>
                            {msg.body}
                         </p>
                         
                         {/* Work Created Artifact */}
                         {msg.workCreated && (
                            <div className="mt-6 rounded-xl border border-foreground/10 bg-background/50 p-5 shadow-inner">
                               <div className="flex items-center gap-3 mb-3">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent text-primary-foreground">
                                     {msg.workCreated.type === "mission" ? <Route className="h-3.5 w-3.5" /> : 
                                      msg.workCreated.type === "task" ? <ClipboardCheck className="h-3.5 w-3.5" /> : 
                                      <Gauge className="h-3.5 w-3.5" />}
                                  </div>
                                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
                                     {msg.workCreated.type} created
                                  </p>
                               </div>
                               <h4 className="text-[14px] font-bold text-foreground">{msg.workCreated.title}</h4>
                               <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground/70">{msg.workCreated.body}</p>
                               <button
                                 onClick={() => onOpenCreatedWork(msg.workCreated!)}
                                 aria-label={`Open created ${msg.workCreated.type}: ${msg.workCreated.title}`}
                                 className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground/[0.03] py-2 text-[11px] font-bold uppercase tracking-wider text-foreground/55 transition-all hover:bg-foreground/[0.06] hover:text-foreground"
                               >
                                  Open created {msg.workCreated.type}
                                  <ChevronRight className="h-3.5 w-3.5" />
                               </button>
                            </div>
                         )}

                         {isAI && idx === 0 && (
                            <div className="mt-6 flex items-center gap-4 border-t border-foreground/5 pt-5">
                               <div className="flex items-center gap-2">
                                  <span className="h-1 w-1 rounded-full bg-success" />
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Verified Insight</span>
                               </div>
                               <div className="h-px w-6 bg-foreground/10" />
                               <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 italic">Signal referenced</span>
                            </div>
                         )}
                      </div>
                   </div>
                );
             })}
          </div>

          {/* Input Area */}
          <div className="fixed bottom-24 left-0 right-0 z-40 px-3 lg:bottom-12 lg:z-50 lg:px-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
             <div className="mx-auto max-w-3xl rounded-[24px] border border-foreground/10 bg-background/88 p-2 shadow-2xl backdrop-blur-xl lg:rounded-[32px] lg:p-3">
                <div className="relative flex items-center gap-3">
                   <textarea
                     value={draft}
                     onChange={(e) => setDraft(e.target.value)}
                     placeholder="Type a message to the Manager..."
                     className="min-h-[56px] w-full resize-none bg-transparent px-5 py-4 font-ui text-[15px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/30"
                     onKeyDown={(e) => {
                       if (e.key === 'Enter' && !e.shiftKey) {
                         e.preventDefault();
                         onSend();
                       }
                     }}
                   />
                   <button 
                     onClick={onSend}
                     disabled={!draft.trim()}
                     className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-accent text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-20"
                   >
                      <ArrowRight className="h-5 w-5" />
                   </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
};

const MissionLane = ({ icon: Icon, title, meta, text, onClick }: { icon: typeof ClipboardCheck; title: string; meta: string; text: string; onClick: () => void }) => (
  <button onClick={onClick} className="group flex flex-col p-6 text-left transition-all surface-panel rounded-[24px] border border-foreground/5 hover:border-foreground/10 hover:bg-foreground/[0.02]">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
         <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/5 text-foreground opacity-60 group-hover:opacity-100">
           <Icon className="h-4 w-4" />
         </span>
         <div>
            <p className="text-[14px] font-bold tracking-tight text-foreground">{title}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">{meta}</p>
         </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/20 transition-all group-hover:translate-x-1" />
    </div>
    <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground/60 group-hover:text-muted-foreground/80 font-medium">{text}</p>
  </button>
);

const ArtistDirectionField = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
  <div className="group rounded-[16px] border border-brand-accent/15 bg-brand-accent/[0.035] p-4 transition-all duration-300 focus-within:border-brand-accent/45 focus-within:ring-4 focus-within:ring-brand-accent/5 sm:col-span-2">
    <label htmlFor="artist-direction" className="font-ui block text-[10px] font-bold uppercase tracking-[0.15em] text-brand-accent">Artist Direction</label>
    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground/70">
      Tell the Manager where the artist is trying to go. This can include the next release, audience, team priorities, budget posture, and what should not be rushed.
    </p>
    <textarea
      id="artist-direction"
      aria-label="Artist Direction"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-3 min-h-[118px] w-full resize-none rounded-[14px] border border-foreground/8 bg-background/75 p-4 text-[14px] font-semibold leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/35"
    />
  </div>
);

const MissionSurfaceButton = ({ icon: Icon, title, meta, onClick }: { icon: typeof ClipboardCheck; title: string; meta: string; onClick: () => void }) => (
  <button onClick={onClick} className="group flex items-center justify-between gap-2 rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-2.5 text-left transition-all hover:border-foreground/16 hover:bg-foreground/[0.05] lg:gap-3 lg:rounded-[16px] lg:p-3">
    <span className="flex min-w-0 items-center gap-2 lg:gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-background text-brand-accent shadow-sm lg:h-9 lg:w-9 lg:rounded-[12px]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-bold leading-tight text-foreground sm:truncate sm:text-[14px]">{title}</span>
        <span className="mt-0.5 hidden truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/55 sm:block">{meta}</span>
      </span>
    </span>
    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
  </button>
);

const TasksWorkspace = ({
  onBack,
  approvedTasks,
  completedTasks,
  onApproveTask,
  onCompleteTask,
}: {
  onBack: () => void;
  approvedTasks: string[];
  completedTasks: string[];
  onApproveTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
}) => {
  const checkpointsWithTasks = missionCheckpoints.filter((checkpoint) => taskRows.some((task) => task.checkpointId === checkpoint.id));
  const [activeCheckpointId, setActiveCheckpointId] = useState(checkpointsWithTasks[0]?.id ?? "");
  const taskResultById = new Map(taskResults.map((result) => [result.taskId, result]));
  const isTaskResolved = (task: ReleaseTask) => completedTasks.includes(task.id) || ["completed", "blocked", "revised"].includes(taskResultById.get(task.id)?.status ?? "");
  const scrollToCheckpoint = (checkpointId: string) => {
    setActiveCheckpointId(checkpointId);
    document.getElementById(`task-checkpoint-${checkpointId}`)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const sections = checkpointsWithTasks
      .map((checkpoint) => document.getElementById(`task-checkpoint-${checkpoint.id}`))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top))[0];
        const checkpointId = visible?.target.getAttribute("data-checkpoint-id");
        if (checkpointId) setActiveCheckpointId(checkpointId);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.08, 0.22, 0.4] },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [checkpointsWithTasks]);

  return (
    <WorkspaceShell eyebrow="Tasks" title="Release tasks" onBack={onBack}>
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">
        <aside className="min-w-0 overflow-hidden rounded-[20px] border border-foreground/8 bg-background/75 p-4 shadow-sm lg:sticky lg:top-6 lg:self-start lg:rounded-[24px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Checkpoint path</p>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/70">
            Tasks are grouped by the checkpoint they help clear. Finish or resolve the required work, then the Manager reviews what changed.
          </p>
          <div data-testid="mobile-task-stepper" className="mt-4 flex min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:mt-5 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
            {checkpointsWithTasks.map((checkpoint, index) => {
              const checkpointTasks = taskRows.filter((task) => task.checkpointId === checkpoint.id);
              const resolvedCount = checkpointTasks.filter(isTaskResolved).length;
              const active = checkpoint.status === "Needs revision" || checkpoint.status === "Ready for AI review";
              const inView = activeCheckpointId === checkpoint.id;
              return (
                <button
                  key={checkpoint.id}
                  data-testid={`task-checkpoint-chain-${checkpoint.id}`}
                  aria-current={inView ? "true" : undefined}
                  onClick={() => scrollToCheckpoint(checkpoint.id)}
                  className={cn("relative flex min-w-[190px] gap-3 rounded-[14px] px-2 py-2 text-left transition-all lg:w-full lg:min-w-0", inView ? "bg-foreground text-background shadow-sm" : "hover:bg-foreground/[0.04]")}
                >
                  {index < checkpointsWithTasks.length - 1 && <span className="absolute left-[13px] top-8 hidden h-[calc(100%-8px)] w-px bg-foreground/10 lg:block" />}
                  <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold", inView ? "border-brand-accent bg-brand-accent text-foreground" : active ? "border-brand-accent bg-brand-accent text-foreground" : "border-foreground/10 bg-background text-muted-foreground")}>
                    {resolvedCount === checkpointTasks.length ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("truncate text-[12px] font-bold", inView ? "text-background" : "text-foreground")}>{checkpoint.title}</p>
                    <p className={cn("mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em]", inView ? "text-background/65" : "text-muted-foreground/55")}>{resolvedCount}/{checkpointTasks.length} needed to clear</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4 lg:space-y-5">
          <div className="rounded-[20px] border border-foreground/8 bg-background/80 p-4 shadow-sm lg:rounded-[24px] lg:p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">How to read this page</p>
            <p className="mt-2 max-w-4xl text-[14px] font-semibold leading-relaxed text-foreground/75">
              Each section is a checkpoint. The rows underneath are the tasks that move it forward. Every completion or blockage creates a Manager review, then the plan either continues, changes, or waits.
            </p>
          </div>

          {checkpointsWithTasks.map((checkpoint) => {
            const checkpointTasks = taskRows.filter((task) => task.checkpointId === checkpoint.id);
            const resolvedCount = checkpointTasks.filter(isTaskResolved).length;
            const sectionActive = activeCheckpointId === checkpoint.id;
            return (
              <section
                key={checkpoint.id}
                id={`task-checkpoint-${checkpoint.id}`}
                data-testid={`task-checkpoint-section-${checkpoint.id}`}
                data-checkpoint-id={checkpoint.id}
                data-active={sectionActive ? "true" : "false"}
                className={cn("scroll-mt-24 overflow-hidden rounded-[20px] border p-4 shadow-sm transition-all lg:scroll-mt-6 lg:rounded-[24px] lg:p-5", sectionActive ? "border-brand-accent/35 bg-brand-accent/[0.045] shadow-lg" : "border-foreground/8 bg-background/85")}
              >
                <div className="grid gap-4 border-b border-foreground/8 pb-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">{checkpoint.title}</p>
                      <span className="rounded-full border border-foreground/10 bg-foreground/[0.035] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">{checkpoint.status}</span>
                    </div>
                    <p className="mt-2 text-[15px] font-semibold leading-relaxed text-foreground">{checkpoint.question}</p>
                    <p className="mt-2 text-[12px] font-semibold leading-relaxed text-muted-foreground/70">Clears when: {checkpoint.decisionRule}</p>
                  </div>
                  <div className="rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Progress</p>
                    <p className="mt-2 text-[28px] font-display font-bold leading-none text-foreground">{resolvedCount}/{checkpointTasks.length}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full rounded-full bg-brand-accent" style={{ width: `${(resolvedCount / checkpointTasks.length) * 100}%` }} />
                    </div>
                    <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">needed to clear</p>
                  </div>
                </div>

                <div className="divide-y divide-foreground/7">
                  {checkpointTasks.map((task) => {
                    const approved = approvedTasks.includes(task.id);
                    const done = completedTasks.includes(task.id);
                    const completionBlocked = task.approvalState === "needs approval" && !approved;
                    const result = taskResultById.get(task.id);
                    const showResult = Boolean(result && (done || result.status === "blocked" || result.status === "revised"));
                    const blocked = result?.status === "blocked" || task.approvalState === "blocked";
                    return (
                      <div key={task.id} className="grid min-w-0 gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:py-5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("h-2.5 w-2.5 rounded-full", blocked ? "bg-[#f97316]" : done || result?.status === "completed" ? "bg-brand-accent" : "bg-foreground/20")} />
                            <p className="text-[15px] font-bold leading-snug text-foreground">{task.title}</p>
                            <span className="rounded-full bg-foreground/[0.045] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65">{done ? "done" : approved ? "approved" : task.approvalState}</span>
                          </div>
                          <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted-foreground/75">{task.owner} / {task.deadline}</p>
                          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-foreground/72">{task.purpose}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <p className="text-[12px] leading-relaxed text-muted-foreground/75"><span className="font-bold text-foreground">Risk if late:</span> {task.riskIfLate}</p>
                            <p className="min-w-0 break-words rounded-[12px] border border-brand-accent/15 bg-background/70 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground/75">
                              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-brand-accent">Checkpoint link</span>
                              <span className="mt-0.5 block"><span className="font-bold text-foreground">Unlocks checkpoint:</span> {checkpoint.title}</span>
                            </p>
                          </div>
                          <details className="mt-3 group">
                            <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-[0.08em] text-brand-accent">Show required steps</summary>
                            <div className="mt-3 grid gap-2">
                              {task.steps.map((step, index) => (
                                <p key={step} className="text-[12px] leading-relaxed text-foreground/72">{index + 1}. {step}</p>
                              ))}
                            </div>
                          </details>
                          {completionBlocked && (
                            <p className="mt-3 rounded-[12px] border border-[#f97316]/20 bg-[#f97316]/10 p-3 text-[12px] font-semibold leading-snug text-[#c2410c]">
                              Approval is required before this task can be marked done.
                            </p>
                          )}
                          {showResult && result && (
                            <div className="mt-4 border-l-2 border-brand-accent/50 pl-4">
                              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager review</p>
                              <p className="mt-1 text-[13px] font-semibold leading-relaxed text-foreground">{result.summary}</p>
                              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/75"><span className="font-bold text-foreground">Task result:</span> {result.userNote}</p>
                              <p className="mt-1 text-[12px] leading-relaxed text-foreground/70">{result.interpretation}</p>
                              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/75"><span className="font-bold text-foreground">Effect on mission:</span> {result.missionEffect}</p>
                              <p className="mt-2 text-[12px] font-bold leading-relaxed text-brand-accent">{result.followUp}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-start justify-start gap-2 lg:justify-end">
                          {task.approvalState === "needs approval" && (
                            <button
                              onClick={() => onApproveTask(task.id)}
                              disabled={approved || done}
                              className="rounded-[10px] border border-foreground/10 px-3 py-2 text-[11px] font-bold text-muted-foreground/80 transition-colors hover:bg-foreground/5 hover:text-black disabled:opacity-40"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => onCompleteTask(task.id)}
                            disabled={done || completionBlocked || task.approvalState === "blocked"}
                            className="rounded-[10px] bg-foreground px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-background transition-all hover:opacity-90 disabled:opacity-35"
                          >
                            Mark done
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </WorkspaceShell>
  );
};

const CheckpointsWorkspace = ({ onBack, testCheckpoint }: { onBack: () => void; testCheckpoint: "setup" | "signal" | "complete" }) => {
  const [selectedCheckpointId, setSelectedCheckpointId] = useState(() => missionCheckpoints.find((checkpoint) => checkpoint.status === "Needs revision")?.id ?? missionCheckpoints[0].id);
  const taskResultById = new Map(taskResults.map((result) => [result.taskId, result]));
  const clearedCount = missionCheckpoints.filter((checkpoint) => checkpoint.status === "Met" || checkpoint.status === "Ready for AI review").length;
  const activeBlocker = missionCheckpoints.find((checkpoint) => checkpoint.status === "Needs revision") ?? missionCheckpoints[0];
  const selectedCheckpoint = missionCheckpoints.find((checkpoint) => checkpoint.id === selectedCheckpointId) ?? activeBlocker;
  const selectedRequiredResults = selectedCheckpoint.requiredTaskIds.map((taskId) => taskResultById.get(taskId)?.status ?? "pending");
  const selectedResolvedCount = selectedRequiredResults.filter((status) => status !== "pending").length;
  const readinessPercent = Math.round((clearedCount / missionCheckpoints.length) * 100);
  const statusClass = (checkpoint: MissionCheckpoint) =>
    checkpoint.status === "Needs revision"
      ? "border-[#f97316]/30 bg-[#fff8f3] text-[#9a3412]"
      : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review"
        ? "border-brand-accent/25 bg-brand-accent/[0.07] text-brand-accent"
        : "border-foreground/8 bg-background text-muted-foreground";
  const statusDotClass = (checkpoint: MissionCheckpoint) =>
    checkpoint.status === "Needs revision"
      ? "bg-[#f97316]"
      : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review"
        ? "bg-brand-accent"
        : "bg-foreground/20";

  return (
    <WorkspaceShell eyebrow="Checkpoints" title="Mission checkpoints" onBack={onBack}>
      <div className="space-y-5">
        <section data-testid="checkpoint-command-strip" className="rounded-[20px] border border-foreground/8 bg-background/85 p-4 shadow-sm lg:rounded-[24px] lg:p-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px] xl:gap-5">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission progress map</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                <h3 className="font-display text-[24px] font-bold leading-tight text-foreground lg:text-[30px] lg:leading-none">Night Bus / June 12</h3>
                <span className="rounded-full border border-[#f97316]/20 bg-[#f97316]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#c2410c]">Active blocker: {activeBlocker.title}</span>
              </div>
              <p className="mt-3 max-w-3xl text-[13px] font-semibold leading-relaxed text-foreground/70">
                Reusable checkpoint model: every mission uses the same shape of task result, evidence, Manager review, and next action. This release only changes the labels and evidence.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ArtifactField label="Readiness" value={`${readinessPercent}%`} />
              <ArtifactField label="Cleared" value={`${clearedCount}/${missionCheckpoints.length}`} />
              <ArtifactField label="Current call" value="Move date" />
              <ArtifactField label="Target" value="Fri Jun 12" />
            </div>
          </div>
          <div className="scrollbar-none mt-5 flex gap-1.5 overflow-x-auto pb-1" aria-label="Checkpoint path">
            {missionCheckpoints.map((checkpoint, index) => (
              <button
                key={checkpoint.id}
                onClick={() => setSelectedCheckpointId(checkpoint.id)}
                aria-current={selectedCheckpoint.id === checkpoint.id ? "true" : undefined}
                className={cn("flex min-w-[118px] items-center gap-2 rounded-full border px-3 py-2 text-left transition-colors", selectedCheckpoint.id === checkpoint.id ? "border-foreground bg-foreground text-background" : "border-foreground/8 bg-foreground/[0.025] text-muted-foreground hover:bg-foreground/[0.05]")}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", selectedCheckpoint.id === checkpoint.id ? "bg-brand-accent" : statusDotClass(checkpoint))} />
                <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em]">{index + 1}. {checkpoint.title.replace(" Gate", "")}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-3 xl:hidden">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[13px] font-bold text-foreground">{selectedCheckpoint.title}</p>
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", statusClass(selectedCheckpoint))}>{selectedCheckpoint.status}</span>
            </div>
            <p className="mt-2 text-[12px] font-semibold leading-relaxed text-foreground/72">{selectedCheckpoint.managerRecommendation}</p>
            <p className="mt-2 text-[12px] font-bold leading-relaxed text-brand-accent">{selectedCheckpoint.nextAction}</p>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Checkpoint path</p>
                <p className="mt-1 text-[13px] font-semibold text-foreground/70">Compact list. Select a checkpoint to inspect task results and Manager calls.</p>
              </div>
              <span className="rounded-full bg-foreground/[0.045] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65">Gate ledger</span>
            </div>
            <div data-testid="checkpoint-scroll-region" className="scrollbar-soft space-y-2 pr-1 lg:max-h-[calc(100vh-245px)] lg:overflow-y-auto lg:pr-2">
              <div data-testid="mobile-checkpoint-list" className="sr-only">Mobile checkpoint list</div>
              {missionCheckpoints.map((checkpoint, index) => {
                const requiredResults = checkpoint.requiredTaskIds.map((taskId) => taskResultById.get(taskId)?.status ?? "pending");
                const resolvedCount = requiredResults.filter((status) => status !== "pending").length;
                const isSelected = selectedCheckpoint.id === checkpoint.id;
                return (
                  <div key={checkpoint.id} className="space-y-2">
                    <button
                      data-testid={`checkpoint-ledger-${checkpoint.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      onClick={() => setSelectedCheckpointId(checkpoint.id)}
                      className={cn("grid w-full grid-cols-[34px_minmax(0,1fr)_76px] items-center gap-3 rounded-[18px] border p-3 text-left transition-all", isSelected ? "border-foreground bg-foreground text-background shadow-lg" : "border-foreground/8 bg-background/82 hover:border-foreground/16 hover:bg-foreground/[0.025]")}
                    >
                      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold", checkpoint.status === "Needs revision" ? "bg-[#f97316] text-white" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? "bg-brand-accent text-foreground" : isSelected ? "bg-background/15 text-background" : "bg-foreground/8 text-muted-foreground")}>
                        {checkpoint.status === "Needs revision" ? "!" : checkpoint.status === "Met" || checkpoint.status === "Ready for AI review" ? <Check className="h-4 w-4" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-bold leading-tight">{checkpoint.title}</span>
                        <span className={cn("mt-1 block truncate text-[12px] font-semibold", isSelected ? "text-background/70" : "text-muted-foreground/72")}>{checkpoint.nextAction}</span>
                      </span>
                      <span className="text-right">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", isSelected ? "border-background/20 bg-background/10 text-background" : statusClass(checkpoint))}>{checkpoint.status}</span>
                        <span className={cn("mt-1 block text-[10px] font-bold uppercase tracking-[0.08em]", isSelected ? "text-background/65" : "text-muted-foreground/55")}>{resolvedCount}/{checkpoint.requiredTaskIds.length} results</span>
                      </span>
                    </button>
                    {isSelected && (
                      <div data-testid="mobile-selected-checkpoint-detail" className="rounded-[18px] border border-foreground/8 bg-background/92 p-4 shadow-sm xl:hidden">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-brand-accent">Manager recommendation</p>
                        <p className="mt-2 text-[14px] font-bold leading-snug text-foreground">{checkpoint.managerRecommendation}</p>
                        <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/72">{checkpoint.managerRead}</p>
                        <div className="mt-4 grid gap-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Required task results</p>
                            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/55">{resolvedCount}/{checkpoint.requiredTaskIds.length}</span>
                          </div>
                          {checkpoint.requiredTaskIds.map((taskId) => {
                            const task = taskRows.find((row) => row.id === taskId);
                            const result = taskResultById.get(taskId);
                            return (
                              <div key={taskId} className="flex min-w-0 items-center justify-between gap-3 rounded-[12px] border border-foreground/7 bg-foreground/[0.025] px-3 py-2">
                                <span className="min-w-0 truncate text-[12px] font-semibold text-foreground/78">{task?.title ?? taskId}</span>
                                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", result ? "bg-brand-accent/12 text-brand-accent" : "bg-foreground/[0.06] text-muted-foreground/60")}>{result?.status ?? "pending"}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-4 text-[12px] font-bold leading-relaxed text-brand-accent">{checkpoint.nextAction}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <aside data-testid="checkpoint-inspector" className="min-w-0 rounded-[24px] border border-foreground/8 bg-background/88 p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Now viewing</p>
                <h3 className="mt-2 text-[24px] font-display font-bold leading-tight text-foreground">{selectedCheckpoint.title}</h3>
              </div>
              <span className={cn("rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]", statusClass(selectedCheckpoint))}>{selectedCheckpoint.status}</span>
            </div>

            <p className="mt-4 text-[15px] font-semibold leading-relaxed text-foreground">{selectedCheckpoint.question}</p>
            <div className="mt-4 rounded-[16px] border border-foreground/8 bg-foreground/[0.025] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">What needs to be true</p>
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/75">{selectedCheckpoint.decisionRule}</p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Required task results</p>
                  <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/55">{selectedResolvedCount}/{selectedCheckpoint.requiredTaskIds.length}</span>
                </div>
                <div className="mt-3 divide-y divide-foreground/7 rounded-[16px] border border-foreground/8 bg-background">
                  {selectedCheckpoint.requiredTaskIds.map((taskId) => {
                    const task = taskRows.find((row) => row.id === taskId);
                    const result = taskResultById.get(taskId);
                    return (
                      <div key={taskId} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[13px] font-bold leading-snug text-foreground">{task?.title}</p>
                          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]", result?.status === "blocked" ? "bg-[#f97316]/12 text-[#c2410c]" : result ? "bg-brand-accent/10 text-brand-accent" : "bg-foreground/5 text-muted-foreground/70")}>{result?.status ?? "pending"}</span>
                        </div>
                        {result && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/72">{result.userNote}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Manager recommendation</p>
                  <p className="mt-2 text-[14px] font-bold leading-relaxed text-foreground">{selectedCheckpoint.recommendation}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Manager read</p>
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/78">{selectedCheckpoint.resultSummary}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Next action</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-foreground/72">{selectedCheckpoint.nextAction}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/55">Signals watched</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedCheckpoint.watchedSignals.slice(0, 6).map((signal) => (
                      <span key={signal} className="rounded-full bg-foreground/[0.045] px-2 py-1 text-[10px] font-semibold text-muted-foreground/75">{signal}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 border-t border-foreground/8 pt-4 text-[12px] leading-relaxed text-muted-foreground/70">{testReviewImpact[testCheckpoint]}</p>
          </aside>
        </div>
      </div>
    </WorkspaceShell>
  );
};

const NotesWorkspace = ({ onBack }: { onBack: () => void }) => (
  <WorkspaceShell eyebrow="Notes" title="Agent-to-agent notes" onBack={onBack}>
    <div className="surface-panel rounded-[28px] p-8 shadow-2xl shadow-black/[0.02] lg:p-8">
      <p className="max-w-3xl text-[15px] leading-relaxed text-foreground/70">
        These are read-only handoffs moving through the Night Bus mission. The user can inspect them, but agents do not need approval to file a note into memory, update a checkpoint, or prepare a recommendation.
      </p>
      <div className="mt-8 divide-y divide-foreground/5">
      {departmentBriefs.map((brief) => (
        <article key={brief.id} className="py-7 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-brand-accent">{brief.route}</p>
              <h3 className="mt-1.5 text-[22px] font-display font-bold tracking-tight text-foreground">{brief.subject}</h3>
            </div>
            <span className="rounded-full bg-foreground/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{brief.status}</span>
          </div>
          <p className="mt-5 max-w-4xl text-[16px] leading-relaxed text-foreground/80">{brief.message}</p>
          <div className="mt-6 space-y-2 rounded-[14px] border border-foreground/5 bg-foreground/5 p-5">
            <p className="text-[13px] leading-relaxed text-black/70">
              <span className="font-bold text-foreground">Why it matters:</span> {brief.recommendedAction}
            </p>
            <p className="text-[13px] leading-relaxed text-black/70">
              <span className="font-bold text-foreground">Evidence used:</span> {brief.sourceBasis}
            </p>
            <p className="text-[13px] leading-relaxed text-black/70">
              <span className="font-bold text-foreground">Resulting change:</span> {brief.resultingChange}
            </p>
          </div>
          <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{brief.briefType} / {brief.linkedMission}</p>
        </article>
      ))}
      </div>
    </div>
  </WorkspaceShell>
);

const MissionsWorkspace = ({
  missions,
  selectedMission,
  setSelectedMissionId,
  onBack,
  onWorkspace,
  onDrawer,
}: {
  missions: Mission[];
  selectedMission: Mission;
  setSelectedMissionId: (id: string) => void;
  onBack: () => void;
  onWorkspace: (view: View) => void;
  onDrawer: (drawer: DrawerKind) => void;
}) => {
  const activeMissions = missions.filter((m) => !m.archived);
  const archivedMissions = missions.filter((m) => m.archived);

  return (
  <WorkspaceShell eyebrow="Artist work" title="Missions" onBack={onBack}>
      <div className="grid items-start gap-5 xl:grid-cols-[260px_1fr] xl:gap-10">
        <aside className="flex flex-col gap-4 overflow-x-auto pb-1 xl:sticky xl:top-12 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto xl:pr-2">
          <div className="space-y-4">
             <div className="flex items-center justify-between px-1">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">Active</p>
                <span className="text-[10px] font-bold text-muted-foreground/30">{activeMissions.length}</span>
             </div>
             <div data-testid="mobile-mission-switcher" className="flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:gap-0.5 xl:overflow-visible xl:pb-0">
                {activeMissions.map((mission) => {
                  const isSelected = selectedMission.id === mission.id;
                  const statusColor = mission.status === "blocked" ? "bg-warning" : mission.status === "review" ? "bg-amber-500" : "bg-brand-accent";
                  return (
                    <button
                      key={mission.id}
                      onClick={() => setSelectedMissionId(mission.id)}
                      className={cn(
                        "group flex min-w-[220px] flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all xl:w-full xl:min-w-0",
                        isSelected ? "bg-foreground/5" : "hover:bg-foreground/[0.02] opacity-60 hover:opacity-100",
                      )}
                    >
                      <p className={cn("truncate text-[13px] font-bold leading-tight tracking-tight", isSelected ? "text-foreground" : "text-muted-foreground")}>
                        {mission.title}
                      </p>
                      <div className="flex items-center gap-2">
                         <span className={cn("h-1 w-1 rounded-full", statusColor)} />
                         <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">{mission.progress}% Â· {mission.review}</p>
                      </div>
                    </button>
                  );
                })}
             </div>
          </div>
          <div className="hidden space-y-4 xl:block">
             <div className="flex items-center justify-between px-1">
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/40">Completed</p>
                <span className="text-[10px] font-bold text-muted-foreground/30">{archivedMissions.length}</span>
             </div>
             <div className="flex flex-col gap-0.5">
                {archivedMissions.map((mission) => {
                  const isSelected = selectedMission.id === mission.id;
                  return (
                    <button
                      key={mission.id}
                      onClick={() => setSelectedMissionId(mission.id)}
                      className={cn(
                        "group flex w-full flex-col gap-1 rounded-xl px-4 py-3 text-left transition-all",
                        isSelected ? "bg-foreground/5" : "hover:bg-foreground/[0.02] opacity-30 hover:opacity-80",
                      )}
                    >
                      <p className="truncate text-[13px] font-bold leading-tight tracking-tight text-foreground">{mission.title}</p>
                      <p className="text-[10px] font-bold uppercase tracking-wider opacity-40">Archived</p>
                    </button>
                  );
                })}
             </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <aside data-testid="mission-surface-rail" className="rounded-[20px] border border-foreground/8 bg-background/85 p-3 shadow-sm xl:hidden">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Mission work</p>
            <div data-testid="mobile-mission-tabs" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MissionSurfaceButton icon={ClipboardCheck} title="Tasks" meta={`${selectedMission.tasks} things to do`} onClick={() => onWorkspace("tasksWorkspace")} />
              <MissionSurfaceButton icon={Gauge} title="Checkpoints" meta="9 review points" onClick={() => onWorkspace("testLabWorkspace")} />
              <MissionSurfaceButton icon={FileText} title="Notes" meta={`${selectedMission.briefs} agent handoffs`} onClick={() => onWorkspace("briefsWorkspace")} />
              <MissionSurfaceButton icon={FileCheck2} title="Memory" meta="Living recap + log" onClick={() => onDrawer("decisionRecord")} />
            </div>
          </aside>

          <section data-testid="mission-command-bar" className="rounded-[20px] border border-foreground/8 bg-background/85 p-4 shadow-sm lg:rounded-[24px] lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">Mission overview</p>
              <span className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em]",
                selectedMission.status === "blocked" ? "border-warning/10 bg-warning/10 text-warning" :
                selectedMission.status === "complete" ? "border-success/10 bg-success/10 text-success" :
                "border-brand-accent/10 bg-brand-accent/10 text-brand-accent"
              )}>
                {selectedMission.status}
              </span>
              <span className="rounded-full bg-foreground/[0.045] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/65">{selectedMission.review}</span>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-5">
              <div className="min-w-0">
                <h3 className="font-display text-[24px] font-bold leading-tight tracking-tight text-foreground lg:text-[30px]">{selectedMission.title}</h3>
                <p className="mt-2 max-w-3xl text-[14px] font-semibold leading-relaxed text-foreground/72">{selectedMission.summary}</p>
                <div className="mt-4 h-1.5 max-w-xl overflow-hidden rounded-full bg-foreground/8">
                  <div className={cn("h-full rounded-full transition-all duration-1000", selectedMission.status === "blocked" ? "bg-warning" : "bg-brand-accent")} style={{ width: `${selectedMission.progress}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:gap-3">
                <ArtifactField label="Progress" value={`${selectedMission.progress}%`} />
                <ArtifactField label="Needs attention" value="Rights & Metadata checkpoint" />
                <ArtifactField label="Manager call" value={missionReview.outcome} />
                <ArtifactField label="Next review" value={missionReview.nextReview} />
              </div>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <aside className="hidden rounded-[20px] border border-foreground/8 bg-background/85 p-3 shadow-sm xl:order-last xl:sticky xl:top-6 xl:block xl:self-start">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Mission work</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-1">
                <MissionSurfaceButton icon={ClipboardCheck} title="Tasks" meta={`${selectedMission.tasks} things to do`} onClick={() => onWorkspace("tasksWorkspace")} />
                <MissionSurfaceButton icon={Gauge} title="Checkpoints" meta="9 review points" onClick={() => onWorkspace("testLabWorkspace")} />
                <MissionSurfaceButton icon={FileText} title="Notes" meta={`${selectedMission.briefs} agent handoffs`} onClick={() => onWorkspace("briefsWorkspace")} />
                <MissionSurfaceButton icon={FileCheck2} title="Memory" meta="Living recap + log" onClick={() => onDrawer("decisionRecord")} />
              </div>
              <div className="mt-4 rounded-[16px] border border-[#f97316]/20 bg-[#f97316]/10 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#c2410c]">Current blocker</p>
                <p className="mt-2 text-[13px] font-bold leading-snug text-[#9a3412]">Split approval is still missing.</p>
              </div>
            </aside>

            <section className="rounded-[24px] border border-brand-accent/15 bg-brand-accent/[0.035] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Manager check-in</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">Latest read</p>
                  <h4 className="mt-2 text-[18px] font-bold text-foreground">{missionReview.title}</h4>
                </div>
                <span className="rounded-full border border-brand-accent/15 bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-accent">
                  {missionReview.outcome}
                </span>
              </div>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">Manager recommendation</p>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-foreground">{missionReview.recommendation}</p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground/80">{missionReview.why}</p>
              <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/50">What changed</p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {missionReview.changes.map((change) => (
                  <div key={change} className="rounded-[14px] border border-foreground/5 bg-background/80 p-3 text-[12px] font-medium leading-relaxed text-foreground/75">
                    {change}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[14px] border border-brand-accent/10 bg-background/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Next task created</p>
                <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/80">{missionReview.nextTaskCreated}</p>
              </div>
            </section>
          </div>

          <div className="border-t border-foreground/5 pt-4">
             <p className="text-[12px] font-medium text-muted-foreground/40 italic">Last updated by AI Manager 4 hours ago</p>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
};

const ArtistProfileWorkspace = ({
  profile,
  setProfile,
  onBack,
}: {
  profile: ArtistProfile;
  setProfile: React.Dispatch<React.SetStateAction<ArtistProfile>>;
  onBack: () => void;
}) => {
  const update = (key: keyof ArtistProfile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  return (
    <WorkspaceShell eyebrow="Settings" title="Artist profile" onBack={onBack}>
      <div className="grid gap-5">
        <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] border border-foreground/10 bg-foreground/[0.035]">
                <BrandMark size="sm" />
              </div>
              <div>
                <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Artist Identity</p>
                <h3 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-foreground">{profile.name}</h3>
              </div>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-[18px] border border-foreground/8 bg-foreground/[0.025]">
              <StaffStat label="Stage" value={profile.stage.includes(" ") ? "Build" : profile.stage} />
              <StaffStat label="Market" value={profile.market} />
              <StaffStat label="Budget" value={profile.budget} />
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-brand-accent/15 bg-brand-accent/[0.035] p-5 shadow-sm">
          <label htmlFor="settings-artist-direction" className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">Artist Direction</label>
          <p className="mt-2 max-w-3xl text-[13px] font-semibold leading-relaxed text-foreground/70">
            The Manager uses this as the artist-level truth when shaping missions, deciding what to protect, and spotting missing proof.
          </p>
          <textarea
            id="settings-artist-direction"
            aria-label="Artist Direction"
            value={profile.goal}
            onChange={(event) => update("goal", event.target.value)}
            className="mt-4 min-h-[140px] w-full resize-none rounded-[16px] border border-foreground/8 bg-background/80 p-4 text-[15px] font-semibold leading-relaxed text-foreground outline-none focus:border-brand-accent/40 focus:ring-4 focus:ring-brand-accent/5"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-5 shadow-sm">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Current Focus</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <SettingsField label="Artist name" value={profile.name} onChange={(value) => update("name", value)} />
              <SettingsField label="Spotify identity" value={profile.spotify} onChange={(value) => update("spotify", value)} />
              <SettingsField label="Artist stage" value={profile.stage} onChange={(value) => update("stage", value)} />
              <SettingsField label="Home market" value={profile.market} onChange={(value) => update("market", value)} />
              <SettingsField label="Genre" value={profile.genre} onChange={(value) => update("genre", value)} />
              <SettingsField label="Active release" value={profile.release} onChange={(value) => update("release", value)} />
              <SettingsField label="Monthly budget" value={profile.budget} onChange={(value) => update("budget", value)} />
            </div>
          </section>

          <div className="grid gap-5">
            <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-5 shadow-sm">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Connected Channels</p>
              <div className="mt-4 grid gap-3">
                <SettingsField label="TikTok" value={profile.tiktok} onChange={(value) => update("tiktok", value)} />
                <SettingsField label="Instagram" value={profile.instagram} onChange={(value) => update("instagram", value)} />
                <SettingsField label="YouTube" value={profile.youtube} onChange={(value) => update("youtube", value)} />
                <SettingsField label="X" value={profile.x} onChange={(value) => update("x", value)} />
              </div>
            </section>

            <section className="rounded-[24px] border border-[#f97316]/15 bg-[#f97316]/[0.055] p-5 shadow-sm">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-[#c2410c]">Private Data Needed</p>
              <p className="mt-3 text-[13px] font-semibold leading-relaxed text-[#9a3412]">
                Spotify for Artists exports, smart-link clicks, royalty statements, split sheets, and distributor metadata are still needed for stronger Manager calls.
              </p>
            </section>
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
};

const SettingsField = ({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) => (
  <label className="block rounded-[14px] border border-foreground/8 bg-foreground/[0.025] p-3">
    <span className="font-ui block text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/55">{label}</span>
    <input
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-1.5 w-full bg-transparent text-[14px] font-bold text-foreground outline-none"
    />
  </label>
);

const LockedAgentWorkspace = ({ agent, onBack }: { agent: Agent; onBack: () => void }) => {
  const Icon = agent.icon;

  return (
    <WorkspaceShell eyebrow="Specialist" title={agent.name} onBack={onBack}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-foreground/6 pb-5">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border" style={{ backgroundColor: agent.color + "18", borderColor: agent.color + "35", color: agent.color }}>
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-[24px] font-bold tracking-tight text-foreground">{agent.name}</h2>
                  <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Needs context</span>
                </div>
                <p className="mt-2 max-w-2xl text-[14px] font-semibold leading-relaxed text-muted-foreground/80">{agent.purpose}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[18px] border border-foreground/8 bg-foreground/[0.025] p-4">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">Why access waits</p>
              <p className="mt-3 text-[14px] font-semibold leading-relaxed text-foreground/75">
                This specialist should not make calls from guesswork. Add the required evidence first, then the Manager can use this role with more confidence.
              </p>
            </div>
            <div className="rounded-[18px] border border-brand-accent/15 bg-brand-accent/[0.04] p-4">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-brand-accent">What the Manager can prepare</p>
              <p className="mt-3 text-[14px] font-bold leading-relaxed text-foreground">{agent.managerCanPrepare}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[18px] border border-foreground/8 bg-background p-4">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/55">What they can help with</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {agent.tools.map((tool) => (
                <span key={tool} className="rounded-[12px] border border-foreground/8 bg-foreground/[0.025] px-3 py-2 text-[12px] font-bold text-foreground/75">
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="grid content-start gap-5">
          <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-5 shadow-sm">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-brand-accent">What this specialist needs</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-foreground/70">
              Add the documents or source exports that prove the specialist has enough context to work.
            </p>

            <div className="mt-5">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-[#c2410c]">Missing proof</p>
              <div className="mt-3 grid gap-2">
                {agent.requiredSources.map((source) => (
                  <div key={source} className="flex items-center gap-3 rounded-[12px] border border-[#f97316]/15 bg-[#f97316]/[0.05] p-3 text-[13px] font-bold text-foreground">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-[#c2410c]">
                      <Upload className="h-3 w-3" />
                    </span>
                    {source}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <p className="font-ui text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Connected proof</p>
              <div className="mt-3 grid gap-2">
                {agent.connectedSources.map((source) => (
                  <div key={source} className="flex items-center gap-3 rounded-[12px] border border-emerald-600/10 bg-emerald-600/[0.055] p-3 text-[13px] font-bold text-foreground/75">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-emerald-700">
                      <Check className="h-3 w-3" />
                    </span>
                    {source}
                  </div>
                ))}
              </div>
            </div>

            <button className="mt-5 flex w-full flex-col items-center justify-center rounded-[16px] border border-dashed border-foreground/18 bg-foreground/[0.025] p-5 text-center transition-colors hover:bg-foreground/[0.05]">
              <Upload className="h-5 w-5 text-muted-foreground/65" />
              <p className="mt-2 text-[13px] font-bold text-foreground">Upload files</p>
              <p className="mt-1 text-[12px] font-semibold text-muted-foreground/70">PDF, CSV, screenshots, or exports</p>
            </button>
          </section>

          <section className="rounded-[24px] border border-foreground/8 bg-background/85 p-5 shadow-sm">
            <p className="font-ui text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/55">Optional context</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {agent.optionalSources.map((source) => (
                <span key={source} className="rounded-full border border-foreground/8 bg-foreground/[0.025] px-3 py-1.5 text-[11px] font-bold text-foreground/65">
                  {source}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </WorkspaceShell>
  );
};

const ReviewWorkspace = ({ onBack, onMission }: { onBack: () => void; onMission: (id?: string) => void }) => (
  <WorkspaceShell eyebrow="Review / What Changed" title="Rights gate review" onBack={onBack}>
    <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <div className="rounded-[20px] border border-brand-accent/20 bg-brand-accent/[0.04] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent">Review triggered</p>
        <p className="mt-4 text-[16px] leading-relaxed text-foreground">
          A task review changed the mission: the split sheet is still unsigned, so the release remains conditional even though the June 12 date preserved DSP and outreach runway.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ArtifactField label="Previous recommendation" value="Move release to June 12 and build the rollout properly." />
          <ArtifactField label="What changed" value="Split sheet task reviewed as blocked." />
          <ArtifactField label="What did not change" value="DSP pitch and outreach work should continue while rights are chased." />
          <ArtifactField label="Manager comparison" value="Mission updated; release clearance remains blocked by rights evidence." />
        </div>
      </div>
      <div className="surface-panel rounded-[28px] p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Review actions</p>
        <div className="mt-5 flex flex-col gap-3">
          <button onClick={() => onMission("night-bus-validation")} className="rounded-[10px] border border-foreground/10 px-5 py-2.5 text-[13px] font-bold text-foreground transition-colors hover:bg-foreground/5">Open updated mission</button>
          <button className="rounded-[10px] border border-foreground/10 px-5 py-2.5 text-[13px] font-semibold text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-black">Run review</button>
          <button className="rounded-[10px] px-5 py-2.5 text-[13px] font-semibold text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-black">Snooze review</button>
        </div>
      </div>
    </div>
  </WorkspaceShell>
);

const PreviewBlock = ({ title, rows }: { title: string; rows: string[] }) => (
  <div className="surface-panel rounded-[28px] p-6">
    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{title}</p>
    <div className="mt-4 space-y-3">
      {rows.map((row) => (
        <p key={row} className="text-[13px] leading-relaxed text-foreground/80">{row}</p>
      ))}
    </div>
  </div>
);

const EvidenceDrawer = ({ drawer, onClose }: { drawer: DrawerKind; onClose: () => void }) => (
  <Sheet open={Boolean(drawer)} onOpenChange={(open) => !open && onClose()}>
    <SheetContent className="w-full overflow-y-auto border-l border-foreground/5 bg-white text-foreground sm:max-w-3xl">
      {drawer === "evidence" && (
        <DrawerBody kicker="Evidence Drawer" title="Evidence file" description="Normalized evidence used by the Manager. Each item includes source, lens, freshness, confidence, provenance, and limitations.">
          <div className="space-y-4">
            {evidence.map((item) => (
              <div key={item.id} className="surface-panel overflow-hidden rounded-[28px] p-8 shadow-2xl shadow-black/[0.03] transition-all hover:scale-[1.01]">
                <div className="flex flex-wrap items-start justify-between gap-6">
                  <div>
                    <p className="font-ui text-[11px] font-bold uppercase tracking-[0.15em] text-brand-accent">{item.id} Â· {item.source}</p>
                    <h4 className="font-display mt-2 text-[22px] font-bold text-foreground tracking-tight">{item.subject}.</h4>
                  </div>
                  <span className={cn(
                    "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest border",
                    item.confidence === "High" ? "bg-success/10 text-success border-success/20" : "bg-warning/10 text-warning border-warning/20"
                  )}>
                    {item.confidence} Confidence
                  </span>
                </div>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <ArtifactField label="Evidence type" value={item.type} />
                  <ArtifactField label="Source kind" value={item.sourceKind} />
                  <ArtifactField label="Time window" value={item.window} />
                  <ArtifactField label="Metric / value" value={item.metric} />
                  <ArtifactField label="Lens" value={item.lens} />
                  <ArtifactField label="Freshness" value={item.freshness} />
                  <ArtifactField label="Provenance" value={item.provenance} />
                  <ArtifactField label="Raw snapshot ref" value={item.rawRef} />
                </div>
                <p className="mt-6 rounded-[14px] border border-[#f97316]/20 bg-[#f97316]/[0.05] p-5 text-[13px] leading-relaxed text-[#c2410c]">Limitation: {item.limitation}</p>
              </div>
            ))}
          </div>
        </DrawerBody>
      )}
      {drawer === "decisionRecord" && (
        <DrawerBody kicker="Mission Record" title="Mission memory" description="A living recap of the mission across tasks, checkpoints, notes, decisions, blockers, and reviews.">
          <div className="surface-panel rounded-[28px] p-8 shadow-2xl shadow-black/[0.02] text-foreground">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{decisionRecord.missionTitle}</p>
                <h3 className="mt-2 text-[22px] font-display font-bold tracking-tight text-foreground">{decisionRecord.finalCall}</h3>
              </div>
              <span className="rounded-full bg-foreground/5 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-foreground/70">{decisionRecord.confidence}</span>
            </div>

            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-foreground/80">
              <p>
                Original request: "I want to drop a new song next week." The Manager treated that as a real release decision, not a generic launch checklist.
              </p>
              <p>
                Manager moved the target from next Friday to Friday, June 12, 2026 because the rushed date would weaken DSP pitching, creator seeding, press outreach, metadata QA, and distributor delivery.
              </p>
              <p>
                The release strategy gate is clean, but the Rights & Metadata Gate is not. The split sheet task created a blocked result, so the release remains conditional until written approval is uploaded.
              </p>
              <p>
                The useful move now is operational: clear the split approval, submit the distributor package, then keep playlist, creator, press, content, release-day, and post-release checkpoints moving from task reviews.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Task status summary</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  Strategy is accepted, split sheet is blocked, Spotify pitch is submitted, and creator, press, content, distribution, release-day, and post-release tasks are staged by checkpoint.
                </p>
              </div>
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Checkpoint status summary</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  Release Strategy is met, Rights & Metadata needs revision, DSP & Playlist is ready for review, and the remaining gates wait on task results.
                </p>
              </div>
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Agent notes that changed the mission</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  Marketing opened creator seeding, DSP/playlist notes preserved the pitch window, and Finance/Rights changed the rights checkpoint to needs revision.
                </p>
              </div>
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Decisions already made</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  Move the release to June 12, reject the next-Friday rush, do not announce before rights and delivery clear, and avoid generic creator or playlist blasts.
                </p>
              </div>
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Blockers and missing evidence</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  Signed split sheet, distributor confirmation, creator commitments, EPK target list, launch content approval, live-link verification, and 48-hour signal read are still missing.
                </p>
              </div>
              <div className="rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">What would change the recommendation</p>
                <p className="mt-3 text-[13px] leading-relaxed text-foreground/75">
                  The Manager changes the date or mission path if splits stay blocked, distributor delivery fails, creator commitments are weak, or early post-release signal does not justify more push.
                </p>
              </div>
            </div>

            <div className="mt-8 rounded-[18px] border border-foreground/5 bg-foreground/[0.035] p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Mission log</p>
              <div className="mt-4 space-y-3">
                {missionEvents.map((event) => (
                  <div key={`${event.type}-${event.summary}`} className="flex gap-3 text-[13px] leading-relaxed text-foreground/75">
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-brand-accent">{event.type}</span>
                    <span>{event.summary}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 border-t border-foreground/5 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">Evidence and decision limits</p>
              <p className="mt-3 text-[13px] leading-relaxed text-foreground/70">
                Evidence used: EV-TTK-0426, EV-YT-1190, EV-SP-3302, EV-ART-0007, EV-RGT-0612, EV-DSP-0612. Rejected moves: {decisionRecord.alternativesRejected.join(", ")}. Missing evidence: {decisionRecord.missingEvidence.join(", ")}. The decision changes if {decisionRecord.changeDecision}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-foreground/70">
                Review date: {decisionRecord.reviewDate}. Override state: {decisionRecord.override}. Quality review: {decisionRecord.qualityGate}.
              </p>
            </div>
          </div>
        </DrawerBody>
      )}
      {drawer === "workDraft" && (
        <DrawerBody kicker="Work drafts" title="Not sent automatically" description="Operational drafts for approval, editing, export, or future sending.">
          <div className="space-y-4">
            {workDrafts.map((draft) => (
              <div key={draft.type} className="surface-panel rounded-[28px] p-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{draft.type}</p>
                <p className="mt-2 text-[18px] font-bold text-foreground">{draft.title}</p>
                <p className="mt-4 text-[14px] leading-relaxed text-black/70">{draft.body}</p>
              </div>
            ))}
          </div>
        </DrawerBody>
      )}
    </SheetContent>
  </Sheet>
);

const InvestigationScreen = ({ onBack }: { onBack: () => void }) => (
  <WorkspaceShell eyebrow="Intelligence" title="Investigation" onBack={onBack}>
    <div className="surface-panel rounded-[24px] p-8">
      <p className="text-[15px] font-medium text-muted-foreground/80 leading-relaxed">Investigation workspace â€” cross-referencing signals and market data.</p>
    </div>
  </WorkspaceShell>
);

const DecisionPackageScreen = ({ conversations, onBack, onMission, onWorkspace, onDrawer, onConversation }: { conversations: RecentConversation[]; onBack: () => void; onMission: (id?: string) => void; onWorkspace: (view: View) => void; onDrawer: (drawer: DrawerKind) => void; onConversation: (conv: RecentConversation) => void }) => (
  <WorkspaceShell eyebrow="Decision Package" title="Manager Decision" onBack={onBack}>
    <div className="surface-panel rounded-[24px] p-8">
      <p className="text-[15px] font-medium text-muted-foreground/80 leading-relaxed">Decision package ready for review. The Manager has finalized a recommendation based on current signals.</p>
    </div>
  </WorkspaceShell>
);

const DrawerBody = ({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="p-8">
    <SheetHeader>
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground/60">{kicker}</p>
      <SheetTitle className="font-display mt-2 text-[2.8rem] font-display font-bold tracking-tight text-foreground">
        {title}
      </SheetTitle>
      <SheetDescription className="mt-3 text-[15px] leading-relaxed text-foreground/70">{description}</SheetDescription>
    </SheetHeader>
    <div className="mt-10">{children}</div>
  </div>
);
