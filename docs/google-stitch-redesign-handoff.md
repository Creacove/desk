# Google Stitch Redesign Handoff: Other Sounds AI Record Label

Document purpose: UI/UX redesign handoff for Google Stitch  
Product: Other Sounds AI Record Label  
Prototype URL during local dev: `http://127.0.0.1:5173/`  
Current prototype source of truth: `src/prototype/AiLabelPrototype.tsx`
PRD reference: `docs/ai-record-label-prd.md`  
Date: May 12, 2026

## Current Prototype Snapshot

This document now reflects the prototype after the latest design and UX pass. The current app is no longer asking Stitch to solve an unresolved visual direction from scratch; it is documenting the live prototype contract so any future redesign keeps the product model intact.

Current visible contract:

- Brand in the UI chrome: `Ordersounds`.
- First-run flow: `Step 1 / Identity` -> `Step 2 / Context` -> `Enter Workspace`.
- Setup collects Spotify identity plus artist context and warns about missing private analytics, save rate, payouts, and conversion.
- Post-setup sidebar: `Label HQ`, `Staff`, `Missions`, and bottom-pinned `Settings`.
- Settings currently opens the Artist Profile workspace.
- Label HQ contains: page header, `Today's Brief`, `The Staff`, `Active missions`, and `Flagged for you`.
- `Today's Brief` is fully visible narrative content with one daily directive and supporting evidence access.
- `The Staff` shows Manager online plus Marketing Lead, Sync & Deals, Touring Agent, and Finance/Rights locked.
- `Flagged for you` contains budget approval, Spotify for Artists CSV/evidence gap, and 72-hour review.
- Evidence, review, agent source readiness, mission records, tasks, tests, and briefs remain contextual surfaces, not top-level navigation.

## 1. What Stitch Is Being Asked To Do

Redesign or extend the full prototype experience for an AI-native record label product. Use the current prototype as the source of truth for product flow, content, required surfaces, and current light-mode visual direction.

The current prototype is moving toward a serious, premium, operational AI workspace for an artist's career. Future design work should refine this direction rather than reverting to a generic dashboard, agent grid, newspaper brief, or chatbot shell.

The goal is not to make it look more decorative. The goal is to make it feel more natural, spatially intelligent, useful, and product-grade.

## 2. Product In One Sentence

Other Sounds AI Record Label is a digital record label team that watches an artist's career signals, explains what matters, helps decide what to do next, and creates the work needed to move the artist forward.

## 3. What The Product Is Not

It is not a generic chatbot.

It is not a Spotify analytics dashboard.

It is not a BI dashboard.

It is not a social media reporting tool.

It is not a newspaper-style briefing product.

It is not a grid of agents.

It is not a collection of cards for the sake of cards.

## 4. Desired Product Feeling

The user should feel:

- "The label already knows what is happening with my artist today."
- "I can see what matters without reading a report."
- "When I talk to the Manager, I am continuing real operational work."
- "Every answer creates or updates something useful."
- "This feels like an AI-native workspace, not a dashboard with a chat box."

The interface should feel premium, focused, calm, and operational. It should have enough density to feel useful, but not so much density that it becomes a control room full of widgets.

## 5. Core Design Problem To Solve

The current design is closer to the intended light-mode operating-room direction, but future work still needs to keep it from becoming a stack of decorative cards or a generic AI dashboard.

The redesign should solve these issues:

- Reduce the feeling of "card after card after card."
- Replace decorative empty panels with purposeful operating surfaces.
- Use space intelligently, especially in the first viewport.
- Make hierarchy obvious without relying only on huge headlines.
- Make conversational flows feel like persistent work threads, not one-off prompts.
- Make missions, tests, tasks, briefs, evidence, and mission records feel connected to the same Manager decision.
- Make the app feel AI-native through behavior, continuity, and interaction patterns, not through flashy decoration.

## 6. Primary Information Architecture

The product has four durable post-setup navigation items:

1. Label HQ
2. Staff
3. Missions
4. Settings

