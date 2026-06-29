# OrderSounds Manager Intelligence — CTO Handoff v6

**Purpose:** This document is the engineering handoff for upgrading the OrderSounds Manager Intelligence layer. It explains what the system should become, how it should reason, what must stay internal, what should appear in the user interface, and how the intelligence generated here should feed later product surfaces such as Today’s Brief, Manager Chat, song reads, project reads, missions, tasks, estimates, and checkpoints.

**Product ambition:** Build the best AI-powered music management application in the world. The product should feel strong enough to demo to a major label team and valuable enough for independent artists, managers, labels, and music teams to pay around **$1,000/month**.

**Core positioning:**  
Data platforms show what is happening.  
OrderSounds Manager explains what it means and what the team should do next.

**Critical instruction:** Never expose the underlying model provider, model name, prompt logic, playbook names, or internal reasoning system to end users. The user experience should feel like the product has deep music-management intelligence built into it.

---

## 1. What Changed From v1

This version corrects the previous direction in three important ways.

### 1. No model-provider language anywhere in product copy
The product must never say or imply that the brief was created by a third-party chat system. It should not expose model names, prompt structure, internal reasoning, or implementation details.

The interface should feel like:
> OrderSounds understands the artist, the catalog, the market, and the next move.

Not:
> A chatbot analyzed your data.

### 2. Internal playbooks must not be shown in the Today’s Brief UI
The Manager Playbooks are internal reasoning frameworks. They guide the Manager Intelligence Engine, but the user should not see which playbooks were used.

Do not show:
- “Playbooks used”
- “Decision lenses used”
- “Inspired by manager X”
- “Reasoning mode”
- “Internal strategy model”

The user should only see the result of the intelligence:
- What is happening
- Why it matters
- What to do next
- What not to do
- What to watch
- What evidence supports the read

### 3. Today’s Brief is not the mission/task/checkpoint generator
Missions, tasks, estimates, and checkpoints live elsewhere in the app. Today’s Brief should not render a task list.

However, the Manager Intelligence Engine must produce enough structured intelligence so that a separate Mission Generator can later create:
- missions
- tasks
- checkpoints
- estimates
- owner suggestions
- follow-up metrics
- success criteria

Today’s Brief can mention the most important next move, but it should not become a project-management screen.

---

## 2. System Architecture: Think Like a CTO

Do not build this as one prompt that creates one screen.

Build it as an intelligence layer with multiple consumers.

### Correct architecture

```text
Chartmetric-style data + internal data + user goals + previous memory
        ↓
Data Normalization Layer
        ↓
Artist Operating Profile
        ↓
Manager Intelligence Engine
        ↓
Strategic Intelligence Packet
        ↓
Multiple product surfaces:
    1. Today’s Brief
    2. Manager Chat
    3. Song Manager Reads
    4. Project Manager Reads
    5. Mission Generator
    6. Task/Checkpoint Generator
    7. Weekly Strategy Review
    8. Campaign Diagnosis
    9. Label/Investor Readiness
```

The Manager Intelligence Engine should not be tightly coupled to Today’s Brief. Today’s Brief is only one renderer of the deeper intelligence.

This is important because the same intelligence should later power:
- “What should we do with this song?”
- “Which song should we push?”
- “Where should this artist tour?”
- “Is this a real breakout or a spike?”
- “What should the manager tell the artist today?”
- “Create missions for the marketing team.”
- “What checkpoints should we track this week?”
- “Is this artist ready for a label conversation?”
- “Which market should we focus on next?”
- “What should we avoid?”

---

## 3. Product Layer Definitions

### 3.1 Data Layer
This layer fetches and normalizes data from the connected data sources.

Expected data categories:
- artist profile
- platform metrics
- selected tracks
- selected projects
- playlist movement
- chart movement
- social movement
- TikTok/UGC movement
- YouTube movement
- Shazam/discovery movement
- audience demographics
- top markets/cities
- similar artists
- radio/live/sync signals where available
- internal goals
- previous briefs
- open missions/checkpoints where available

### 3.2 Artist Operating Profile
This is persistent strategic memory for the artist.

It is not a biography. It is the manager’s map of the artist.

It should answer:
- Who is this artist?
- What stage are they in?
- What platform shape do they have?
- What markets matter?
- Which songs/projects matter?
- What world are they building?
- What risks exist?
- What is the current strategic priority?

### 3.3 Manager Intelligence Engine
This is the core reasoning system.

It reads the Artist Operating Profile and current signals, applies internal Manager Playbooks, and produces a Strategic Intelligence Packet.

### 3.4 Strategic Intelligence Packet
This is the most important object.

It is the internal structured output that all downstream product surfaces use.

The packet is not the UI. It is the source of truth for:
- Today’s Brief
- Manager Chat
- song reads
- project reads
- missions
- tasks
- checkpoints
- campaign analysis

### 3.5 Today’s Brief Renderer
This takes the Strategic Intelligence Packet and renders a concise user-facing brief.

It must not show:
- internal playbook names
- task lists
- checkpoint lists
- prompt logic
- reasoning labels
- model/provider information

### 3.6 Mission Generator
This is separate.

It consumes the Strategic Intelligence Packet and creates missions, tasks, estimates, owners, and checkpoints in the mission area of the app.

Today’s Brief should not do that work.

---

## 4. Current Screenshot Assessment

The attached screenshot shows a Today’s Brief for Mavo.

### What is already working
The current product has the right direction:
- It gives a clear priority headline.
- It has an artist intelligence section.
- It identifies relevant signals: TikTok, monthly listeners, Lagos, playlist reach, Shazams, tracks/projects.
- It tries to create a management read, not just a data dump.
- It understands that TikTok attention needs to become streaming growth.

This is a good start.

### What needs to improve
The current brief is still too close to a dashboard summary. It needs to become sharper, more decision-oriented, and more structured.

#### Problems
1. **It relies too heavily on static profile facts.**  
   A daily brief should emphasize what changed, what is emerging, and what decision the change creates.

2. **It does not clearly separate signal types.**  
   TikTok views, playlist reach, Shazams, listeners, followers, and city concentration do not mean the same thing. The system must classify them before interpreting them.

3. **It does not explain confidence properly.**  
   “Medium confidence” is shown, but the user does not know why confidence is medium.

4. **It has no strong “avoid this” judgment.**  
   Great managers do not only recommend actions. They protect the artist from bad timing, bad opportunities, vanity moves, and premature scale.

5. **It does not clearly identify the single most important next move.**  
   The brief gives multiple ideas but should land on a sharper immediate management priority.

6. **It does not create enough reusable intelligence for other product surfaces.**  
   The output should feed Manager Chat, song reads, project reads, and future mission generation.

7. **It risks making claims without enough delta context.**  
   If the system says something is “fresh” or “priority,” it should know what changed and over what period.

8. **It should not show internal frameworks on the UI.**  
   The system can use internal playbooks, but the user should only see the management read.

---

## 5. The Core Product Standard

The system should be judged by this question:

> Would a serious artist manager or label team use this in a morning strategy meeting?

If no, it is not good enough.

### Bad output
> Your TikTok views are high and your playlist reach is strong. Consider promoting your music on social media.

### Good output
> Mavo has attention, but the job now is conversion. The TikTok moment is much larger than the owned fanbase, which means the audience is watching but not fully captured. For the next 72 hours, route the viral attention into full-track saves and follows around “Call Me” and “Energy,” starting with Lagos because it is the strongest listener base and cultural proof market.

### Bad output
> Lagos is a strong market.

### Good output
> Lagos is the power center. Abuja and Port Harcourt are secondary tests, not equal priorities yet. Prove Lagos conversion first before spreading the campaign nationally.

### Bad output
> Playlist reach increased.

### Good output
> Playlist reach is useful only if it converts. Before increasing spend, check playlist type, fit, and retention. If the adds are high-reach but low-fit, this is exposure, not fan growth.

---

## 6. Internal Manager Playbooks

These are internal reasoning frameworks. They must not be exposed in the user interface.

The Manager Intelligence Engine should use them to interpret data. A single situation can use multiple playbooks at once.

### Playbook 1: Cultural Expansion

**Inspired by:** Noah Assad, Bose Ogulu, Oliver El-Khatib.

#### Core principle
Make the artist bigger as themselves. Do not dilute the artist to chase a generic global audience.

#### Use when
- The artist has strong cultural identity.
- The artist has city, language, diaspora, street, subculture, or regional identity.
- The artist is gaining traction outside their home market.
- The team is considering collaborations, international positioning, or expansion.

#### Ask internally
- What is the artist’s cultural home base?
- Which market already understands the artist without explanation?
- What must not be diluted?
- Is the growth coming from authentic identity or random algorithmic exposure?
- Is a market responding because of diaspora connection?
- Would this opportunity make the artist look powerful or validation-seeking?
- Which collaborators expand the artist’s world without making them generic?

#### Decision logic
For African artists, do not automatically recommend U.S. validation. Sometimes the smarter move is Lagos, Accra, London, Paris, Toronto, Johannesburg, or a diaspora bridge.

---

### Playbook 2: Era Architecture

**Inspired by:** Brandon Creed, Taylor Swift, Harry Styles’ team.

#### Core principle
A release is not just a song. It should become a recognizable era.

#### Use when
- The artist is releasing a single, EP, album, or project.
- The campaign lacks identity.
- Fans are reacting to the music but not repeating a phrase, symbol, mood, or behavior.
- The team needs stronger rollout direction.

#### Ask internally
- What era is the artist entering?
- What is the emotional theme?
- What visual language repeats?
- What phrase, color, symbol, or behavior can fans carry?
- Does the song fit the era or confuse it?
- Does the campaign have a world, or only a release date?
- Are fans participating or only consuming?

#### Decision logic
Do not recommend random content. Recommend repeatable campaign codes.

---

### Playbook 3: Artist-as-Business

**Inspired by:** Wassim “Sal” Slaiby.

#### Core principle
The artist is a creative business. Growth without structure creates chaos.

#### Use when
- The artist is gaining momentum.
- A deal, brand opportunity, label conversation, publishing decision, or distribution move is involved.
- The team may be structurally unprepared for scale.

#### Ask internally
- Are rights clear?
- Are splits clean?
- Is publishing handled?
- Is metadata clean?
- Does the team know what they own?
- Is the artist negotiating from leverage or fear?
- What is the partner actually contributing?
- Is the deal fair?
- Does the artist need legal review?
- Does this opportunity improve future leverage?

#### Decision logic
Slow the team down when excitement can create a bad deal.

---

### Playbook 4: Prestige & Positioning

**Inspired by:** Jeffrey Azoff, Brandon Creed, Taylor Swift.

#### Core principle
Perception compounds. Not every opportunity that gives reach is good.

#### Use when
- Evaluating collaborations.
- Evaluating influencer campaigns.
- Evaluating brand deals.
- Evaluating press.
- The artist risks overexposure.
- The artist’s public image is unclear.

#### Ask internally
- Does this make the artist look bigger or smaller?
- Does the brand fit the artist’s world?
- Does the collaboration raise status?
- Is the artist becoming too available?
- Is the team accepting low-level opportunities because they are impatient?
- Does this move create prestige or cheapness?
- What should the artist say no to?

#### Decision logic
Money and reach are not enough. The move must improve long-term positioning.

---

### Playbook 5: Artist-First Development

**Inspired by:** Janelle Lopez Genzink.

#### Core principle
The artist must grow in a way they can actually sustain.

#### Use when
- The artist is developing.
- The team is forcing a persona.
- The strategy may be commercially attractive but emotionally wrong.
- The artist needs patience, refinement, or confidence.

#### Ask internally
- What does the artist naturally enjoy doing?
- What kind of attention can the artist handle?
- What part of the artist’s personality are fans responding to?
- What does the artist not want to become?
- Is the team rushing?
- Is the content strategy misaligned with the artist’s real personality?
- Is the growth plan sustainable?

#### Decision logic
Creative alignment is risk management.

---

### Playbook 6: Song & Fan Trust

**Inspired by:** Stuart Camp, Danny Rukasin, Brandon Goodman.

#### Core principle
The song and the fan relationship matter more than clever marketing.

#### Use when
- A song is being pushed.
- Playlist reach is rising but listener conversion is unclear.
- TikTok attention is high but streaming movement is weak.
- The artist may be over-marketing a weak song.
- Fans may feel ignored, used, or confused.

#### Ask internally
- Is the song strong enough to carry the campaign?
- Are listeners saving it?
- Are listeners returning?
- Are people Shazaming it?
- Are fans emotionally responding?
- Is the team chasing a trend that does not fit?
- Would early fans feel respected by this move?
- Is attention becoming attachment?

#### Decision logic
Be honest. Sometimes the campaign is not the problem. The song may not be strong enough.

---

### Playbook 7: Live Demand & Community

**Inspired by:** Coran Capshaw, Jeffrey Azoff, Noah Assad.

#### Core principle
Live demand is one of the strongest proofs of real fandom.

#### Use when
- The team is deciding cities.
- The artist may be ready for shows, showcases, pop-ups, or fan events.
- City-level signals are moving.
- The artist has audience density in specific markets.

#### Ask internally
- Where are listeners concentrated?
- Where are saves/comments stronger than raw streams?
- Which cities show both streaming and social signals?
- Which markets show Shazam/discovery intent?
- Which cities are passive stream markets?
- Is the artist ready for live shows?
- What venue size matches actual demand?
- Should the artist underplay a city to create scarcity?
- Which city should be avoided for now?

