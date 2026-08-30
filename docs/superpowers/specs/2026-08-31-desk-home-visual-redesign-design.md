# Desk Home Visual Redesign

**Date:** 2026-08-31

## Objective

Redesign Desk Home as one coherent, premium composition using the information and actions that already exist. Improve hierarchy, rhythm, surfaces, responsive behavior, and state transitions without turning Home into a dashboard, adding explanatory copy, or making Today feel attached after the fact.

The page must remain fast to scan. Existing content may be removed when it is redundant or low-value, but new product information must not be invented to fill space.

## Design point of view

The page follows four review lenses:

- Naoto Fukasawa: the next interaction should feel obvious without explanation.
- Dieter Rams: every visible element must have a clear job.
- Khoi Vinh: the page is organized by one editorial grid rather than independent cards.
- Susan Kare: controls and states remain immediately legible at small sizes.

This is a product-design standard, not a visual imitation of those designers.

## Existing content contract

Home may render only information already available to the current screen:

- Home and Activity
- Today label, runtime headline, tasks, task descriptions, task metadata, actions, questions, permissions, blockers, and watch items
- Manager composer and existing attachment behavior
- Today's Brief label, generated time, refresh state, headline, and selected metrics
- Manager's Read labels and bodies

The redesign will not add date copy, action counts, invented summaries, source explanations, confidence text, mission descriptions, or all-clear messaging that the screen does not already provide.

Existing generated copy may be visually prioritized, truncated only through controlled responsive wrapping, or omitted when duplicative. It must not be replaced with fabricated UI copy.

## Page architecture

Home remains a single vertical reading flow:

1. Workspace masthead
2. Today, only when runtime work or watches exist
3. Manager composer
4. Today's Brief
5. Signal metrics
6. Manager's Read

All areas share the existing `--os-room-max` rail and the same horizontal anchors. The redesign does not introduce a second page width, a card grid, or a separate visual theme.

## Workspace masthead

The desktop masthead keeps the existing Home title and Activity action. It uses a quiet bottom rule to establish the page grid and align with the section rules below.

- Home: 32px/34px, weight 600, tracking -0.03em
- Activity: minimum 44px target
- Bottom spacing: 22-24px

Mobile continues to use the existing app header. Home is not repeated inside the content viewport.

## Today

Today is a conditional execution section, not a hero card. It uses a restrained tonal field or rule-based band that feels native to the page in light and dark themes. The surface must include enough interior padding that text never appears constricted against a colored background.

### Visible hierarchy

When actionable work exists, Today renders:

1. Existing Today label
2. Existing runtime headline
3. One visually primary action
4. Up to two quieter supporting actions
5. Existing watch items when present

No new labels such as “Priority mission,” “Next move,” or “Also today” are required. A short existing label may be retained only if it materially improves scanning and does not duplicate the content around it.

### Typography

- Today label: 11px/14px, weight 700, uppercase, tracking 0.09em
- Runtime headline: 27-30px/32-35px desktop; 22-24px/27-30px mobile
- Primary task title: 15-16px/21px, weight 600
- Task description: 13-14px/21px, weight 500
- Metadata: 11-12px/17px
- Action: 12-13px, weight 600, minimum 44px target

The runtime headline must be visibly subordinate to the Home title but strong enough to lead the execution section. It must not look like a small caption above a task list.

### Action rows

The first runtime item receives stronger spacing, title weight, and restrained brand emphasis. Supporting items use the same alignment with reduced emphasis. Items are separated by subtle rules rather than individual cards.

Circular number badges are removed. If indexes remain useful, they render as quiet monospaced `01`, `02`, and `03` markers aligned with the numbering used by Manager's Read.

Actions sit close to the item they control. On desktop they occupy the trailing grid column. On mobile they move beneath the description or remain inline only when the title still has a comfortable measure.

Question and permission details continue to expand inline. Expanded content uses the full readable width of the Today surface, with 16-20px padding and no nested oversized card.

Task CTA wording must remain behaviorally honest. A control that only navigates must not claim that it directly starts work.

### Conditional states

- Actionable: headline, action rows, and any watches render.
- Watch-only: the existing watch content renders in a compact Today section without an empty action area.
- Empty: Today returns `null`. No placeholder, all-clear message, reserved space, top rule, or empty background remains.
- Loading: retain the fallback/current projection so the section does not flash between present and absent.
- Failure: retain usable fallback work. Errors must not replace the rest of Home.

DeskHQ owns page spacing so the composer and brief move upward naturally when Today is absent.

## Manager composer

The composer remains the transition between execution and intelligence. It keeps the existing placeholder and attachment behavior.

- Minimum height: 48px
- Radius: 12px
- Horizontal padding: 12-16px
- Input: 14-15px/22px
- Neutral surface and border at rest
- Brand-accent focus ring and send action
- No heavy shadow or persistent accent border

When Today exists, use 18-22px between Today and the composer. When Today is absent, use 20-24px below the masthead. Today's Brief begins 36-44px after the composer.

## Today's Brief