Label HQ is the daily operating room. It is the first useful destination after setup. It belongs to the whole label system, not only the Manager.

Manager Office is still an important room, but it is reached through the AI Manager agent/action inside Label HQ. It should not be a top-level sidebar item because that makes the Manager feel more important than the rest of the label team.

Supporting workspaces branch from those two zones:

- Conversation Thread
- Manager Run / Investigation
- Decision Package
- Missions Workspace
- Tasks Workspace
- Test Lab
- Briefs Workspace
- Locked Agent Workspace
- Review / What Changed inside Mission Record
- Evidence Drawer
- Mission Record Drawer
- Work Draft Drawer

## 7. Current Demo Artist And Data

Use this artist context in the redesign:

- Artist: Sable Day
- Genre: Alternative R&B
- Market: Atlanta
- Active release: Night Bus
- Current goal: Validate the single before scale spend
- Budget context: $5,000
- Stage: Developing artist with breakout signals
- Social handles: TikTok, Instagram, YouTube, X as `@sableday`

The prototype uses polished mock data. Do not design for backend setup or live integration yet.

## 8. Active And Locked Agents

Only the AI Manager is active in V1.

Visible locked agents:

- Marketing Lead
- Sync & Deals
- Touring Agent
- Finance/Rights

Agents should be visible as the label team, but the first screen should not feel like an agent directory. The agent bench should be compact, secondary, and accessible.

Each agent owns its own sources. Do not design a global Evidence navigation item as a primary destination. Inside each agent room, show compact source readiness: connected sources, minimum required sources, optional sources, and upload/connect actions. Finance/Rights needs royalty statements and split sheets. Sync & Deals needs rights clarity and pitch assets.

## 9. Flow Overview

### Entry Flow

The user starts by choosing or confirming the artist identity, then adds basic operating context.

Required setup surfaces:

- Spotify artist identity
- Artist name
- Genre
- Market
- Active release
- Current goal
- Budget
- TikTok, Instagram, YouTube, and X handles
- Clear note that private analytics are not connected yet

After setup, the user enters Label HQ.

### Label HQ

Label HQ is the main daily operating room.

Required content:

- Compact persistent sidebar with Label HQ, Staff, Missions, and Settings only
- Page header: Label HQ / Your daily operating picture
- Today's Brief with artist, active release, market, current operating read, and Talk to Manager
- One daily directive inside the brief
- Active missions
- Flagged for you queue
- The Staff agent bench
- Contextual evidence/source affordances
- Action to talk to the Manager

Label HQ should answer: "What is happening with this artist today, and what should I pay attention to?"

It should not feel like a blog post, article, or static report. It should feel alive and operational.

### Manager Office

Manager Office is for talking to the AI Manager and making decisions.

Required content:

- Manager scope
- Required Manager context questions
- Ask Manager composer
- Recent Manager conversations
- Continue conversation affordance
- Manager-specific decision flow

Manager Office should answer: "What do I need to ask the Manager, what context does the Manager need, and what thread am I continuing?"

It should not contain the morning brief, active missions list, Flagged for you queue, or broad label-wide operating context. Those belong in Label HQ.

### Conversation Threads

Recent conversations must open real threads. Clicking a recent conversation should not merely populate the Ask Manager input. It should open the selected conversation history.

Required behavior:

- Show a list of previous conversations.
- Open selected conversation.
- Show existing messages.
- Show work created from that conversation.
- Include a follow-up composer at the bottom of the thread.
- New follow-ups stay inside that conversation.
- The thread can link to related mission/work.

### Manager Run / Investigation

After the user asks the Manager a serious decision question, the app shows the Manager investigating.

Required content:

- The user question
- Investigation steps
- Live context being checked
- Clear sense that the Manager is using evidence and playbooks, not just generating text

This can be redesigned as a transient process screen, inline state, or split-view state, but the user must understand that the Manager is working through evidence.

### Decision Package

The Manager answer must be more than chat.

Required content:

