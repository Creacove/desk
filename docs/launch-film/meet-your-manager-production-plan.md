# Meet Your Manager launch film

## Goal

Create a premium product-launch film for Desk that can stand alone, be reposted without additional context, and make one idea unmistakable:

**Meet your manager.**

The film is about Desk itself. Beta conversion, traction, customer counts, funding proof, and founder milestones do not appear in this film. Those belong in separate launch graphics and posts.

## Creative thesis

The artist should begin the film carrying the release operation alone. By the end, Desk is visibly carrying the operating work while the artist stays in control.

The story is not a feature tour. It is one continuous use case:

1. Artist has a goal.
2. Desk understands the artist and the release.
3. Desk decides what matters now.
4. Desk does the work it can do itself.
5. Desk gives the artist exact human work when required.
6. Reality changes.
7. Desk adjusts without needing a new "what next?" prompt.
8. Desk watches the result.
9. Desk asks for approval only where authority is required.
10. Desk continues.
11. End on **Meet your manager.**

## Primary format strategy

The film is designed mobile-first. A landscape film will never be used as the master and cropped down.

### Primary masters

- Vertical: 2160 x 3840, 9:16, 60 fps
- Feed: 2160 x 2700, 4:5, 60 fps
- Landscape: 3840 x 2160, 16:9, 60 fps

Each format receives its own camera composition, typography positions, UI crop, safe zones, and motion path.

### Composition rules

- Important UI must be readable on a normal phone without pausing.
- Most phone shots show only the relevant portion of the Desk interface.
- Full application views are used briefly for orientation, not as the default shot scale.
- One idea per frame.
- Cursor appears only when a human decision matters.
- Product UI remains authentic. Motion may lift real UI objects into space, enlarge them, isolate them, or transition between them, but should not redesign Desk into a fictional interface.
- Sound-off viewing must still communicate the entire story.

## Visual scales

### Product world

Shows enough of Desk to establish location and product context. Use sparingly.

Target share of film: approximately 15%.

### Feature scale

Camera crops directly into the important operating surface, such as Today, a Task, a Manager artifact, or an approval.

Target share of film: approximately 55%.

### Detail scale

One product state or action becomes the visual subject, for example:

- EPK ready
- Desk is watching
- Move it
- Approve & run
- Sunday

Target share of film: approximately 30%.

## Camera language

Camera movement carries meaning.

- Push in: a decision matters.
- Pull out: Desk has completed or assembled work.
- Horizontal move: reality changed and the route changed with it.
- Hard cut: a new chapter or strong product truth.
- Interface-to-type transition: a product state becomes a brand statement.

Random zooming and decorative camera movement are not allowed.

## Master story, approximately 55 to 60 seconds

### 01. The question, 0:00 to 0:04

Large type only.

**You make the music.**

Then:

**Who runs everything else?**

Minimal sound. No product yet.

### 02. Desk enters, 0:04 to 0:07

Purple Desk mark / brand presence enters.

**Desk.**

Transition immediately into the real Manager surface.

### 03. Give Desk the goal, 0:07 to 0:12

Manager composer is large enough to read on a phone.

Artist input:

**I want to release Odaeshi next month.**

The send action is the first meaningful user interaction.

### 04. Desk understands, 0:12 to 0:17

Song context, artist understanding, audience signals, files, release state, and operating facts are represented through real Desk UI elements.

They may lift from the interface and converge around the song.

On-screen type:

**Desk gets the context.**

### 05. Desk decides, 0:17 to 0:22

Cut to Home / Today.

Everything secondary recedes. One exact priority fills the frame.

Example:

**Odaeshi is the priority today.**

**Record "What couldn't finish us?"**

On-screen type:

**Then decides what matters now.**

### 06. Desk does the work, 0:22 to 0:30

Manager-created work appears from the real product flow:

- EPK
- press release or press angle
- content plan
- editorial or playlist pitch

Objects can lift out of the interface, stack in space, then collapse back into Files / completed work.

On-screen type:

**Desk does the work it can.**

### 07. Exact human work, 0:30 to 0:37

Open the Mission Task.

Show enough of the actual brief to prove the artist is not receiving a vague instruction:

- setup
- hook
- what to film/do
- edit direction
- CTA
- fallback where relevant

On-screen type:

**When it needs you, you get the exact job.**

### 08. Reality changes, 0:37 to 0:42

Artist uses Move it or communicates a real constraint.

Example:

**Both friends and the car are only available Sunday.**

Old route slides away.

### 09. Desk adjusts, 0:42 to 0:47

Home / Mission updates automatically.

No artist prompt asking what next.

On-screen type sequence:

**Plans changed.**

Then:

**Desk adjusted.**

Optional micro-copy:

**No "what next?" required.**

### 10. Desk watches, 0:47 to 0:51

Task result enters the operating loop.

Show:

**Desk is watching**

Then transition into the next decision or result state.

### 11. You stay in control, 0:51 to 0:55

Show one exact external-action approval.

Tight crop:

**Approve & run**

Cursor appears, clicks once, then disappears.

