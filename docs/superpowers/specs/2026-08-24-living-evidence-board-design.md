# Living evidence board setup presentation

## Objective

Make paid setup feel like a capable manager is actively discovering and organizing an artist's world. Preserve the existing queue, setup lifecycle, backend data contract, and immediate completion behavior. Change only the presentation layer.

The screen should communicate two ideas at once:

1. The manager is handling one confirmed finding now.
2. The visible findings are a curated sample of a larger working file, not the full extent of the investigation.

## Design direction

Use a restrained, editorial product language consistent with Desk. The page stays mostly neutral. Purple remains limited to the Ordersounds mark and existing brand moments. Real semantic state may use the existing green status color.

Design settings:

- Design variance: 6. The board is asymmetrical but controlled.
- Motion intensity: 7. Motion tells the filing story, with no perpetual decorative animation.
- Visual density: 5. More information is visible than today, but it is grouped into a composition rather than a long list.

## Page hierarchy

### Header

Keep the existing Ordersounds Desk identity and small Setup control. Do not add another progress message to the header.

### Context rail

Reduce the left rail to:

- `Getting to know {artist}`
- The current phase headline, such as `Finding the signals that matter.`
- One short active sentence only when useful, such as `Checking audience momentum.`
- The existing timing reassurance only when the wait is genuinely long.

Remove `Desk setup`, its decorative dot, the phase eyebrow, duplicate explanatory copy, and the persistent progress-saved ornament. Saving continues to work but does not need to compete with the experience.

### Active finding

The active object sits immediately above the evidence board. It has no heavy left border, footer strip, or duplicate destination sentence. Its visual form is selected from confirmed data:

- Metric: platform mark, metric label, large value, optional real trend sparkline.
- Market: location symbol, market name, optional rank or share.
- Music: real cover artwork, title, and release type.
- Identity: artist image, name, and concise genre context.
- Narrative: document symbol, title, and one short status line.

The object may show one semantic `Reading now` state. Platform branding is communicated with official or existing local marks where available, never with invented provider colors or fake data.

### Living evidence board

Replace the paper stack and long categorized rows with a compact asymmetric board. The board begins with an artist identity anchor and arranges settled findings into content-aware modules:

- Important metrics use medium tiles with a strong value.
- Music findings use cover-led tiles or a compact artwork strip.
- Markets use small place modules that can cluster together.
- Platform signals carry recognizable platform marks.
- Narrative outputs use document-like modules with restrained copy.

The board is deterministic. The same findings produce the same layout, avoiding reflow noise. Empty categories are not rendered. Section numbers, `Filing now`, `Building first read`, and repetitive checkmarks are removed.

To imply a larger investigation without fabricating information:

- Render only the presentation queue's bounded settled sample.
- Allow the final row to be partially masked by a soft surface fade when more settled findings exist.
- Show a factual count such as `18 more signals filed` when the queue reports collapsed findings.
- Keep a small current-investigation line outside the board while setup is active.
- Never render fake cards, fake metrics, placeholder platform activity, or looping skeletons after real data exists.

## Motion

Keep the current first-in-first-out queue and minimum display timing.

Each active finding enters with opacity and a short vertical transform. When its display interval finishes, it compresses toward its destination and the board updates. The settled module receives a brief opacity and scale confirmation. Only `transform` and `opacity` animate.

Motion must not delay setup completion. When setup reports completion, the existing navigation behavior wins immediately. `prefers-reduced-motion` converts all transitions to instant state changes.

No canvas, WebGL, physics engine, charting package, continuous particle system, or scroll listener is introduced.

## Data and architecture

`ManagerWorkingFile` remains a read-only consumer of `SetupPresentationSnapshot`. `useSetupPresentationQueue` remains the only presentation queue controller. Setup workers and database writes are unchanged.

Introduce small presentation-only units:

- `ActiveEvidence`: chooses the active finding treatment.
- `EvidenceBoard`: composes the settled sample.
- `EvidenceModule`: renders metric, market, music, identity, or narrative variants.
- `PlatformMark`: maps known platform identifiers to existing local assets or restrained text fallback.
- `EvidenceSparkline`: renders only supplied historical points; absent history produces no chart.

All variants accept the existing `SetupPresentationFinding` data. Any derived display classification is pure and deterministic.

## Responsive behavior

Desktop keeps the context rail and board side by side. The active finding aligns with the board width.

Below 768px, the rail becomes a compact top introduction. The board uses two columns where space permits and one column for larger modules. Cover strips may scroll horizontally with native overflow. No horizontal page overflow is allowed.

The composition must remain useful at 320px wide, with values and platform marks readable without truncating the primary metric.

## Failure and incomplete-data behavior

- Missing artwork uses the existing restrained fallback, not a generic avatar illustration.
- Unknown platforms render a neutral source label.
- Missing value or detail collapses cleanly without reserving blank space.
- Failed images preserve module dimensions to prevent layout shift.
- No findings shows one line: `Waiting for the first signal.`
- Queue and feed errors do not affect setup execution or navigation.

## Performance constraints

- No new runtime dependency.
- No new backend request.
- No animation of layout properties.
- No continuous timers beyond the existing queue timing.
- Images retain explicit dimensions and lazy-load outside the first visible group.
- Sparkline rendering is bounded to the small number of points already supplied by the finding.
- Presentation exceptions remain isolated from setup completion.

## Verification

- Component tests cover active metric, market, music, unknown-platform, missing-artwork, collapsed-count, and reduced-motion states.
- Existing queue-order and immediate-completion tests continue to pass.
- Production build must pass.
- Visual verification covers desktop, mobile, populated, sparse, and reduced-motion fixtures.
- Final QA checks copy density, brand color restraint, platform mark accuracy, overflow, animation cleanup, and the absence of the active card's left border.
