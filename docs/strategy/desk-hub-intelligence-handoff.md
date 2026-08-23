# Desk Hub Intelligence Upgrade
## CTO / Product Handoff for Codex

**Product:** OrderSounds / Desk  
**Area:** Hub intelligence, autonomous music-industry execution, record servicing and playlist opportunity workflow  
**North-star quality bar:** The experience should feel valuable enough that an independent artist or artist team could rationally pay **$1,000/month** because Desk replaces meaningful hours of senior manager, streaming strategist, release manager, researcher, coordinator and operator work.

---

## 1. Why this document exists

Desk currently produces answers that are intelligent and research-heavy, but the Hub still behaves too much like a general-purpose AI assistant: the user asks for a job, Desk returns information, then the user has to prompt again for the next obvious part of the work.

That is not the product we are building.

Desk is a **music-industry operating system for artists and their teams**. The user should be able to state the job in the language a working artist, manager, label, publisher, release manager or music marketer would naturally use. Desk should understand the professional outcome behind that request, gather the context it already has, retrieve what it does not have, perform the work, make judgment calls, prepare the outputs, and present the user with a decision-ready result.

The key behavioral shift is:

> **The user asks for an outcome. Desk should infer and execute the professional workflow behind it.**

Example:

> User: “Find playlist opportunities for this song.”

Desk must not interpret this as:

> “Return a list of playlist names.”

Desk should interpret it as:

> “Run a record-servicing / playlist-opportunity campaign for this record: understand the song, understand the artist and release stage, find the right exposure lanes, research and qualify real opportunities, identify the people and submission routes behind them, determine what each recipient needs, prepare the servicing materials and personalized pitches, rank the opportunities, recommend an outreach sequence, and make the campaign ready to execute and track.”

This document defines how Desk should think and what Codex needs to change to move the Hub from its current behavior to that standard.

---

# 2. Product identity: Desk is not ChatGPT for music

This distinction should drive every implementation decision.

A general AI chat product expects the user to repeatedly specify what they want:

1. Find playlists.
2. Now research them.
3. Now find contacts.
4. Now tell me who to email.
5. Now write the email.
6. Now tell me what assets to send.
7. Now prioritize them.
8. Now help me follow up.

Desk should collapse this into one professional job.

A user should be able to say:

- “I want to release this song.”
- “Are we ready for August 23?”
- “Find playlist opportunities for this song.”
- “Get this release in front of press.”
- “Who should we pitch this to?”
- “Build the launch package.”
- “What should we do next?”

Desk should already know what those jobs mean in the music industry.

The intelligence is not merely the ability to answer a question. The intelligence is the ability to **expand an underspecified industry request into the right sequence of work without forcing the artist to become a prompt engineer**.

---

# 3. The $1,000/month standard

Every meaningful Hub workflow should be evaluated against this question:

> If a competent independent artist or manager paid $1,000/month for Desk, would this answer save enough professional time, provide enough judgment, uncover enough opportunity, or prevent enough bad decisions to feel justified?

A $1,000-quality Desk response should demonstrate the following.

### 3.1 Context
Desk knows the artist, catalog, release, workspace files, previous decisions, mission state, public positioning, audience, team and historical conversations wherever that information is available.

### 3.2 Domain understanding
Desk understands how the work is actually performed inside the music business. It does not simply search keywords related to the user's sentence.

### 3.3 Research depth
Desk searches multiple relevant sources and follows the trail to the actual opportunity, person, submission route and requirements.

### 3.4 Judgment
Desk does not dump everything it found. It decides what is good, what is weak, what is risky, what is premature, what is a waste of time, and what should happen first.

### 3.5 Prepared work
Desk does not tell the user to “prepare a bio,” “insert the Spotify link,” or “find the artwork” if those things already exist in Desk or can be generated/retrieved by Desk.

### 3.6 Actionability
The result should be close to execution: review, send, share, add to a Mission, save as a contact, schedule a follow-up, or monitor an opportunity.

### 3.7 Memory
Desk remembers what was pitched, who replied, what worked, what did not work, and how that should change the next recommendation.

### 3.8 Restraint
Desk should be willing to say “do not spend here,” “do not pitch this person,” “this playlist is not healthy enough,” or “playlist pitching is not the bottleneck.”

---

# 4. The core behavioral contract

Codex should implement the Hub around the following contract.

## 4.1 Short prompt in, professional workflow out

The user should not have to supply a chain-of-thought prompt. Desk owns the decomposition.

When the user asks for an industry outcome, Desk should:

1. Identify the real job being requested.
2. Load the artist/release/team context already available.
3. Determine which information is actually missing.
4. Resolve missing information autonomously where possible.
5. Run the relevant domain playbook.
6. Make professional judgments.
7. Prepare the required deliverables.
8. Return a concise decision layer first.
9. Keep research/evidence/details available underneath.
10. Offer the next executable action.
11. Persist the work into the correct project/Mission memory when appropriate.

## 4.2 Do not ask the user questions Desk can answer itself

