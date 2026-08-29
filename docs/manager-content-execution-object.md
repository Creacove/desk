# Manager Runtime — content execution object

## Product contract

When Desk assigns content work, the artist should be able to make it without asking:

> “Okay, but what exactly do I film?”

A content task is not complete because it says:

- create a video;
- post on TikTok;
- tell your story;
- make a Tough Skin Story;
- test audience participation.

Those are strategic directions, not executable work.

Desk must compile the creative idea into a practical production brief that fits the artist's real resources, time, budget, location, preferences and campaign strategy.

The target feeling is:

> **Desk did the manager/creative-producer thinking. I just need to make and post this.**

## Hard product constraint: no campaign-media upload dependency

Desk should **not** require artists to upload campaign videos, rough cuts, photos or other content media into OrderSounds/Supabase as part of the Manager Runtime.

Reasons:

- campaign video storage is not core product value;
- video would consume storage/egress quickly;
- current OpenAI model stack does not make full video review a reliable core primitive;
- forcing uploads adds another workflow artists must maintain;
- the Manager should remain valuable even when it cannot inspect the raw media.

Therefore the content loop is built around:

1. a highly specific execution brief **before** the artist makes the content;
2. normal creation/editing in the artist's existing tools;
3. normal posting to the target platform;
4. a public post URL or connected-platform post identity as proof;
5. platform metrics / artist-reported result evidence for review;
6. automatic Manager evaluation of the campaign signal, not a promise that Desk visually inspected footage it never received.

If future provider integrations allow legitimate direct media access without making OrderSounds the storage layer, that can be added as an optional enhancement. It is not an MVP dependency.

---

# Why content needs first-class structure

The current Task model is stronger than a title-only to-do, but `steps: string[]` alone is too weak for creative production because important fields can disappear without violating the contract.

Content therefore needs a typed `execution_brief` attached to the human Task.

Do not create a separate content-planning product outside Missions. Mission owns the outcome; Task owns the human action; the execution brief tells the artist exactly how to execute it.

---

# Product-quality lenses

## Utility

The artist should know:

- what to make;
- why this piece exists;
- where/how to make it;
- who is needed;
- what happens in the opening seconds;
- what to say/do;
- where the song enters;
- how it should be edited;
- what response we want;
- where to post it;
- what evidence Desk needs afterward.

If the artist still has to invent the execution, the task is not ready.

## Low user effort

Do not make the artist fill out a creative brief.

Desk compiles it from:

- strategy state;
- lyrics/song meaning;
- World Model resources;
- creator preferences;
- budget;
- Mission phase;
- prior post results;
- platform evidence when available.

Ask one decision-changing question only when one unknown materially changes the concept.

## Context

Never require people, places, equipment or spend that Desk has not grounded in current facts.

Examples:

- iPhone available;
- two friends free Saturday;
- car access until Sunday;
- dislikes memorized scripts;
- speaks Igbo/Pidgin/English;
- ₦20k exists but proof does not justify spending it yet.

## Reasoning

Every content brief has a hypothesis.

Example:

> Personal resilience stories will make Odaeshi feel like language people can use for themselves rather than only a song they listen to.

The content tests that hypothesis.

## Runtime

The brief survives across:

- task creation;
- Today projection;
- execution;
- posted URL / platform identity;
- response watch;
- Manager evaluation;
- follow-up Task;
- checkpoint;
- adaptive replan.

It cannot live only inside one model response.

## Autonomy

Desk should automatically do safe machine work:

- concept development;
- hook/talking-point preparation;
- caption drafting;
- response comparison;
- strategy interpretation;
- replanning.

The artist/team does real-world production, editing, posting and approvals.

## Three clocks

Do not schedule fake Manager workdays.

After a post exists, platform signal waiting is a **watch**.
When metrics become available, Manager analysis runs immediately.

## Execution quality

Two gates:

1. Could the artist execute this now without asking “how?”
2. Could the artist/song name be swapped and the task still work?

