# Data Source Map

Purpose: define where dynamic product data comes from, what it can support, and what it must not be used to claim.

## Source Rules

Every source-derived claim needs source, time window, confidence, freshness, provenance, and limitation. Raw snapshots should be append-only. Evidence items should be normalized from snapshots or user input and cited by Manager runs.

Visible Label HQ and Today's Brief text follows the same rule. Metrics, region names, growth percentages, timestamps, recent movement, and source warnings are not decorative copy; production must source them from evidence, operating events, memory, or explicit limitations.

## Spotify Public Catalog

Provides: artist identity, public profile, public catalog metadata, release/catalog references.  
Supports: identity confirmation, public catalog context, release matching, artwork links, Spotify URLs/URIs, ISRC/UPC when returned, release dates, explicit flags, duration, album/project membership, and public popularity metadata where returned.
Does not support: stream counts, private saves, skips, listener conversion, source-of-stream, editorial pitch status, revenue, royalty state, campaign ROI, or real-time performance.
Prototype example: `EV-SP-3302`.

## Chartmetric

Provides: third-party music intelligence for resolved artists/tracks/albums, including platform movement, Chartmetric-reported stream/platform metrics where returned, playlists, charts, social/video context, geography, similar-artist context, and cross-platform identifiers where available from the contracted API endpoints.
Supports: enrichment beyond Spotify public catalog, setup intelligence for the artist profile, setup project/release, and standalone songs, track-level momentum reads, playlist/chart movement, public/social attention signals, source readiness, and stronger Label HQ context when the endpoint returns a supported metric with a time window.
Does not support: treating third-party estimates as Spotify Web API data, private Spotify for Artists analytics, royalty revenue, legal ownership, guaranteed causation, or conversion unless paired with stronger private/uploaded evidence.
Credential rule: use `CHARTMETRIC_REFRESH_TOKEN` server-side only; exchange it for a short-lived bearer token and store raw responses before normalization.

## OpenAI Generated Summaries

Provides: derived narrative summaries from saved Music state, source snapshots, evidence items, limitations, memory, and operating events.
Supports: readable song/project summaries, Label HQ brief language, Manager synthesis drafts, and source-gap explanations.
Does not support: raw facts by itself. A generated summary is interpretation and must cite or list the source classes and limitations used to create it.
Credential rule: use `OPENAI_API_KEY` server-side only and write provider/model/usage records for generated summaries.

## Spotify For Artists Export

Provides: private artist analytics when connected or uploaded.  
Supports: saves, listener behavior, playlist/source data if included in export, stream/listener counts if included, territory/time-window reads.  
Does not support: claims outside export fields/time range or guaranteed causation.  
Production use: stronger conversion evidence and post-release signal reviews.

## TikTok

Provides: public or connected video/use/comment signals.  
Supports: attention, participation, creator fit, hook movement, content testing.  
Does not support: streaming conversion or spend scale by itself.  
Prototype example: `EV-TTK-0426`.

## Instagram

Provides: public/connected audience, content, engagement, replies, story/reel signals where available.  
Supports: owned audience response and campaign participation.  
Does not support: reliable conversion without link/campaign data.

## YouTube

Provides: videos, shorts, comments, public engagement, channel context.  
Supports: comment themes, release intent, visual/content response.  
Does not support: private conversion without analytics/link data.  
Prototype example: `EV-YT-1190`.

## X

Provides: public posts, audience conversation, sentiment/context where available.  
Supports: conversation monitoring and cultural context.  
Does not support: reliable fan demand or conversion by itself.

## Smart-Link Data

Provides: clicks, destinations, geography, campaign sources, conversion proxies depending on provider.  
Supports: campaign path analysis and post-release signal reads.  
Does not support: actual platform saves/listens unless integrated with platform analytics.

## Saved Music State

Provides: durable song/project lifecycle, files, identifiers, credits, split state, contributor confirmations, distribution package state, linked missions, prior Music events, and Manager/agent read history.
Supports: Manager and specialist continuity, release readiness, rights/readiness blockers, project rollups, source freshness decisions, and avoiding unnecessary provider fetches when saved state is fresh enough.
Does not support: new factual claims, private analytics, provider availability, rights certainty, revenue, or distribution success without linked evidence, source snapshots, user confirmation, or provider confirmation.

## Distributor Data

Provides: delivery status, metadata, territories, ISRC/UPC, release date, platform ingestion status.  
Supports: release readiness and launch-day verification.  
Does not support: public availability until checked on platforms.  
Prototype example: `EV-DSP-0612`.

## Royalty Statements

Provides: payout line items, periods, platforms, territories, revenue categories.  
Supports: finance reads only within statement limits.  
Does not support: legal ownership certainty, future revenue, or complete catalog accounting by itself.

## Split Sheets

Provides: collaborator shares, approvals, signatures, publishing/master notes if included.  
Supports: rights-readiness checks and release risk.  
Does not support: legal conclusion without human/legal review.  
Prototype example: `EV-RGT-0612`.

## Artist Replies

Provides: user-supplied goals, constraints, approvals, capacity, context, corrections.  
Supports: user intent, team state, operating constraints.  
Does not support: third-party facts unless backed by uploaded/connected proof.  
Prototype example: `EV-ART-0007`.

## Uploaded Files

Provides: user-submitted statements, exports, pitch assets, rights documents, campaign reports.  
Supports: evidence extraction based on file contents.  
Does not support: claims beyond file scope or authenticity without validation.

## Prior Conversations

Provides: user questions, Manager answers, prior decisions, linked work, unresolved questions.  
Supports: continuity and thread-aware recommendations.  
Does not support: treating unconfirmed Manager speculation as fact.

## Operating Events

Provides: append-only record of important product activity: source changes, runs, mission updates, task state changes, checkpoint changes, reviews, permissions, generated drafts, and memory writes.  
Supports: Recent Movement feed, audit trail, memory generation, review triggers, and explaining why Label HQ changed.  
Does not support: factual external claims unless linked to evidence.

## Mission Memory

Provides: mission recap, decisions, blockers, task/checkpoint/note changes, review timing.  
Supports: future mission-aware answers and daily brief context.  
Does not support: replacing source evidence for factual claims.

## Task Results

Provides: what happened, user notes, Manager interpretation, mission effect, follow-up.  
Supports: checkpoint updates, mission progress, review triggers.  
Does not support: external proof unless linked evidence is present.

## Agent Notes

Provides: handoffs, findings, source requests, future specialist context.  
Supports: coordination and memory.  
Does not support: user approval or completed external action.

## Brief Snapshots / Manager Runs

Provides: generated brief timestamp, source set, directive, linked evidence, limitations, and generated output.  
Supports: showing brief freshness and reconstructing why Today's Brief said what it said.  
Does not support: new facts unless the brief links back to evidence, memory, profile context, agent report, operating event, or explicit limitation.