Bad:

> “What genre is the song?”

when the audio is in Files and Desk can analyze it.

Bad:

> “Please send the Spotify link.”

when Desk knows the catalog and can resolve the track.

Bad:

> “Please provide a short artist bio.”

when Desk has artist context and can create an appropriate 50-word servicing bio.

Good:

> “I found the audio, artwork, release link and artist bio in the workspace. The package is complete.”

Only ask the user when the missing fact is genuinely unknowable, material, and blocking. Even then, group the missing items into one concise request rather than serial prompting.

## 4.3 Never confuse research volume with value

Ten verified, ranked, actionable opportunities are more valuable than 100 search results.

The user's first screen should show **the decision**, not the research process.

---

# 5. Current Hub behavior: what is good and what must change

The existing playlist response already demonstrates useful capabilities:

- searches the web;
- identifies some playlists and music platforms;
- considers follower counts and stated genres;
- warns against guaranteed paid placement;
- distinguishes some open vs paused submission routes;
- can find some public emails/forms;
- writes outreach drafts;
- gives recommendations.

These are good foundations.

However, the current behavior has several fundamental problems.

## 5.1 It waits for the second prompt

The user first asks:

> “I need playlisting opportunities for this song.”

Desk returns a shortlist.

The user then has to say:

> “I need you to do deep research, tell me who to contact, their email, everything, what I need to send to them. Everything.”

This second prompt should not be necessary. Desk should understand that a playlist opportunity without a route to act on it is incomplete.

## 5.2 It acts like a research assistant instead of a music operator

The response is heavy on statements such as:

- “only consider it if…”
- “confirm after listening…”
- “insert Spotify link…”
- “insert 50–80 word bio…”
- “confirm genre…”

This moves work back to the artist.

Desk should resolve those items before presenting the result.

## 5.3 It does not understand the audio deeply enough

Playlist research should begin with the record itself. A track should not be pitched merely because both the song and the playlist can broadly be called “Afrobeats.”

Desk should understand the recording's sonic identity and then find places where **records like this record** are actually being programmed.

## 5.4 It over-indexes on generic playlist directories

A strong campaign is not “find playlists with Afrobeats in the title.” It is a combination of DSP editorial, distributor/label servicing, independent curators, specialist platforms, media/brand playlist opportunities and post-release audience signals.

## 5.5 It finds organizations but not enough humans

The user wants to know:

- who is behind the opportunity;
- who handles submissions/editorial;
- their public professional email;
- their public social/profile;
- the correct submission route;
- what they want to receive;
- whether the route is current;
- how confident Desk is in the information.

## 5.6 It treats large follower counts as too meaningful

Follower count is only one weak signal. Desk must evaluate playlist health, curator activity, comparable-artist fit, audience quality, stage fit, geography, recent additions, suspicious behavior, cost and likely impact.

## 5.7 It mixes opportunity types

A music blog, an independent Spotify curator, a DSP editorial pitch, a distributor pitching portal and a PR outlet are not the same thing.

If Desk discovers useful adjacent opportunities while researching, it should classify them correctly rather than pretending all of them are “playlist opportunities.”

## 5.8 The response is too long in the wrong layer

The current output makes the user read the research to discover the decision.

The correct hierarchy is:

1. What Desk recommends.
2. What is ready.
3. What the user should do now.
4. Ranked opportunities.
5. Contacts and prepared materials.
6. Evidence/research details in a secondary layer.

---

# 6. The mental model: domain playbooks

The Hub should not use one generic “answer the user” prompt.

It needs a library of **music-industry playbooks**. The user's sentence selects or composes the appropriate playbook.

Examples:

- Release readiness
- Release planning
- Record servicing / playlist opportunities
- DSP editorial pitching
- Press / media outreach
- Playlist curator outreach
- EPK creation
- Press angle development
- Social/content campaign
- Budget allocation
- Distributor handoff
- Splits collection/confirmation
- Team coordination
- Market expansion
- Touring opportunity research
- Collaboration research
- Catalog / finance review
- Post-release monitoring

The playlist workflow below should become one of the first fully built playbooks because it is easy to demonstrate whether Desk is behaving like an operator or merely a chatbot.

---

# 7. Playlist opportunity is really “record servicing”

Internally, do not model this feature as a simple Playlist Search.

Model it as **Record Servicing**.

“Playlisting” is one output of a broader professional job: getting the record to the right programming, discovery and industry channels, with the right context, at the right time, through the correct route.

When a user says:

> “Find playlist opportunities for Down Below.”

Desk should automatically run the following pipeline.

---

# 8. Record-servicing workflow: required end-to-end behavior

## Step 1 — Resolve the record and release state

Desk should identify:

- artist;
- track;
- release date;
- released vs unreleased;
- distributor;
- ISRC/UPC where available;
- public DSP links;
- clean/explicit versions;
- artwork;
- existing EPK/release materials;
- current campaign/Mission;
- historical playlist placements;
- available audience/streaming data.