- The user question
- Direct recommendation
- Budget/action numbers
- Why this recommendation
- Rejected options
- Work created
- Evidence access
- Mission link
- Continue thread link
- Schedule review action

This screen should feel like a decision packet that the artist team can act on.

### Missions Workspace

Missions are live operating objects created from Manager decisions.

Required content:

- Mission list
- Selected mission detail
- Mission health/progress
- Mission summary
- Work lanes:
  - Tasks
  - Test Lab
  - Briefs
  - Record
- Current operating read for the mission

The visual problem to solve: the current mission workspace still feels like a left list plus more cards. Redesign it so selecting a mission clearly changes the right-side operating object and the work lanes feel like parts of one mission.

### Tasks Workspace

Tasks are owner-ready work.

Required content:

- Task title
- Owner
- Deadline
- Approval state
- Purpose
- Dependency
- Steps
- Linked evidence
- Completion note
- Approve and Mark Done actions

Important behavior:

- Some tasks require approval before they can be marked done.
- Completion should feel like operational progress, not just checking a generic todo.

### Test Lab

Test Lab must feel like a real test, not a decorative page.

Required content:

- Hypothesis
- Budget cap
- Decision rule
- Signals watched
- Intermediate checkpoints
- Approval state
- Actions: Approve cap, Edit amount, Reject

The test should feel measurable and decision-oriented. It should not feel like a marketing plan card.

### Briefs Workspace

Briefs are helpful agent-to-agent communications prepared by Manager runs, specialist runs, or mission activity. They should feel like humans working together: one agent asks for a run, another shares a finding, or a specialist flags a useful source gap.

Do not design Briefs as a stack of small field cards. They should be prose-led operational messages with clear sender/recipient, source basis, and next action, so a human can understand the exchange without parsing boxed metadata.

Required content:

- Sender -> recipient, for example Manager -> Marketing Lead or Finance/Rights -> Manager
- Brief type
- Subject
- Message
- Source basis
- Recommended next action
- Linked mission
- Status or approval/export actions

### Locked Agent Workspace

Locked agent pages explain what a specialist can do when unlocked and what sources are needed. Sources should live inside the agent surface and remain compact; they should not take over the page.

Required content:

- Agent purpose
- Available Manager-prepared output today
- Source readiness
- Connected sources
- Required sources
- Optional sources
- Upload/connect actions
- Specialized tools
- Manager-prepared context
- Action: Ask Manager to prepare brief

### Review / What Changed

Review is a follow-up moment when new evidence changes or confirms the Manager recommendation. It should be treated as part of the mission record, not as a durable top-level navigation item.

Required content:

- Review trigger
- What changed
- What did not change
- Previous recommendation
- Manager comparison
- Actions: open updated mission, run review, snooze review

### Settings / Artist Profile

Settings is the durable lower-sidebar item in the current prototype. It currently opens the Artist Profile workspace, where the user can inspect the active artist operating profile, connected sources, current goal, budget context, and known limitations.

Do not replace Settings with top-level Notifications unless the prototype intentionally changes again. Attention and review events currently live in `Flagged for you` and contextual workspaces.

### Evidence Drawer

Evidence is a supporting proof surface. It can be dense.

Required content:

- Evidence ID
- Source
- Source kind
- Evidence type
- Subject
- Time window
- Metric/value
- Lens
- Freshness
- Confidence
- Provenance
- Raw snapshot reference
- Limitation

Evidence should not dominate the morning brief or Label HQ. It should be accessible when the user wants proof.

### Mission Record Drawer

Mission records are living operating memory. This is what the AI reads to understand a mission before it answers follow-up questions or recommends the next move.

Do not design Mission Record as a grid of boxes. It should feel like a readable mission intelligence note: what happened, what changed because of tasks/tests/briefs, what is unresolved, and what the next useful move is. Evidence and audit details can sit below the narrative.

Required content:

- Mission goal/current state
- Task/test/brief updates
- Review events
- Blockers
- Next recommendation
- Final call
- Confidence
- Evidence used
- Alternatives rejected
- Missing evidence
- What would change the decision
- Review date
- Override state
- Quality gate result
- Linked mission