#### Decision logic
Do not tour the biggest streaming markets blindly. Tour where fan behavior is dense enough to convert physically.

---

### Playbook 8: Authentic Growth

**Inspired by:** Billie Eilish and Finneas’ early management approach.

#### Core principle
Grow at the speed of real demand, not ego.

#### Use when
- The artist is spiking quickly.
- The team may skip steps.
- The artist’s weirdness or authenticity could be over-polished.
- The team may scale live, brand, or media too quickly.

#### Ask internally
- Is communication still authentic?
- Is growth too fast for the live show or team?
- Are fans still seeing the artist they connected with?
- Is scarcity being used properly?
- Is the team commercializing too aggressively too early?
- Would the earliest fans recognize this artist now?

#### Decision logic
Protect fan intimacy and creative authenticity while scaling.

---

### Playbook 9: World-Building

**Inspired by:** Oliver El-Khatib, The Weeknd/XO, Bad Bunny, Taylor Swift.

#### Core principle
A long-term artist is not just a person with songs. They are a world people want to enter.

#### Use when
- The artist has songs but no recognizable universe.
- The artist needs stronger symbols, content codes, fan rituals, or cultural ownership.
- The team needs to build identity beyond a single track.

#### Ask internally
- What city, crew, sound, phrase, fashion, mood, or symbol belongs to this artist?
- What can the artist own that others cannot credibly own?
- What recurring content formats should exist?
- What fan rituals can be created?
- What visual system repeats?
- What community does the artist represent?
- Does the artist have a taste world?

#### Decision logic
Build a world around the artist so fans have something to recognize, repeat, and enter.

---

### Playbook 10: Fan Psychology & Ownership

**Inspired by:** Taylor Swift / 13 Management.

#### Core principle
Fans should feel like participants in the artist’s story, not only consumers.

#### Use when
- The artist has fan-favorite behavior.
- The team wants to deepen fandom.
- A release can become an event.
- The artist needs direct-to-fan infrastructure.
- The team needs to reduce dependence on platforms.

#### Ask internally
- What do core fans know that casual fans do not?
- What ritual can fans repeat?
- What story are fans participating in?
- Can the release become an event?
- Is the artist collecting direct fan relationships?
- Are fans being rewarded for attention?
- Does this move support long-term ownership?

#### Decision logic
Fan participation is economic infrastructure.

---

### Playbook 11: A&R Breakout

**Inspired by:** modern label A&R and discovery teams.

#### Core principle
Separate a real breakout from a temporary spike.

#### Use when
- The artist or song is growing fast.
- One platform is driving attention.
- The team is deciding whether to scale a campaign.
- The team is evaluating whether a song is a breakout candidate.

#### Ask internally
- Is growth coming from one song or the artist’s full identity?
- Is growth platform-specific or cross-platform?
- Which signal appeared first?
- Is attention converting to streams, saves, follows, and repeat listening?
- Is the current audience aligned with the artist’s direction?
- Is the rise sustainable?
- What is missing before the artist can scale?

#### Decision logic
One platform spike is not enough. Multiple agreeing signals create conviction.

---

### Playbook 12: Playlist & Discovery

**Inspired by:** modern label marketing and playlist strategy.

#### Core principle
Playlist reach is not the same as fan growth.

#### Use when
- Playlist adds or playlist reach are central to the signal.
- A track is entering or leaving playlists.
- The team is deciding whether to increase spend.
- The system needs to judge whether playlist movement is durable.

#### Ask internally
- Which playlists actually matter?
- Are they editorial, algorithmic, user-generated, branded, mood/background, or low-fit?
- Are listeners converting?
- Is playlist retention strong?
- Is the song rising or falling in playlist position?
- Is this a playlist that feeds other discovery?
- Is this placement a vanity metric?
- Are playlist gains aligned with social/discovery signals?

#### Decision logic
A large playlist can still be low-value if the fit and retention are weak.

---

### Playbook 13: Social Contagion

**Inspired by:** TikTok-era management, Charli xcx, Bad Bunny, Billie Eilish.

#### Core principle
Virality is not success unless it converts or strengthens identity.

#### Use when
- TikTok, Instagram Reels, YouTube Shorts, creator activity, memes, or UGC are involved.
- A sound is spreading.
- The artist has attention but unclear conversion.

#### Ask internally
- Are people using the sound or only watching the artist?
- Are creators making original content with it?
- Are fans repeating a phrase?
- Is the song creating behavior?
- Is the format easy to copy?
- Are the right creators using the track?
- Is the trend aligned with the artist’s identity?
- Is attention converting to streams, saves, follows, Shazams, or playlist adds?
- Is this helping the artist’s world or making them look generic?

#### Decision logic
Attention must become attachment, conversion, or stronger identity.

---

### Playbook 14: No Engine

**Inspired by:** every elite manager.

#### Core principle
The system must protect the artist from bad moves.

#### Use always.

#### Ask internally
- What attractive-looking move is strategically wrong right now?
- What should the artist not do yet?
- What would waste money?
- What would weaken positioning?
- What would create noise without conversion?
- What would make the artist look desperate?
- What would confuse the campaign?
- What would be premature?

#### Decision logic
A useful manager says no.

---


## 7A. Chartmetric KPI Translation Layer

This addition is critical. The app should not treat Chartmetric KPIs as random numbers. These scores are useful because they help the system quickly understand the artist’s level, momentum, competitive position, audience quality, and platform shape.

The Manager Intelligence Engine needs a **KPI Translation Layer** that converts Chartmetric-style scores into management meaning.

### Why this matters

A manager does not look at an artist score and stop there. A manager asks:

- What does this score say about the artist’s real career stage?
- Is the artist respected broadly, or only hot this week?
- Is the artist building long-term fanbase or short-term engagement?
- Is the rank improving because the artist is growing, or because peers are slowing down?
- Is popularity coming from one platform or a balanced cross-platform base?
- Is the artist’s engagement unusually strong for their stage?
- Is the city affinity strong enough to affect touring or market activation?
- Is the brand affinity strong enough to affect partnership strategy?
- Is the track score showing playlist durability or temporary exposure?

The system must translate these metrics into artist memory so Manager Chat, Today’s Brief, song reads, project reads, and downstream mission generation can all answer smarter questions.

---

### Chartmetric Artist Score

#### What it means
Chartmetric Artist Score is a normalized 0–100 score that compares artists’ performance across streaming and social platforms. It reflects both fanbase scale and engagement/current relevance. It is relative, so an artist’s score can move because of their own performance and because the surrounding competitive environment changes.

#### How to use it
Use it as a broad artist-strength signal, not a complete diagnosis.

The score helps with:
- artist stage classification
- cross-platform relevance
- benchmark comparisons
- momentum confirmation
- competitive positioning
- manager-level summary

#### How not to use it
Do not use Artist Score alone to decide:
- whether an artist is breaking
- whether to tour
- whether to sign a deal
- whether to increase spend
- whether a song is working

Artist Score is a strong headline metric, but management decisions need supporting signals.

#### Manager interpretation examples
- High score + high engagement = established artist with current relevance.
- High score + weak engagement = large fanbase but possible cooling or passive audience.
- Medium score + explosive recent momentum = potential breakout candidate.
- Low score + unusually high engagement = early-stage artist with strong fan attachment.
- Rising score + falling rank = artist is improving, but competitors are improving faster.
- Stable score + rising rank = artist may be holding while peers decline.

---

### Chartmetric Artist Rank

#### What it means
Artist Rank places the artist’s Chartmetric Score in context against other artists. Rank is relative. A better rank means the artist is closer to the top of the global Chartmetric artist universe.

#### How to use it
Use rank to understand competitive context:
- global standing
- market comparability
- whether an artist is operating at developing, mid-level, mainstream, superstar, or legendary scale
- whether improvement is meaningful compared with peers

#### Management interpretation
Rank is useful for boardroom-style questions:
- “How serious is this artist globally?”
- “Is this artist still developing, or already mainstream?”
- “Is this artist strong enough to justify bigger investment?”
- “Is this artist moving up against their peer set?”

#### Caution
Rank can fall even if the artist improves, because other artists can improve faster. The system should never treat rank movement without context.

---

### Career Stage

#### What it means
Career Stage is a long-term view of the artist’s level. It should be based on stabilized performance, not daily spikes.

Recommended internal stages:
- Emerging / Seed
- Developing
- Mid-Level
- Mainstream
- Superstar
- Legendary / Legacy

Chartmetric’s own career-stage methodology uses a long-term view of Artist Score and separates artists into stages such as Developing, Mid-Level, Mainstream, Superstar, and Legendary. The app can use Chartmetric’s provided stage directly when available, but should enrich it with internal interpretation.

#### How to use it
Career Stage should control the advice the system gives.

Examples:
- Developing artist: prove identity, convert early fans, clean catalog, build repeatable content, avoid premature scale.
- Mid-Level artist: build market focus, identify breakout tracks, improve team infrastructure, strengthen release strategy.
- Mainstream artist: protect positioning, optimize campaigns, build touring/brand leverage, deepen fanbase.
- Superstar artist: eventize releases, protect scarcity, manage global markets, maximize ownership and leverage.
- Legendary/Legacy artist: activate catalog, touring, sync, documentaries, fan rituals, anniversary campaigns, and rights value.

#### Critical rule
Do not give a Developing artist a Superstar strategy. Do not give a Superstar artist a Developing artist strategy.

---

### Recent Momentum / Artist Growth

#### What it means
Recent Momentum or Artist Growth shows direction: whether the artist is rising, flat, or declining relative to their stage/peer group. It is different from Career Stage.

Career Stage asks:
> Where has the artist settled?

Momentum asks:
> Which direction is the artist moving now?

#### How to use it
Use momentum to decide urgency.

Examples:
- Developing + explosive momentum = potential early breakout; focus on conversion and proof.
- Mid-Level + strong growth = candidate for bigger campaign, market expansion, or label attention.
- Mainstream + flat momentum = protect base and find new era/campaign trigger.
- Superstar + decline = diagnose overexposure, weak release cycle, poor fan engagement, or market fatigue.
- Legacy + renewed momentum = catalog revival or eventization opportunity.

#### Caution
A very recent viral spike may not fully appear in slower moving growth metrics. Use daily Artist Score movement, TikTok, Shazam, playlist, and streaming deltas for real-time reads.

---

### Fan Base Rank

#### What it means
Fan Base Rank reflects long-term accumulated audience. It is the slower, more durable side of artist strength.

It is connected to:
- followers
- subscribers
- long-term audience size
- accumulated platform base

#### How to use it
Use Fan Base Rank to answer:
- Does this artist have a real base?
- Is the artist’s audience durable?
- Can the artist absorb bigger campaigns?
- Is the artist bigger than one song?
- Is the artist likely to have repeatable demand?

#### Management interpretation
- Strong Fan Base Rank + weak Engagement Rank = established but possibly cooling.
- Weak Fan Base Rank + strong Engagement Rank = hot but not yet converted into durable fanbase.
- Strong Fan Base Rank + strong Engagement Rank = strong career position.

---

### Engagement Rank

#### What it means
Engagement Rank reflects current relevance and activity. It captures the hotter, more immediate side of artist performance.

It is connected to:
- recent streams
- playlist movement
- views
- likes
- comments
- shares
- page activity
- short-term platform movement

#### How to use it
Use Engagement Rank to answer:
- Is the artist hot right now?
- Is current attention stronger than the artist’s historical base?
- Is this a real moment or only old audience size?
- Is campaign activity working?

#### Management interpretation
- Engagement much stronger than Fan Base = current spike; convert attention into followers/saves.
- Fan Base much stronger than Engagement = large artist with cooling relevance; find new campaign/era trigger.
- Both rising = scale campaign carefully.
- Engagement rising only on one platform = call it a platform spike until other signals confirm.

---

### Social Engagement Score

#### What it means
Social Engagement Score measures how actively fans interact with an artist’s content, adjusted against audience size and career stage.

This matters because a smaller artist can sometimes have healthier fan activity than a large artist with passive reach.

#### How to use it
Use it to answer:
- Are fans actually reacting?
- Is the audience alive or passive?
- Is content creating behavior?
- Does the artist have community energy?
- Is social reach becoming fan attachment?

#### Manager interpretation
- High social engagement for a Developing artist = strong early community; protect authenticity.
- Low social engagement for a Mainstream artist = potential overexposure or weak content fit.
- High TikTok reach but low social engagement = people are watching, not attaching.
- Strong engagement but weak streaming conversion = content is working, funnel is weak.

---

### Network Strength Score

#### What it means
Network Strength Score measures quality of social connections, not just quantity. It looks at who follows or connects with the artist and how influential/selective those connections are.

#### How to use it
Use it to answer:
- Is the artist connected to influential people?
- Is the artist gaining industry/cultural attention?
- Is there co-sign potential?
- Are there partnership/collaboration openings?
- Is the artist respected by tastemakers even before mass audience catches up?

#### Manager interpretation
- High Network Strength + low general popularity = tastemaker momentum; handle carefully, do not over-commercialize too early.
- High Network Strength + strong engagement = strong collaboration/press leverage.
- Low Network Strength + high viral attention = public attention without industry network; build relationships.
- Rising Network Strength = check who followed, mentioned, or engaged; this may create strategic openings.

---

