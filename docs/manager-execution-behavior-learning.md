# Manager Runtime — execution behavior learning

## Product contract

Over time, Desk should get better at assigning work to **this artist**, not merely better at understanding music strategy.

The artist should notice that Desk gradually learns things like:

- I finish 20-minute tasks but postpone two-hour shoots.
- I work faster when friends are involved.
- I usually respond after 4 PM.
- I dislike memorized scripts but execute loose talking points well.
- I repeatedly miss tasks that require long travel.
- I can reliably edit simple phone footage myself.

The product should use these patterns to make future plans more executable.

The target feeling is:

> **Desk knows how I actually work.**

This is different from static preference memory and different from judging the artist's personality.

---

# Product-quality lenses

## Lens 1 — utility

Learn only behavior that can improve future execution decisions.

Useful learned patterns affect:

- task duration;
- task size;
- timing/window;
- collaborator structure;
- production complexity;
- travel burden;
- proof mode;
- reminder cadence;
- sequencing;
- fallback design.

Do not create behavior labels that do not change work.

## Lens 2 — user effort

The artist should not fill in a questionnaire about productivity style.

Desk learns primarily from actual runtime events:

- started;
- moved;
- completed;
- blocked;
- result submitted;
- revision required;
- reminder response;
- resource failure;
- task duration;
- time of action.

Artist-stated preferences can seed the model, but observed patterns should be learned quietly and cautiously.

## Lens 3 — context/memory

Execution behavior belongs in the Artist World Model only after enough evidence exists.

Examples of potential canonical facts:

- `execution.preferred_task_duration`
- `execution.collaborative_completion_advantage`
- `execution.best_response_window`
- `execution.long_travel_risk`
- `execution.content_script_mode`

These are not one-event memories. They are aggregated interpretations with provenance.

## Lens 4 — reasoning quality

A good behavior learner separates:

- one-off circumstance;
- repeated pattern;
- actual preference;
- structural constraint.

Example:

One two-hour shoot missed because the artist was sick is not evidence that the artist cannot handle long shoots.

Three long solo shoots repeatedly moved while short collaborative shoots complete on time may support a planning hypothesis.

## Lens 5 — runtime/harness

Learning should happen as a downstream Manager process from durable execution events.

Do not require the user to ask:

> “What have you learned about how I work?”

The runtime should update behavior evidence after relevant task events and make fresh high-confidence patterns available to future planning.

## Lens 6 — autonomy

Desk may automatically adapt low-risk planning choices from learned behavior:

- make tasks smaller;
- prefer known productive time windows;
- avoid unnecessary travel;
- prefer collaborative setup if strongly supported;
- choose talking points over scripts if artist-confirmed preference exists.

Desk should not silently make high-impact artistic or financial decisions from behavioral patterns.

## Lens 7 — three clocks

Behavior learning is Manager machine work.

It does not consume calendar days and should not appear as a user Task.

## Lens 8 — execution quality

The purpose of learning is not scoring the artist. It is making human Tasks more realistic.

A future plan should become more specific:

Bad:

> Film three videos this weekend.

Better after learning:

> Saturday: record two 20-minute videos with the same two friends in one setup. Do not schedule the third concept until Desk reviews those two.

## Lens 9 — product coherence

The learner produces evidence/World Model facts used by the same Plan Compiler.

It does not create a second recommendation system.

## Lens 10 — trust

Execution behavior can feel personal. Keep it narrow and observable.

Do not infer:

- laziness;
- motivation level;
- mental-health state;
- personality diagnosis;
- intelligence;
- reliability as a moral trait.

Use neutral operational language:

> “Recent long solo shoots have been moved more often than short collaborative shoots.”

Not:

> “The artist is unmotivated.”

## Lens 11 — 11-star feeling

The artist should experience better plans, not a creepy productivity scorecard.

The best evidence of this feature is that the next Task simply fits better.

---

# Observation model

The learner consumes durable runtime observations rather than raw chat speculation.

Potential observations:

```ts
type ExecutionObservation = {
  taskId: string;
  missionId: string;
  taskKind: string;
  plannedMinutes?: number;
  actualMinutes?: number;
  startedAt?: string;
  completedAt?: string;
  availableFrom?: string;
  deadline?: string;
  moveCount: number;
  blockedCount: number;
  reminderCount?: number;
  ownerRole: string;
  collaboratorCount?: number;
  requiredTravel?: boolean;
  locationType?: string;
  costBand?: string;
  scriptMode?: string;
  resultOutcome?: string;
  revisionCount?: number;
  sourceFactIds?: string[];
};
```

Not every field must exist in the MVP. The contract is that conclusions should be grounded in observable operational events.

---

# Pattern candidates

## Task size

Question:

> What amount of work does the artist consistently complete in one sitting?

Potential finding:

- tasks estimated 15–30 minutes complete at a materially higher rate than tasks above 90 minutes.

Planning effect:

- split long work into smaller natural chunks when doing so does not create unnecessary overhead.

Do not fragment everything mechanically.

## Collaboration

Question:

> Does execution improve when another person is involved?

Potential finding:

- collaborative content tasks complete more reliably than solo capture.

Planning effect:

- prefer batch shoots with known collaborators for important content tests when appropriate.

Do not conclude this from one successful shoot.

## Time window

Question:

> When does the artist actually start/respond to work?

Potential finding:

- most execution actions happen after 16:00 local time.

Planning effect:

- reminder delivery and realistic start windows may favor late afternoon/evening.

Do not create a rigid rule if behavior varies by day/context.

## Travel/mobility burden

Potential finding:

- tasks requiring cross-city travel are repeatedly moved.

Planning effect:

- cluster location-based work;
- choose known nearby resources when creative value is comparable;
- give more lead time for travel-dependent actions.

## Creative production mode

Potential finding:

- content using loose talking points completes with fewer revisions than verbatim scripts.

Planning effect:

- default to talking-point briefs unless a specific format requires verbatim delivery.

Artist-confirmed preference should outrank weak behavioral inference.

## Resource fragility

Potential finding:

- borrowed specialist resources repeatedly cause blockers.

Planning effect:

- include a fallback from the beginning;
- avoid making the whole route depend on one fragile resource unless the creative upside justifies it.

---

# Confidence model

Do not persist a strong execution pattern after one observation.

Recommended confidence ladder:

### Candidate

1–2 relevant observations.

Use internally as a hypothesis only. Do not materially constrain future planning yet.

### Emerging

3+ relevant observations with a consistent direction and no strong contradiction.

May influence low-risk plan choices with a soft preference.

### Established

Repeated pattern across multiple Missions/tasks and time periods, or artist-confirmed behavior.

May become a canonical World Model `execution.*` fact with medium/high confidence.

Exact statistical thresholds can evolve. The important product rule is **no one-event overfitting**.

---

# Recency and decay

Execution behavior changes.

A pattern should carry:

- observation count;
- first observed;
- last observed;
- confidence;
- contradiction count;
- relevant task kinds;
- optional decay/refresh window.

Recent behavior should normally outweigh old behavior when enough evidence exists.

Do not let the artist's first month permanently define how Desk plans years later.

---

# Contradiction handling

Example:

Old pattern:

> Artist rarely completes solo talking-head content.

New evidence:

> Five recent solo story videos completed successfully after the format changed to loose prompts.

Desk should update the interpretation rather than retain both as equal active truth.

Potential new conclusion:

> The problem was scripted format, not solo recording.

This is why behavior learning should preserve observations/provenance, not only a final label.

---

# Storage direction

Do not immediately create dozens of permanent `execution.*` facts.

Recommended architecture:

## Raw observations

Use existing durable runtime data where possible:

- task state events;
- task results;
- reminder events;
- operating events;
- Task metadata/execution brief;
- Mission/plan context.

Avoid duplicating raw events into another table unless analytics/query performance requires it.

## Aggregated pattern record

A later implementation can use either:

1. `artist_operating_facts` with metadata containing observation summary; or
2. a dedicated internal `execution_behavior_patterns` table if pattern lifecycle becomes complex.