Desk completes the action after approval.

On-screen type:

**You stay in control.**

### 12. End card, 0:55 to 0:60

Product collapses into the brand mark or the camera pulls out from the final Desk surface.

Black or near-black canvas.

**Meet your manager.**

Desk / OrderSounds mark.

No beta conversion statistic. No customer count. No traction slide.

## Typography rules

- On a 1080 x 1920 delivery, important supporting copy should generally not require sizes below approximately 42 to 48 px equivalent.
- Headlines should commonly occupy approximately 70 to 130 px equivalent depending on length.
- If important copy needs to become tiny to fit, recompose the shot instead.
- Typography should interact with product states, not behave like subtitles pasted over a screen recording.
- The existing Manrope-based Desk system remains the foundation.

## Mobile safe-area rules

For 9:16 social versions:

- keep critical information away from the hard right edge where social controls may sit
- keep final CTAs away from the bottom interaction chrome
- avoid putting essential copy at the extreme top
- ensure the central composition remains understandable even with social UI present

A film-guide overlay should be available in the studio route but disabled for final capture.

## Sound rules

The story must work silently.

With sound enabled:

### Phase 1: tension

Sparse, tactile, restrained.

### Phase 2: Desk enters

A clean impact introduces the operating pulse.

### Phase 3: control

The sound opens up as Desk begins doing work, adapting, and continuing.

No generic tech whoosh pack. Motion and sound cues should be designed together.

Primary cut should not depend on voice-over.

## Technical architecture

This branch is a film environment, not a production product branch.

Branch:

`marketing/meet-your-manager-motion`

### Film-only route

Add a dedicated route:

`/launch-film`

This route should never depend on real customer data.

It should use deterministic film fixtures and real Desk design-system / product components where practical.

### Query contract

Planned controls:

- `format=vertical|feed|landscape`
- `shot=<shot-id>`
- `capture=true|false`
- `guides=true|false`

Examples:

`/launch-film?format=vertical&shot=today`

`/launch-film?format=feed&shot=exact-human-work`

`/launch-film?format=landscape&shot=meet-your-manager&capture=true`

### Film data

Create dedicated fixtures for one coherent artist and one coherent record so every shot belongs to the same story.

Working artist / song scenario:

- artist: Otmos
- song: Odaeshi
- objective: release Odaeshi next month
- human constraint: friends + car only available Sunday
- content concept: "What couldn't finish us?"

The exact names can be replaced before final export if necessary, but a single narrative must remain consistent throughout the film.

### Scene source of truth

The film should have one scene specification that defines:

- shot id
- narrative purpose
- duration
- product state
- camera scale
- text
- human interaction if any
- vertical composition
- feed composition
- landscape composition
- sound cue

The three aspect-ratio versions should consume the same semantic shot list while providing separate composition data.

## Branch file structure

Planned structure:

```text
src/marketing/launch-film/
  FilmStudio.tsx
  filmSpec.ts
  filmFixtures.ts
  filmCamera.ts
  film.css
  scenes/
    OpeningScene.tsx
    GoalScene.tsx
    UnderstandingScene.tsx
    TodayScene.tsx
    WorkScene.tsx
    HumanTaskScene.tsx
    AdaptScene.tsx
    WatchScene.tsx
    ApprovalScene.tsx
    EndScene.tsx
```

Reuse real Desk components instead of copying them where possible.

## Implementation gates

### Gate 1: film studio foundation

- dedicated `/launch-film` route
- format switching
- shot switching
- capture mode
- guide overlay
- exact Desk theme / brand tokens

### Gate 2: deterministic story fixtures

- one artist
- one song
- one release objective
- Today state
- Manager work artifacts
- exact Task
- changed-reality state
- watch state
- approval state

### Gate 3: real UI composition

- replace temporary storyboard cards with real Desk components / film-safe extractions
- verify every important mobile label is readable
- remove unnecessary app chrome from feature/detail shots

### Gate 4: motion system

- camera transforms
- UI-object lift / stack transitions
- type transitions
- product-to-brand transitions
- timing and easing

### Gate 5: responsive direction

Direct and review every shot independently in:

- 9:16
- 4:5
- 16:9

No automatic cropping as the final output.

### Gate 6: sound and final capture

- score
- product interaction sounds
- transition sounds
- final render / capture
- social compression test
- phone readability test

## Quality bar

A shot fails if any of these are true:

1. It exists only because the animation looks cool.
2. Important UI is unreadable on a normal phone.
3. It feels like a tutorial or Loom recording.
4. The transition is unrelated to the meaning of the scene.
5. The viewer cannot see Desk doing useful work within the first 15 seconds.
6. The landscape version was simply cropped to create the mobile version.
7. It invents product behavior Desk does not actually have.
8. It depends on traction statistics to make the product feel important.

## Separate launch assets, outside this film

Beta proof and traction can become separate launch content later, for example:

- static beta-results graphic
- founder post
- carousel
- investor / partner update
- paid acquisition proof creative

Those assets should support the launch campaign without interrupting the core **Meet your manager** film.