### Work Draft Drawer

Work drafts are generated outputs that are not automatically sent.

Required content:

- Draft type
- Draft title
- Draft body
- Clear status that nothing is sent automatically

## 10. Key Interaction Rules

- Label HQ is the first useful screen after setup.
- After setup, the persistent sidebar should stay small and contain only Label HQ, Staff, Missions, and Settings.
- Manager is an agent/action inside Label HQ, not a top-level sidebar destination.
- Evidence is contextual to the agent, mission, brief, or decision that uses it.
- Review belongs inside the mission record.
- Talk to Manager opens Manager Office.
- Recent conversations open conversation threads, not composer prefill.
- Follow-up questions happen inside selected conversation threads.
- Ask Manager should be blocked or guided until required context questions are answered.
- Manager outputs should create or link to work products.
- Missions should connect decision, tasks, test, briefs, and record.
- Evidence and sources should be available but secondary.
- Locked agents should be visible but not visually dominant.
- Human approval is required for expensive, external, sensitive, legal, financial, or reputation-affecting actions.

## 11. Design Direction

The product should feel like an AI-native operating room for an artist's career.

Recommended direction:

- Premium but not luxury-for-luxury's-sake.
- Calm but not empty.
- Dense enough to feel useful.
- More product workspace than editorial publication.
- More operational console than marketing dashboard.
- More living workspace than static report.

Avoid:

- Giant editorial headlines on every screen.
- Too many standalone cards.
- Big decorative panels with little useful information.
- Agent directory as homepage.
- Dashboard metric tiles as the primary pattern.
- Newspaper/magazine layout.
- Generic SaaS card grids.
- Purple-gradient AI aesthetic.
- Overly playful chat UI.

Use:

- Strong spatial hierarchy.
- Purposeful density.
- Clear object relationships.
- Persistent context.
- Inline status and evidence affordances.
- Compact navigation between related artifacts.
- Contextual source readiness inside agent rooms.
- Progressive disclosure for dense proof.
- Subtle motion only where it clarifies state changes.

## 12. Visual System Notes

The current direction is a premium light-mode operating room, especially for Label HQ. Stitch may improve or reinterpret the visual system, but preserve the feeling of a serious music-tech operating product and the current Ordersounds information architecture.

Suggested baseline:

- Light, warm off-white workspace with strong contrast.
- White/translucent panels with subtle borders and shadows.
- Ordersounds purple as the disciplined primary accent, with warm orange and green reserved for specific status moments.
- Sharp typography hierarchy, but less editorial.
- Smaller, more purposeful headings inside work surfaces.
- Cards only when they represent real objects: mission, task, evidence item, conversation, memo, staff member, or flagged item.
- Use layout, grouping, and affordances instead of wrapping everything in cards.

The product should not look like a crypto dashboard, analytics dashboard, or generic AI assistant.

## 13. Screen-Level Redesign Priorities

Highest priority:

1. Label HQ first viewport
2. Manager Office
3. Conversation thread experience
4. Missions workspace
5. Decision package

Second priority:

1. Test Lab
2. Tasks
3. Briefs
4. Evidence and mission record drawers
5. Setup

## 14. Specific Current UX Concerns

The current Label HQ establishes the right operating-room model: page header, Today's Brief, The Staff, Active missions, and Flagged for you. Future redesign work should refine that model without replacing it with a generic dashboard, agent directory, or notification center.

Questions to solve:

- What should the first thing the artist sees be?
- How much artist identity is needed before the operating read?
- Where should Talk to Manager live?
- How should The Staff remain visible without feeling like a homepage feature?
- How can the morning brief be digestible without becoming editorial?
- How should Flagged for you and Active missions show up as active work instead of more panels?

The current Manager Office is cleaner, but still may feel like a structured form plus chat. Stitch should make it feel like a Manager room where context, conversations, and decisions naturally live together.

Questions to solve:

- How should required Manager context questions appear?
- Where should the Ask Manager composer live?
- How should recent conversations appear before and after context is ready?
- How should the user understand that conversations become work?
- How should thread continuation feel persistent and natural?

