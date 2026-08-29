# Artist World Model + Question Engine — acceptance matrix

This matrix is the product-review gate for the World Model slice. It converts the quality lenses into observable behavior and regression requirements.

## North-star experience

The artist should experience:

`Desk has an idea -> Desk needs one thing -> artist answers -> Desk keeps working -> next exact human action appears`

The artist should not experience:

`Desk asks me to build a profile -> I explain my situation -> Desk gives advice -> I ask what next`

## Lens matrix

| Lens | Artist-visible bar | Invisible system behavior | Automatic rejection |
| --- | --- | --- | --- |
| Utility | Question clearly affects current work | Fact is tied to a planning/execution decision | Fact collected only because it might be useful later |
| Low effort | One concise question | Fresh facts/memory/evidence checked first | Questionnaire or repeated question |
| Reliable harness | Answer causes continuation without prompting | Question is linked to one suspended review | Answer exists only in chat text |
| Reasoning quality | Question reveals the idea behind it | Hypothesis + fallback are persisted | Generic “what resources do you have?” |
| Freshness | Desk does not assume old temporary access | Scope + expiry + supersession enforced | Temporary fact silently treated as permanent |
| 11-star feel | Desk turns ordinary resources into practical work | Plan uses the artist's actual world | Artist still has to manage dependencies or decide next step |

## State transition contract

### A. Enough context already exists

Input:

- adaptive review is due;
- fresh operating fact already answers the decision-critical question.

Expected:

1. runner packs the fresh fact;
2. compiler does not ask the artist again;
3. compiler returns `no_change` or `replan`;
4. runtime continues normally.

Failure:

- new duplicate question is inserted.

### B. One fact is genuinely missing

Input:

- adaptive review is due;
- no fresh fact/memory/evidence safely answers it;
- answer materially changes the route.

Expected:

1. compiler returns `needs_context`;
2. exactly one question exists;
3. no replacement tasks/checkpoints/permissions are returned;
4. question includes a concrete hypothesis and fallback;
5. current plan remains active;
6. review becomes suspended;
7. guided Manager question appears in the existing conversation surface.

Failure:

- plan is partially replaced before answer;
- multiple questions appear;
- a second resource UI is introduced.

### C. Artist answers

Expected:

1. artist answer is persisted through existing `contextRequestId + contextAnswers` flow;
2. pending question resolves exactly once;
3. previous active fact for the same scoped key is superseded;
4. new fact receives source, confidence and expiry;
5. exact linked review becomes due again;
6. runtime is nudged automatically;
7. artist does not type “continue.”

Failure:

- answer remains only in conversation history;
- unrelated review is resumed;
- second Mission graph is produced by normal conversation logic.

### D. Artist answers “no”

Expected:

1. `no` is still useful operating context;
2. Manager uses the recorded fallback or known resources first;
3. a second question is allowed only if one new decision-critical fact remains missing.

Failure:

- Mission dead-ends;
- Desk immediately asks a broad inventory question.

### E. Fact expires

Expected:

1. expired fact is excluded from fresh World Model context;
2. if no longer relevant, Desk ignores it;
3. if still decision-critical, Desk may refresh it contextually;
4. old fact remains in history/provenance but is not treated as current truth.

Failure:

- expired car access, budget or availability is silently reused.

## Odaeshi end-to-end acceptance scenario

### Strategy state

- objective: establish Odaeshi as a cultural resilience expression;
- confirmed meaning: resilience, bulletproof toughness, tested but still standing, collective strength;
- broad spend is not justified before participation proof;
- first execution direction is an intimate Tough Skin / “What couldn’t finish us?” response test.

### Manager idea

Desk has a parked-car conversation concept because a car creates a low-cost, close, repeatable setup with two friends.

### Missing fact

Car access for roughly 30 minutes this week is unknown.

### Correct question

> I have a stronger version of the first Odaeshi video if you can use a parked car for about 30 minutes. Can you get access to one this week?

### Yes path

Expected fact:

- domain: `access`;
- scoped to current Mission/task;
- short validity;
- source: user answer.

Expected next work:

- exact shoot action;
- people/resources;
- setup;
- hook/talking points;
- Odaeshi song cue;
- edit treatment;
- desired response/CTA;
- expected result/proof;
- estimated human time;
- no fake Manager calendar work.

### No path

Desk first checks known World Model places/resources and uses the precomputed fallback if possible.

It must not immediately ask:

> What locations do you have available?

unless a specific unresolved location decision genuinely remains.

## Scoped budget acceptance

Profile says the artist has a monthly budget.

This does not authorize Desk to spend or treat that whole amount as available for Odaeshi.

If the first two tests can be executed at ₦0, Desk should normally run those first.

If the next route materially depends on spend, a good question is:

> I can keep the first two tests at ₦0. Before I plan the third one, what can you actually spend on Odaeshi this week?

Expected storage:

- domain: `money`;
- key such as `money.scoped_budget`;
- Mission scope;
- short validity.

## Concurrency acceptance

A `world-model:` answer turn has two systems nearby:

1. normal Manager conversation;
2. suspended adaptive review.

Only the adaptive review owns the pending replan.

The normal conversation path may acknowledge the answer, but it must not independently persist Mission graph decisions, replacement tasks, or another replan from the same answer turn.

Test this explicitly.

## Regression checklist

### World Model

- [ ] one active fact per scoped key;
- [ ] newer answer supersedes previous fact;
- [ ] temporary fact can expire;
- [ ] expired/superseded fact excluded from fresh packet;
- [ ] wrong Mission/task scope rejected;
- [ ] authenticated direct writes are not allowed.

### Questions

- [ ] exactly one question for `needs_context`;
- [ ] question has hypothesis;
- [ ] question has fallback;
- [ ] question maps to allowed fact domain/key/scope;
- [ ] duplicate retry does not duplicate question;
- [ ] already-known fresh fact prevents question;
- [ ] generic resource questionnaire fails contract test.

### Continuation

- [ ] answer resolves pending request;
- [ ] answer persists canonical operating fact;
- [ ] answer resumes exact review;
- [ ] recovery gateway is used for worker nudge;
- [ ] no artist “continue” message required;
- [ ] stale active-plan guard still applies after question wait;
- [ ] normal conversation cannot create a competing graph.

### UX

- [ ] existing guided Manager question surface is reused;
- [ ] active question disappears when answered;
- [ ] user understands why Desk is asking;
- [ ] no giant onboarding form;
- [ ] resulting task can be executed without “okay, but how?”

## Merge bar

Do not merge because the schema exists or because the model can emit a question.

Merge when this sentence is true in the product:

> Desk had a real idea, asked me one thing it genuinely needed, remembered my answer, and carried on managing the work without me prompting it again.