If the first is no or the second is yes, reject it.

## Trust

Desk must never imply it watched or reviewed a video it did not actually receive/access.

It may say:

> “This post produced 2.1× your normal share rate.”

It may not say:

> “The first five seconds are weak.”

unless a future legitimate media-access path actually gave Desk visual evidence.

---

# Object model

Conceptual task payload:

```ts
type ContentExecutionBrief = {
  version: 1;
  kind: "content_capture" | "content_edit" | "content_publish" | "content_response";

  objective: string;
  hypothesis: string;
  conceptTitle: string;
  conceptSummary: string;

  platforms: Array<"tiktok" | "instagram_reels" | "youtube_shorts" | "instagram_feed" | "x" | "other">;

  format: {
    media: "video" | "photo" | "carousel" | "text" | "live";
    orientation?: "9:16" | "1:1" | "4:5" | "16:9";
    targetDurationSeconds?: number;
    style: string;
  };

  setup: {
    people: string[];
    location: string;
    equipment: string[];
    props: string[];
    estimatedMinutes: number;
    estimatedCost: string;
    sourceFactIds: string[];
  };

  hook: {
    firstBeat: string;
    onScreenText?: string;
    spokenOpen?: string;
    avoid?: string[];
  };

  performance: {
    direction: string;
    scriptMode: "verbatim" | "talking_points" | "improvised" | "none";
    script?: string;
    talkingPoints: string[];
  };

  shotPlan: Array<{
    order: number;
    shot: string;
    action: string;
    framing?: string;
    durationSeconds?: number;
    audio?: string;
  }>;

  songUse: {
    songId?: string;
    songTitle?: string;
    moment: string;
    startAtSeconds?: number;
    lyricOrCue?: string;
    reason: string;
  };

  edit: {
    pacing: string;
    cuts: string[];
    textTreatment: string;
    audioTreatment: string;
    avoid: string[];
  };

  publish: {
    captionDraft?: string;
    cta: string;
    desiredAudienceResponse: string;
    postingNotes: string[];
  };

  successSignal: {
    primary: string;
    secondary: string[];
    observationWindow?: string;
  };

  proof: {
    completionMode: "published_url" | "connected_platform_post" | "result_note" | "attestation";
    required: string[];
  };

  fallback: {
    trigger: string;
    alternative: string;
  };
};
```

First implementation can store this as validated JSONB on Tasks.

---

# Task kinds

Recommended task-level field:

```ts
task_kind:
  | "general_action"
  | "content_capture"
  | "content_edit"
  | "content_publish"
  | "content_response"
  | "approval"
  | "outreach"
  | "event"
  | "admin"
  | "result_report";
```

Do not infer content type from task-title regexes once the compiler can emit it directly.

---

# Content capture contract

A `content_capture` Task must answer:

### What are we trying to learn/change?

Not “promote the song.”

### What exactly is the concept?

One sentence the artist can picture.

### Which real resources are required?

Ground them in World Model facts where possible.

### What happens in the first 1–3 seconds?

Avoid generic explanatory intros by default.

### What does the artist say/do?

Match known creative preference.

### What is the shot plan?

Specific enough for a phone shoot.

### Where does the song enter?

“Use the sound” is insufficient.

### What should editing do?

Concrete cuts/pacing/text treatment, not “keep it engaging.”

### What response are we inviting?

Not every post needs “stream now.”

### What proves completion?

For the normal content loop, completion should be one of:

- connected platform identifies the published post;
- artist pastes the public TikTok/Reels/Shorts URL;
- artist confirms it was completed when no public evidence is available;
- artist supplies a short result note/metrics when the platform is not connected.

No campaign-media upload requirement.

---

# Content runtime loop without media uploads

## 1. Capture/edit — human

Artist makes the content in the tools they already use.

Desk does not need the raw file.

## 2. Publish — human / permission boundary

