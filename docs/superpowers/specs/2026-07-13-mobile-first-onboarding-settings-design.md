# Mobile-first onboarding and settings redesign

## Objective

Make artist selection, Manager Basics, and Settings feel like purpose-built mobile app surfaces while preserving useful desktop context. Reuse the paywall's strongest design qualities: compact viewport budgeting, disciplined typography, restrained surfaces, clear hierarchy, and robust overflow containment.

The paywall design itself remains unchanged except for fixes that prevent long artist, project, release, or track names from widening cards beyond the viewport.

## Design principles

- Mobile is a distinct composition, not a stacked desktop layout.
- The primary task must begin in the first viewport.
- Remove copy and panels that do not help the user complete the current action.
- Use one dominant action per onboarding screen.
- Preserve desktop context only where it improves understanding.
- Use the paywall's visual language without forcing every page into its exact shell.
- Long user- and catalog-supplied content must never create horizontal scrolling.

## Artist selection

### Mobile

The initial state contains only the compact app identity/navigation required to leave the session safely, the title `Choose your artist`, one short supporting line, and the artist search input. Search results appear directly beneath the input.

The mobile layout hides the desktop marketing introduction, `Artist Authentication` eyebrow, oversized `Bring your catalog to life` headline, long catalog/setup explanation, desktop status treatment, and decorative lead-in space.

Each result is a compact tappable row containing artwork or a fallback, artist name, essential public metadata, and a directional affordance. Artist names, genres, and follower text truncate inside a `min-width: 0` content region. Results may extend the page vertically, but never horizontally.

After an artist has been selected, the confirmation state uses the same compact hierarchy: selected identity followed by one clear continuation action.

### Desktop

Desktop retains the useful two-column introduction and selection card. Typography, spacing, borders, and shadows are refined to align with the paywall's restrained visual hierarchy. Functional search and selection behavior does not change.

## Manager Basics

### Mobile

The screen contains, in order:

1. A compact back affordance.
2. A compact artist identity row.
3. The `Manager Basics` title.
4. Artist direction.
5. Monthly budget.
6. One full-width `Enter Desk HQ` action.

The form begins within the first viewport on common mobile sizes. Mobile hides the onboarding tips card, enrichment and source explanations, editable Artist name and Spotify identity fields, the `Skip` action, repeated setup copy, and decorative desktop lead-in content.

Artist name and Spotify identity remain in the underlying profile and submission payload; hiding them on mobile does not remove or overwrite their values. Artist direction and monthly budget remain required according to the existing completion contract.

Pending, validation, and catalog status feedback appears adjacent to the form action and remains concise. It must not insert a large content block above the required inputs.

### Desktop

Desktop keeps a contextual two-column layout. The supporting copy is shortened, the identity/tips panel becomes quieter, and the form remains the visual priority. Existing fields and behavior remain available on desktop.

## Settings information architecture

Settings uses the same three-section information architecture on mobile and desktop:

### Profile

- Compact artist summary.
- Identity: Artist name and Spotify identity.
- Career context: Artist stage, home market, genre, and active release.
- Operating context: Artist direction and monthly budget.
- Channels: TikTok, Instagram, YouTube, and X.

### Access

- Access type: paid subscription, private beta, or no active access.
- Current access status.
- Relevant start, renewal, or expiry dates.
- Existing workspace access data remains the source of truth.

When workspace access information is unavailable, the tab renders a concise unavailable/empty state instead of disappearing or showing misleading values.

### Account

- Appearance: System, Light, and Dark.
- Password update when the capability is available.
- Sign out when the capability is available.

### Navigation and responsive behavior

The page defaults to Profile. A compact segmented tab control switches among Profile, Access, and Account without navigating away or losing edits held in the parent profile state.

On mobile, the tab control is sticky beneath the settings header. Only the active section is mounted and visible, preventing a long stacked page. Controls are single-column with clear labels and mobile tap targets.

On desktop, the same tabs and section boundaries remain. The active section uses the wider canvas for grouped two-column fields where appropriate. Desktop and mobile do not maintain separate information architectures.

Artist Intelligence is removed from Settings entirely. Intelligence remains available only on working surfaces where it supports a decision, including Desk HQ and Manager. The profile model is not altered and intelligence data is not deleted.

## Visual system

The redesign follows a refined, utilitarian app direction:

- Display typography establishes one concise title per screen.
- Small uppercase labels are reserved for genuine state or grouping, not repeated decoration.
- One foreground/accent action carries the primary task.
- Cards are used only when they define an interaction or contain a selected identity; routine settings groups rely on spacing and dividers.
- Border radii, subtle borders, restrained shadows, and translucent surfaces inherit the paywall's material quality.
- Motion is limited to quick tab/content transitions, search-result appearance, and action feedback, with reduced-motion preferences respected by existing animation utilities.

## Paywall overflow hardening

The paywall retains its current fixed-viewport composition and design.

All nested grid and flex regions that contain catalog-supplied text receive explicit shrink constraints such as `min-width: 0` and appropriate overflow containment. Single-line identity labels use truncation. Longer descriptive or title content uses a bounded line clamp where retaining more context is useful.

Artwork, pricing, and action columns have bounded sizes and cannot be widened by text. Long unbroken strings must wrap or clip safely. The paywall root continues to use a fixed dynamic viewport and must not produce horizontal document scrolling.

## State and error behavior

- Existing callbacks, persistence boundaries, billing behavior, and profile data flow remain unchanged.
- Artist search pending, empty, error/message, results, and selected states remain available in the compact layout.
- Manager Basics retains its completion and pending rules; hidden mobile fields retain their values.
- Settings tab state is local presentation state. Profile edits continue to flow through `onChange` immediately.
- Password success and error messages remain within Account next to the password form.
- Optional capabilities produce intentional empty states or omit only the unavailable control, not the entire settings structure.

## Accessibility

- Tabs use tab semantics or an equivalent accessible selected-state pattern with clear names.
- Keyboard focus remains visible and moves predictably.
- Inputs retain programmatic labels.
- Primary mobile controls meet practical touch-target sizing.
- Truncated visible text remains available through accessible names or existing underlying content where needed.
- Responsive hiding does not remove required actions or session escape routes.

## Verification

Automated component tests will cover:

- Mobile-specific artist selection hooks/classes expose the title and search control while hiding desktop lead-in content.
- Mobile Manager Basics hides tips, redundant identity fields, explanatory copy, and Skip while retaining direction, budget, and the primary action.
- Settings renders Profile, Access, and Account tabs, defaults to Profile, and exposes only the active section.
- Settings never renders Artist Intelligence.
- Appearance, password, sign-out, and access data remain in their intended tabs.
- Existing profile edits still call `onChange` with the complete profile.
- Long paywall artist, project, release, and track names do not create unconstrained content regions.
- Existing billing/paywall, onboarding, theme, password, and access tests remain passing after their expectations are updated to the new information architecture.

Manual responsive checks will use representative narrow mobile, larger mobile, tablet, and desktop widths in light and dark modes. They will confirm that the primary onboarding controls appear without preliminary scrolling, Settings behaves like an app surface, and no affected page scrolls horizontally.

## Scope boundaries

This work does not change onboarding persistence, Spotify search, billing, subscription terms, catalog import, enrichment, workspace entitlements, or the underlying artist intelligence model. It does not redesign unrelated Desk HQ, Catalog, Manager, Agent, or Mission screens.
