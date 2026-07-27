# Theme-Safe Orbs and Manager Buttons

## Goal

Restore reliable legibility for the Ask Manager controls and every `ThinkingOrb`
usage in both app-controlled light and dark modes while preserving the existing
Ordersounds visual language.

## Root cause

The two Ask Manager buttons are wrapped in `MetalFx`. Its default host
normalization removes the child button's background, border, and shadow. The
button continues to use `text-background`, so light mode renders near-white text
over the effect's white surface. The same structure can produce dark-on-dark
content in dark mode.

Separately, all current `ThinkingOrb` call sites pin `theme="light"` or
`theme="dark"`. Those values describe the orb's host surface rather than the
application theme, and they do not react to the app's manual theme setting.
Several call sites can therefore render the low-contrast orb variant.

## Design

### Ask Manager controls

- Remove `MetalFx` from the song and project Ask Manager controls.
- Keep the established compact pill silhouette, `font-ui` typography, spacing,
  and semantic `foreground`/`background` color tokens used by nearby Ordersounds
  actions.
- Use a solid inverse surface (`bg-foreground text-background`) with the app's
  standard subtle shadow, brand-accent focus ring, hover opacity, and disabled
  opacity/pointer behavior.
- Keep the refresh icon for idle, retry, and refresh states.
- Show a small orb only while the request is pending.
- Do not introduce a new brand color or decorative treatment. These remain
  compact workspace actions rather than primary page calls to action.

### Shared orb behavior

- Add a small design-system wrapper around `ThinkingOrb`.
- For orbs placed on normal app surfaces, map the app's resolved light/dark mode
  directly to the orb theme.
- For orbs placed inside inverse buttons, map to the opposite surface mode:
  a light app has a dark button, and a dark app has a light button.
- Replace every direct `ThinkingOrb` use in production and prototype screens
  with the wrapper so no call site hard-codes a stale theme.
- Preserve each call site's state, size, motion, and layout.

## Accessibility and interaction

- Maintain the existing button accessible names and disabled semantics.
- Add a visible brand-accent focus ring consistent with `ProductButton`.
- Preserve reduced-motion behavior provided by `thinking-orbs`.
- Ensure icon and label color are inherited from the button so both remain
  readable as the theme changes.

## Testing

- Add a focused component test proving the shared orb uses the resolved app
  theme on normal surfaces.
- Add a focused component test proving inverse-surface orbs use the opposite
  theme.
- Extend the music screen regression coverage to verify that both Ask Manager
  buttons use the solid Ordersounds button treatment and are no longer hosted
  by `MetalFx`.
- Run the focused tests, the relevant production app shell tests, type checking,
  and a production build.
- Visually inspect the affected screens in both light and dark app modes,
  including idle and pending button states.

## Scope

This change is limited to orb theme selection and the two MetalFx-wrapped Ask
Manager buttons. It does not redesign unrelated buttons, change loading copy, or
remove orb animation from non-button loading states.