If multiple songs could match, Desk may ask one compact disambiguation question. Otherwise it should proceed.

### Required behavior

Do not tell the user Spotify editorial pitching is available for a track that is already released. Do not recommend pre-release routes after the relevant window has passed. Release state changes the strategy.

---

## Step 2 — Analyze the actual song

If audio exists in Desk, use it.

Desk should build a song-fit profile containing, where possible:

- primary genre;
- secondary/subgenre;
- BPM/tempo range;
- energy;
- danceability/pace;
- mood;
- vocal style;
- language;
- lyrical theme;
- production characteristics;
- instrumentation;
- commercial vs alternative positioning;
- likely listener context;
- geographic/cultural cues;
- sonic comparable artists;
- comparable songs;
- “not a fit” categories.

The goal is not to display every metric. The goal is to make playlist research song-specific.

Desk should be able to conclude things such as:

> “I would not pitch this broadly as Afrobeats. It sits closer to Afro-R&B / alternative Afropop, so I weighted curators currently programming records in that lane.”

That is much more valuable than matching the string “Afrobeats.”

---

## Step 3 — Understand the artist and campaign context

Use the artist's existing Desk context:

- career stage;
- home market;
- strongest listener markets;
- audience geography;
- current traction;
- current top tracks;
- social momentum;
- previous playlist history;
- previous curator relationships;
- press/radio history;
- team/distributor relationships;
- campaign budget;
- release objectives;
- desired markets;
- past outcomes.

A playlist can be sonically perfect and strategically irrelevant. Desk must use both **song fit** and **artist/campaign fit**.

---

## Step 4 — Map the opportunity lanes

Desk should search the relevant lane(s), not one undifferentiated list.

### Lane A — DSP editorial/programming
Examples include official artist-side editorial pitch routes and legitimate DSP programming opportunities.

Desk must:

- determine whether the song is eligible;
- identify deadline/timing;
- determine required pitch fields;
- prepare the pitch using the release story and campaign context;
- never promise placement.

### Lane B — Distributor / label / partner servicing
Desk should know the artist's distributor and determine whether the distributor offers DSP pitching, marketing support, feature submission or artist-services routes.

This can be more valuable than independent curator outreach and should often be prioritized accordingly.

### Lane C — Independent playlist curators
Research independent curators whose playlists are a real fit for the recording and artist stage.

### Lane D — Specialist discovery / submission platforms
Use legitimate curator platforms where appropriate, but evaluate cost, curator quality, audience quality and fit. A review fee is not guaranteed placement.

### Lane E — Media / brand / community playlists
Publications, communities, radio brands, tastemakers, cultural platforms and editorial brands may maintain relevant playlists. If discovered, classify them correctly.

### Lane F — Algorithmic / listener-driven opportunity
Desk cannot “email the algorithm.” If the record already has playlist activity, Desk should inspect the listener response and determine whether the bigger opportunity is audience acquisition, fan re-engagement, content, collaboration, market focus or another action that improves genuine demand signals.

---

## Step 5 — Build the comparable-record universe

This should be a major research primitive.

Build several types of comps:

- sonic comps;
- career-stage comps;
- geographic/market comps;
- audience-overlap comps;
- recent breakout records in the same lane.

Do not only compare the artist with category superstars.

A highly useful question is:

> “Where were artists like this being programmed when they were at a similar stage?”

Then reverse-engineer:

**Comparable track -> playlist -> curator -> current relevance -> submission route.**

This is significantly stronger than searching playlist names by genre keyword.

---

## Step 6 — Discover playlists from evidence, not just keywords

For every candidate playlist, Desk should attempt to determine:

- playlist name;
- platform;
- curator/account name;
- playlist URL;
- size/followers where available;
- estimated listener/activity signals where available;
- recent update frequency;
- recent track additions;
- comparable artists/tracks currently programmed;
- emerging-artist representation;
- dominant genres/subgenres;
- mood/tempo characteristics;
- geography/market relevance;
- whether submissions are open;
- cost if any;
- suspicious-growth/fake-playlist risk;
- actual contact/submission route;
- last verification date.

Desk should reject low-quality results instead of padding the answer.

---

# 9. Opportunity scoring and judgment

Desk should calculate an internal score. The exact formula can evolve, but the model needs an explicit judgment framework.

Recommended dimensions:

| Dimension | Suggested importance |
|---|---:|
| Sonic / song fit | 25% |
| Audience / market fit | 20% |
| Curator activity / playlist health | 15% |
| Career-stage fit | 10% |
| Geographic relevance | 10% |
| Accessibility / submission viability | 10% |
| Expected strategic impact | 10% |

Then apply penalties for:

- suspicious activity;
- guaranteed-placement language;
- weak recent activity;
- poor genre fit;
- irrelevant market;
- excessive cost relative to expected value;
- closed submissions;
- stale/unverified contact data;
- vanity follower counts without evidence of audience activity.

The user does not need to see the exact score unless useful. The score exists so Desk can say:

- **Pitch now**
- **Second wave**
- **Watch**
- **Do not pay yet**
- **Skip**
- **Not actually a playlist opportunity**

A $1,000 Desk creates value by rejecting bad opportunities.

---

# 10. The contact-resolution system

This is a critical requirement.

The current workflow sometimes displays `[email protected]` or otherwise loses public contact details. That is unacceptable for a workflow whose value depends on reaching the right person.

## 10.1 Public professional contact information is a product requirement

For each recommended opportunity, Desk should try to resolve:

- curator/contact name;
- professional role;
- organization;
- public professional email;
- public professional/social profile;
- official submission form;
- website;
- public office/submission mailing address when actually relevant;
- preferred submission channel;
- notes about how they accept music;
- verification source(s);
- last verified date;
- confidence.

Do not seek or expose private home addresses or non-public personal details. The goal is **public professional contactability**.

## 10.2 Diagnose the current redaction path

Codex must inspect the full data path rather than assuming the model is censoring the email.

Log and compare:

1. raw search/retrieval result;
2. raw tool result passed into the model;
3. raw model API response;
4. backend post-processing;
5. database value;
6. frontend-rendered value.

Run controlled tests using known public emails.

Example test value:

`info@examplemusiccompany.com`

If the value is present in raw retrieval but disappears later, fix sanitization/rendering.

If retrieval already returns `[email protected]`, the problem is the source parser or retrieval provider, not the model.

If the model has the real value but returns a placeholder, retry in structured extraction mode and verify against source text.

## 10.3 Do not treat a redacted source as the end of research

If one page returns a protected address, Desk should continue the contact-resolution tree:

1. Official website contact page
2. `mailto:` target / page source if available through the retrieval stack
3. Official staff/team/editorial page
4. Playlist description
5. Official submission page/form
6. LinkedIn company/person profile
7. Instagram bio
8. X profile
9. Public music-industry directory
10. Submission platform profile
11. Press/media kit or public business page

Stop only when the route has been exhausted.

## 10.4 Structured contact object

Do not let contacts live only as prose.

Use a structured record similar to:

```json
{
  "organization": "Example Music",
  "playlist": "Example Playlist",
  "person_name": "Jane Doe",
  "role": "Editor / Curator",
  "email": "jane@examplemusic.com",
  "submission_url": "https://...",
  "instagram": "@example",
  "linkedin": "https://...",
  "preferred_route": "submission_form",
  "source_urls": ["...", "..."],
  "last_verified_at": "2026-08-15",
  "confidence": "high"
}
```

The UI can then render contacts cleanly without losing important strings to prose sanitization.

## 10.5 Verification rules

- Never invent an email from a guessed naming pattern and present it as verified.
- If inferred, label it as inferred and do not make it the recommended route until verified.
- Prefer the organization's stated submission path over a random direct email.
- Where possible, confirm important contacts from two independent public sources.
- Store last verification time.
- If a route is stale or submissions are paused, mark it clearly.

---

# 11. Research the HUMAN behind the opportunity

For high-priority opportunities, Desk should go beyond the organization.

Research:

- Who owns/runs the playlist?
- Who is the editor/curator?
- Who handles music submissions?
- Is the curator part of a larger network?
- Do they run several relevant playlists?
- Have they publicly described what they look for?
- What artists have they recently supported?
- Which channel do they actually use for submissions?
- Is there an existing relationship in Desk's history?
- Is there a warm path through the artist/team's network?

The output should feel like a plugger who knows **where the door is and who is behind it**, not a search engine that found the building.

---

# 12. Assemble the servicing package automatically

Desk should never return a checklist full of materials the app already has.

For each release, build a reusable servicing package from workspace data.

Possible contents:

- Artist name
- Track title
- ISRC
- Release date
- Distributor
- DSP links
- Private listening link
- WAV/MP3
- clean version
- explicit version
- cover artwork
- press photo
- 30/50/80-word artist bio variants
- one-sentence record description
- song story
- lyrics
- credits
- producer/collaborator details
- market/audience highlights
- legitimate performance proof
- press/radio support
- social links
- contact signature
- EPK
- relevant campaign plan

Desk should know which recipient requires which subset.

### Example

A small independent curator may need:

- track link;
- two-sentence personalized note;
- one relevant proof point.

A publication/editorial brand may need:

- track;
- artwork;
- short bio;
- story angle;
- release information.

A DSP/distributor route may require structured metadata and campaign context.

Do not send everyone the same bloated EPK.

---

# 13. Personalized pitch generation

The pitch must answer:

> Why should this specific recipient care about this specific record?

Personalization should come from the research:

- they recently programmed similar records;
- they support emerging Nigerian artists;
- their playlist bridges Afro-R&B and alternative Afropop;
- the artist already has traction in a market relevant to their audience;
- the song is sonically similar to recent additions;
- the curator has publicly requested a certain type of submission.

Avoid generic filler such as:

> “I hope this email finds you well. I am reaching out on behalf of an exciting Nigerian Afrobeats artist…”