The current mission workspace has the right content but not enough visual objecthood. Stitch should make a mission feel like a selected operating object, not another page of cards.

## 15. Core Demo Path To Preserve

Design for this demo path:

1. User lands on Connect Artist.
2. User sees Step 1 / Identity with a selected Spotify identity and continues to Context.
3. User sees Step 2 / Context, reviews artist fields, sees the private analytics warning, and enters the workspace.
4. User enters Label HQ.
5. User sees the daily operating state for Sable Day.
6. User sees Today's Brief, the operating directive, The Staff, Active missions, and Flagged for you.
7. User opens supporting evidence from Label HQ.
8. User clicks Talk to Manager.
9. User answers Manager required context questions.
10. User sees recent conversations and can open a previous thread.
11. User asks: "We have $5,000. What should we do this month?"
12. Manager investigates.
13. Manager returns a decision package.
14. User opens the created mission.
15. User opens tasks, test lab, briefs, evidence, and mission record.
16. User returns to conversation thread and asks a follow-up.
17. User opens review/what changed when new evidence arrives.

## 16. Prototype Content That Should Remain

Keep these core example decisions and artifacts:

- Recommendation: use $1,850 for a 10-day Night Bus validation test.
- Hold back $2,250 until the 72-hour signal review.
- Do not fund full video or full paid-media push yet.
- Mission: Validate Night Bus before scale spend.
- Task: Approve capped campaign test budget.
- Task: Post three Night Bus hook variations.
- Task: Track saves, clicks, follows, and demand comments.
- Task: Upload Spotify for Artists CSV.
- Test: 10-day validation test.
- Review point: 72-hour signal review.
- Evidence limitations: private Spotify saves, source-of-stream, smart-link clicks, royalty statements, and rights metadata are missing.

## 17. What To Deliver From Stitch

A redesigned UI concept for the full prototype.

Useful deliverables:

- High-fidelity screen designs for desktop.
- Responsive/narrow viewport direction.
- Component system or style guide.
- Screen-by-screen interaction notes.
- Navigation model.
- State examples:
  - setup incomplete
  - Label HQ normal state
  - Manager context incomplete
  - Manager context ready
  - conversation thread open
  - Manager running investigation
  - decision package created
  - mission selected
  - test approval pending/approved/rejected
  - evidence drawer open

## 18. Quality Bar

The redesign is successful if:

- The first screen no longer feels like an agent directory.
- Label HQ feels like the artist's daily operating room.
- Manager Office feels like a place to talk through decisions, not a generic chat page.
- Conversations feel persistent and valuable.
- Work artifacts feel connected to Manager decisions.
- Missions feel like live operating objects.
- Evidence is credible but not visually dominant.
- The experience feels AI-native without leaning on obvious AI tropes.
- The interface feels world-class enough for an artist, manager, or small label to believe this product should exist.

## 19. Short Prompt Version For Stitch

Redesign the Other Sounds AI Record Label prototype. It is an AI-native record label workspace for one artist, Sable Day. The current prototype has the right product flow but feels too editorial, too card-heavy, and not yet like a world-class operating product.

Create a premium, light-mode music-tech operating room experience. Label HQ should be the first useful screen after setup and should show what is happening with the artist today: Today's Brief, one operating directive, The Staff, Active missions, Flagged for you, and contextual evidence/source affordances. Manager Office should focus only on Manager conversations, required context questions, Ask Manager, recent conversations, thread continuation, and decision packages.

Do not make the homepage an agent grid. Do not make the morning brief a dashboard of metric cards. Do not make the experience feel like a newspaper, BI dashboard, or generic chatbot. Make it feel like the artist has entered a serious AI record label that already knows what is happening and can help decide what to do next.

Preserve the demo flow: setup, Label HQ, Manager Office, conversation thread, investigation, decision package, mission, tasks, Test Lab, briefs, review inside mission record, evidence drawer, mission record, and locked agent pages.