### City Affinity Scores

#### What it means
City Affinity identifies cities where an artist’s audience is disproportionately concentrated compared with normal distribution. This is more useful than raw listener count alone.

A city with fewer listeners but high affinity may be more strategically valuable than a city with many passive listeners.

#### How to use it
Use City Affinity for:
- tour planning
- pop-up shows
- radio/local press
- campus activation
- diaspora strategy
- creator seeding
- local playlist/editorial strategy
- brand partnerships

#### Manager interpretation
- High city listener count + high affinity = power market.
- Low listener count + high affinity = emerging pocket worth testing.
- High listener count + low affinity = passive scale; do not over-prioritize without engagement.
- Rising city affinity + rising Shazams = local discovery moment.
- City affinity + strong social engagement = possible live activation.

---

### Brand Affinity Scores

#### What it means
Brand Affinity measures overlap between the artist’s audience and specific brands or brand categories.

#### How to use it
Use Brand Affinity for:
- brand partnership fit
- sponsorship strategy
- fashion/consumer/lifestyle alignment
- campaign targeting
- avoiding bad brand deals
- understanding fan taste profile

#### Manager interpretation
- High brand affinity with strong audience fit = partnership opportunity.
- High-paying brand with low affinity = possible positioning risk.
- Brand affinity matching artist world = strong strategic fit.
- Brand affinity outside artist world = investigate before recommending.

#### Important
Do not recommend brand partnerships solely because affinity exists. The brand must also fit the artist’s identity and career stage.

---

### Mood Tags

#### What they mean
Mood tags describe how listeners or platform contexts emotionally perceive tracks or artists. They can come from playlist language, user descriptions, and contextual patterns.

#### How to use them
Use mood tags to enrich:
- artist world
- campaign language
- visual direction
- content tone
- sync positioning
- playlist pitching
- fan messaging

#### Manager interpretation
- If mood tags match artist identity, strengthen that world.
- If mood tags conflict with campaign positioning, flag a positioning mismatch.
- If a track has strong mood clarity, use it for playlist and sync targeting.
- If mood tags are scattered, the artist/project may lack emotional clarity.

---

### Genre Tags

#### What they mean
Genre tags classify artists/tracks based on playlist context, co-occurrence with other artists, and platform/community signals.

#### How to use them
Use genre tags to:
- understand the artist’s actual market context
- compare against peer artists
- detect genre drift
- guide playlist pitching
- avoid wrong collaborations
- identify subgenre communities

#### Manager interpretation
- Official genre and audience-perceived genre may differ. The audience perception often matters more for campaign targeting.
- If genre tags are shifting after a release, the artist may be entering a new lane.
- If genre tags are too broad, positioning may be weak.

---

### Chartmetric Track Score

#### What it means
Chartmetric Track Score is a track-level score. According to Chartmetric’s glossary, it is a weighted calculation of historical and 28-day Spotify playlist count on a 1–100 scale.

#### How to use it
Use it to understand playlist durability and track-level playlist strength.

#### Management interpretation
- High Track Score + strong conversion = strong track asset.
- High Track Score + weak conversion = playlist exposure without attachment.
- Low Track Score + high Shazams/TikTok = discovery is ahead of playlist support; pitch/playlist opportunity.
- Rising Track Score on older song = catalog revival candidate.
- Track Score stronger than project context = push the track, not the whole project.

#### Caution
Track Score is not the same as song quality or fan love. It is a playlist-performance signal and must be interpreted with saves, Shazams, UGC, streams, and market movement.

---

### Spotify Popularity Index

#### What it means
Spotify Popularity Index is a 0–100 score from Spotify that reflects relative artist or track popularity on Spotify.

#### How to use it
Use it as a Spotify-specific popularity signal.

#### Manager interpretation
- High Spotify popularity + low cross-platform score = Spotify-heavy artist; diversify.
- Low Spotify popularity + high TikTok/Shazam = discovery is not yet converting to Spotify.
- Rising Spotify popularity after TikTok movement = conversion beginning.
- Strong Spotify popularity but weak social engagement = passive listening risk.
- Track popularity rising faster than artist popularity = song-first attention; convert to artist followers.

#### Caution
Spotify Popularity is platform-specific. Do not treat it as global artist health.

---

## 7B. KPI-to-Artist-Memory Mapping

The Artist Operating Profile should store both raw KPIs and interpreted meanings.

### Add to Artist Operating Profile

```json
{
  "kpi_profile": {
    "chartmetric_artist_score": {
      "value": "number | null",
      "interpretation": "string",
      "trend": "rising | falling | stable | unknown",
      "confidence": "High | Medium | Low"
    },
    "chartmetric_artist_rank": {
      "value": "number | null",
      "interpretation": "string",
      "trend": "improving | declining | stable | unknown"
    },
    "career_stage_from_chartmetric": {
      "value": "string | null",
      "interpretation": "string"
    },
    "internal_career_stage": {
      "value": "string",
      "reason": "string"
    },
    "recent_momentum": {
      "value": "Explosive | Strong Growth | Growth | Even | Decline | Unknown",
      "interpretation": "string"
    },
    "fan_base_rank": {
      "value": "number | null",
      "interpretation": "string"
    },
    "engagement_rank": {
      "value": "number | null",
      "interpretation": "string"
    },
    "social_engagement_score": {
      "value": "number | null",
      "interpretation": "string"
    },
    "network_strength_score": {
      "value": "number | null",
      "interpretation": "string"
    },
    "city_affinity": [
      {
        "city": "string",
        "score": "number | null",
        "role": "power_market | emerging_pocket | passive_market | avoid_for_now",
        "interpretation": "string"
      }
    ],
    "brand_affinity": [
      {
        "brand_or_category": "string",
        "score": "number | null",
        "fit": "strong | possible | weak | risky | unknown",
        "interpretation": "string"
      }
    ],
    "mood_tags": ["string"],
    "genre_tags": ["string"],
    "spotify_popularity": {
      "artist_value": "number | null",
      "interpretation": "string"
    }
  }
}
```

### Add to Track Read

```json
{
  "track_kpi_profile": {
    "chartmetric_track_score": {
      "value": "number | null",
      "interpretation": "string"
    },
    "spotify_popularity": {
      "value": "number | null",
      "interpretation": "string"
    },
    "playlist_strength": {
      "interpretation": "string"
    },
    "discovery_gap": {
      "interpretation": "string"
    },
    "conversion_gap": {
      "interpretation": "string"
    }
  }
}
```

---

## 7C. KPI Interpretation Rules

### Rule 1: Separate stage from momentum
An artist can be:
- Developing but exploding.
- Mainstream but declining.
- Superstar but flat.
- Mid-Level but breaking quickly.

Do not collapse these into one label.

### Rule 2: Compare Fan Base Rank and Engagement Rank
This comparison is one of the most useful reads.

Use:
- Fan Base stronger than Engagement = established base, weaker current heat.
- Engagement stronger than Fan Base = current heat, weaker long-term base.
- Both strong = healthy position.
- Both weak = early or inactive artist.

### Rule 3: Use Artist Score for broad strength, not tactical proof
Artist Score helps with overall position, but tactical actions need platform, song, market, and conversion signals.

### Rule 4: Use Rank for competitive context
Rank explains where the artist sits against the market, not just whether the artist improved personally.

### Rule 5: Use Career Stage to control advice
The same data point means different things at different stages.

Example:
- 50K new listeners may be huge for a Developing artist.
- 50K new listeners may be noise for a Superstar.

### Rule 6: Use Social Engagement Score to detect audience life
High followers with weak engagement means passive audience risk. Smaller audience with strong engagement can be more valuable.

### Rule 7: Use Network Strength to detect hidden leverage
A rising artist with strong network strength may have industry/tastemaker support before public-scale metrics catch up.

### Rule 8: Use City Affinity over raw city count for activation decisions
City affinity can reveal cities where the artist over-indexes and may have stronger fan density.

### Rule 9: Use Brand Affinity as fit signal, not automatic recommendation
Brand affinity must pass artist-world and positioning checks.

### Rule 10: Use Mood/Genre Tags to enrich the artist world
These tags should shape campaign language, playlist strategy, visuals, and sync positioning.

### Rule 11: Use Track Score as playlist-strength signal
Track Score does not prove fandom. Always combine with saves, Shazams, streams, UGC, and market movement.

### Rule 12: Use Spotify Popularity as platform-specific signal
Spotify Popularity is useful but should not be treated as global career strength.

---

## 7D. Example KPI-Based Manager Interpretations

### Example 1: Developing artist with high engagement
Input:
- Career Stage: Developing
- Artist Score: low/moderate
- Engagement Rank: much stronger than Fan Base Rank
- Social Engagement Score: high
- City Affinity: strong in Lagos and Accra

Manager read:
> The artist is still early, but the audience that exists is active. Do not chase broad expansion yet. Build Lagos and Accra proof, convert engagement into follows/saves, and strengthen the artist world before increasing spend.

### Example 2: Viral artist with weak fanbase
Input:
- TikTok activity high
- Engagement Rank rising
- Fan Base Rank weak
- Spotify Popularity rising only on one track
- Artist Score improving but still low

Manager read:
> This is a song-first spike, not a confirmed artist breakout. The next move is conversion: full-track saves, artist follows, and repeat listening. Do not announce a large project or tour until the artist, not just the song, starts moving.

### Example 3: Mainstream artist cooling
Input:
- Career Stage: Mainstream
- Fan Base Rank strong
- Engagement Rank declining
- Artist Score stable/falling
- Social Engagement Score below stage expectation

Manager read:
> The artist has a durable base but weak current heat. This is not an awareness problem. It is an era problem. The next move should create a clearer campaign world or stronger song trigger, not more generic content.

### Example 4: Track with playlist strength but weak conversion
Input:
- Track Score high
- Playlist reach high
- Saves/follows weak
- Shazams flat
- TikTok weak

Manager read:
> The track is getting exposure, but not attachment. Do not increase spend yet. Check playlist fit and retention. Test live/lyric/story content to see whether listeners connect emotionally outside playlist context.

### Example 5: Strong city affinity but smaller raw audience
Input:
- London raw listeners below Lagos
- London City Affinity high
- London social engagement strong
- Shazams rising in London

Manager read:
> London is not the largest market, but it is over-indexing. Treat it as a high-quality diaspora pocket. Test targeted creator, press, or listening-room activation before a broad UK campaign.

---

## 7E. How KPI Intelligence Should Improve Manager Chat

Manager Chat should use KPI memory to answer questions respectfully and intelligently.

### Example user question
“Is this artist still developing or already mainstream?”

Bad answer:
> They have 3.8M monthly listeners, so they are mainstream.

Good answer:
> They may look mainstream by monthly listeners, but the better read depends on score, rank, fanbase depth, engagement rank, and catalog spread. If their Engagement Rank is much stronger than Fan Base Rank, they may be in a high-attention breaking moment rather than a fully durable mainstream position.

### Example user question
“Should we pitch labels now?”

Good answer:
> Not yet if the current momentum is mostly engagement-led and the fanbase rank is still weak. The better move is to build 30–60 days of proof around saves, repeat listening, city affinity, and playlist retention so the conversation happens from leverage, not excitement.

### Example user question
“Why Lagos first?”

Good answer:
> Lagos should lead only if it combines raw audience, affinity, and conversion behavior. If Lagos has the highest listeners but weak affinity or engagement, it may be a passive market. If Lagos also shows strong affinity, Shazams, and social engagement, it becomes the power market.

### Example user question
“Is this song worth pushing?”

Good answer:
> It depends on whether the song has more than playlist exposure. If Track Score and playlist reach are strong but saves, Shazams, UGC, and repeat listening are weak, it is not yet a strong push candidate. It may need conversion testing before more spend.

---

## 7F. Engineering Requirements for KPI Handling

### Normalization
Create a KPI normalization utility.

Suggested file:
```text
src/lib/manager-intelligence/normalize/chartmetricKpiNormalize.ts
```

It should map raw API fields into normalized internal fields.

### Interpretation
Create a KPI interpreter.

Suggested file:
```text
src/lib/manager-intelligence/profile/kpiInterpreter.ts
```

It should output:
- raw value
- trend
- interpretation
- confidence
- missing data warnings
- downstream usage notes

### Career stage classifier
Update:
```text
src/lib/manager-intelligence/profile/careerStageClassifier.ts
```

It should use:
- Chartmetric Career Stage when available
- Artist Score
- Artist Rank
- Fan Base Rank
- Engagement Rank
- Recent Momentum
- platform spread
- catalog depth
- monthly listeners
- follower base
- market concentration

### Manager memory
Update:
```text
src/lib/manager-intelligence/memory/artistMemory.ts
```

It should store KPI interpretations, not only raw values.

### Strategic packet
Update `StrategicIntelligencePacket` to include:

```json
{
  "kpi_read": {
    "artist_score_read": "string",
    "rank_read": "string",
    "career_stage_read": "string",
    "momentum_read": "string",
    "fanbase_vs_engagement_read": "string",
    "network_strength_read": "string",
    "social_engagement_read": "string",
    "city_affinity_read": "string",
    "brand_affinity_read": "string",
    "mood_genre_read": "string",
    "spotify_popularity_read": "string",
    "track_score_reads": ["string"]
  }
}
```

Do not show all of this in Today’s Brief by default. Use it to make the brief, chat, song reads, and project reads smarter.

---