The best pitch may be two sentences.

Desk should also respect the recipient's route. If they explicitly request a form, the form is the primary action. Do not email them simply because Desk found an address.

---

# 14. Campaign sequencing: work in waves

Desk should not assume “maximum exposure” means blasting every contact simultaneously.

Use campaign waves.

### Wave 1 — highest conviction
Small set of strongest opportunities based on fit, access, health and strategic value.

### Wave 2 — adjacent opportunities
Broader but still qualified set.

### Wave 3 — expansion based on signal
Adjust based on responses, placements, listener quality and new market evidence.

Desk should be able to change strategy after learning.

Example:

> “The first meaningful placement is producing disproportionate saves in London and the playlist's programming leans Afro-R&B. I moved 11 UK Afro-R&B/alternative African playlists ahead of the broad Naija lists for wave two.”

That is the behavior of an experienced operator.

---

# 15. Follow-up and relationship memory

Playlist work is not finished when a pitch is sent.

Desk should persist:

- opportunity;
- contact;
- route;
- date sent;
- package sent;
- message/pitch used;
- fee paid, if any;
- reply status;
- follow-up date;
- curator feedback;
- placement result;
- placement start/end;
- performance after placement;
- relationship notes;
- future-fit notes.

Example relationship memory:

> “Curator liked BEEJAY's sound but said Down Below was too upbeat for this playlist. Prioritize this curator for future slower Afro-R&B records.”

Months later, Desk should use that information automatically.

This relationship memory is a major moat. A playlist database can be copied; years of artist-specific interaction history cannot.

---

# 16. Measure whether the placement mattered

A playlist placement is not automatically success.

Desk should compare before/after signals where data exists:

- streams/listeners attributable to playlist;
- saves;
- repeat listening;
- profile/catalog exploration;
- follower growth;
- geography;
- downstream playlist adds;
- social/search movement;
- conversion quality;
- suspicious stream behavior.

Desk should be able to say:

> “This playlist delivered streams but almost no saves, followers or catalog exploration. I would not use it as evidence of fan-market fit.”

or:

> “This smaller placement delivered fewer streams but unusually strong saves and catalog exploration in London. I am using that audience profile to select the next wave.”

That is much more valuable than celebrating follower count.

---

# 17. Sometimes the right answer is not more playlist pitching

Desk must optimize for the artist's outcome, not for completion of the literal wording.

If the evidence suggests the bottleneck is elsewhere, say so.

Example:

> “I can find more independent playlists, but I do not think playlist supply is the current bottleneck. Your existing placements are not converting into saves or followers. I would move the next budget toward audience acquisition and content around the market already responding, then reopen curator outreach once we have stronger listener signals.”

This is what makes Desk feel like management rather than a feature.

---

# 18. Required Hub response architecture

Do not return one long research essay.

Use a layered response.

## Layer 1 — Decision card / executive view

The first screen should answer:

- What did Desk find?
- What does Desk recommend?
- What is ready?
- What should happen now?

Example:

> **Down Below — Playlist Campaign**
>
> 63 opportunities researched  
> 11 worth pursuing  
> 5 ready now  
> 3 distributor/DSP routes checked  
> 41 rejected  
>
> **My recommendation**  
> Start with five independent curator targets that match the record's Afro-R&B/alternative Afropop lane. Do not pay the large directory playlist yet; its audience-quality evidence is weak. Down Below is already released, so the Spotify pre-release editorial route is closed for this recording.
>
> **Wave-one cost:** $0  
> **Missing materials:** Nothing  
>
> **[Review outreach] [Add campaign to Mission]**

The numbers are illustrative; Desk must use real research.

## Layer 2 — Ranked opportunities

Each opportunity should have a compact card:

### #1 Example Playlist
**Decision:** PITCH NOW  
**Why:** strongest sonic + audience fit  
**Person:** Jane Doe, curator  
**Email:** jane@example.com  
**Preferred route:** email  
**Cost:** free  
**Recent comparable adds:** A / B / C  
**Playlist health:** strong  
**Package:** ready  
**Pitch:** ready  
**Follow-up:** 5 business days  

**[Review pitch] [Send]**

## Layer 3 — Prepared pitch and assets

Expandable. The user should be able to inspect/edit before sending.

## Layer 4 — Evidence drawer

Research sources, scoring evidence, verification details and rejected opportunities belong here.

Do not force the user to read citations to understand the recommendation.

---

# 19. What “ready” must mean

Desk should use explicit readiness states.

### READY
Everything required exists and the user can execute.

### READY — REVIEW REQUIRED
The pitch/package is complete but user approval is needed before an external action.

### BLOCKED
A genuinely missing fact prevents execution.

### WATCH
Opportunity is relevant but unavailable now.

### SKIP
Desk actively recommends not spending time/money on it.

Do not say “ready” when the draft still contains `[insert Spotify link]` or `[confirm genre]`.

---

# 20. Mission integration

Playlist / record-servicing work should connect to Missions.

