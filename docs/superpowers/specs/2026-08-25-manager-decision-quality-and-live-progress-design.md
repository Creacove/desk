# Manager Decision Quality And Live Progress

## Goal

Make consequential Manager answers commercially rigorous and visibly active without adding a second model call, a new agent system, or latency to ordinary questions.

The implementation has two outcomes:

1. High-stakes choices receive decision-grade analysis instead of generic caution or legal boilerplate.
2. The conversation UI presents the real run and tool progress events the backend already streams instead of a fixed `Manager is working...` message.

## Scope

This is a surgical extension of the existing Manager conversation path. It preserves the current Responses API agent loop, workspace packet, tools, output schema, persistence flow, and normal conversational behavior.

The implementation may change:

- Manager turn classification and per-turn instructions;
- reasoning effort selection;
- user-facing run-step labels and emissions;
- the Manager conversation loading state;
- focused regression and quality-contract tests.

It must not add:

- a second model or critique call;
- a new database subsystem;
- a visible multi-agent workflow;
- raw chain-of-thought or provider reasoning summaries;
- a special-case answer for the `$30,000` master-rights example;
- a heavyweight response format for ordinary questions.

## Expert Lenses

The design applies two public professional lenses without claiming endorsement or direct participation.

### Dina LaPolt: creator-side business and rights advocacy

A useful deal answer must value the exchange, protect the artist's leverage, distinguish commercial judgment from legal diligence, and produce a negotiating position. Legal review is an important boundary at the end of the analysis; it is not a substitute for the analysis.

### John Maeda: AI product simplicity and trust

The product should keep operational complexity behind a simple interface while communicating enough meaningful context to earn trust. The loading experience should show one calm, truthful description of the current work, not a technical log, fake percentage, or internal reasoning transcript.

## Consequential-Decision Detection

Add a small, deterministic classifier shared by the streamed and non-streamed Manager endpoints.

A turn is `decision_grade` when its combined user message and submitted context answers contain both:

1. a decision request or comparison, such as whether to accept, reject, choose, spend, sign, delay, negotiate, continue, license, sell, or commit; and
2. a material stake involving money, rights, ownership, exclusivity, term, control, reputation, timing, or another external commitment.

The detector must be general rather than tied to one deal type or artist. It returns a stable mode and a bounded reason suitable for tests and internal run metadata. Ordinary explanations, greetings, workspace actions, and artifact requests remain in normal mode.

False positives should prefer normal mode. Existing specialized release and document workflows retain their current tool-selection behavior.

## Decision-Grade Instruction Contract

For `decision_grade` turns, append a concise instruction block to the existing Manager instructions. It requires the Manager to:

1. identify the artist's actual objective and immediate need;
2. establish the current artist, catalog, financial, and leverage position from available workspace evidence;
3. separate verified facts, user-provided terms, assumptions, and unknowns;
4. quantify what the artist receives and surrenders;
5. model downside, base, and upside scenarios when numbers materially affect the decision;
6. inspect the mechanics that change value, including scope, ownership versus license, revenue definition, recoupment, deductions, term, extensions, territory, control, partner obligations, accounting, audit, cross-collateralization, reversion, and exit conditions as applicable;
7. compare credible and less expensive alternatives;
8. give a ranked, specific negotiating position;
9. identify unanswered questions capable of changing the recommendation; and
10. give an actionable conditional recommendation.

The instructions must explicitly prohibit treating public popularity, playlist reach, or attention as revenue proof. Estimates must name their assumptions and must not be presented as known artist revenue.

For these turns, the existing normal-answer `1-3 natural paragraphs` constraint is overridden. The Manager may use short headings, bullets, and one compact scenario table when they improve the decision. It should remain direct and avoid a generic memo template when a shorter answer is sufficient.

## Answer Hierarchy

When applicable, a decision-grade response should organize the substance in this order:

1. **Manager's position**: direct recommendation and conditions.
2. **What the move solves**: the immediate objective, runway, or constraint relieved.
3. **Current position**: relevant artist, catalog, leverage, and evidence limitations.
4. **What is surrendered**: rights, control, income, time, flexibility, or positioning.
5. **Economics**: downside, base, and upside scenarios with explicit assumptions.
6. **Terms that change the answer**: only the material mechanics for this decision.
7. **Alternatives**: other ways to reach the same objective.
8. **Our counter**: negotiation priorities in order.
9. **Questions before commitment**: unresolved facts that could reverse the recommendation.

