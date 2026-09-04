import type {
  ConversationViewModel,
  MissionCheckpointViewModel,
  MissionTaskViewModel,
  MissionViewModel,
} from "../types/cleanProduction";

export const odaeshiCheckpoint: MissionCheckpointViewModel = {
  id: "checkpoint-content",
  phase: 1,
  title: "Content ready before release week",
  status: "Waiting on tasks",
  question: "Is the first release story ready to publish?",
  requiredTaskIds: ["task-story-video"],
  dependsOnCheckpointIds: [],
  unlocks: ["Release-week content cadence"],
  blockedReason: "",
  dependencyImpact: "The campaign should not accelerate without a strong first story.",
  watchedSignals: ["video_posted", "saves", "profile_visits"],
  decisionRule: "Publish the first story, then review response before expanding the cadence.",
  recommendation: "Shoot the first story video while the record still feels personal and specific.",
  rationale: "The strongest angle is the record's survival story, not a generic release announcement.",
  managerRead: "The song needs a human story before more promotion.",
  nextAction: "Record the first story video.",
};

export const odaeshiTask: MissionTaskViewModel = {
  id: "task-story-video",
  checkpointId: odaeshiCheckpoint.id,
  title: "Record: What couldn't finish us?",
  owner: "Artist",
  deadline: "2026-09-06T18:00:00+01:00",
  approvalState: "not_required",
  purpose: "Give Odaeshi one human story people can understand before release week begins.",
  steps: [
    "Open on camera: ‘There was a point I thought this song would never come out.’",
    "Tell the 15-second version of what almost stopped the record.",
    "Play the strongest 7–10 seconds of Odaeshi under the final line.",
    "End with: ‘Odaeshi. Next month.’",
  ],
  evidenceIds: [],
  workMode: "artist_action",
  completionMode: "attestation",
  completionExpectation: "One vertical video, 25–35 seconds, filmed close and direct.",
  deliverableTitle: "Story video",
  deliverableRequirements: ["9:16", "25–35 seconds", "clear face and voice", "song audible at the end"],
  managerResponsibility: "Desk chose the angle, wrote the hook, structured the story and set the CTA.",
  userResponsibility: "Record the video and tell Desk when it is posted.",
  dependency: "None",
  riskIfLate: "The release starts without a human story for new listeners to attach to.",
};

export const odaeshiMission: MissionViewModel = {
  id: "mission-odaeshi-release",
  title: "Release Odaeshi",
  status: "active",
  progress: 38,
  review: "The release plan is active. The first audience-facing story is the current human dependency.",
  summary: "Prepare, release and learn from Odaeshi without losing the artist in campaign admin.",
  recommendation: "Record the first story video before expanding the campaign.",
  musicSubject: "Odaeshi",
  subjectType: "music_item",
  subjectId: "music-odaeshi",
  nextTask: odaeshiTask.title,
  checkpoints: [odaeshiCheckpoint],
  tasks: [odaeshiTask],
  notes: [],
  events: [],
};

export const watchMission: MissionViewModel = {
  ...odaeshiMission,
  id: "mission-odaeshi-watch",
  progress: 61,
  review: "The story video is live. No artist action is needed until Desk has enough response to make the next call.",
  recommendation: "No action needed right now. Desk is watching the first response window.",
  nextTask: "",
  checkpoints: [{
    ...odaeshiCheckpoint,
    id: "checkpoint-story-response",
    title: "First story response",
    status: "Watching signal",
    requiredTaskIds: [],
    recommendation: "No action needed. Desk is watching saves, profile visits and audience response before changing the plan.",
    watchedSignals: ["saves", "profile_visits", "comments", "completion_rate"],
  }],
  tasks: [],
};

export const approvalTask: MissionTaskViewModel = {
  ...odaeshiTask,
  id: "task-split-confirmation",
  checkpointId: "checkpoint-release-admin",
  title: "Send collaborator split confirmation",
  owner: "Desk",
  deadline: "2026-09-05T13:00:00+01:00",
  approvalState: "needs approval",
  purpose: "Desk has prepared the exact collaborator confirmation and only needs authority to send it.",
  steps: [],
  workMode: "manager_work",
  completionMode: "manager_draft",
  managerResponsibility: "Prepare the exact message, recipient and split details, then execute once approved.",
  userResponsibility: "Approve or reject the prepared external action.",
  dependency: "Artist authority",
  riskIfLate: "Credits remain unconfirmed before distributor delivery.",
};

export const approvalMission: MissionViewModel = {
  ...odaeshiMission,
  id: "mission-odaeshi-admin",
  title: "Release admin for Odaeshi",
  progress: 74,
  recommendation: "Approve the prepared split confirmation.",
  nextTask: approvalTask.title,
  checkpoints: [{
    ...odaeshiCheckpoint,
    id: "checkpoint-release-admin",
    title: "Release admin cleared",
    requiredTaskIds: [approvalTask.id],
    recommendation: "Approve the prepared split confirmation.",
  }],
  tasks: [approvalTask],
};

const work = [
  { type: "task" as const, title: "Odaeshi release mission", body: "Current plan, checkpoints and exact human work.", id: odaeshiMission.id, status: "created" as const },
  { type: "task" as const, title: "Press release", body: "A release-ready press draft built around the survival story.", artifactKind: "song_document" as const, documentType: "press_release", id: "doc-press", status: "created" as const },
  { type: "task" as const, title: "EPK", body: "Artist story, release context, press image and essential links.", artifactKind: "song_document" as const, documentType: "epk", id: "doc-epk", status: "created" as const },
  { type: "task" as const, title: "Content plan", body: "First three audience-facing stories and the order to publish them.", artifactKind: "song_document" as const, documentType: "content_plan", id: "doc-content", status: "created" as const },
  { type: "task" as const, title: "Editorial pitch", body: "A concise pitch focused on why Odaeshi matters now.", artifactKind: "song_document" as const, documentType: "editorial_pitch", id: "doc-pitch", status: "created" as const },
];

export const odaeshiConversation: ConversationViewModel = {
  id: "conversation-odaeshi",
  topic: "Odaeshi release",
  status: "active",
  summary: "Desk is running the Odaeshi release plan.",
  prompt: "I want to release Odaeshi next month. Help me run it.",
  musicSubject: {
    type: "music_item",
    id: "music-odaeshi",
    title: "Odaeshi",
    lifecycleStage: "pre_release",
  },
  messages: [
    {
      id: "msg-artist-goal",
      speaker: "artist",
      label: "You",
      body: "I want to release Odaeshi next month. Help me run it.",
      status: "sent",
    },
    {
      id: "msg-manager-plan",
      speaker: "manager",
      label: "Desk",
      body: "I’ve got the release. The first thing I’m protecting is the story. I’ve built the release mission, prepared the core press work and narrowed today to one thing you need to do.",
      status: "sent",
      createdWork: work,
    },
  ],
  createdWork: work,
};