## 7G. Updated Acceptance Criteria for KPI Intelligence

The KPI upgrade is successful when:

1. The app stores Chartmetric-style scores as interpreted memory, not just raw numbers.
2. Career stage is improved by Artist Score, Rank, Career Stage, Fan Base Rank, Engagement Rank, and Recent Momentum.
3. Manager Chat can answer stage/momentum/popularity questions without relying only on monthly listeners.
4. Song reads use Track Score and Spotify Popularity correctly.
5. Market decisions use City Affinity, not only raw city listeners.
6. Brand recommendations use Brand Affinity but still pass artist-world and positioning checks.
7. Social recommendations consider Social Engagement Score and career-stage expectations.
8. The system distinguishes long-term fanbase from short-term heat.
9. The system can say: “This artist is hot, but not yet durable.”
10. The system can say: “This artist has a large base, but current engagement is cooling.”
11. Missing KPI fields lower confidence instead of causing hallucinations.

---


## 7. Artist Operating Profile

The Artist Operating Profile should be generated or updated before any high-quality Today’s Brief, Manager Chat answer, song read, project read, or mission generation.

### Required fields

```json
{
  "artist_id": "string",
  "artist_name": "string",
  "last_updated": "date",
  "career_stage": "Seed | Developing | Breaking | Emerging | Mid-level | Mainstream | Superstar | Legacy | Unknown",
  "career_stage_reason": "string",
  "platform_shape": {
    "primary_shape": "TikTok-led | Spotify-led | Apple-led | YouTube-led | Instagram-led | Shazam-led | Playlist-led | Radio-led | Live-led | Catalog-led | Fragmented | Unknown",
    "description": "string",
    "risk": "string"
  },
  "market_shape": {
    "power_markets": ["string"],
    "secondary_markets": ["string"],
    "emerging_markets": ["string"],
    "passive_markets": ["string"],
    "markets_to_avoid_for_now": ["string"],
    "description": "string"
  },
  "catalog_shape": {
    "current_drivers": ["string"],
    "breakout_candidates": ["string"],
    "sleepers": ["string"],
    "catalog_revival_candidates": ["string"],
    "risk_assets": ["string"],
    "description": "string"
  },
  "artist_world": {
    "emotional_world": "string",
    "cultural_base": "string",
    "visual_codes": ["string"],
    "recurring_themes": ["string"],
    "fan_language": ["string"],
    "what_not_to_dilute": ["string"],
    "world_building_gap": "string"
  },
  "strategic_risks": [
    {
      "risk": "string",
      "why_it_matters": "string",
      "severity": "High | Medium | Low"
    }
  ],
  "current_priority": "string"
}
```

### Career stage rules

Do not classify career stage by monthly listeners alone.

Use:
- monthly listeners
- follower base
- growth velocity
- platform spread
- market concentration
- chart movement
- playlist quality
- song depth
- release history
- social conversion
- live demand where available
- fan attachment signals

### Platform shape examples

- “TikTok-led, weak owned-fan conversion.”
- “Playlist-led, passive listener risk.”
- “Shazam-led discovery, weak social identity.”
- “YouTube-led regional audience, low playlist penetration.”
- “Fragmented momentum across TikTok, Shazam, and playlists.”

### Catalog shape rules

Selected tracks should be classified by management role, not only size.

Roles:
- current driver
- breakout candidate
- sleeper
- catalog revival candidate
- TikTok candidate
- playlist candidate
- live-show anchor
- fan-favorite
- sync candidate
- underperforming current single
- overexposed/weak conversion
- declining asset
- unsupported release
- unknown

---

## 8. Selecting Management-Relevant Songs and Projects

The app should not ingest the whole catalog by default. It should ingest the assets that matter to management decisions.

### Track selection logic

Always consider:
- latest release
- track tied to active campaign
- top track by current momentum
- top track by playlist movement
- top track by TikTok/UGC movement
- top track by Shazam/discovery movement
- top track by YouTube movement
- top track by market/city movement
- track referenced by user/team
- track previously identified as strategic

Also include if detected:
- older song resurfacing
- high saves but low reach
- high Shazams but weak playlist support
- high TikTok activity but weak streaming conversion
- strong city/country concentration
- decline after marketing push
- brand/sync potential
- live-show potential
- track carrying the project
- track with abnormal movement

### Project selection logic

Select projects using:
- latest project
- project tied to current campaign
- project containing tracks with current signals
- project with catalog revival behavior
- project with playlist/chart activity
- project representing the current era
- project with strategic importance even if not currently biggest

### Key rule
The newest song is not automatically the priority. The priority is the song creating the strongest career decision.

---

## 9. Signal Classification

Before the system interprets data, it must classify signals.

### Signal types

#### Attention signal
People are noticing.
Examples:
- TikTok views
- video views
- impressions
- creator posts
- press mentions

#### Conversion signal
Attention is becoming listening or fandom.
Examples:
- streams
- saves
- follows
- repeat listening
- full-track movement
- playlist retention

#### Discovery signal
People are searching or identifying the music.
Examples:
- Shazams
- search movement
- profile visits where available
- discovery chart movement

#### Fan signal
People are showing attachment.
Examples:
- comments
- saves
- shares
- repeat listening
- UGC quality
- fan language
- direct fan signups
- merch demand

#### Market signal
A location is becoming strategically important.
Examples:
- city-level listener growth
- country rank movement
- local playlist movement
- local creator activity
- local Shazam movement

#### Playlist signal
Playlist environment is changing.
Examples:
- playlist adds
- playlist removals
- reach
- position movement
- playlist type
- retention

#### Live signal
Evidence of possible physical demand.
Examples:
- city concentration
- engagement density
- ticket/waitlist/event data
- comments asking for shows
- local fan clusters

#### Catalog signal
Older music is gaining value.
Examples:
- old track resurfacing
- catalog playlist adds
- sync/radio activity
- TikTok revival

#### Risk signal
Something looks good but may be dangerous.
Examples:
- one-platform spike
- attention without conversion
- playlist reach without retention
- inflated views
- overexposure
- weak brand fit
- market mismatch

---

## 10. Signal Rules

These are hard rules.

### Rule 1: One signal is not enough for major decisions
If only TikTok is rising, call it a spike.  
If TikTok + Shazam + saves are rising, call it momentum.  
If TikTok + Shazam + saves + city concentration + playlist adds are rising, call it breakout potential.

### Rule 2: Streams are weaker than repeat behavior
Raw streams matter, but repeat listeners, saves, playlist retention, Shazams, UGC quality, comments, and ticket interest are stronger management signals.

### Rule 3: Not all markets are equal
A smaller city with high engagement can be more valuable than a large city with passive streams.

### Rule 4: Not all playlists are equal
Playlist reach is not the same as fan growth. Inspect playlist type, fit, retention, curator behavior, and conversion.

### Rule 5: Newest song is not always priority
Support the song with the strongest career signal, not automatically the latest release.

### Rule 6: Advice must match career stage
- Developing artist: prove identity and fan response.
- Breaking artist: convert attention into owned fans.
- Emerging artist: build repeatable era and market focus.
- Established artist: protect positioning and maximize leverage.
- Superstar: eventize, protect scarcity, expand business.
- Legacy: activate catalog, community, live, sync, and rights.

### Rule 7: Every insight must create a decision
If the insight does not affect a decision, do not include it in the user-facing brief.

### Rule 8: Every recommendation needs evidence
No evidence, no recommendation.

### Rule 9: Every output needs an “avoid” judgment
The exact UI label can change, but the system must say what not to do.

### Rule 10: Confidence must be explained
Confidence level must be tied to signal agreement, data freshness, and missing fields.

---


## 10A. Available Evidence Discipline

This rule is critical for product quality.

The system must make the best possible management read from the data it actually has. It should not behave like it is unhappy, blocked, or constantly complaining about missing fields.

A great manager does not spend the meeting saying:
> “I do not have this, I do not have that, I cannot know this.”

A great manager says:
> “Based on what we can see, this is the strongest read. Here is the move. Here is what we should watch next.”

The product should follow the same behavior.

---

### Core principle

Use available evidence aggressively and intelligently. Mention missing data only when it materially affects confidence, risk, or the next decision.

Do not make missing data the main story.

---

### What the system should do

When some metrics are missing, the system should:

1. Use the strongest available signals.
2. Avoid hallucinating unavailable metrics.
3. Lower confidence only when the missing field affects the decision.
4. Mention the missing field briefly, not repeatedly.
5. Reframe missing data as a watch item, not a complaint.
6. Still produce a useful management read.
7. Still provide a next move.
8. Still say what not to do if the available evidence supports it.

---

### What the system should not do

Do not write:
- “We do not have saves data, so we cannot determine anything.”
- “Repeat listener data is missing, so this brief is limited.”
- “Because we lack conversion data, no recommendation can be made.”
- “The system needs more data before giving a useful read.”
- “There is insufficient data” unless the dataset is genuinely too weak to support any decision.

This makes the product feel weak.

Instead, the system should say:
> “The strongest available signals point to a conversion moment. Confidence is medium because save/follow movement is not available yet, so the next read should watch whether attention turns into owned audience.”

That is useful, honest, and still managerial.

---

### UI behavior

The user-facing UI should emphasize:
- what the system knows
- what matters
- what the next move is
- what should be avoided
- what to watch next

The UI should not over-emphasize:
- missing fields
- data limitations
- uncertainty language
- technical caveats
- unavailable metrics

Missing data can appear in:
- confidence reason
- “what to watch next”
- supporting evidence
- admin/debug mode

Missing data should not dominate:
- priority headline
- opening diagnosis
- manager’s read
- first move
- market read

---

### Confidence wording

Bad:
> Low confidence because saves, repeat listeners, playlist retention, conversion, and follower deltas are missing.

Better:
> Medium confidence. TikTok, Shazam, and market concentration point in the same direction; save/follow movement would confirm whether the attention is becoming owned fandom.

Bad:
> We cannot confirm if the artist is breaking because we lack complete data.

Better:
> This should be treated as a strong spike until more conversion signals confirm breakout behavior.

Bad:
> There is no repeat listener data.

Better:
> Repeat behavior is the next thing to watch before scaling spend.

---

### Missing data hierarchy

Only mention missing data when it changes the management decision.

#### High-importance missing data
Mention briefly if absent and relevant:
- save/follow movement when judging conversion
- playlist retention when judging playlist quality
- city deltas when judging market activation
- track-level movement when deciding which song to push
- rights/metadata/splits when judging deal readiness
- ticket/live demand when recommending shows
- recent movement when creating a daily brief

#### Medium-importance missing data
Mention only if useful:
- audience demographics
- brand affinity
- mood tags
- similar artists
- creator quality
- press/radio/sync data

#### Low-importance missing data
Usually do not mention:
- any metric that does not affect the current decision
- niche data points unrelated to the priority
- fields that are nice-to-have but not necessary for the current read

---

### Fallback strategy when key data is missing

If a preferred metric is unavailable, use proxy signals.

Examples:

#### If saves are unavailable
Use:
- follower movement
- repeat platform activity if available
- Shazams
- playlist retention
- comments asking for the song
- UGC quality
- full-track streaming movement
- track popularity movement

#### If repeat listeners are unavailable
Use:
- streaming trend stability
- follower growth
- playlist retention
- track rank stability
- city-level persistence
- social comments and shares
- Shazam persistence

#### If playlist retention is unavailable
Use:
- playlist add/removal movement
- playlist type
- position movement
- playlist fit
- duration since add
- downstream streaming change

#### If city-level deltas are unavailable
Use:
- current top cities
- city affinity
- country rank
- local social signals
- Shazam by market if available
- audience concentration

#### If brand affinity is unavailable
Use:
- artist world
- audience demographics
- genre/mood tags
- platform audience
- comparable artists
- cultural positioning

#### If chart movement is unavailable
Use:
- platform growth
- playlist movement
- Shazam
- social movement
- rank/score movement

---

### Prompt rule

Every generation prompt should include:

```text
Use the strongest available evidence. Do not complain about missing data. Mention missing metrics only when they materially affect confidence or the next decision. If a preferred metric is unavailable, use reasonable proxy signals and clearly state the read based on available evidence. The user-facing output should focus on what is known, what it means, and what to do next.
```

---

### Strategic packet rule

The Strategic Intelligence Packet can track missing data more fully for internal use.

But the Today’s Brief renderer should compress missing data into:
- confidence reason
- watch item
- evidence caveat

Do not let internal uncertainty leak into the user interface as weakness.

---

### Example: Good handling of missing data

Input:
- TikTok attention high
- Shazams high
- Lagos listeners high
- playlist reach high
- saves unavailable
- repeat listeners unavailable

Bad output:
> We do not have saves or repeat listeners, so we cannot know if this is conversion.

Good output:
> The strongest available read is a conversion moment. TikTok is creating attention, Shazam shows discovery intent, and Lagos gives the team a clear market to test first. Treat this as momentum, not confirmed breakout yet. The next thing to watch is whether full-track listening, follows, playlist retention, or other owned-audience signals start moving.

---

### Acceptance criteria for this rule

The implementation is successful when:
1. Missing data does not dominate user-facing outputs.
2. The system still gives useful reads from partial data.
3. Missing fields lower confidence only when relevant.
4. Missing data is framed as “what to watch,” not “why we cannot help.”
5. The brief feels like a smart manager using available information, not a system complaining about unavailable fields.
6. The app never invents metrics to fill gaps.
7. The UI remains confident, useful, and honest.