Professional legal, tax, accounting, or wellbeing review appears as a concise boundary after the Manager has provided useful commercial judgment.

## Model And Latency Policy

- Normal turns keep the current model, `medium` reasoning effort, output limits, and tool limits.
- Decision-grade turns use the same selected model with `high` reasoning effort.
- Detection is local and does not create another provider request.
- Tools remain model-selected and limited by the current agent loop.
- Public web research is used only when current external facts could materially change the recommendation.
- A calculator tool is out of scope. Scenario arithmetic remains model-generated with explicit assumptions; a deterministic calculator can be added later only if evaluations demonstrate a recurring accuracy problem.

## Live Progress Experience

The streamed endpoint already emits `run.step`, `tool.started`, and `tool.completed` events, and the client already stores them in `activeRun.steps`. The implementation will use that existing state.

### Backend behavior

Before each provider reasoning pass, emit or maintain a truthful phase label appropriate to the turn:

- normal: `Preparing the answer`;
- strategic/non-decision work: an existing specialized workflow label;
- decision-grade: `Working through the economics and trade-offs`.

Existing tool events continue to temporarily provide more specific labels such as:

- `Checking catalog`;
- `Checking evidence`;
- `Reading Manager memory`;
- `Reviewing prior decisions`;
- `Searching the web`;
- `Preparing Manager answer`.

All labels must be plain, user-facing language. Raw function names and provider mechanics never appear.

### Frontend behavior

Replace the fixed loading sentence in the active Manager conversation with one live status line derived from the latest meaningful run step.

- Show only one line at a time.
- Prefer the most recent running step; briefly showing the most recent completed step is acceptable when no newer running step exists.
- Preserve `aria-live` status semantics.
- Do not show fake percentages, fake precision, elapsed-time promises, or a scrolling technical log.
- When answer text begins streaming, remove the separate loading line and preserve the existing streamed Manager message behavior.
- If no server step is available, fall back to `Manager is working...`.

## Error And Compatibility Behavior

- Stream failures retain the current failed-message and retry behavior.
- A failed tool event may be shown as a concise failed status but must not expose internal error details.
- The non-streamed endpoint uses the same consequential-decision detector and instructions so behavior does not diverge.
- Existing document, song workspace, release-success, permission, source-confidence, and persistence contracts remain authoritative.
- Current conversation and run payloads remain backward compatible; no database migration is required.

## Verification

### Detector tests

Cover positive examples across unrelated decision families:

- master ownership or licensing offer;
- campaign-spend decision;
- touring guarantee;
- brand partnership;
- release-timing commitment.

Cover negative examples:

- a greeting;
- a factual definition;
- a simple catalog question;
- a document creation request;
- an ordinary workspace update.

### Instruction and request tests

Verify that:

- decision-grade instructions require objective, present position, scenarios, mechanics, alternatives, negotiation, and open questions;
- the same contract contains no artist, `$30,000`, or Niniola-specific language;
- decision-grade calls use `high` reasoning;
- normal calls remain `medium`;
- no second provider request is introduced.

### Quality fixtures

Use representative prompts for the five decision families. A decision-grade answer is unacceptable if it:

- jumps to a verdict without analyzing the objective;
- treats public attention as revenue evidence;
- omits opportunity cost or scenario assumptions when economics matter;
- ignores applicable deal mechanics;
- gives no concrete negotiation position;
- hides material uncertainty; or
- substitutes professional-review boilerplate for management judgment.

Tests should enforce the instruction contract deterministically. A live model evaluation may supplement, but must not replace, repeatable repository tests.

### Progress tests

Verify that:

- streamed run and tool events continue to populate `activeRun.steps`;
- the conversation UI shows the latest meaningful step instead of the fixed sentence;
- raw tool names do not render;
- the loading line disappears once a streamed Manager message exists;
- the fallback remains available when no step has arrived;
- accessibility status semantics remain intact.

### Final verification

Run the focused Manager agent-loop, conversation-stream, context, turn-contract, UI, and new decision-quality tests, followed by the full test suite if focused verification passes.

## Delivery

Implementation occurs directly on `main` as authorized. Only task-related files are committed. Existing unrelated untracked Playwright artifacts are left untouched. After tests pass, push the implementation commits to `origin/main`.