Today's Brief remains the intelligence focal point. It does not receive an additional summary or explanatory block.

The label, update time, refresh action, headline, and metrics remain. The composition uses the same left and right anchors as Today.

- Section label: 11px/14px, weight 700, uppercase, tracking 0.09em
- Update text: 11-12px/17px
- Headline: 34-38px/39-43px desktop; 27-30px/32-35px mobile
- Headline maximum measure: approximately 26-30 characters per line where content permits
- Gap from section header to headline: 16-20px

The brief headline is intentionally larger than the Today runtime headline because it is the page's intelligence read. Today compensates through stronger action hierarchy and surface treatment, not by competing at the same headline size.

Refresh pending and failure states preserve the current brief and occupy stable space in the section header.

## Signal metrics

Metrics remain a quiet evidence ledger rather than cards.

- Up to four metrics
- Four equal desktop columns; two-by-two mobile grid
- Top and bottom rules with internal dividers
- 20-24px vertical padding
- Label: 12px/17px, weight 500
- Value: 24-27px/29px, weight 600
- No icon, colored tile, shadow, or decorative badge

Metric labels and values wrap without clipping. Cells retain adequate padding in dark and light themes.

## Manager's Read

Manager's Read remains a single-column editorial sequence. Existing labels and body copy are preserved. No introduction, summary, accordion, or card grid is added.

- Section label: 11px/14px, weight 700
- Row padding: 26-30px desktop; 20-24px mobile
- Metadata column: approximately 144-160px desktop
- Body: 15-16px/25-26px, weight 500
- Reading measure: approximately 66-72 characters
- Number: 11px mono, quiet tertiary color
- Label: 11px/15px uppercase

Rows use thin dividers. Body text receives enough width and line height to read comfortably without spanning the entire room rail.

## Shared color system

Home uses the existing semantic theme tokens rather than page-specific hard-coded colors.

- Canvas: `--surface-canvas`
- Today and composer fields: `--surface-panel` and `--surface-elevated`
- Primary text: `--foreground`
- Supporting text: `--muted-foreground`
- Dividers: `--surface-line` or equivalent foreground opacity
- Accent: `--brand-accent`
- Warning and destructive colors only for corresponding runtime states

Purple is reserved for the primary action, active/focus feedback, and the Activity badge. Background variation must be tonal and flat. The Home redesign introduces no gradients, glow, glass treatment, or large shadow.

In dark mode, any different background must include at least 20px of interior padding and enough contrast from the canvas to read as a deliberate surface. In light mode, the same structure uses warm neutral surfaces and existing border tokens.

## Responsive behavior

Desktop uses the full room rail and consistent horizontal anchors.

Mobile behaves like a native app screen:

- 16px content padding
- Existing mobile header and navigation remain authoritative
- No duplicate Home heading
- No squeezed desktop grids
- Today rows stack title, description, metadata, and action naturally
- Composer fills the available width
- Metrics use a two-by-two grid
- Manager's Read metadata moves above body copy
- All controls have at least a 44px target
- No essential content is placed in a horizontal carousel

The page must not create horizontal overflow at 320px, 375px, or 390px viewport widths.

## Spacing rhythm

Desktop targets:

- Masthead to Today or composer: 22-24px
- Today internal vertical rhythm: 18-24px
- Today to composer: 18-22px
- Composer to brief: 36-44px
- Brief headline to metrics: 28-34px
- Metrics to Manager's Read: 40-48px
- Page bottom: 64-72px

Mobile targets:

- Major section gaps: 30-36px
- Internal gaps: 16-22px
- Page bottom: enough room for the existing bottom navigation

Spacing is controlled by explicit Home layout variants rather than margins that assume Today is always present.

## Motion and accessibility

- Keep the existing short workspace reveal.
- Interactive transitions remain between 150ms and 200ms.
- Avoid staggered task animation and shimmer.
- Respect reduced-motion preferences.
- Preserve semantic heading order.
- Preserve visible keyboard focus.
- Do not communicate runtime state through color alone.
- Maintain readable contrast in both themes.

## Implementation boundaries

Primary implementation areas:

- `src/features/desk/DeskHQ.tsx`
- `src/features/desk/TodayRuntimeExecution.tsx`
- `src/design-system/desktop-premium.css` or a focused Home stylesheet imported through the existing design layer
- Existing Home and Today tests, plus focused responsive/state contracts

The projection priority logic, Supabase reads, mutation behavior, Today's Brief generation, and Manager's Read data are out of scope unless a display-copy bug makes a current action misleading.

## Verification

The redesign must be verified in:

- Desktop light and dark at 1440x900
- Compact desktop/tablet at 1024x768
- Mobile light and dark at 390x844
- Narrow mobile at 320px
- Actionable Today
- Watch-only Today
- Empty Today
- Long headline and long task text
- Brief refresh pending and failure
- Inline permission and question expansion
- Reduced motion

The page is complete only when every state reads as the same Home design and no conditional state leaves an unexplained gap, orphaned rule, cramped surface, or competing hierarchy.