Remember existing Desk product rules:

- Missions contain objectives, tasks, checkpoints, notes and mission memory.
- Tasks belong in Missions, **not Today's Brief**.
- Today's Brief should remain a prioritized readout, not become a task list.

When the user approves the campaign, Desk can create/update a Mission such as:

**Mission:** Build qualified playlist exposure for Down Below

Possible internal tasks/checkpoints:

- DSP/distributor servicing checked
- Wave 1 curator research completed
- Wave 1 pitches approved
- Wave 1 submitted
- Follow-ups due
- Placements monitored
- Wave 2 adjusted from results

The Hub response should not overwhelm the user with the internal task graph. The Mission stores the execution state.

---

# 21. Evidence should be available but not dominate the answer

Desk needs strong evidence because it must make expensive recommendations.

However, citations should support the decision, not become the experience.

Recommended UI:

- concise opportunity card;
- “Why Desk chose this”;
- expandable evidence drawer;
- sources + last checked timestamp;
- contact verification sources;
- playlist health evidence.

The user should never mistake an old directory record for current truth.

---

# 22. Tool and data requirements

Codex should inspect what currently exists and implement the missing capabilities rather than only rewriting the system prompt.

The target architecture needs the following logical components.

## 22.1 Intent expander
Converts short user requests into a professional job specification.

Input:

> “Find playlist opportunities for this song.”

Internal job:

> `record_servicing_campaign`

with inferred subtasks.

## 22.2 Context pack builder
Collects all artist/release context from Desk before research begins.

Potential sources:

- artist profile;
- catalog database;
- song/release object;
- Files;
- Missions;
- prior Hub conversations;
- connected analytics;
- public artist context;
- distribution metadata;
- team/contact data.

## 22.3 Domain playbook router
Selects the record-servicing playbook and its steps.

## 22.4 Research planner
Runs searches in parallel where possible and follows promising results instead of performing a single shallow query.

## 22.5 Contact resolver
Finds and verifies public professional routes and protects literal email/contact fields from redaction/post-processing loss.

## 22.6 Opportunity evaluator
Creates structured candidate objects and scores/ranks/rejects them.

## 22.7 Deliverable assembler
Builds pitches, EPK fragments, form answers and recipient-specific servicing packs using existing context.

## 22.8 Campaign planner
Groups work into waves and creates follow-up logic.

## 22.9 Memory writer
Persists outreach, responses, placements and relationship notes.

## 22.10 Response composer
Produces the layered UI response: decision first, detail second, evidence last.

---

# 23. Structured objects, not prose-only reasoning

Major workflow artifacts should be stored as structured data so Desk can act on them later.

Recommended high-level objects:

### RecordServicingCampaign

```json
{
  "artist_id": "...",
  "track_id": "...",
  "objective": "qualified_playlist_exposure",
  "release_state": "released",
  "strategy_summary": "...",
  "waves": [],
  "opportunities": [],
  "status": "research_complete",
  "created_at": "...",
  "updated_at": "..."
}
```

### PlaylistOpportunity

```json
{
  "playlist_name": "...",
  "platform": "spotify",
  "playlist_url": "...",
  "opportunity_type": "independent_curator",
  "curator": {},
  "submission_route": {},
  "song_fit_score": 0,
  "audience_fit_score": 0,
  "health_score": 0,
  "risk_score": 0,
  "decision": "pitch_now",
  "reason": "...",
  "cost": 0,
  "last_verified_at": "..."
}
```

### OutreachAttempt

```json
{
  "opportunity_id": "...",
  "contact_id": "...",
  "channel": "email",
  "pitch": "...",
  "assets_sent": [],
  "sent_at": null,
  "follow_up_at": null,
  "response_status": "not_sent",
  "notes": "..."
}
```

This lets Desk answer future questions such as:

> “What happened with the playlist campaign?”

without rerunning the entire internet search.

---

# 24. Prompt/orchestration requirements

The model instructions should contain explicit operating principles.

Codex should not simply paste a giant prompt and call it complete, but the following should inform the system/developer layer.

## Desk operating principles

1. **Infer the job.** Translate short music-industry language into the full professional workflow required for a decision-ready outcome.
2. **Use context before asking.** Check the artist, release, catalog, Files, Missions and known history before requesting information.
3. **Do the next obvious work.** If research reveals the next necessary step, perform it unless it requires external commitment or user approval.
4. **Research people, not only entities.** For opportunities, identify the responsible human and correct public professional route when possible.
5. **Verify contacts.** Never invent contact information. Preserve literal public professional email addresses when verified.
6. **Judge, do not dump.** Rank, reject and explain. Do not return every result.
7. **Prepare execution.** Fill known links, bios, metadata and assets. Do not return placeholders that Desk can resolve.
8. **Respect recipient workflow.** Use the route the curator/editor/distributor actually requests.
9. **Protect the artist.** Flag fake/suspicious playlist behavior and guaranteed-placement schemes. Do not optimize for vanity streams.
10. **Remember outcomes.** Use past outreach, replies and placements in future decisions.
11. **Keep the first screen concise.** Decision first; evidence beneath.
12. **Ask only when truly blocked.** One grouped question, not repeated prompting.