## 11. Strategic Intelligence Packet

This is the central output from the Manager Intelligence Engine.

It should include more information than Today’s Brief displays. Downstream systems will use the packet later.

### Important
The Strategic Intelligence Packet may include internal playbook routing for logs/debugging, but the UI must not render it.

### Suggested schema

```json
{
  "packet_id": "string",
  "artist_id": "string",
  "artist_name": "string",
  "created_at": "datetime",
  "data_freshness": {
    "status": "Fresh | Partial | Stale | Unknown",
    "reason": "string",
    "missing_critical_fields": ["string"]
  },
  "artist_operating_profile_ref": "string",
  "executive_read": {
    "priority": "string",
    "manager_read": "string",
    "confidence_level": "High | Medium | Low",
    "confidence_reason": "string"
  },
  "strategic_diagnosis": {
    "career_stage": "string",
    "platform_shape": "string",
    "market_shape": "string",
    "catalog_shape": "string",
    "strongest_signal": "string",
    "biggest_risk": "string",
    "current_priority": "string"
  },
  "signal_map": [
    {
      "signal_id": "string",
      "signal_type": "Attention | Conversion | Discovery | Fan | Market | Playlist | Live | Catalog | Risk",
      "asset": "artist | track | project | market | platform",
      "name": "string",
      "metric": "string",
      "value": "string | number",
      "period": "string",
      "direction": "up | down | flat | unknown",
      "interpretation": "string",
      "evidence_strength": "High | Medium | Low"
    }
  ],
  "management_insights": [
    {
      "insight_id": "string",
      "insight": "string",
      "why_it_matters": "string",
      "decision_created": "string",
      "recommended_next_move": "string",
      "avoid": "string",
      "confidence_level": "High | Medium | Low",
      "evidence_ids": ["string"]
    }
  ],
  "asset_reads": [
    {
      "asset_type": "track | project",
      "asset_name": "string",
      "management_role": "string",
      "read": "string",
      "next_move": "string",
      "watch_metric": "string",
      "risk": "string",
      "evidence_ids": ["string"]
    }
  ],
  "market_reads": [
    {
      "market": "string",
      "role": "power_market | secondary_test | emerging_market | passive_market | avoid_for_now",
      "read": "string",
      "next_move": "string",
      "watch_metric": "string",
      "evidence_ids": ["string"]
    }
  ],
  "mission_seed": {
    "primary_mission_direction": "string",
    "supporting_mission_directions": ["string"],
    "do_not_generate_missions_for": ["string"],
    "mission_generation_notes": "string"
  },
  "conversation_memory_seed": {
    "what_manager_should_remember": ["string"],
    "follow_up_questions_it_can_answer_better": ["string"],
    "open_uncertainties": ["string"]
  },
  "internal_only": {
    "playbooks_considered": ["string"],
    "playbooks_applied": ["string"],
    "routing_notes": "Do not display this field in the UI."
  }
}
```

---

## 12. Today’s Brief Renderer

Today’s Brief should be a user-facing summary of the Strategic Intelligence Packet.

It should feel like a sharp manager’s morning read.

It should not show:
- internal playbooks
- model/provider details
- prompt details
- task lists
- checkpoint lists
- full mission plans
- implementation language

### Recommended Today’s Brief sections

#### 1. Priority headline
One direct sentence.

Format:
> Priority: [convert/protect/validate/scale/fix] [specific signal/problem] into [specific outcome] by [specific strategic move].

Example:
> Priority: convert Mavo’s TikTok attention into owned listeners by using Lagos as the first conversion market for “Call Me” and “Energy.”

#### 2. Confidence
Show:
- High / Medium / Low
- short reason

Example:
> Medium confidence: TikTok attention and Shazam activity are strong, but streaming conversion and playlist retention need confirmation.

#### 3. Artist Intelligence Snapshot
Show:
- career stage
- platform shape
- strongest signal
- biggest risk
- market focus
- key songs/projects

This should be short.

#### 4. Manager’s Read
One sharp paragraph:
- What is happening
- Why it matters
- What decision it creates

#### 5. What Changed
3 to 5 bullets. Each should be based on movement or meaningful current signal.

#### 6. Next Move
This replaces task lists.

It should be one main move, optionally with 2 to 3 supporting actions in prose.

Example:
> For the next 72 hours, route the viral asset into full-track saves and follows. Keep Lagos as the conversion center, then test Abuja and Port Harcourt only after Lagos shows movement.

#### 7. Avoid
Mandatory.

Example:
> Do not spend broadly on Instagram yet. It is not carrying the moment. Do not announce a new project until “Call Me” and “Energy” have either converted or cooled.

#### 8. Songs / Projects to Watch
Small table or compact list:
- asset
- role
- why it matters
- what to watch next

No tasks. No checkpoints.

#### 9. Market Read
Short market strategy:
- primary market
- secondary market
- market to avoid or deprioritize

#### 10. Supporting Evidence
Expandable. Show evidence behind the read.

---


## 12A. Setup Today’s Brief / First Manager Read

This is a special version of Today’s Brief shown immediately after artist setup, before the system has mission history, checkpoint results, task progress, or previous brief memory.

This first experience is extremely important. It is the first major screen the artist/team sees after setup. It must make the user feel:

> “This product already understands who this artist is, where they are in their career, what is actually happening, and what the team should focus on first.”

This first screen should feel like an elite manager walking into the first meeting after doing serious homework on the artist.

It should not feel like:
- a generic onboarding summary
- a dashboard report
- a list of metrics
- a task generator
- a chatbot response
- a mission planner

It should feel like:
- a first strategic diagnosis
- a manager’s operating read
- a sharp explanation of the artist’s current position
- a clear first management priority
- proof that the system understands the artist’s data, catalog, market, and risks

### Recommended product name

Internally, call it:

```text
Setup Brief
```

User-facing title options:
- First Manager Read
- Artist Operating Read
- First Strategic Read
- Your Artist Read
- Today’s Brief: First Read

Recommended UI label:

```text
FIRST MANAGER READ
[Artist Name] — Artist Operating Read
```

This can live in the Today’s Brief space, but it should be treated differently from recurring daily briefs.

---

### Difference between Setup Brief and recurring Today’s Brief

#### Setup Brief
Generated once after setup.

It uses:
- artist profile
- Chartmetric-style KPI scores
- artist score/rank/stage
- platform metrics
- top markets/cities
- selected management-relevant tracks
- selected management-relevant projects
- playlist/social/discovery signals
- genre/mood tags
- city affinity
- brand affinity where available
- similar artists
- available bio/context
- user/team goals if collected during setup

It does **not** use:
- previous brief memory
- completed missions
- mission progress
- checkpoint results
- task status
- historical app behavior

Its job:
- establish the artist’s operating profile
- diagnose the current career position
- identify first priority
- identify what to avoid
- decide what future systems should watch
- seed Manager Chat memory
- seed future mission generation

#### Recurring Today’s Brief
Generated after setup, when the system has memory and ongoing activity.

It uses:
- new data movement
- previous brief memory
- open missions
- completed checkpoints
- campaign state
- task outcomes
- signal changes
- previous recommendations

Its job:
- explain what changed
- update the manager’s read
- guide the next move
- warn against bad moves
- keep the team focused

---

## 12B. What the Setup Brief Must Achieve

The Setup Brief must prove four things immediately.

### 1. “We know who this artist is”
The system should clearly describe the artist’s identity, stage, platform shape, market shape, and catalog shape.

Example:
> Mavo is not simply a high-streaming artist. The current shape is TikTok-led attention with Lagos-first listener concentration and a small owned social base compared with the scale of the viral asset.

### 2. “We know what is real and what may be misleading”
The system should separate vanity metrics from durable signals.

Example:
> The 1.4B-view TikTok asset is powerful public leverage, but it is not the same as owned fandom. The real test is whether the attention converts into saves, follows, repeat listening, and city-level retention.

### 3. “We know the first management priority”
The setup screen should land on one clear priority.

Example:
> The first priority is conversion, not more awareness.

### 4. “We know what not to do yet”
The setup screen must protect the artist from bad early moves.

Example:
> Do not treat this as a confirmed breakout until TikTok, Shazam, playlist retention, and streaming conversion agree.

---

## 12C. Setup Brief User-Facing Structure

The Setup Brief should be shorter than a full report but richer than a normal daily brief.

### Recommended sections

#### 1. Opening Diagnosis
A strong top headline that says what the system sees.

Format:
```text
[Artist Name] is in a [career situation] moment: [main opportunity], but [main risk].
```

Example:
> Mavo is in a high-attention conversion moment: the audience is watching, but the team now has to turn that attention into owned listeners.

#### 2. Artist Operating Read
This is the “we know you” section.

It should answer:
- what stage the artist appears to be in
- what platform shape the artist has
- what markets matter first
- what kind of catalog situation exists
- what the main opportunity is
- what the main risk is

Example:
> Mavo’s current operating shape is TikTok-led with a Lagos power base. The artist has major public attention, meaningful streaming scale, and discovery infrastructure through Shazam and playlists. The risk is that the viral asset may be larger than the owned fanbase, so the next phase should focus on converting attention into durable listeners.

#### 3. What We See
A compact signal breakdown, not a metric dump.

Recommended buckets:
- Career position
- Platform shape
- Market center
- Catalog drivers
- Discovery signal
- Fanbase risk

Example:
```text
Career position: High-attention / breaking-conversion stage.
Platform shape: TikTok-led, streaming conversion still needs proof.
Market center: Lagos first, Abuja and Port Harcourt as secondary tests.
Catalog drivers: “Call Me” and “Energy” are the immediate conversion assets.
Discovery signal: Shazam and playlist reach suggest people are looking, not only watching.
Main risk: attention may be ahead of owned fandom.
```

#### 4. First Management Priority
One clear priority.

Example:
> First priority: convert the TikTok moment into saves, follows, and repeat listening around the tracks already carrying the signal.

#### 5. The First Move
This is not a task list. It is a strategic move.

Example:
> Start with a Lagos-first conversion push. Use the viral asset as the opening hook, but route the audience to the full songs. Treat Abuja and Port Harcourt as secondary tests, not equal priorities yet.

#### 6. What Not To Do Yet
Mandatory.

Example:
> Do not spread the campaign nationally yet. Do not make Instagram the lead channel unless it starts moving. Do not announce a new project until the current tracks either convert or cool.

#### 7. Songs / Projects To Watch
This section should classify assets by management role.

Example:
```text
Call Me — primary conversion track.
Energy — secondary conversion test.
Breaking — campaign context, not necessarily the main push.
```

#### 8. Market Read
The first setup brief must show market intelligence.

Example:
> Lagos is the power market. Abuja and Port Harcourt are secondary lanes. The next decision is not “Nigeria or global”; it is whether Lagos conversion is strong enough to justify broader expansion.

#### 9. Confidence + What We Need To Confirm
The system should be honest.

Example:
> Confidence: Medium. The attention and discovery signals are strong, but the system still needs streaming conversion, playlist retention, save/follow movement, and short-term city deltas to confirm whether this is a full breakout or a strong spike.

---

## 12D. Setup Brief Output Schema

This is the renderer schema for the first setup brief.

```json
{
  "setup_brief_id": "string",
  "artist_id": "string",
  "artist_name": "string",
  "created_at": "datetime",
  "brief_type": "setup_first_manager_read",
  "opening_diagnosis": "string",
  "confidence": {
    "level": "High | Medium | Low",
    "reason": "string",
    "what_needs_confirmation": ["string"]
  },
  "artist_operating_read": {
    "summary": "string",
    "career_position": "string",
    "platform_shape": "string",
    "market_shape": "string",
    "catalog_shape": "string",
    "main_opportunity": "string",
    "main_risk": "string"
  },
  "what_we_see": [
    {
      "label": "Career position | Platform shape | Market center | Catalog drivers | Discovery signal | Fanbase risk | Other",
      "read": "string",
      "evidence_ids": ["string"]
    }
  ],
  "first_management_priority": {
    "priority": "string",
    "why_this_first": "string"
  },
  "first_move": {
    "summary": "string",
    "timeframe": "string",
    "notes": "string"
  },
  "what_not_to_do_yet": [
    {
      "warning": "string",
      "reason": "string"
    }
  ],
  "songs_projects_to_watch": [
    {
      "name": "string",
      "type": "track | project",
      "management_role": "string",
      "why_it_matters": "string",
      "what_to_watch": "string"
    }
  ],
  "market_read": {
    "primary_market": "string",
    "secondary_markets": ["string"],
    "emerging_markets": ["string"],
    "deprioritized_markets": ["string"],
    "read": "string"
  },
  "manager_memory_seed": {
    "artist_stage_memory": "string",
    "platform_memory": "string",
    "market_memory": "string",
    "catalog_memory": "string",
    "risk_memory": "string",
    "priority_memory": "string"
  },
  "mission_seed": {
    "primary_direction": "string",
    "supporting_directions": ["string"],
    "do_not_generate_for": ["string"],
    "notes_for_mission_system": "string"
  },
  "supporting_evidence": [
    {
      "id": "string",
      "metric": "string",
      "value": "string | number",
      "period": "string",
      "source": "Chartmetric | internal | user | other",
      "interpretation": "string"
    }
  ],
  "source_packet_id": "string"
}
```

