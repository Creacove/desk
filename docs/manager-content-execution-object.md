# Manager Runtime — content execution object

## Product contract

When Desk assigns content work, the artist should be able to make the content without asking:

> “Okay, but what exactly do I film?”

A content task is not complete because it says:

- create a video;
- post on TikTok;
- tell your story;
- make a Tough Skin Story;
- test audience participation.

Those are strategic directions, not executable work.

The Manager Runtime must compile the creative idea into a practical production brief that fits the artist's real resources, time, budget, location, preferences and current campaign strategy.

The target feeling is:

> **Desk did the manager/creative-producer thinking. I just need to make this.**

---

# Why content needs first-class structure

The current Task model is much stronger than a title-only to-do:

- title;
- purpose;
- steps;
- completion expectation;
- manager/user responsibility;
- risk if late;
- deadline/availability;
- result/deliverables.

That is sufficient for many operational tasks.

It is not sufficient to reliably represent a content execution brief.

A `steps: string[]` array can technically hold creative detail, but it has three problems:

1. the model can omit important production dimensions without violating the schema;
2. the UI cannot distinguish hook, shot plan, script, song cue, edit direction, CTA or resources;
3. Manager review cannot reason against the original creative intent structurally.

Content therefore needs a typed execution object attached to a human Task.

Do not create a separate content-planning product outside Missions. The content brief belongs to the Task that the artist is executing.

---

# Product-quality lenses

## Lens 1 — utility

The object must turn strategy into something filmable/postable.

The artist should know:

- what to make;
- where/how to make it;
- who is needed;
- what happens in the opening seconds;
- what to say/do;
- where the song enters;
- how it should be edited;
- what response we want;
- what to return to Desk.

If the user still has to invent the creative execution, the object has not done its job.

## Lens 2 — user effort

Do not make the artist fill out a creative brief.

Desk should compile it from:

- strategy state;
- cultural/song meaning;
- World Model resources;
- creator preferences;
- budget;
- current Mission phase;
- prior test results;
- platform/content evidence when available.

Ask only for a decision-changing fact if one specific unknown blocks the concept.

## Lens 3 — context/memory

A content brief should use current operating reality.

Examples:

- artist has iPhone but no camera;
- can get two friends Saturday;
- can borrow car until Sunday;
- dislikes memorized scripts;
- speaks Igbo/Pidgin/English;
- ₦20k exists but early proof does not justify spending it yet.

Do not generate a production concept that requires resources Desk does not know are available.

## Lens 4 — reasoning quality

A good brief has a creative hypothesis.

Example:

> Personal resilience stories will make Odaeshi feel like language people can use for themselves, rather than only a song they passively listen to.

The execution should test that hypothesis.

Content is not valuable merely because it looks good.

## Lens 5 — runtime/harness

A content brief must survive across:

- task creation;
- Today projection;
- task execution;
- upload/result submission;
- Manager review;
- revision Task;
- post/publication Task;
- response watch;
- checkpoint decision;
- adaptive replan.

It cannot live only inside one model response body.

## Lens 6 — autonomy

Desk should automatically do the work that does not require the artist:

- concept development;
- hook options;
- script/talking-point preparation;
- caption drafting;
- edit recommendation after reviewing submitted material;
- comparison against prior tests;
- response analysis;
- replan.

Artist work should be the real-world production/performance/approval/posting action.

## Lens 7 — three clocks

Do not schedule:

- “Tomorrow: Desk reviews footage”
- “Day 4: Desk writes caption”

When footage arrives, review runs immediately.
When the cut is approved, caption preparation runs immediately.
If audience response needs 12–24 hours, that is a watch.

## Lens 8 — execution quality

The main quality gate is:

> Could this artist execute the brief now without asking Desk “how?”

Second gate:

> If the artist/song name were swapped, would the brief still work?

If yes, it is generic and should be rejected.

## Lens 9 — product coherence

Content remains inside the same Mission/Task runtime.

- Mission owns outcome;
- Strategy State owns campaign intent;
- Task owns human action;
- Content Execution Brief owns the production instructions for that Task;
- Task Result owns what happened;
- Manager review owns interpretation;
- Watch owns response maturation.

No separate “content calendar brain.”

## Lens 10 — trust

Never invent:

- a location;
- access to a vehicle;
- available friends/creators;
- budget;
- gear;
- song meaning;
- performance metrics;
- a platform trend as current fact without evidence.