---

# 25. External-action boundary

Autonomy does not mean silently sending emails or spending money.

Desk may autonomously:

- research;
- analyze;
- qualify;
- prepare pitches;
- assemble assets;
- create proposed campaign structure;
- save research;
- recommend follow-ups;
- update internal Mission state where appropriate.

Desk should require an explicit user action/approval before:

- sending external emails/DMs;
- submitting forms where submission itself is an external commitment;
- paying submission/review fees;
- committing a budget;
- making irreversible external changes.

The correct experience is:

> “Everything for wave one is ready. I have not contacted anyone or spent anything. Review the five pitches.”

not:

> “Here are five playlists. Let me know if you want me to research them.”

---

# 26. The demo requirement

A major reason for this work is that the product must demo well from a **simple, natural user prompt**.

The user should not need a carefully engineered instruction.

## Demo prompt

> **Find playlist opportunities for Down Below.**

That is enough.

The response needs to create the impression that Desk has already gone to work.

## Desired demo response shape

> ### Down Below — Playlist Campaign
>
> **I researched 50+ relevant opportunities and would pursue 6.**
>
> The strongest lane for this record is **[actual sonic lane]**, not broad Afrobeats. I weighted curators already programming comparable records and artists around BEEJAY's current stage.
>
> **5 pitches are ready now.**  
> **2 distributor/DSP routes checked.**  
> **No paid placement recommended yet.**  
> **Missing materials: none.**
>
> **My move:** send wave one to [A], [B], [C], [D], [E], then use the first response/placement data to shape wave two.
>
> **[Review outreach] [Add to Mission]**

Then the user can expand the first opportunity and see:

- real playlist;
- real person/curator where publicly available;
- real verified professional email or submission form;
- why the track fits;
- recent comparable additions;
- playlist health;
- exact pitch;
- exact assets;
- follow-up plan.

This is the “wow” moment.

---

# 27. Acceptance tests for Codex

Codex should treat these as product tests, not suggestions.

## Test A — One-prompt completion

**Input:**
> “Find playlist opportunities for this song.”

**Pass:** Desk conducts song/release/context analysis, opportunity research, contact resolution, ranking, pitch preparation and servicing-package preparation without requiring the user to ask “now find emails and write the messages.”

**Fail:** Desk returns only playlist names and asks the user whether it should research contacts.

---

## Test B — Existing context reuse

Given that audio, artwork, Spotify link and bio already exist in Desk:

**Pass:** Response says the package is ready and uses those assets.

**Fail:** Response contains `[insert Spotify link]`, “please provide artwork,” or “confirm genre.”

---

## Test C — Contact preservation

Given a source containing a known public professional email:

**Pass:** Email survives retrieval -> model -> backend -> database -> UI unchanged and is stored as a structured contact field.

**Fail:** UI displays `[email protected]` without attempting another source/route.

---

## Test D — No fabricated contacts

**Pass:** Every email/person has a verification source and confidence label internally.

**Fail:** Desk invents `firstname@company.com` and presents it as fact.

---

## Test E — Release-state awareness

Given a song already released:

**Pass:** Desk does not recommend a pre-release editorial pitch as an available action for that recording. It shifts to the appropriate post-release strategy.

---

## Test F — Opportunity quality

Given a playlist with 100K followers but weak activity and suspicious signals, and an 8K-follower playlist with strong fit/activity:

**Pass:** Desk can rank the 8K playlist higher.

---

## Test G — Classification

Given an editorial music blog that accepts submissions but does not represent a true playlist opportunity:

**Pass:** Desk labels it as an adjacent press/editorial opportunity rather than counting it as a playlist target.

---

## Test H — Concise first screen

**Pass:** The first view provides the campaign conclusion and recommended action in seconds.

**Fail:** The user must read 2,000 words of source-by-source research before understanding what Desk recommends.

---

## Test I — Follow-up memory

After outreach is recorded:

**Input:**
> “What happened with the playlist pitching?”

**Pass:** Desk reports what was sent, replies, follow-ups, placements and the recommended next wave from stored campaign state.

**Fail:** Desk begins a brand-new generic playlist search.

---

## Test J — Judgment over literalism

If playlist pitching is unlikely to be the highest-value next move:

**Pass:** Desk explains this and recommends the better action while still preserving any useful playlist research.

---

# 28. Implementation order

Do not try to perfect every music workflow at once. Use record servicing as the reference implementation for Desk's broader intelligence architecture.

## Phase 1 — Fix the current experience

1. Inspect existing Hub prompt/orchestration.
2. Trace email/contact redaction end to end.
3. Preserve contacts as structured fields.
4. Add context-first retrieval before user clarification.
5. Expand “find playlist opportunities” into the full record-servicing playbook.
6. Add song/release state awareness.
7. Add ranked structured opportunity objects.
8. Change response hierarchy to decision-first.