### UI rule
Only render:
- opening diagnosis
- confidence
- artist operating read
- what we see
- first management priority
- first move
- what not to do yet
- songs/projects to watch
- market read
- supporting evidence

Do not render:
- manager_memory_seed
- mission_seed
- internal playbooks
- full task lists
- checkpoints
- estimates
- prompt/model/provider details

---

## 12E. Setup Brief Prompt

Use this prompt after setup data has been fetched and normalized.

```text
Create the Setup Brief for this artist.

This is the first manager read the artist/team will see after setup. There is no previous brief memory, no mission progress, no checkpoint history, and no task state yet.

The purpose is to make the team feel that the product understands the artist deeply from the first read.

Do not write a dashboard summary.
Do not list every metric.
Do not create tasks.
Do not create checkpoints.
Do not create full missions.
Do not expose internal playbooks.
Do not mention model/provider details.
Do not use generic music marketing advice.
Do not invent missing data.
Do not complain about missing data. Use the strongest available evidence and mention missing metrics only when they materially affect confidence or the first management decision.

Use the available artist profile, Chartmetric-style KPI scores, platform metrics, market data, selected tracks, selected projects, playlist signals, discovery signals, social signals, genre/mood tags, city affinity, brand affinity, similar artists, and setup goals.

Produce a first strategic diagnosis:
1. Who is this artist right now?
2. What stage are they likely in?
3. What is their platform shape?
4. What is their market shape?
5. Which songs/projects matter first?
6. What is the strongest current opportunity?
7. What is the biggest risk?
8. What is the first management priority?
9. What is the first move?
10. What should the team not do yet?
11. What needs to be confirmed as more data comes in?

The tone should feel like an elite artist manager opening the first meeting after doing serious homework.

Return strict JSON matching the Setup Brief schema.
```

---

## 12F. Setup Brief Example Using Mavo-Style Data

This example is based on the screenshot direction. Final output must depend on real data and available deltas.

### Opening Diagnosis
Mavo is in a high-attention conversion moment: the audience is watching, but the team now has to turn that attention into owned listeners.

### Confidence
Medium confidence. The public attention and discovery signals are strong, but streaming conversion, playlist retention, and short-term city movement still need confirmation.

### Artist Operating Read
Mavo’s current shape is TikTok-led with a Lagos power base. The artist has a major viral asset, meaningful monthly-listener scale, and strong discovery infrastructure through Shazam and playlist reach. The opportunity is to convert attention into durable streaming behavior around “Call Me” and “Energy.” The risk is mistaking viral reach for owned fandom before saves, follows, repeat listening, and playlist retention confirm the audience is staying.

### What We See
```text
Career position: high-attention breaking/conversion stage.
Platform shape: TikTok is the public leverage point; streaming conversion needs proof.
Market center: Lagos is the power market, with Abuja and Port Harcourt as secondary tests.
Catalog drivers: “Call Me” and “Energy” are the first tracks to judge.
Discovery signal: Shazam and playlist reach suggest people are looking for the music, not only watching.
Fanbase risk: owned social/follower depth appears smaller than the viral moment.
```

### First Management Priority
Convert TikTok attention into owned listeners.

Why this first:
> If the team increases awareness before conversion is proven, the campaign may create more noise without building a durable fanbase.

### First Move
Start with a Lagos-first conversion push for “Call Me” and “Energy.” Use the viral asset as the opening hook, but route attention into full-song saves, follows, and repeat listening. Treat Abuja and Port Harcourt as secondary tests after Lagos movement is confirmed.

### What Not To Do Yet
- Do not spread the campaign nationally until Lagos conversion is proven.
- Do not make Instagram the lead channel unless current data shows it is moving.
- Do not announce a new project until the current tracks either convert or cool.
- Do not treat the TikTok number as full breakout proof without streaming conversion and retention.

### Songs / Projects To Watch
| Asset | Role | Why it matters | What to watch |
|---|---|---|---|
| Call Me | Primary conversion track | Best route from viral attention into owned listening | Saves, follows, repeat listening |
| Energy | Secondary conversion test | Shows whether the moment can extend beyond one track | City-level movement, playlist retention |
| Breaking | Campaign context | Useful as a project frame, but track-level performance should lead decisions | Which track actually carries the project |

### Market Read
Lagos is the first market to prove. Abuja and Port Harcourt are secondary lanes. Do not treat all Nigerian markets equally yet. The next proof point is whether Lagos attention becomes repeat listening and track-level conversion.

### Manager Memory Seed
Do not render this directly in the UI.

```json
{
  "artist_stage_memory": "Mavo is currently read as high-attention breaking/conversion stage, not yet confirmed full breakout.",
  "platform_memory": "TikTok is the public leverage point; streaming conversion needs confirmation.",
  "market_memory": "Lagos is the power market, Abuja and Port Harcourt are secondary tests.",
  "catalog_memory": "Call Me and Energy are the first management-relevant tracks to watch.",
  "risk_memory": "Main risk is mistaking viral attention for durable fandom.",
  "priority_memory": "First priority is conversion into saves, follows, repeat listening, and playlist retention."
}
```

### Mission Seed
Do not render this directly in the UI.

```json
{
  "primary_direction": "Convert viral TikTok attention into owned listening behavior around Call Me and Energy.",
  "supporting_directions": [
    "Validate Lagos as the first conversion market.",
    "Check whether Energy can become a secondary breakout asset.",
    "Audit playlist quality and retention before increasing spend."
  ],
  "do_not_generate_for": [
    "Broad Instagram campaign unless Instagram movement is confirmed.",
    "National expansion before Lagos conversion is proven.",
    "New project announcement before current track conversion is clear."
  ],
  "notes_for_mission_system": "The mission system should create conversion-focused actions separately. Today’s Brief should only show the first management move."
}
```

---

## 12G. First Impression Quality Bar

The Setup Brief should create a “how does it know that?” feeling.

It should surface one or two hidden truths that a normal dashboard would not say.

Examples of hidden truths:
- “The artist looks bigger than their owned fanbase.”
- “The song is moving faster than the artist.”
- “The city with the most listeners is not necessarily the best first activation market.”
- “Playlist reach is high, but retention must confirm whether this is real.”
- “The artist has a fanbase problem, not an awareness problem.”
- “The artist has attention, but no clear world yet.”
- “The project is not the strategy; one track inside it is carrying the moment.”
- “This is a conversion moment, not a release moment.”
- “This is a diaspora bridge, not a generic global push.”
- “The team should slow down, not speed up.”

This is what makes the first screen feel premium.

---

## 12H. Setup Brief Acceptance Criteria

The Setup Brief is successful when:

1. It immediately tells the user who the artist is strategically.
2. It does not behave like a metrics summary.
3. It identifies artist stage, platform shape, market shape, and catalog shape.
4. It identifies the first management priority.
5. It includes what not to do yet.
6. It does not show tasks, checkpoints, estimates, or full missions.
7. It seeds future mission generation without rendering mission details.
8. It seeds Manager Chat memory.
9. It explains confidence and missing confirmation signals.
10. It makes the user feel the product has already done serious manager-level homework.
11. It is specific enough to impress a major-label team in a demo.
12. It can become the foundation for recurring Today’s Briefs after missions and memory exist.

---



## 12I. Dynamic User-Facing Reads

This addition is important for the user-facing experience.

The Today’s Brief and Setup Brief must not feel like every artist is being pushed through the same rigid template. The product should feel agentic: the read should be shaped by what matters most for that artist on that day.

The system still needs structure internally, but the user-facing output should not feel structurally predetermined.

If 1,000 users screenshot their Today’s Brief, the cards should not all look like:
1. Priority
2. Confidence
3. Artist Intelligence
4. What Changed
5. Next Move
6. Avoid
7. Songs to Watch
8. Market Read

That becomes predictable and less premium.

Instead, the product should use a **dynamic presentation engine**.

---

### Core principle

The intelligence should be structured.  
The presentation should be fluid.

Internally, the system can produce consistent fields for reliability. But the UI should render the most relevant blocks in the order that best fits the artist’s situation.

A manager does not walk into every meeting with the same speech format. The manager leads with what matters.

Some artists need a risk warning first.  
Some need a song read first.  
Some need a market read first.  
Some need an identity read first.  
Some need a conversion read first.  
Some need to be told to slow down.  
Some need to be told to move now.

The brief should adapt.

---

### Required ingredients, not fixed sections

Every user-facing read should include these ingredients somewhere:

- the main read
- the main reason
- the next move
- what to avoid
- evidence
- confidence or certainty level when useful

But the exact section order, labels, and layout should be dynamic.

Do not hard-code the same visible structure for every artist.

---

### Dynamic Brief Composer

Create a rendering layer called something like:

```text
DynamicBriefComposer
```

Its job is to take the Strategic Intelligence Packet and decide:

1. What is the dominant situation?
2. What should the user see first?
3. Which content blocks matter today?
4. Which blocks should be hidden because they are not important today?
5. What tone should the brief use?
6. What layout pattern fits this read?
7. What should be expandable evidence instead of main content?

---

### Dominant Situation Types

The composer should classify the user-facing read into one dominant situation.

Examples:

#### 1. Conversion Moment
Use when attention is strong but owned fandom needs proof.

Lead with:
> “You have attention. Now capture it.”

Best blocks:
- conversion read
- track focus
- market focus
- avoid broad spend
- evidence

#### 2. Breakout Watch
Use when multiple signals suggest a possible breakout but confirmation is still needed.

Lead with:
> “This could be a breakout, but only if the next signals confirm.”

Best blocks:
- signal stack
- track read
- confidence reason
- next proof point
- avoid premature scaling

#### 3. Song-First Spike
Use when one song is moving faster than the artist.

Lead with:
> “The song is ahead of the artist.”

Best blocks:
- song spotlight
- artist conversion gap
- follower/fanbase read
- next move
- avoid project announcement

#### 4. Market Opening
Use when one city/country/diaspora pocket is over-indexing.

Lead with:
> “The market is telling you where to go first.”

Best blocks:
- market read
- city/country signal
- activation suggestion
- songs tied to market
- avoid spreading too wide

#### 5. Playlist Exposure Risk
Use when playlist reach is strong but conversion is unclear.

Lead with:
> “This is exposure, not yet proof.”

Best blocks:
- playlist quality read
- conversion proxy read
- track watch
- avoid spend increase
- evidence drawer

#### 6. Era Problem
Use when the artist has activity but weak world-building or unclear campaign identity.

Lead with:
> “The music is moving, but the world is not clear enough yet.”

Best blocks:
- identity/world read
- campaign gap
- visual/content direction
- avoid random posting
- asset focus

#### 7. Cooling Artist
Use when the artist has a strong base but weaker current heat.

Lead with:
> “The base is there. The current heat needs a new trigger.”

Best blocks:
- fanbase vs engagement read
- catalog/project read
- era reset suggestion
- avoid more generic content
- evidence

#### 8. Catalog Revival
Use when an older song/project is resurfacing.

Lead with:
> “The catalog is creating a new opening.”

Best blocks:
- catalog asset read
- market/platform causing revival
- activation route
- avoid ignoring older asset
- watch signal

#### 9. Live Demand Signal
Use when city engagement, listener density, or fan activity suggests physical activation.

Lead with:
> “This may be a live market.”

Best blocks:
- city density read
- live readiness read
- venue/activation caution
- avoid premature venue jump
- evidence

#### 10. Structural Readiness Gap
Use when momentum exists but team infrastructure may be weak.

Lead with:
> “The opportunity is growing faster than the structure.”

Best blocks:
- rights/metadata/team readiness warning
- deal caution
- next proof to build
- avoid label/brand rush
- evidence

---

### Content Block Library

The UI should support flexible content blocks. The composer chooses which blocks to show.

Possible blocks:

#### Opening Read
A punchy diagnosis.

Example:
> The song is moving faster than the artist. That is the opportunity and the risk.

#### Manager’s Note
A short, human-feeling paragraph.

Example:
> This is the kind of moment teams waste by chasing more views. The better move is to capture the people already paying attention.

#### Signal Stack
Shows 3 to 5 key signals that agree or conflict.

Example:
```text
TikTok: public attention is ahead.
Shazam: discovery intent is real.
Lagos: strongest market base.
Playlist reach: useful, but retention needs proof.
Owned fanbase: still behind the viral moment.
```

#### The Real Read
One hidden truth.

Example:
> The artist does not have an awareness problem. The artist has a capture problem.

#### First Move / Next Move
One strategic move, not a task list.

Example:
> Push the two tracks already carrying the signal and route the viral attention into saves, follows, and repeat listening.

#### Avoid
What not to do yet.

Example:
> Do not spread the campaign nationally until Lagos conversion is proven.

#### Asset Spotlight
Focus on one song/project.

Example:
> “Call Me” is the conversion track. “Energy” is the secondary test.

#### Market Read
Focus on city/country/diaspora strategy.

Example:
> Lagos is the power market. Abuja and Port Harcourt are secondary tests, not equal priorities.

#### Confidence Note
Short confidence explanation.

Example:
> Confidence is medium because attention and discovery agree, but conversion still needs proof.

#### What To Watch
Future signals to monitor, without sounding like a complaint.

Example:
> Watch saves, follows, playlist retention, and city-level persistence over the next few days.

#### Evidence Drawer
Expandable proof, not always main-screen content.

Example:
- TikTok reach
- Shazam volume
- playlist reach
- city affinity
- artist score/rank movement
- track score movement

