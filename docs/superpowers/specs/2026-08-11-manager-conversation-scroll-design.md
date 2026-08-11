# Manager conversation streaming scroll design

**Date:** 2026-08-11

## Problem

The Manager conversation currently has two independent scroll writers. `ConversationWorkspace` scrolls smoothly whenever the message list, run steps, or streamed text changes, while `useTypewriter` scrolls automatically for every rendered character. Optimistic-message updates, run events, and token updates therefore restart or override one another. The tail anchor also sits at the viewport edge while the composer is fixed above it, so the thinking state can be hidden behind the composer.

## Goal

Make the Manager conversation follow the active reply smoothly and predictably on desktop and mobile:

1. Sending a message moves the latest user message and Manager thinking state into view.
2. The view remains attached to the reply while it streams, without competing smooth-scroll animations.
3. The fixed composer never covers the thinking indicator or the streaming tail.
4. If the user intentionally scrolls away from the latest message, automatic following pauses until they return to the latest position or send another message.

## Non-goals

- Do not introduce a nested chat scroll container, virtualization, or a new scrolling package.
- Do not change the Manager stream protocol, message ordering, typewriter cadence, or composer behavior.
- Do not force-scroll a user who has intentionally left the latest position.

## Design

Keep the document/page scroll model and make `ConversationWorkspace` the only scroll owner. Remove the character-level scroll side effect from `useTypewriter`. Add one tail spacer/anchor with enough bottom clearance for the fixed composer. A small local scroll controller should:

- mark the conversation as following when a new send begins;
- use one immediate reposition for the optimistic message/thinking indicator;
- coalesce subsequent tail updates through `requestAnimationFrame`, using an automatic position update while following rather than restarting smooth scrolling for each delta;
- track whether the page is near the latest position and stop following after an intentional upward scroll;
- resume following on a new send.

The existing fixed composer remains in place. The tail clearance is part of the conversation content, so the last message and thinking indicator remain above the composer on both breakpoints. Respect `prefers-reduced-motion` by avoiding smooth behavior when the browser requests reduced motion.

## Verification

Add regression coverage to `src/production-app-shell.test.tsx` that spies on the tail anchor and verifies:

- a pending send produces one initial reposition;
- streamed/typewriter content does not produce competing per-character scroll calls;
- the tail includes bottom-clearance markup for the fixed composer;
- existing Manager stream tests still render the pending state and final response.

Run the focused Manager conversation tests, the full Vitest suite, and the production build.