For early implementation, World Model facts are sufficient if metadata includes provenance and evidence count.

---

# Pattern fact shape

Conceptual:

```json
{
  "domain": "execution",
  "factKey": "execution.preferred_task_duration",
  "scope": "artist",
  "displayValue": "Short 15–30 minute execution blocks have completed more reliably recently.",
  "confidence": "medium",
  "metadata": {
    "observationCount": 7,
    "supportingTaskIds": ["..."],
    "contradictionCount": 1,
    "firstObservedAt": "...",
    "lastObservedAt": "...",
    "appliesToTaskKinds": ["content_capture"]
  }
}
```

Do not expose raw internal scoring to the artist by default.

---

# Planner usage rules

A behavior pattern is a preference/constraint input, not a command.

The Plan Compiler should ask:

1. Does this pattern apply to this task kind/context?
2. Is it fresh/confident enough?
3. Does adapting to it preserve the strategic objective?
4. Is there contradictory current context?
5. Would following it create worse tradeoffs?

Example:

An artist usually avoids long shoots, but a rare one-hour studio performance might still be the right move if the opportunity is unusually valuable and confirmed.

Desk should adapt intelligently, not optimize for minimum effort at all costs.

---

# Reminder adaptation

Behavior learning can later improve reminder timing.

Example:

If the artist consistently acts between 17:00–20:00 and ignores morning nudges, Standard/Stay-on-me reminder modes may shift soft reminders toward that window.

Hard deadline reminders should still respect the actual deadline.

Do not hide deadline changes behind behavior optimization.

---

# Odaeshi example

Suppose over several weeks:

- three 20–35 minute collaborative Odaeshi shoots complete on time;
- two 2-hour solo capture tasks are moved repeatedly;
- artist-confirmed preference says loose prompts feel more natural than scripts;
- evening tasks start more reliably than morning tasks.

A future Odaeshi phase should not say:

> Record five videos this weekend.

A better route might be:

> Saturday evening: use the same two friends and one location to record two 25-minute concepts. Desk will review both before deciding whether a third shoot is worth scheduling.

The improvement comes from combining:

- strategy;
- resource graph;
- observed execution behavior;
- immediate Manager review.

---

# User-facing behavior

Normally, do **not** add a dashboard called “Your productivity profile.”

The learning should manifest through better work.

When explanation is useful, keep it concrete:

> “I kept this shoot to 30 minutes because the last few shorter group shoots have been easier to get done. We can add another concept after I review this one.”

This is preferable to opaque personalization and preferable to creepy scoring.

The artist can always disagree and redirect Desk.

---

# Safety / dignity rules

Never convert execution behavior into moral judgment.

Prohibited internal/user-facing labels include things like:

- lazy;
- unreliable person;
- low motivation;
- undisciplined;
- difficult;
- poor work ethic.

Use event-grounded operational language only.

Do not infer sensitive personal conditions from schedule or completion behavior.

---

# Regression failures

Reject the learner if any becomes true:

- one missed Task becomes a permanent behavior fact;
- artist must complete a productivity questionnaire;
- old patterns never decay;
- behavior facts override explicit current constraints/preferences;
- Planner treats learned preference as an absolute prohibition;
- system creates moral/personality judgments;
- artist sees a score instead of better work;
- behavior learner becomes a separate planning engine;
- reminder optimization silently changes real deadlines;
- the product learns from Manager-owned machine work as if it were artist behavior;
- observations from one team member are incorrectly generalized to another person's execution style.

---

# Acceptance bar

A reviewer should be able to say:

1. The pattern is grounded in repeated real execution events.
2. It changes a concrete future planning choice.
3. It is scoped to the right person/task kinds.
4. It has recency/confidence/provenance.
5. Contradictory new behavior can update it.
6. It never labels the artist morally.
7. It reduces execution friction without weakening strategy.
8. The artist experiences a better plan, not more profile maintenance.

The success metric is not “how many behavior facts did Desk learn?”

It is:

> **Does Desk increasingly assign work this artist actually completes?**