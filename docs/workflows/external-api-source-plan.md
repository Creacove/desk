# External API Source Plan

Purpose: define the V1 external APIs, cost assumptions, procurement choices, and evidence boundaries needed to power the AI Manager from the prototype's handle-only artist setup.

This plan is implementation-oriented as of June 3, 2026. Spotify is already the first catalog source, and Chartmetric credentials are now available for the first paid enrichment slice. This document still records procurement tradeoffs, but the current default is no longer "choose Chartmetric or Soundcharts"; it is "integrate Chartmetric in small verified slices, keep Soundcharts as fallback."

## CTO Recommendation

V1 should optimize for the lowest paid path that still proves the AI Manager.

- Use Spotify Web API and YouTube Data API immediately as the free/base layer.
- Use Chartmetric as the first paid music intelligence API because credentials are available.
- Keep Soundcharts as the fallback if Chartmetric coverage, quota, or endpoint shape does not support the required V1 evidence.
- Use Bright Data only as a public TikTok/Instagram raw-data fallback when the primary music intelligence API does not expose enough detail.
- Use Apify only for low-budget experiments, not as the core evidence pipeline.
- Evaluate Chartex only if TikTok sound/video depth is a blocker after testing Chartmetric or Soundcharts.
- Avoid direct TikTok OAuth, direct Instagram OAuth, and X API as core V1 dependencies unless a specific Manager workflow requires them.

## Pricing Matrix

| API / Vendor | Minimum public cost | Free / trial | V1 use | CTO read |
| --- | ---: | --- | --- | --- |
| Spotify Web API | No public per-call fee found | Developer app/account required | Artist identity, catalog, tracks, albums, images, ISRC where available | Use immediately. Not enough for analytics. |
| YouTube Data API | No paid plan; quota based | Default 10,000 quota units/day | YouTube handle, channel stats, video stats, comments | Use immediately. Good free evidence source. |
| Chartmetric API | From $350/month, monthly only | 7-day trials on Chartmetric plans; limited free service exists | Broad artist, track, social, playlist, and chart intelligence | Best fit if budget allows. First paid choice. |
| Soundcharts API | From $250/month for 500k queries/month | Free sandbox; free production token with 1,000 requests | Broad artist, song, playlist, chart, radio, and social intelligence | Best cost-to-coverage alternative. Strong V1 candidate. |
| Bright Data TikTok/Instagram Scraper APIs | $1.50 / 1k records pay-as-you-go; $499/month scale plan | 1k one-time requests, available for one week, no card | TikTok profile, videos, comments; Instagram public profile/posts if needed | Use as fallback for raw public TikTok/Instagram. Watch legal and terms risk. |
| Apify TikTok actors | Free plan has monthly credits; common TikTok actors roughly $1.70-$5 / 1k results | $5 monthly platform credits | Cheap TikTok scraping tests | Budget fallback, not primary production source. Actor quality varies. |
| Viberate Music API | API package selector starts at $300/month | 14-day API trial advertised | Broad music/social API alternative | Evaluate if Chartmetric/Soundcharts pricing or coverage fails. |
| Chartex | App has free tier; Premium $45/month; Business $90/month; API pricing behind login/dashboard | Free app tier | TikTok sounds, daily create counts, video-level data, Instagram creates, Shazam | Evaluate for TikTok music depth. API price must be confirmed after signup. |
| Instagram Graph API | No per-call fee from Meta | Requires Meta app/account/permissions | Limited Business/Creator discovery or owned account insights | Not core. Too much setup and incomplete for handle-only V1. |
| X API | Pay-per-usage; no stable public minimum captured | Requires developer account | X profile/post context | Defer unless X becomes essential. |

## Recommended V1 Purchase Path

### Start Free This Week

- Use Spotify Web API for identity and catalog matching.
- Use YouTube Data API for YouTube handle, channel, video, and comment evidence.
- Use Chartmetric limited/free app or trial manually to inspect real artist coverage.
- Use Soundcharts free sandbox plus the 1,000-request production token to test real API shape.

### Choose One Primary Paid Music Intelligence API