When a resource is a creative suggestion rather than known availability, Desk must either choose a known fallback or ask one contextual question.

## Lens 11 — 11-star feeling

A great brief should create the reaction:

> “How did Desk think of that using the random things I already have around me?”

That is the value of combining strategy with the Artist World Model.

---

# Object model

Add a structured `execution_brief` to applicable human Tasks.

Do not force every Task to have one. It is primarily for content-production work.

Conceptual schema:

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
    completionMode: "raw_media" | "draft_cut" | "published_url" | "result_note";
    required: string[];
  };

  fallback: {
    trigger: string;
    alternative: string;
  };
};
```

This is conceptual. The implementation may use JSONB on Tasks initially, but the contract should remain typed/validated.

---

# Task kind

The runtime should be able to distinguish content work from generic human work without guessing from title text.

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

The first implementation does not need bespoke UI for every kind. The important change is that content tasks can require/validate `execution_brief`.

Do not infer task type at render time through regexes once the Plan Compiler can emit it directly.

---

# Content capture contract

A `content_capture` Task must answer these questions.

## What are we trying to learn/change?

Not “promote the song.”

Examples:

- test whether people attach their own resilience stories to Odaeshi;
- test whether the artist's personal story creates stronger identification than generic anthem language;
- test whether the call-and-response phrase is naturally repeatable.

## What exactly is the concept?

One sentence the artist can picture.

Example:

> Three people sit in a parked car and each says the one thing they thought would finish them; Otmos closes with “That’s Odaeshi,” then the record enters.

## What resources are required?

Use World Model fact IDs where possible.

Known vs optional should be clear.

## What happens in the first 1–3 seconds?

Do not let every video start with explanation.

Example:

> Start directly on the strongest friend's answer: “I thought dropping out finished me.”

## What does the artist say/do?

Match creative preference.

If World Model says the artist dislikes scripts, use talking points rather than a polished paragraph.

## What is the shot plan?

Specific enough for a phone shoot.

## Where does the song enter?

Do not merely say “use the sound.”

The cue is part of the concept.

## What should editing do?

Examples:

- no intro card;
- cut dead air aggressively;
- subtitles only on the actual stories;
- keep imperfect laughter/reactions;
- do not over-grade the footage.

## What response are we inviting?

Not every post needs “stream now.”

Examples:

- “What tried to finish you?”
- comment one word for what you survived;
- stitch/duet with your story;
- tag someone who kept standing.

## What counts as completion?

Raw footage is often enough for first submission. Do not make the artist edit before Desk has reviewed whether the capture works.

---

# Capture → review → revision → publish loop

Content should move through a runtime loop rather than one giant Task.

## 1. Capture Task — human

Artist records raw footage.

Completion proof: raw media.

## 2. Manager review — automatic

As soon as media exists, Desk evaluates:

- hook strength;
- clarity;
- emotional specificity;
- alignment to strategy;
- unnecessary setup;
- performance authenticity;
- usable moments;
- whether reshoot is actually needed.

No future-day task for Desk.

## 3A. If usable

Desk may automatically prepare:

- edit prescription;
- recommended opening;
- caption;
- CTA.

Then release a human edit Task only if the artist/team must perform the edit.

If connected tools can safely edit in future, that may become Manager action.

## 3B. If revision needed

Create a narrowly scoped human follow-up.

Bad:

> Improve the video.

Good:

> Cut the first six seconds and start on Tobi saying “I thought dropping out finished me.” Keep the rest. No reshoot.

## 3C. If capture failed conceptually

Only request reshoot when existing material cannot be repaired.

Explain exactly what needs to change.

## 4. Publish Task — human/permission boundary

If posting remains human-controlled, Task contains approved asset/caption/posting notes.

## 5. Response Watch — reality

After published URL is submitted/observed, start watch immediately.

## 6. Manager evaluation — automatic

When response window matures, compare intended signal vs observed response and update Plan/Checkpoint.

---

# Manager review output

A content-result review should be structured enough to produce surgical follow-up work.

Conceptual shape:

```ts
type ContentReview = {
  outcome: "approved" | "edit_only" | "reshoot_partial" | "reshoot_full" | "blocked";
  summary: string;
  strategyFit: string;
  strongestMoment?: {
    description: string;
    startSeconds?: number;
    endSeconds?: number;
  };
  hookAssessment: string;
  keep: string[];
  change: string[];
  doNotChange: string[];
  nextManagerActions: string[];
  nextHumanAction?: {
    title: string;
    exactInstruction: string;
    estimatedMinutes: number;
  };
};
```

A model should not create a revision Task if its own automatic work can resolve the issue.

---

# Odaeshi example — complete brief

## Task

**Record “What couldn’t finish us?”**

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

## Concept

Three people sit in a parked car. Each answers one thing they thought they would not recover from. Otmos closes the sequence by naming that survival as Odaeshi.

## Setup

- Park somewhere quiet; engine off.
- Phone vertical.
- Put the phone close enough that all three faces feel intimate rather than like an interview.
- Use available daylight/window light; no extra lighting purchase.
- Do not spend the current campaign budget on this test.

## Hook

Do **not** start with Otmos explaining Odaeshi.

Start on the strongest friend's answer.

Possible first line:

> “I thought dropping out finished me.”

On-screen text:

> What couldn't finish you?

## Talking points

Otmos does not need a memorized script.

Prompt each person:

1. What happened?
2. What made you think you were done?
3. What made you realize you were still standing?

Otmos closes naturally:

> “That's Odaeshi.”

Then let the song enter.

## Shot plan

1. Tight frame on strongest first answer — no intro.
2. Quick reaction from the others.
3. Second person's story in the same setup.
4. Otmos gives his own shortest answer.
5. Otmos says “That's Odaeshi.”
6. Song enters; hold on the group for one human reaction/laugh/look rather than a staged pose.

## Edit

- Target 25–40 seconds for first test.
- Cut pauses before each answer.
- Keep small real reactions.
- Subtitle the stories.
- Do not add a branded title animation.
- Do not turn it into a polished music-video clip.

## CTA

> What tried to finish you?

The desired response is personal stories/comments, not “stream now.”

## Proof

Upload the raw best take before editing.

Desk should review whether the strongest opening is already present and tell the artist exactly what to cut/use.

## Fallback

If car access disappears, preserve the same emotional structure in a known quiet location with close seating/framing. Do not throw away the creative hypothesis merely because one production device changed.

---

# Resource-aware generation rules

The Plan Compiler / content brief compiler should receive relevant World Model facts.

When choosing a concept:

1. prefer known available resources;
2. prefer lower-cost execution until evidence justifies spend;
3. do not require professional production by default;
4. treat relatable/unpolished execution as a legitimate creative choice when it fits the concept;
5. ask only when one missing resource fact changes which concept should be selected;
6. include a fallback for fragile resources.

The goal is not “cheap content.”
The goal is **resource-intelligent content**.

---

# Budget behavior

A content brief should include expected/capped spend.

Rules:

- ₦0 is a valid strategic choice, not a missing budget;
- do not spend merely because money exists;
- profile monthly budget is not campaign authorization;
- current Mission-scoped budget is planning context;
- actual external spend remains permission-gated;
- if a paid resource materially improves a proven concept, Desk can propose the spend with expected reason/impact.

---

# Platform behavior

Do not turn the schema into a giant platform template library.

The Manager should select format based on:

- campaign hypothesis;
- artist identity;
- current platform behavior/evidence when available;
- production resources;
- previous results.

Platform conventions can inform execution, but the idea should not reduce to:

> “Use a trending hook and keep it short.”

That fails the swap test.

---

# Content task UI

The normal Task surface should remain recognizable as a Task.

When `execution_brief.kind` is content-related, render structured sections instead of one long text blob.

Recommended order:

1. **What you're making**
2. **Why this now**
3. **Setup** — time / cost / people / location / gear
4. **Hook**
5. **What to say/do**
6. **Shot plan**
7. **Use of the song**
8. **Edit**
9. **Post / CTA**
10. **What to send back to Desk**
11. Start / Done / Move it / I'm blocked

Keep the most important execution detail above the fold.

Do not show internal fact IDs/evidence machinery to the artist.

---

# Today preview

Today should not render the entire production brief.

Example:

**Record “What couldn’t finish us?”**

30–40 min · ₦0 · Otmos + 2 friends · parked car

Start on the strongest story. Odaeshi enters after “That's Odaeshi.”

**Start**

Opening the Task reveals the full brief.

---

# Result/proof types

Content tasks need media-aware proof modes.

Recommended evolution:

- `raw_media`
- `draft_cut`
- `published_url`
- `result_note`

Do not force “Done” based only on an attestation when the task explicitly requires material that Desk needs to review.

The upload/runtime implementation must eventually support video/image result attachments separate from canonical song masters/assets.

Do not misuse `music_assets` as the permanent home for every campaign video.

---

# Storage direction

MVP options:

## Option A — JSONB on Tasks

Add:

- `task_kind text`
- `execution_brief jsonb`

Advantages:

- simplest migration;
- version naturally follows Plan Version/task supersession;
- easy for compiler/finalizer.

Use strict application/schema validation.

## Option B — separate task execution briefs table

Useful later if briefs need independent versions/review history.

Not necessary for first implementation unless the current task table becomes unwieldy.

Recommendation for first slice: **Option A**.

The brief is part of the planned Task and should be superseded with that Task when a new Plan Version replaces the route.

---

# Compiler contract

For a content Task, compiler must either:

1. emit a complete valid content execution brief using known context; or
2. return `needs_context` for one decision-changing missing fact.

It must not emit a vague content Task and defer the creative work to a later artist prompt.

## Content quality rejection rules

Reject output when:

- concept could apply to almost any song;
- hook is missing or generic;
- required resources are not grounded;
- no desired audience behavior exists;
- “use the song” has no actual cue/moment;
- editing instruction is only “keep it engaging”;
- CTA is generic when campaign hypothesis calls for a specific behavior;
- artist is asked to invent script/shot plan;
- script ignores stored creative preference;
- task asks for expensive production without reason/evidence/permission;
- content tries to test several unrelated hypotheses in one post.

---

# Revision quality rules

Manager review should prefer the smallest change that preserves usable work.

Order:

1. approve as-is;
2. edit only;
3. partial pickup/reshoot;
4. full reshoot only if necessary.

This is important for low-resource artists. “Reshoot everything” is a high-cost recommendation and should require a real reason.

---

# Execution-behavior learning hooks

The content loop should create structured evidence for future planning:

- actual time taken;
- rescheduled count;
- blockers;
- resource failures;
- revision count;
- script mode used;
- solo vs collaborator;
- whether the artist completed the task;
- performance/result signal after publish.

Do not immediately convert one outcome into a permanent preference.

A later Execution Behavior Learner can aggregate repeated patterns into World Model `execution.*` facts.

---

# Odaeshi regression ladder

## Failure level 1

> “Create a TikTok around Odaeshi's resilience message.”

Reject: strategy restatement.

## Failure level 2

> “Film yourself talking about a hard time. Use Odaeshi in the background.”

Reject: still generic; artist must direct the creative.

## Failure level 3

> “Sit with two friends in a car and talk about things you survived.”

Better, but incomplete.

## Passing level

The full brief contains:

- hypothesis;
- why car/people setup;
- exact first beat;
- prompts/talking points;
- shot order;
- Odaeshi cue;
- edit behavior;
- CTA;
- expected response;
- raw-media proof;
- fallback;
- time/cost/resources.

The artist can execute it now.

---

# Regression failures

Reject the implementation if any becomes true:

- Mission strategy is copied verbatim into a content Task;
- artist still has to ask what to film;
- the compiler invents people/places/equipment;
- `steps[]` remains the only contract and important creative fields can silently disappear;
- every content idea assumes a professional shoot;
- profile monthly budget is treated as available spend;
- raw capture is not reviewed until a future fake “Manager day”;
- Manager generates an edit/reshoot Task for work it could do automatically;
- revision feedback says only “make it stronger”;
- content Task is generic after swapping artist/song names;
- external posting/spend bypasses permission boundaries;
- campaign video files are incorrectly treated as song master assets;
- the content system becomes a separate calendar/strategy brain outside Missions.

---

# Acceptance bar

For a generated content Task, a reviewer should be able to answer yes to all:

1. Can I picture the exact piece of content?
2. Are the required resources known/realistic?
3. Do I know exactly how it starts?
4. Do I know what the artist says/does?
5. Do I know where the song enters and why?
6. Do I know how to shoot/edit it?
7. Do I know what audience behavior we want?
8. Do I know what to return to Desk?
9. Is there a fallback if a fragile resource disappears?
10. Could the artist make this without another “how?” prompt?
11. Would it still feel specific if compared with a random artist's campaign?
12. Will Desk automatically review and continue when the result arrives?

If any critical answer is no, the content Task is not execution-ready.