#### Manager Warning
A stronger caution when needed.

Example:
> Do not confuse the size of the moment with the strength of the fanbase.

#### Opportunity Window
Time-sensitive read.

Example:
> The next 72 hours matter because attention is warm now. Waiting too long may let the spike cool before the team captures it.

#### Strategic Question
A smart question for the team.

Example:
> Is the team trying to grow the artist, or only the current song?

---

### Layout Patterns

The renderer should choose a layout pattern depending on the dominant situation.

#### Pattern A: The Sharp Diagnosis
Use when one issue is clearly dominant.

Structure:
- Opening Read
- The Real Read
- Next Move
- Avoid
- Evidence drawer

#### Pattern B: The Signal Stack
Use when multiple signals need interpretation.

Structure:
- Opening Read
- Signal Stack
- Manager’s Note
- What To Watch
- Avoid

#### Pattern C: The Asset-Led Read
Use when one song/project matters most.

Structure:
- Asset Spotlight
- Why It Matters
- Next Move
- Market Read
- Avoid

#### Pattern D: The Market-Led Read
Use when city/country movement is the story.

Structure:
- Market Read
- Signal Stack
- Next Move
- Asset Tie-In
- Avoid

#### Pattern E: The Risk-Led Read
Use when the biggest value is preventing a bad move.

Structure:
- Manager Warning
- Why This Matters
- Better Move
- What To Watch
- Evidence

#### Pattern F: The Setup First Read
Use after setup.

Structure:
- Opening Diagnosis
- Artist Operating Read
- What We See
- First Priority
- First Move
- What Not To Do Yet
- Evidence

Even Pattern F should not feel exactly identical every time. The labels and emphasis can change depending on the artist.

---

### Dynamic section labels

Avoid using the same labels every time. The composer can choose labels based on the read.

Examples for main read:
- Manager’s Read
- The Real Read
- What This Means
- The Situation
- The Read
- Where This Stands
- The Career Read

Examples for action:
- Next Move
- First Move
- Move Now
- The Play
- What To Do Next
- Where To Focus
- Immediate Focus

Examples for warning:
- Avoid
- Not Yet
- Do Not Chase This
- Watch The Trap
- Manager Warning
- What To Hold Back
- The Risk

Examples for evidence:
- Why We Think This
- Evidence
- Signal Check
- What Supports This
- Proof Points
- Data Behind The Read

Use variation carefully. Do not become cute. The labels should feel premium and clear.

---

### Voice rules

The manager voice should be:

- tight
- direct
- calm
- confident
- specific
- slightly opinionated
- protective of the artist
- allergic to generic marketing advice
- able to say no
- useful in one screen

It should not be:

- motivational fluff
- overly excited
- robotic
- over-explaining
- template-like
- full of caveats
- obsessed with missing data
- pretending certainty where there is none
- using technical implementation language

Good voice:
> The song is ahead of the artist. That is not a problem yet, but it becomes one if the team keeps chasing views instead of capturing listeners.

Bad voice:
> Based on the provided metrics, it may be beneficial to leverage social media platforms to increase engagement and optimize conversion opportunities.

---

### Rhythm rules

Use short paragraphs.  
Use strong first sentences.  
Use 3 to 5 visible bullets at most unless the user expands.  
Use tables only when comparison is actually useful.  
Do not make every brief a table.  
Do not make every brief a paragraph.  
Do not make every brief a card stack with identical order.

The brief should feel composed, not filled.

---

### Personalization rules

The brief should change based on:
- artist career stage
- dominant platform
- dominant market
- strongest signal
- biggest risk
- available data
- whether this is setup or recurring
- whether a song, market, project, or risk is the main story
- whether the team has open missions
- whether prior advice was confirmed or contradicted

Examples:
- A TikTok-led developing artist should not get the same structure as a mainstream artist with cooling engagement.
- A catalog revival should not look like a new single campaign.
- A market-opening read should lead with geography.
- A song-first spike should lead with the track, not the artist summary.
- A risk-led read should lead with warning, not opportunity.

---

### Dynamic JSON for user-facing reads

Instead of forcing fixed UI sections, the renderer can output composable blocks.

Suggested schema:

```json
{
  "read_id": "string",
  "artist_id": "string",
  "artist_name": "string",
  "brief_type": "setup | recurring | song_read | project_read | campaign_read",
  "dominant_situation": "Conversion Moment | Breakout Watch | Song-First Spike | Market Opening | Playlist Exposure Risk | Era Problem | Cooling Artist | Catalog Revival | Live Demand Signal | Structural Readiness Gap | Other",
  "layout_pattern": "Sharp Diagnosis | Signal Stack | Asset-Led Read | Market-Led Read | Risk-Led Read | Setup First Read | Custom",
  "tone": "direct | cautionary | opportunity-led | urgent | calm | celebratory | corrective",
  "hero": {
    "headline": "string",
    "subline": "string",
    "confidence": {
      "level": "High | Medium | Low",
      "reason": "string"
    }
  },
  "blocks": [
    {
      "block_id": "string",
      "block_type": "opening_read | manager_note | signal_stack | real_read | next_move | avoid | asset_spotlight | market_read | confidence_note | what_to_watch | evidence_drawer | manager_warning | opportunity_window | strategic_question | custom",
      "title": "string",
      "priority": 1,
      "content": "string",
      "items": [
        {
          "label": "string",
          "value": "string",
          "evidence_ids": ["string"]
        }
      ],
      "display": {
        "default_state": "expanded | collapsed",
        "emphasis": "high | medium | low"
      }
    }
  ],
  "supporting_evidence": [
    {
      "id": "string",
      "metric": "string",
      "value": "string | number",
      "period": "string",
      "source": "Chartmetric | internal | user | other",
      "interpretation": "string"
    }
  ],
  "internal_render_notes": {
    "why_this_layout": "string",
    "do_not_display": true
  }
}
```

This lets the product feel alive while keeping data structured.

---

### Prompt rule for dynamic reads

Every user-facing renderer prompt should include:

```text
Do not force the same visible structure every time. Choose the strongest presentation for this artist and this situation. Lead with what matters most. Use only the blocks that help the user understand the decision. Keep internal structure reliable, but make the user-facing read feel composed, fluid, and specific to the artist.
```

---

### Acceptance criteria for dynamic reads

The dynamic read system is successful when:

1. Two different artists do not receive identical-looking briefs unless their situations are genuinely similar.
2. The brief leads with the most important thing, not the same default section every time.
3. The UI can render different block combinations.
4. Internal schemas remain reliable even when user-facing presentation changes.
5. The read still includes action, avoidance, confidence, and evidence.
6. The voice feels manager-like, not template-like.
7. The product can create screenshot-worthy reads that feel personal to each artist.
8. The user can understand the next move without reading a long report.
9. Missing data does not dominate the read.
10. The experience feels premium, fluid, and intelligent.

---


## 13. Today’s Brief Output Schema

This is the UI renderer schema, not the internal Strategic Intelligence Packet.

```json
{
  "brief_id": "string",
  "artist_id": "string",
  "artist_name": "string",
  "created_at": "datetime",
  "priority_headline": "string",
  "confidence": {
    "level": "High | Medium | Low",
    "reason": "string"
  },
  "artist_snapshot": {
    "career_stage": "string",
    "platform_shape": "string",
    "strongest_signal": "string",
    "biggest_risk": "string",
    "market_focus": "string",
    "key_assets": ["string"]
  },
  "manager_read": "string",
  "what_changed": [
    {
      "change": "string",
      "why_it_matters": "string",
      "evidence_ids": ["string"]
    }
  ],
  "next_move": {
    "summary": "string",
    "timeframe": "string",
    "supporting_actions": ["string"]
  },
  "avoid": [
    {
      "warning": "string",
      "reason": "string"
    }
  ],
  "songs_projects_to_watch": [
    {
      "name": "string",
      "type": "track | project",
      "role": "string",
      "why_it_matters": "string",
      "what_to_watch": "string"
    }
  ],
  "market_read": {
    "primary_market": "string",
    "secondary_markets": ["string"],
    "deprioritized_markets": ["string"],
    "read": "string"
  },
  "supporting_evidence": [
    {
      "id": "string",
      "metric": "string",
      "value": "string | number",
      "period": "string",
      "source": "Chartmetric | internal | user | other",
      "interpretation": "string"
    }
  ],
  "source_packet_id": "string"
}
```

### Explicit UI rule
Do not render `internal_only.playbooks_applied`.  
Do not render mission/task/checkpoint objects in Today’s Brief.  
Do not render engineering or prompt details.

---

## 14. Mission Generator Relationship

Today’s Brief should not generate tasks/checkpoints in the UI, but the Strategic Intelligence Packet must give the Mission Generator enough intelligence.

### Mission Generator input
The Mission Generator should consume:
- mission_seed
- management_insights
- asset_reads
- market_reads
- strategic_diagnosis
- signal_map
- evidence
- user/team goals
- open missions
- previous checkpoint results

### Mission Generator output
This happens in the separate mission area:
- missions
- tasks
- checkpoints
- estimates
- owners
- success metrics
- review date
- completion criteria

### Important separation
Today’s Brief says:
> “The next move is to convert TikTok attention into full-track saves.”

Mission Generator creates:
- mission
- tasks
- owner suggestions
- time estimates
- checkpoint dates
- metrics to track

This separation keeps Today’s Brief clean while still making the whole app intelligent.

---

## 15. Manager Chat Relationship

The same Strategic Intelligence Packet should power Manager Chat.

This means when the user asks:
- “Why are you saying Lagos first?”
- “Should we push this song or the new one?”
- “Is this a real breakout?”
- “What should we do next?”
- “Should we tour?”
- “Should we pitch labels?”
- “What is the risk?”
- “Which song is carrying the artist?”

The Manager Chat should answer using stored intelligence from:
- Artist Operating Profile
- latest Strategic Intelligence Packet
- previous briefs
- open mission state
- checkpoint results
- current data

Manager Chat should not answer like a generic assistant. It should answer like the product already understands the artist.

### Manager Chat behavior
It should:
- reference the current priority
- explain the evidence
- clarify assumptions
- recommend decisions
- say what not to do
- update its read when new data conflicts with old assumptions
- avoid generic advice
- avoid exposing internal playbooks

---

## 16. Song Manager Reads

The same intelligence should power song-level pages.

For each selected management-relevant song, the system should produce a song read.

### Song read should answer
- What role is this song playing in the artist’s career right now?
- Is it a driver, sleeper, breakout candidate, TikTok asset, playlist asset, live anchor, or risk asset?
- Is attention converting?
- Which markets are responding?
- What should the team do with it next?
- What should the team avoid?
- What metric proves whether it is working?

### Song read schema

```json
{
  "track_id": "string",
  "track_name": "string",
  "management_role": "string",
  "current_read": "string",
  "strongest_signal": "string",
  "biggest_risk": "string",
  "next_move": "string",
  "avoid": "string",
  "markets_to_watch": ["string"],
  "watch_metrics": ["string"],
  "evidence_ids": ["string"]
}
```

---

## 17. Project Manager Reads

The same intelligence should power project-level pages.

### Project read should answer
- Is the project still active strategically?
- Which tracks are carrying it?
- Does the project represent the current era?
- Is it creating new growth or only housing old signals?
- Should the team push the project, one track, or move on?
- What should be avoided?

### Project read schema

```json
{
  "project_id": "string",
  "project_name": "string",
  "project_role": "current_era | catalog_context | inactive | revival_candidate | unclear",
  "current_read": "string",
  "tracks_carrying_project": ["string"],
  "strategic_value": "string",
  "next_move": "string",
  "avoid": "string",
  "watch_metrics": ["string"],
  "evidence_ids": ["string"]
}
```

---

## 18. Prompting Principles

### Do not write vague prompts
Bad:
```text
Analyze this artist and give recommendations.
```

Good:
```text
Read the artist profile, selected tracks, selected projects, market signals, playlist signals, social signals, discovery signals, and previous memory. Build a strategic diagnosis. Classify the artist’s career stage, platform shape, market shape, catalog shape, strongest signal, and biggest risk. Produce a Strategic Intelligence Packet that can power Today’s Brief, Manager Chat, song reads, project reads, and later mission generation.
```

### The model should be instructed like it is careless by default
Spell out the rules:
- Do not summarize all metrics.
- Do not include data that does not create a decision.
- Do not recommend actions without evidence.
- Do not treat virality as fandom.
- Do not treat playlist reach as fan growth.
- Do not recommend tasks inside Today’s Brief.
- Do not expose internal playbooks to users.
- Do not invent missing data.
- Do not use generic advice.
- Do not make the user interface sound like a chatbot.

---

## 19. Core Internal Prompt: Manager Intelligence Engine

Use this as the internal system instruction for generating the Strategic Intelligence Packet.