Choose Chartmetric for the current V1 build. The first implementation must prove token exchange, artist/track resolution, setup enrichment queueing, raw snapshot storage, and normalized evidence items before broad ingestion.

Choose Soundcharts later only if budget, quota, or coverage gaps make Chartmetric a poor fit for the selected artists/tracks.

Do not pay for Chartmetric and Soundcharts at the same time until V1 has paying users or a clear data gap that one cannot cover.

## Current Credential Setup

Do not paste credentials into docs, source code, browser-visible env vars, or client code.

Server-side environment variables:

- `CHARTMETRIC_REFRESH_TOKEN`: long-lived Chartmetric refresh token.
- `CHARTMETRIC_BASE_URL`: defaults to `https://api.chartmetric.com`.
- `OPENAI_API_KEY`: OpenAI API key for server-side summary generation.
- `OPENAI_SUMMARY_MODEL`: optional model override for source-backed summaries.

Chartmetric access flow:

1. Store the refresh token only in local `.env.local`, Supabase function secrets, or deployment secrets.
2. Exchange the refresh token with `POST https://api.chartmetric.com/api/token`.
3. Cache and reuse the returned bearer token until expiry; Chartmetric documents access tokens as one-hour tokens.
4. Send API calls with `Authorization: Bearer <access token>`.
5. Respect `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

OpenAI use:

1. Use OpenAI only after raw snapshots and normalized evidence items exist.
2. Generate summaries from evidence rows, source limitations, and Music state, not directly from unpersisted provider responses.
3. Persist model/provider metadata and usage/cost rows when summary generation runs.
4. Store summary output as a derived artifact that can be regenerated or superseded, not as the source of truth.

### Add TikTok Raw-Data Fallback Only When Needed

Use Bright Data pay-as-you-go for raw TikTok profile, video, and comment pulls when Chartmetric or Soundcharts cannot answer the evidence question.

Budget example: 10,000 TikTok records costs about $15 on Bright Data pay-as-you-go at $1.50 / 1k records.

Set monthly spend limits before production use. Treat Bright Data records as public web data, not private analytics.

### Evaluate Chartex Only For TikTok Sound Depth

Test Chartex if Chartmetric or Soundcharts cannot answer:

- which TikTok sounds are linked to this track
- which videos are driving the sound
- how daily create counts are moving
- whether the track is charting by country or sound usage

Chartex app pricing is visible, but API pricing must be confirmed after signup/login.

## Monthly Budget Scenarios

| Scenario | Monthly cost estimate | Stack | Use when |
| --- | ---: | --- | --- |
| Free prototype | $0 | Spotify Web API + YouTube Data API + manual trials | Building schema, adapters, and evidence model before paid procurement. |
| Lean V1 | $0-$250 | Free APIs + Soundcharts sandbox/free token, then Soundcharts paid plan | Budget is tight and API quota matters. |
| Best fit V1 | $350 | Free APIs + Chartmetric API | Chartmetric confirms the strongest artist/track/social coverage. |
| Best fit with TikTok raw fallback | $350 + Bright Data usage | Free APIs + Chartmetric + Bright Data pay-as-you-go | The Manager needs raw public TikTok profile/video/comment proof. |
| Low-budget TikTok testing | $0-$50 variable | Free APIs + Apify credits/pay-per-result actors | Testing data shape before committing to Bright Data or Chartex. Not production-grade. |
| TikTok music specialist add-on | $45-$90 app tier plus unknown API request cost | Chartex app/API | TikTok sounds and create-count depth are more important than broad artist intelligence. |

## Handle-Only Onboarding Flow

The prototype collects handles and identity fields, not social OAuth. Production should preserve that model.

1. User enters Spotify identity, TikTok handle, Instagram handle, YouTube handle/channel, and X handle where available.
2. Resolve Spotify identity with Spotify Web API.
3. Use the Spotify ID, Spotify URL, artist name, and social URLs to resolve the artist in Chartmetric or Soundcharts.
4. Store each entered handle as a source candidate with status: `resolved`, `unresolved`, `ambiguous`, `unavailable`, or `not_configured`.
5. Pull free/public source snapshots first: Spotify catalog and YouTube channel/video data.
6. After Spotify catalog import, queue Chartmetric setup enrichment for the artist profile, latest setup project/release, and up to five standalone songs outside that project.
7. Pull primary music intelligence snapshots from the selected paid provider.
8. Pull Bright Data snapshots only for specific TikTok/Instagram evidence gaps.
9. Save durable song/project identity into first-class Music records when the source resolves catalog or release context.
10. Normalize snapshots into evidence items with source, time window, confidence, freshness, provenance, limitation, and raw reference.

Unresolved handles should not block onboarding. They should lower source readiness and create a Manager evidence request when the missing source affects decision quality.

## Manager Evidence Matrix

| Manager need | Primary source | Fallback source | Claim boundary |
| --- | --- | --- | --- |
| Artist identity | Spotify Web API | Chartmetric/Soundcharts search | Supports identity and public profile only. |
| Catalog and active release | Saved Music records + Spotify Web API | Chartmetric/Soundcharts track/album endpoints | Saved Music state supports continuity; source-backed catalog context still cannot prove private release performance. |
| Track-level momentum | Chartmetric | Soundcharts or Chartex for TikTok sound depth | Must name the platform and time window. |
| Track-level summary | Saved Music + Spotify public catalog + Chartmetric evidence + uploaded/private analytics where available | OpenAI source-backed synthesis | The summary is generated interpretation, not evidence. It must list source limitations. |
| Streams/listeners/saves | Spotify for Artists export or authorized/private source when available | Chartmetric for Chartmetric-reported platform streams/listeners only when the endpoint clearly provides the metric and window | Label these as Chartmetric evidence. Do not attribute them to Spotify Web API. Saves/source-of-stream still require a source that supports those exact fields. |
| TikTok hook/video movement | Chartmetric track/social endpoints where available | Bright Data public TikTok scraper, Chartex | Attention signal unless paired with conversion data. |
| TikTok comments/themes | Bright Data public TikTok scraper | Apify experiment | Supports qualitative audience reaction, not streaming conversion. |
| Instagram audience/posts/reels | Chartmetric | Bright Data Instagram public scraper; Meta Business Discovery for eligible accounts | Public or third-party social signal only unless artist authorizes private insights. |
| YouTube channel/video response | YouTube Data API | Chartmetric/Soundcharts YouTube stats | Public engagement and comment signal, not private YouTube Studio analytics. |
| Playlist adds/removals | Chartmetric | Soundcharts | Supports playlist movement if source includes date/reach/platform. |
| Chart appearances | Chartmetric | Chartex for TikTok/Spotify/YouTube/Instagram chart focus | Supports chart position only inside the source's coverage. |
| City/market signal | Chartmetric geography where available | YouTube/comment geography as weak signal | Do not claim city demand from comments alone. |
| Conversion evidence | Spotify for Artists export, distributor analytics, smart-link report, campaign report | Uploaded files | Required for saves, source-of-stream, ROI, or conversion claims. |

## Source Boundaries

The AI Manager must preserve the source-confidence contract.

- Spotify Web API cannot prove private Spotify saves, skips, source-of-stream, Spotify for Artists pitch status, royalty revenue, or listener conversion.
- Chartmetric-reported Spotify streams or platform streams can be used as Chartmetric evidence when returned by the contracted endpoint. They are not Spotify Web API data and must not be described as private account analytics.
- TikTok, Instagram, YouTube, and X public data are attention and context signals unless paired with stronger conversion evidence.
- Bright Data, Apify, and similar providers should be labeled as public web data providers, not official platform analytics.
- Scraped/public social data must not be treated as private account analytics.
- Regional demand claims require a geography-capable source for the relevant signal.
- Comments mentioning a city can support "comments mention Lagos"; they cannot support "Lagos demand is confirmed."
- Campaign ROI requires spend data plus conversion data. Views, comments, and shares alone are not ROI.

## Vendor Decision Rules

- Pick Chartmetric when the selected test artist has strong coverage across artist, track, TikTok, Instagram, YouTube, playlist, chart, and geography endpoints.
- Pick Soundcharts when API quota, lower entry price, and broad endpoint access matter more than Chartmetric's wider industry workflow.
- Add Bright Data when the Manager needs raw TikTok or Instagram public artifacts that the primary music intelligence API cannot provide.
- Test Chartex when TikTok sound creation counts, creator-per-sound data, and country-level TikTok sound performance become core to the release read.
- Defer X API until X becomes a meaningful source in the prototype's Manager decisions.
- Avoid building V1 around direct TikTok or Instagram OAuth because the prototype is handle-only and artists may reasonably resist connecting social accounts.

## Implementation Notes For Backend Planning

- Store provider credentials server-side only.
- Chartmetric refresh tokens are secrets. Never expose them through `VITE_` variables.
- Create adapter boundaries by provider, not by UI surface.
- Store raw source snapshots append-only before normalization.
- Persist resolved songs/projects into Music records so Manager runs can reuse fresh-enough saved state instead of refetching provider data for every decision.
- Normalize every source result into evidence items before Manager synthesis reads it.
- In setup, separate project enrichment from standalone-song enrichment: the setup project is enriched as a release/project body of work, while up to five standalone songs are enriched individually.
- Generate OpenAI summaries from saved evidence and Music records only. Do not let AI summaries become raw evidence.
- Include cost controls in ingestion jobs: provider enable flags, per-provider monthly spend caps, per-artist refresh intervals, and manual refresh limits.
- Prefer scheduled refreshes over on-demand full refreshes during V1 to control spend.
- Use provider-specific stale-state warnings in Label HQ when paid source access is missing or exhausted.

## Acceptance Checks

- The external API plan gives a concrete V1 default stack and budget scenarios.
- Every API in the plan has a V1 purpose, cost posture, and source limitation.
- The Manager can work from handle-only onboarding without requiring social OAuth.
- The plan distinguishes public catalog, public social data, third-party music intelligence, and private connected/uploaded analytics.
- Chartmetric access token exchange is server-side, refresh-token based, rate-limit aware, and covered by tests before broad ingestion.
- OpenAI summaries are generated only from persisted source snapshots, evidence items, Music records, and explicit limitations.
- No Manager-visible metric can be generated unless the source class supports that claim.
- Any TikTok or Instagram public-data fallback includes legal/terms review and monthly spend limits before production use.

## Source Links

- Chartmetric pricing: [from $350/month API access](https://chartmetric.com/pricing).
- Chartmetric API docs: [Developer API quickstart](https://apidocs.chartmetric.com/), [API documentation](https://api.chartmetric.com/apidoc/).
- OpenAI Responses API: [API reference](https://platform.openai.com/docs/api-reference/responses).
- Soundcharts pricing/API access: [$250 for 500k queries/month](https://soundcharts.com/en/pricing), [free sandbox and 1,000-request production token](https://help.soundcharts.com/en/articles/10091349-how-can-i-get-access-to-soundcharts-api).
- Bright Data pricing: [1k free trial requests and $1.50/1k records pay-as-you-go](https://brightdata.com/pricing/web-scraper).
- Bright Data TikTok scraper docs: [TikTok Scraper API](https://docs.brightdata.com/datasets/scrapers/tiktok/introduction).
- YouTube quota: [10,000 units/day default quota](https://developers.google.com/youtube/v3/getting-started).
- YouTube Data API docs: [channels.list](https://developers.google.com/youtube/v3/docs/channels/list), [videos.list](https://developers.google.com/youtube/v3/docs/videos/list), [search.list](https://developers.google.com/youtube/v3/docs/search/list).
- Spotify Web API: [documentation](https://developer.spotify.com/documentation/web-api), [API calls](https://developer.spotify.com/documentation/web-api/concepts/api-calls), [search](https://developer.spotify.com/documentation/web-api/reference/search).
- Viberate API: [14-day trial and $300/month package option](https://www.viberate.com/music-data-api/).
- Chartex: [free/Premium/Business app pricing](https://chartex.com/pricing), [API docs](https://chartex.com/apidocs/getting-started).
- TikTok official limitation context: [Display API requires user-scoped profile/video permissions](https://developers.tiktok.com/doc/display-api-overview).