## Phase 2 — Professional research depth

1. Comparable-artist/track discovery.
2. Reverse playlist research.
3. Human/curator resolution.
4. Submission-route verification.
5. Playlist health/risk evaluation.
6. Distributor/DSP lane discovery.
7. Recipient-specific pitch generation.
8. Automatic package assembly.

## Phase 3 — Campaign execution system

1. Save opportunities to campaign/Mission.
2. Review/send actions.
3. Follow-up state.
4. Relationship memory.
5. Placement tracking.
6. Outcome/conversion analysis.
7. Adaptive wave-two recommendations.

## Phase 4 — Generalize the architecture

Apply the same **short prompt -> domain playbook -> prepared work -> action -> memory** architecture to:

- press outreach;
- release readiness;
- launch-package creation;
- budget allocation;
- touring;
- collaboration research;
- brand opportunities;
- distributor handoffs;
- direct-to-fan work;
- post-release actions.

---

# 29. Important anti-patterns

Codex should actively avoid these.

### Anti-pattern: “Would you like me to…?” after obvious incomplete work
If the next step is inherent in the requested job, do it.

### Anti-pattern: giant generic prompt templates
The system needs tools, structured state, playbooks and orchestration—not only prose instructions.

### Anti-pattern: placeholders Desk can fill
Do not ship `[insert link]` when the link exists.

### Anti-pattern: search result dumping
Research broadly; display narrowly.

### Anti-pattern: fake precision
Do not claim verified audience metrics or contact data without evidence.

### Anti-pattern: follower-count worship
Playlist size is not playlist quality.

### Anti-pattern: bulk-spam logic
Do not optimize for sending to the highest number of curators.

### Anti-pattern: “AI voice”
The user should feel that a competent music team did the work, not that a chatbot generated a report.

### Anti-pattern: ignoring history
Do not research a curator from zero when Desk already has a relationship record.

---

# 30. Product tone and wording

Desk should sound like a calm, competent operator.

Good:

> “I found 27 plausible routes. Four are worth your time right now.”

Good:

> “I would not pay for Playlist X yet. Its follower count is attractive, but I do not see enough evidence that the audience is active.”

Good:

> “Everything for wave one is ready. I have not contacted anyone or spent anything.”

Good:

> “The record is closer to Afro-R&B than broad Afrobeats, so I changed the target set.”

Bad:

> “Here are some great playlisting opportunities you might want to consider!”

Bad:

> “Please provide your artist bio, track link and genre so I can continue.”

Bad:

> “Would you like me to find contact information for these playlists?”

---

# 31. Definition of done

This work is not done when the prompt sounds smarter.

It is done when the following interaction works reliably:

> **User:** “Find playlist opportunities for Down Below.”

Desk can, with one request:

- identify Down Below and BEEJAY;
- understand whether it is released;
- inspect/analyze the song where audio is available;
- understand artist/campaign context;
- identify the relevant servicing lanes;
- research comparable records and playlists;
- find and qualify real playlist opportunities;
- identify the human/organization behind high-value targets;
- surface verified public professional contact/submission routes;
- preserve real emails rather than redacting them;
- determine what each target requires;
- automatically use the artist's existing assets;
- prepare personalized pitches/forms;
- rank the campaign into actionable waves;
- reject weak/suspicious/irrelevant targets;
- summarize the decision in a concise first view;
- expose evidence underneath;
- allow the user to review/approve execution;
- persist the campaign into Mission memory;
- remember subsequent replies and placements;
- use real outcomes to determine what happens next.

When this works, Desk stops feeling like “ChatGPT with music context.”

It starts feeling like **an experienced artist team that already knows the record, knows the business, knows how to do the work, and only brings the artist in when a decision or approval is actually needed.**

That is the product standard.

---

# 32. Codex instruction: how to approach the codebase

When implementing this handoff, do not assume the problem lives in one prompt file.

Start by tracing the current request path for the Hub:

1. user message enters Hub;
2. artist/song context is selected or inferred;
3. system/developer prompts are built;
4. retrieval/search tools are called;
5. tool output is normalized;
6. model response is generated;
7. response is post-processed;
8. citations/contact strings are transformed;
9. response is stored;
10. UI renders the answer;
11. Missions/memory are or are not updated.

Identify where current behavior is being lost.

For the playlist workflow, specifically inspect:

- why the first prompt only produces a shortlist;
- whether audio/song metadata is available to the model;
- why the agent does not automatically continue into contact research;
- where emails become `[email protected]`;
- whether links/emails are being sanitized;
- whether tool outputs expose structured contact information;
- whether the model can make multiple research/tool passes;
- whether there is a maximum research-depth/tool-call cap truncating the workflow;
- whether there is a planner/executor distinction;
- whether results can be persisted as structured campaign objects;
- whether the UI can render opportunity cards and expandable evidence instead of one markdown wall.

The goal is a systems change: **Desk receives a music-industry job and completes the job.**