Task contains the final brief, caption/CTA and platform instructions.

If posting remains manual, artist posts normally.

## 3. Post identity — evidence

Preferred order:

1. connected TikTok/platform integration detects the artist's own public post;
2. artist pastes the public post URL;
3. artist supplies a short attestation/result note if no public reference exists.

## 4. Response watch — reality

Once the post exists, start the configured observation window.

Examples:

- 6 hours;
- 12 hours;
- 24 hours;

Do not create a human or Manager calendar Task simply to wait.

## 5. Manager evaluation — automatic

When signal matures, evaluate what Desk can actually observe.

For TikTok with creator authorization this can include:

- views;
- likes;
- comments count;
- shares;
- post timing;
- caption/description;
- comparison with recent artist baseline.

Do not claim comment sentiment without comment text.

## 6. Next move

Manager chooses:

- repeat/scale concept;
- alter CTA;
- test another creative pillar;
- change cadence;
- ask one missing contextual question;
- start another watch;
- replan.

The artist never has to ask “what next?”

---

# What Desk can and cannot review

## Before posting

Desk reviews the **plan/brief**, not the actual video.

Its value is making the brief good enough that an emerging artist can execute it with ordinary tools.

## After posting

Desk reviews **performance evidence**, not the unseen video itself.

It may reason about:

- relative response;
- share/comment/like/view ratios;
- posting cadence;
- whether the hypothesis generated participation;
- whether the concept is worth repeating.

It must not invent visual critique.

## Optional future enhancement

If a connected provider later exposes legitimate media access, or a user deliberately supplies an external public/unlisted URL that the model can access, visual review can become an optional capability.

That capability should still avoid making Supabase/OrderSounds the campaign-media storage layer.

---

# Odaeshi example

## Task

**Record and post “What couldn’t finish us?”**

Owner: Otmos  
Estimated time: 30–40 min  
Estimated spend: ₦0  
People: Otmos + 2 friends  
Resource: parked car  
Platforms: TikTok / Reels

## Objective

Test whether people understand Odaeshi as language for personal resilience, not only as a song title.

## Hypothesis

Specific real stories followed by “That’s Odaeshi” will make the meaning easier for viewers to adopt and repeat.

## Setup

- Park somewhere quiet; engine off.
- Phone vertical.
- Keep framing intimate.
- Use daylight/window light.
- Do not spend campaign budget on the first test.

## Hook

Do not start with Otmos explaining Odaeshi.

Start on the strongest answer.

On-screen text:

> What couldn't finish you?

## Talking points

Ask each person:

1. What happened?
2. What made you think you were done?
3. What made you realize you were still standing?

Otmos closes naturally:

> “That’s Odaeshi.”

Then the song enters.

## Shot plan

1. Strongest story first.
2. Quick human reaction.
3. Second story.
4. Otmos gives his shortest story.
5. “That’s Odaeshi.”
6. Song enters; keep a real reaction rather than staged pose.

## Edit

- 25–40 seconds.
- Cut pauses aggressively.
- Keep real laughter/reactions.
- Subtitle stories.
- No branded intro animation.
- Do not turn it into a polished music-video clip.

## CTA

> What tried to finish you?

Desired response: personal stories/comments, not “stream now.”

## Completion proof

After posting:

- if TikTok is connected, Desk should associate the post automatically where possible;
- otherwise paste the TikTok/Reels URL.

No raw-video upload to Desk.

## Watch

Desk checks available platform metrics after the chosen response window and compares them with the artist's recent baseline.

Example valid Manager conclusion:

> This post's share rate is materially stronger than your recent posts, so the personal-resilience direction deserves another test.

Invalid conclusion without comment text/media evidence:

> People love the opening shot and are telling detailed survival stories in the comments.

## Fallback

If car access disappears, preserve the same emotional structure in a known quiet location with close seating/framing.

---

# Resource-aware generation rules

When choosing a concept:

1. prefer known available resources;
2. prefer low-cost execution until evidence justifies spend;
3. do not require professional production by default;
4. treat relatable/unpolished execution as legitimate when it fits the hypothesis;
5. ask only when one missing resource fact changes the route;
6. include a fallback for fragile resources.

The goal is not cheap content. It is **resource-intelligent content**.

---

# Budget behavior

Rules:

- ₦0 is a valid strategic choice;
- do not spend merely because money exists;
- profile monthly budget is not campaign authorization;
- Mission-scoped budget is planning context;
- external spend remains permission-gated.

---

# TikTok/platform evidence contract

For the first platform integration, prioritize creator-authorized TikTok post identity + metrics.

Useful fields:

- platform post ID;
- URL;
- created time;
- description/caption;
- views;
- likes;
- comments count;
- shares;
- duration when available.

Store normalized platform evidence rather than the media file.

Conceptual result object:

```ts
type ContentPostEvidence = {
  taskId: string;
  platform: "tiktok" | "instagram" | "youtube" | "other";
  externalPostId?: string;
  publicUrl?: string;
  postedAt?: string;
  source: "connected_api" | "public_url" | "artist_report";
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
  capturedAt: string;
};
```

This is lightweight database evidence, not media storage.

---

# Task UI

For a content task, render structured sections:

1. What you're making
2. Why this now
3. Setup — time/cost/people/location/gear
4. Hook
5. What to say/do
6. Shot plan
7. Song use
8. Edit
9. Post / CTA
10. What Desk will watch afterward
11. Start / Done / Move it / I'm blocked

On completion, ask only for the smallest evidence necessary:

- **Post URL** when not connected;
- or **Done** if connected-platform discovery can resolve the post;
- or a short result note if the task is not public/platform-observable.

Do not present a campaign-media upload control.

---

# Compiler contract

For a content task, compiler must either:

1. emit a complete valid execution brief using known context; or
2. return `needs_context` for one decision-changing missing fact.

Reject output when:

- concept could apply to almost any song;
- hook is missing/generic;
- resources are ungrounded;
- no desired audience behavior exists;
- song use has no actual cue/moment;
- editing instruction is generic;
- CTA does not support the hypothesis;
- artist is asked to invent script/shot plan;
- brief ignores stored preference;
- expensive production appears without reason;
- multiple unrelated hypotheses are tested at once;
- proof requires uploading campaign media to Desk.

---

# Execution-behavior learning hooks

The content loop can still learn from lightweight execution data:

- actual time to completion;
- reschedule count;
- blockers;
- collaborator/resource failures;
- script mode;
- post URL/platform;
- response metrics;
- whether the artist completed the task.

No raw video is required for this learning.

---

# Regression failures

Reject implementation if:

- artist is required to upload campaign video/image to OrderSounds;
- Supabase Storage becomes the campaign-media repository;
- content review claims to have seen footage it never accessed;
- Mission strategy is copied verbatim into a content Task;
- artist still has to ask what to film;
- compiler invents people/places/equipment;
- every idea assumes professional production;
- profile monthly budget becomes available spend;
- waiting for post response becomes a fake Manager Task;
- TikTok comment sentiment is claimed without comment data;
- generic content survives the artist/song swap test;
- content becomes a separate strategy/calendar brain outside Missions.

---

# Acceptance bar

A reviewer should answer yes:

1. Can I picture the exact content?
2. Are the resources realistic and known?
3. Do I know exactly how it starts?
4. Do I know what the artist says/does?
5. Do I know where the song enters and why?
6. Do I know how to shoot/edit it?
7. Do I know what audience behavior we want?
8. Do I know how completion is proven without uploading campaign media?
9. Is there a fallback if a fragile resource disappears?
10. Can the artist execute without another “how?” prompt?
11. Will Desk automatically watch/evaluate the available post evidence afterward?
12. Does Desk remain honest about what it can and cannot observe?

That is the content-execution bar.