```text
You are the Manager Intelligence Engine for OrderSounds.

Your job is not to summarize data. Your job is to turn artist, song, project, audience, market, playlist, chart, social, discovery, and campaign signals into professional music-management intelligence.

You are building the internal Strategic Intelligence Packet that will power multiple product surfaces: Today’s Brief, Manager Chat, song reads, project reads, and later mission generation.

The user should never see internal playbook names, prompt logic, model/provider details, or implementation notes.

Use internal Manager Playbooks inspired by the public operating patterns of elite music managers and artist-strategists, including Noah Assad, Brandon Creed, Wassim “Sal” Slaiby, Jeffrey Azoff, Janelle Lopez Genzink, Stuart Camp, Coran Capshaw, Bose Ogulu, Danny Rukasin, Brandon Goodman, Oliver El-Khatib, and Taylor Swift / 13 Management.

Do not impersonate these people. Use their principles as internal strategic frameworks.

Never give generic advice.
Never recommend action without evidence.
Never treat all metrics equally.
Never confuse attention with fandom.
Never confuse playlist reach with real demand.
Never confuse virality with career growth.
Never give the same advice to a developing artist and an established artist.
Never recommend a brand, collaboration, tour, campaign, release, or market move unless it strengthens the artist’s long-term positioning or solves a clear current problem.
Never include an insight that does not create a decision.
Never invent data. If data is missing, reduce confidence only when the missing data materially affects the decision.
Use the strongest available evidence. Do not complain about missing data. Mention missing metrics only when they materially affect confidence or the next decision. If a preferred metric is unavailable, use reasonable proxy signals and clearly state the read based on available evidence.

For every Strategic Intelligence Packet:
1. Identify the artist’s career stage.
2. Identify the artist’s platform shape.
3. Identify the artist’s market shape.
4. Identify the artist’s catalog shape.
5. Identify selected tracks/projects that matter right now.
6. Classify signals into attention, conversion, discovery, fan, market, playlist, live, catalog, or risk.
7. Identify the strongest current signal.
8. Identify the biggest risk.
9. Select the relevant internal Manager Playbooks.
10. Use the playbooks internally only.
11. Produce an executive read.
12. Produce management insights.
13. Produce asset reads.
14. Produce market reads.
15. Produce a mission seed for the separate Mission Generator.
16. Produce a conversation memory seed for Manager Chat.
17. Provide supporting evidence.
18. Explain confidence.
19. State what should be avoided.

The output must be strict JSON matching the Strategic Intelligence Packet schema.
```

---

## 20. Core Prompt: Today’s Brief Renderer

This prompt should render a user-facing brief from the Strategic Intelligence Packet.

```text
Create a user-facing Today’s Brief from the Strategic Intelligence Packet.

This is a concise morning management read for an artist team.

Do not expose internal playbooks.
Do not mention model/provider details.
Do not show prompt logic.
Do not create task lists.
Do not create checkpoints.
Do not create full missions.
Do not use implementation language.

Only show:
- priority headline
- confidence level and short reason
- artist intelligence snapshot
- manager’s read
- what changed
- next move
- what to avoid
- songs/projects to watch
- market read
- supporting evidence

Keep the brief sharp, practical, and decision-oriented.
Do not force the same visible structure every time. Choose the strongest presentation for this artist and this situation. Lead with what matters most. Use only the blocks that help the user understand the decision. Keep internal structure reliable, but make the user-facing read feel composed, fluid, and specific to the artist.

Every recommendation must be backed by evidence from the packet.
If confidence is medium or low, explain what signal is missing.
If something looks attractive but strategically wrong, include it under Avoid.

The brief should feel like it was written by a sharp artist manager before a morning team call.
Return strict JSON matching the Today’s Brief schema.
```

---

## 21. Core Prompt: Mission Seed Generator

This prompt is not for Today’s Brief. It is for the separate mission system.

```text
Use the Strategic Intelligence Packet to create mission directions for the separate mission system.

Do not render these inside Today’s Brief.

Your job is to convert the management diagnosis into mission-ready direction.

Create:
- primary mission direction
- supporting mission directions
- what not to generate missions for
- why these missions matter
- what evidence supports them
- what risks the mission system should consider

Do not create detailed task lists here unless the mission system explicitly asks for them.
Do not create checkpoints here unless the checkpoint system explicitly asks for them.
Return structured JSON for downstream mission generation.
```

---

## 22. Example: Improved Mavo Flow

This example is based on the screenshot direction, but final output should depend on real data and deltas.

### Strategic diagnosis
- Artist has a major TikTok attention asset.
- TikTok attention is much larger than owned social/fanbase.
- Lagos is the power market.
- Abuja and Port Harcourt are secondary tests.
- “Call Me” and “Energy” appear to be the songs that should receive conversion focus.
- Shazam and playlist signals suggest discovery infrastructure, but conversion and retention need verification.
- Instagram should not be treated as the main lane if it is not carrying movement.

### User-facing Today’s Brief example

#### Priority
Convert Mavo’s TikTok attention into owned listeners by using Lagos as the first conversion market for “Call Me” and “Energy.”

#### Confidence
Medium confidence. TikTok attention and Shazam volume suggest real discovery, but streaming conversion and playlist retention still need confirmation.

#### Artist Intelligence
Mavo is in a high-attention conversion moment. The artist’s current shape is TikTok-led with a Lagos-first listener base. The strongest signal is mass public attention. The biggest risk is treating views as fandom before saves, follows, repeat listening, and playlist retention confirm conversion.

#### Manager’s Read
Mavo has attention, but the management job now is capture. The viral asset proves that people are watching; it does not prove that they have become owned listeners. Lagos should be treated as the first conversion market because it carries the strongest listener base and cultural proof. The next move is not broad awareness. The next move is to route attention into full-track saves, follows, and repeat listening around “Call Me” and “Energy.”

#### What Changed
- TikTok is the public leverage point, but the owned fanbase is much smaller than the viral reach. This means attention is ahead of fan capture.
- Lagos is the power market, while Abuja and Port Harcourt are useful secondary tests. The campaign should not spread evenly across every market yet.
- Playlist reach and Shazam volume suggest discovery infrastructure, but playlist quality and listener conversion must be checked before increasing spend.
- Instagram should not be treated as the main conversion lane unless current growth data proves it is moving.

#### Next Move
For the next 72 hours, push “Call Me” and “Energy” through TikTok-to-stream conversion content. Use the viral asset as the opening hook, then push fans toward full-song saves and artist follows. Keep Lagos as the center. Test Abuja and Port Harcourt only as secondary lanes.

#### Avoid
- Do not spend broadly on Instagram yet if it is not carrying the moment.
- Do not announce a new project until “Call Me” and “Energy” either convert or cool.
- Do not call this a full breakout until TikTok, Shazam, playlist retention, and streaming conversion agree.
- Do not use generic creators who do not fit Mavo’s world.

#### Songs / Projects to Watch
| Asset | Role | Why it matters | What to watch |
|---|---|---|---|
| Call Me | Primary conversion track | Best route from attention into owned listening | Saves, follows, repeat listening |
| Energy | Secondary conversion track | Can confirm whether momentum extends beyond one asset | City-level movement and playlist retention |
| Breaking project | Campaign context | Holds the active songs but should not distract from track-level conversion | Which track actually carries the project |

#### Market Read
Lagos is the priority. Abuja and Port Harcourt are secondary tests. Do not spread the campaign nationally until Lagos conversion is proven.

### Mission seed generated internally
Do not show this inside Today’s Brief.

```json
{
  "primary_mission_direction": "Convert TikTok attention into owned listeners for Call Me and Energy",
  "supporting_mission_directions": [
    "Validate Lagos as the first conversion market",
    "Audit playlist quality before increasing spend",
    "Test whether Energy is a true secondary breakout candidate"
  ],
  "do_not_generate_missions_for": [
    "Broad Instagram growth campaign unless Instagram movement is confirmed",
    "New project announcement",
    "Generic national campaign"
  ],
  "mission_generation_notes": "The mission system should focus on conversion, not awareness. Tasks and checkpoints should be created in the separate mission workflow."
}
```

---

## 23. UI Recommendations

### Keep Today’s Brief clean
Recommended cards:
1. Priority
2. Confidence
3. Artist Intelligence
4. Manager’s Read
5. What Changed
6. Next Move
7. Avoid
8. Songs / Projects to Watch
9. Market Read
10. Supporting Evidence

### Remove from Today’s Brief UI
- Internal playbook names
- Manager names
- “decision lens” labels
- mission lists
- task lists
- checkpoint lists
- engineering notes
- model/provider references
- prompt references

### Add expandable evidence
Every major claim should connect to evidence.

Evidence card should show:
- metric
- value
- period
- source
- interpretation

### Add hidden debug mode only for admins
Admin/dev mode can show:
- playbooks applied
- missing data
- prompt version
- packet ID
- schema validation result
- confidence calculation notes

This must not appear for normal users.

---

## 24. Suggested Code Organization

Add a Manager Intelligence layer rather than rewriting the whole app.

```text
src/lib/manager-intelligence/
  types.ts
  normalize/
    chartmetricNormalize.ts
    internalDataNormalize.ts
  selection/
    trackSelector.ts
    projectSelector.ts
  profile/
    artistOperatingProfile.ts
    careerStageClassifier.ts
    platformShapeClassifier.ts
    marketShapeClassifier.ts
    catalogShapeClassifier.ts
  signals/
    signalClassifier.ts
    signalStrength.ts
    deltaComputer.ts
    situationDetector.ts
  playbooks/
    playbookDefinitions.ts
    playbookRouter.ts
    noEngine.ts
  packet/
    strategicIntelligencePacket.ts
    packetSchema.ts
    evidenceBuilder.ts
    confidence.ts
  renderers/
    todaysBriefRenderer.ts
    managerChatContextBuilder.ts
    songReadRenderer.ts
    projectReadRenderer.ts
  downstream/
    missionSeedBuilder.ts
  memory/
    briefMemory.ts
    checkpointMemory.ts
    artistMemory.ts
```

### Important implementation principle
Keep generation separated:
- `strategicIntelligencePacket.ts` creates intelligence.
- `todaysBriefRenderer.ts` renders the brief.
- `missionSeedBuilder.ts` prepares mission direction.
- The separate mission system creates tasks/checkpoints.

---

## 25. Data Persistence

### Table: artist_operating_profiles
- id
- artist_id
- artist_name
- career_stage
- career_stage_reason
- platform_shape_json
- market_shape_json
- catalog_shape_json
- artist_world_json
- strategic_risks_json
- current_priority
- confidence
- created_at
- updated_at

### Table: artist_signal_snapshots
- id
- artist_id
- snapshot_date
- raw_metrics_json
- normalized_metrics_json
- selected_tracks_json
- selected_projects_json
- source_status_json
- created_at

### Table: strategic_intelligence_packets
- id
- artist_id
- packet_date
- data_freshness_json
- executive_read_json
- strategic_diagnosis_json
- signal_map_json
- management_insights_json
- asset_reads_json
- market_reads_json
- mission_seed_json
- conversation_memory_seed_json
- internal_only_json
- supporting_evidence_json
- created_at

### Table: manager_briefs
- id
- artist_id
- source_packet_id
- brief_date
- priority_headline
- confidence_json
- artist_snapshot_json
- manager_read
- what_changed_json
- next_move_json
- avoid_json
- songs_projects_to_watch_json
- market_read_json
- supporting_evidence_json
- created_at

### Table: manager_memory
- id
- artist_id
- memory_type
- memory_json
- source_packet_id
- created_at
- updated_at

Mission/task/checkpoint tables should remain part of the separate mission system.

---

## 26. Acceptance Criteria

The upgrade is successful when:

1. The product never exposes model/provider names or internal prompt mechanics to users.
2. The Today’s Brief does not show internal playbook names.
3. The Today’s Brief does not render missions, tasks, estimates, or checkpoints.
4. The Manager Intelligence Engine produces a Strategic Intelligence Packet that downstream systems can use.
5. Today’s Brief becomes a renderer of that packet, not the whole intelligence system.
6. Manager Chat can use the same packet to answer follow-up questions intelligently.
7. Song pages can use the same packet to produce song-specific management reads.
8. Project pages can use the same packet to produce project-specific management reads.
9. Mission generation can use the same packet without relying on UI text scraping.
10. Every recommendation is tied to evidence.
11. Every brief includes what to avoid.
12. Confidence is explained.
13. The system distinguishes attention, conversion, discovery, fan, market, playlist, live, catalog, and risk signals.
14. The system can handle missing fields without inventing data.
15. The output feels like professional artist-management judgment, not a generic dashboard summary.

---

## 27. Quality Rubric

Each generated Strategic Intelligence Packet and Today’s Brief should be evaluated on:

### 1. Specificity
Does it name the actual artist, song, market, platform, and move?

### 2. Evidence discipline
Does every recommendation connect to evidence?

### 3. Management judgment
Does it say what to do and what not to do?

### 4. Career-stage fit
Is the advice appropriate for the artist’s level?

### 5. Signal intelligence
Does it distinguish attention from conversion, discovery from fandom, playlist reach from demand?

### 6. Downstream usefulness
Can another function use the packet to generate missions, tasks, checkpoints, song reads, and chat answers?

### 7. UI cleanliness
Does Today’s Brief stay clean and avoid exposing internal machinery?

### 8. Non-generic quality
Would the advice still sound the same if artist and song names were removed? If yes, it is too generic.

### 9. Strategic sharpness
Would a serious manager use this in a morning call?

Do not ship outputs that fail evidence discipline, management judgment, or downstream usefulness.

---

## 28. Final Product Standard

The system should make the user feel:

> This product understands the artist and knows the next move.

It should not feel like:
- a dashboard summary
- a chatbot
- a generic music marketing adviser
- a task generator pasted into a brief
- a metrics report

It should feel like a professional management brain that sees the data, understands the artist, protects the career, and gives the team the right next move.

That is the standard.
