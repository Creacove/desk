# Manager label-grade document standard

Desk documents are work products, not AI explanations. Recipient-facing artifacts must look like the real document a label, publicist, distributor, manager or editorial team would use. Internal reasoning, quality scoring, evidence provenance and missing-field state remain in Desk metadata/UI and never appear in the exported/shared artifact.

## Product contract

- Research before writing. For EPKs, artist biographies, one-sheets, press releases, press angles, editorial/playlist/press pitches and artist-specific content plans, the Manager must use current public web research in addition to the song workspace unless the artist has explicitly supplied an authoritative private source that makes public research irrelevant.
- Prefer official artist/label/DSP sources and reputable editorial coverage. Store source URLs in claims/evidence metadata, not in the public copy unless the document convention calls for a link.
- Never invent quotes, accolades, playlist placements, audience numbers, credits, contact details, dates, identifiers or press coverage.
- Unknown information is omitted from recipient-facing copy. `missingInputs`, blockers, warnings and verification prompts remain internal Desk state.
- Do not render `Purpose`, `Audience`, `Core narrative`, `Quality checked`, `Needs verification`, model/process notes or other Desk language inside a public artifact.
- Less is more. No section exists merely to satisfy a word count. Each document uses the smallest complete industry-standard structure for its job.
- Release Narrative remains an internal strategy object and is never shareable.

## Artifact standards

### Credit sheet / label copy

Grounded in Recording Academy / Producers & Engineers Wing credit guidance and DSP delivery practice. Capture, when known: artist, track/release title, songwriters/composers/lyricists, producers, recording/mix/master engineers, performers with role/instrument, other creative roles, samples, recording country/date/location, source/mix format, label/content owner, publisher/admin, PRO, ISRC, ISNI and ISWC. Present people by role in a clean credit sheet, not prose. Missing identifiers remain internal blockers rather than visible `TBD` rows.

### Spotify editorial pitch

A copy/paste-ready Spotify for Artists submission aid, not an essay. Include release/track identity, concise editor note, genre/mood/culture/instrument context when supportable, song story and creation context, audience/territory relevance, and the actual marketing/release plan. Keep the pitch compact and specific. Do not claim placement or submission.

### Press release

Use real press-release form: headline, optional subheadline/dek, dateline + lead, concise body, sourced/approved artist quote only if one exists, release/listen details, short artist boilerplate and media contact. No internal strategy headings. Aim for newsroom-ready copy, usually roughly 300–500 words when the facts justify it.

### Distribution delivery sheet

`distributor_notes` is treated as a delivery/label-copy sheet, not a prose note. Include release identity; UPC/EAN/catalog number when known; release/original release date; label; P/C lines; territories; genre/language/explicit designation; per-track title/version/ISRC; primary/featured artists; writers/producers and other required contributors; audio/artwork/lyrics asset state; and specific delivery instructions. Do not expose missing-field warnings in the sheet.

### Content plan

Operational plan, not marketing prose. Start with one campaign idea/objective, then a dated or phase-relative schedule. Each content item should state channel, format, concept/hook, asset/source material, CTA, objective and owner/status where known. Include pre-release, release-day and post-release work appropriate to the release. Base concepts on the artist's real voice, public presence, available assets and campaign story; never manufacture a one-size-fits-all posting formula.

### Release calendar

A real timeline. Show date (or T-minus timing when no date is confirmed), milestone/action, owner, dependency/approval and status. Cover only applicable recording/delivery, distribution, editorial/press, content, release-day and post-release milestones. Do not render the calendar as one long paragraph.

### One-sheet

One page, highly scannable. Use a short bio, strong image/artwork references when available, career highlights, verified DSP/playlist wins, media coverage/quotes, live highlights, key team, links and contact. Omit empty categories. Never include internal readiness/status sections.

### Artist biography

Artist-first, third person. Short version about 100–200 words and fuller version around 250–300 words when enough verified history exists. Cover who the artist is, origin/context, musical identity, journey, influences where sourced, meaningful releases/achievements/collaborations/live moments and current direction. A song can be mentioned as current context, but release operations, splits, ISRC, delivery gates and workspace status do not belong in an artist bio.

### EPK

An industry-facing artist press kit. Include a strong artist overview/bio, focus release/music with listen links where available, selected verified highlights/press, photos/artwork/video assets, social/DSP/site links and professional contact. It may include current news/release context. It is not a release-readiness report and must not contain internal verification or campaign-process language.

## Rendering rules

Public artifacts render only title + artifact-native content. Internal metadata can still be persisted for grounding and approval logic, but the recipient-facing body must never serialize it. Quality/readiness indicators belong in Desk chrome outside the document. Artifact-specific layouts should prefer:

- prose for biographies and press releases;
- compact fields/cards for editorial pitches;
- role groups/tables for credits and distribution sheets;
- tables/timelines for content plans and release calendars;
- a visual single-page hierarchy for one-sheets;
- a media-rich structured page for EPKs.

The document editor uses short product actions such as `Save`, `Edit`, `Approve`, and `Close`; process explanations do not sit above the work product.

## Acceptance rules

A generated recipient-facing document fails product acceptance if it contains any of: `Purpose:`, `Audience:`, `Core narrative:`, `Needs verification`, `Quality checked`, `Manager-built artifact`, instructions about canonical versions, retry/persistence language, workspace gate language unrelated to the recipient, or fabricated placeholders such as `TBD`/`TK`.
