# Manager release workflow regression matrix

This matrix is the product acceptance surface for open-chat release work. Wording is intentionally varied because routing must not depend on one exact phrase.

| Phase | Artist intent | Expected durable work | Expected turn surface | Must never appear |
|---|---|---|---|---|
| Pre-release | “Is this actually ready to release?” | None unless a real plan change is made | Release-success assessment | Stale package, unrelated opportunities |
| Pre-release | “Move the release to the 24th” | Approval preview only until user approves | Release-success/date approval | Applied-date claim before approval |
| Pre-release | “Build the release plan” | One linked release mission when warranted | Mission/task receipts | Duplicate mission |
| Campaign | “Create an EPK” | Canonical EPK document | EPK receipt/open exact document | Release Narrative, generic Song ready, decision package |
| Campaign | “Write the press release” | Canonical press-release document | Document receipt | Release Narrative, stale package |
| Campaign | “Give me a proper artist bio/one-sheet” | Canonical requested document(s) | Document receipt(s) | Internal campaign scaffolding |
| Campaign | “Prepare the Spotify pitch” | Canonical pitch document | Pitch receipt | Claimed submission/contact |
| Campaign | “Make a content plan/release calendar” | Canonical requested document(s) | Document receipt(s) | Decision package unless explicitly requested |
| Metadata | “Prepare credits/lyrics/distributor notes” | Canonical requested document(s) | Document receipt(s) | Unrelated campaign surfaces |
| Opportunities | “Who should we pitch this to?” | Source-backed playlist/press targets | Opportunity surface | Release-date UI, stale package |
| Opportunities | “Record that they replied/declined” | Opportunity outcome update | Opportunity surface | Invented outreach or submission |
| Sharing | “Prepare a private press package” | Frozen revocable share package | Share preparation | Claim that anything was sent |
| Post-release | “The song is out. What do we do now?” | Usually analysis/next action; mission change only if warranted | Tool-backed post-release answer | Pre-release master/split/delivery gates |
| Post-release | “Where is momentum coming from?” | Evidence/Manager-read update as needed | Chat/native evidence surface | Generic release-readiness checklist |
| Decision | “Create a decision package for the team” | Decision package | Decision-package surface | Extra package on later unrelated turns |
| Conversational | “What would you do next?” | None unless action is warranted | Chat or tool-derived surface | Automatic decision package |

For every row: only artifacts attributable to the current turn may render; internal artifacts are never artist-facing; logical duplicates collapse to one canonical receipt; successful document actions navigate using the canonical document ID; failures do not inherit prior-turn UI.
