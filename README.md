# Project Selvaria

A 2D tactical RPG in the Fire Emblem lineage — grid battlefield, squad of
named units, turn-based combat with counterattacks. Built on **Phaser 4** +
TypeScript + Vite + boardgame.io.

Successor to [`psporr/winteremblem`](https://github.com/psporr/winteremblem),
a working prototype on React + CSS-grid that proved the game design and is
being rebuilt on Phaser for real rendering, tweens, particles, and tilemaps.

## Start here

**Read [`HANDOFF.md`](./HANDOFF.md) first.** It carries the full design (rules,
classes, combat, campaign content), the architecture decisions already made,
and the lessons learned building the prototype — including what to deliberately
*not* port. It's the source of truth for what this project is building.

If you're sourcing or drawing art, see [`ART_BRIEF.md`](./ART_BRIEF.md) —
the spec for the unit sprites/tileset/portraits the game still needs (it's
currently 100% placeholder shapes, zero art assets).

## Workflow

**Push directly to `main`.** Per the repo owner (2026-08-22): no feature
branches — every AI session working here commits and pushes straight to
`main`, which auto-deploys to GitHub Pages on every push (see Project Status
below). This replaces any earlier per-session branch instructions.

**Versioning: `0.x.y`.** Pre-1.0, so `x`/`y` carry the meaning major/minor
normally would — bump `x` for a new feature or gameplay change, `y` for a
fix. Update both `package.json`'s `"version"` and `src/version.ts`'s
`GAME_VERSION` together (the HUD watermark reads the latter; they're kept in
sync manually since Vite can't read `package.json` into a static string at
runtime without extra build config).

**Verification cadence** (per the repo owner, 2026-08-22): Playwright
screenshot verification costs real tokens (mostly the images themselves) —
worth it for changes touching the input state machine, timing, or
cross-component wiring, where a subtle bug is expensive to discover later
(it's caught real ones: a board-row-count assumption that broke tap
targets, a phase-banner/AI timing race). For small, contained visual
tweaks, skip it: edit → `typecheck` → `build` → push, and say so explicitly
("small fix, please verify yourself") rather than defaulting to a full
Playwright pass.

## Skills

`.claude/skills/phaser/` contains Phaser Studio's own 28 official Agent
Skills, copied from [`phaserjs/phaser`](https://github.com/phaserjs/phaser)
(MIT licensed) so any Claude Code session working here has deep Phaser 4 API
knowledge available natively. See `CREDITS.md`.

## Project Status

More than one AI works on this repo (Claude and Gemini so far). **Read this
section before starting work, and update it before you stop** — it's the
one place that stays current between sessions/agents that don't otherwise
share context. Git history has the detail; this is the fast-to-read summary.

Update rules:
- Move something out of **In progress** and into **Recent changes** (newest
  entry on top, keep ~10) when you finish it.
- Add a line to **In progress**, tagged with your name, before you start
  something nontrivial — so a second agent doesn't pick up the same thing.
  Remove your line if you drop it unfinished.
- Keep **Now** accurate to what's actually true today, not aspirational.
- If you're not sure whether something's done, check the code — this file
  can lag reality, never treat it as more authoritative than the repo.

### Now

Playable with the full action loop, deployed at
https://psporr.github.io/projectselvaria/ (auto-deploys on every push to
`main` via `.github/workflows/deploy-pages.yml`).

- Full pure game core ported from `winteremblem` (`src/game/`) — classes,
  combat, grid, skills, equipment, blessings, waves, maps (3 chapters),
  story triggers, AI, the boardgame.io `Game` definition. All exercised by
  the headless simulator (`npm run sim -- --batch N`) and map validator
  (`npm run validate-maps`).
- Hit/crit implemented (HANDOFF.md §3, Option A) — flat per-class rates,
  terrain avoid, probabilistic combat throughout. Class hit/crit numbers are
  a first-pass design, not final balance.
- `TacticalScene` + `UIScene` (HUD/panels split out per HANDOFF.md §7) render
  the board and units from `G`/`ctx`. Full click flow: select a unit → move
  → **action menu** (Attack / class skill / Wait / Cancel, each gated on
  real legality) → target → **forecast panel** (hit%/crit%/damage preview)
  → confirm. Wave clears open a real **blessing picker** (3 cards, rarity-
  colored). A "Player Phase"/"Enemy Phase" **banner** (`src/ui/PhaseBanner.ts`)
  plays on every real turn transition; the CPU's opening move waits for it
  to finish rather than guessing a matching delay. A spent unit's sprite
  visibly dims/desaturates.
- **Mobile-style UI pass** (`src/ui/kit.ts` — shared rounded `Button`/`Card`
  widgets, since Phaser's plain `Rectangle` has no rounded-corner support):
  a persistent **bottom dock** (Squad / Danger Zone / End Turn / Menu,
  thumb-reachable) replaced the old top-right buttons and separate End-Turn/
  Danger-Zone pair; the action menu is now a small pill cluster **anchored
  next to the acting unit** (edge-clamped) instead of a centered modal; a
  **compact unit status bar** below the board shows whichever unit (either
  team) was last tapped, with a tap-to-expand full detail card (stats, hit/
  crit, skill+cooldown, equipment). The **System Menu** is now just Restart
  + Cancel (everything else moved to the dock). Every other panel
  (ForecastPanel/BlessingPicker/EquipScreen) reskinned onto the same kit.
- Portrait/mobile scaling fixed: `Scale.FIT` + `CENTER_BOTH` on a 480x854
  base, verified at real phone/tablet/desktop viewports.
- Rendering is DPR-aware (`src/systems/viewport.ts`) — the canvas backing
  store is sized off the *actual measured display box* × device pixel ratio
  (capped at 3x combined), not device pixel ratio alone, so there's no
  residual browser stretch left to blur in either direction (a fixed-size
  buffer on a big desktop window, or an under-sized one on a real phone).
  Every scene's own layout math is untouched (still authored against the
  480x854 logical space); `applyDprZoom()` handles the compensating camera
  zoom + centering. If you add a new `Scene`, call `applyDprZoom(this)` in
  `create()`; if you add a new `Text` object anywhere, give it
  `resolution: DPR`.

### Not built yet

- `CombatOverlayScene` (HANDOFF.md §7 phase 2 — GBA-style combat presentation)
- Campaign chapters in the UI (maps/story exist in `src/game/`, no chapter
  select or dialogue rendering)
- Multiplayer, mobile app wrap (both explicitly deferred, HANDOFF.md §9/§10)

### In progress

*(Add a line here when you start something. Format: `- [Name] what, since when`.)*

- [Claude] Graphical art pass — blocked on custom art being commissioned
  (unit sprites first, terrain tileset held to ship together with them,
  portraits after that). See `ART_BRIEF.md` for the spec handed to the
  artist. Nothing to build code-side until art lands; the loading/
  rendering integration is a contained follow-up once files exist.

### Recent changes

- 2026-08-22 Claude: Discussed moving from text/shape-only UI to real
  graphical art. Decided: unit sprites and portraits will be custom-
  commissioned (not generic asset packs — the game is a distinct enough
  cast, e.g. Eirika/Byleth/Corrin/etc, to be worth it, and the old
  `winteremblem` prototype already had a precedent for original art
  "drawn by a friend"), sequenced unit sprites → terrain tileset (held
  back to ship together with sprites, not separately) → portraits. Wrote
  `ART_BRIEF.md` as a concrete, scoped spec (7 class map sprites, 48×48px,
  neutral palette for runtime team-tinting, v1 explicitly excludes
  animation) so an artist can start without back-and-forth. No code
  changes — this is blocked on external art; see "In progress" above.
- 2026-08-22 Claude: Attack/Skill no longer appear in the action menu at
  all when there's no target in range from the picked destination —
  previously they showed grayed-out. A skill with a target still on
  cooldown stays visible-but-disabled (useful info: "could hit something,
  just not yet"); only "no target" hides the option entirely. Small fix,
  typecheck/build/sim green, not independently re-verified with Playwright
  — please check it looks right.
- 2026-08-22 Claude: Fixed `ActionMenu`'s card covering half the acting
  unit's tile — the margin math predated the card's own padding around the
  buttons, so the card's near edge landed ~2px from the tile center instead
  of clearing it. Now computed from the card's actual half-width so its
  near edge always sits a fixed gap outside the unit's tile. Small fix, not
  independently re-verified with Playwright this time (see Workflow) —
  please check it looks right.
- 2026-08-22 Claude: `ActionMenu` (the unit-anchored Attack/Skill/Wait/
  Cancel popup) now has its own `Card` background behind the button stack
  for legibility, and its full-screen backdrop is fully transparent instead
  of dimming the board — an invisible tap-away-to-cancel zone only, since
  the whole point of anchoring it beside the unit was to keep the board
  visible while choosing. Verified via Playwright: card renders correctly
  behind the buttons, board stays undimmed, tap-away-to-cancel still works.
  Bumped to `0.3.2` (fix).
- 2026-08-22 Claude: Fixed enemy units showing dimmed throughout the
  player's entire turn. `hasActed` only resets at the start of *that unit's
  own* team's turn (game.ts's `turn.onBegin`) — an enemy keeps
  `hasActed: true` from the end of its last turn all the way through the
  player's whole next phase, so dimming off that flag alone made every
  enemy look "already acted" the entire time it was actually the player's
  turn. `UnitSprite.sync()` now takes an explicit `dimmed` boolean instead
  of reading `unit.hasActed` itself; `TacticalScene.syncUnits()` computes
  it as `unit.hasActed && unit.team === activeTeam`. Verified via
  Playwright: enemies that acted last turn show full color once it's the
  player's turn again. Bumped to `0.3.1` (fix).
- 2026-08-22 Claude: UI improvement pass — unit status UI + mobile-style
  controls, discussed and planned with the user before building (locked
  decisions: compact status bar + tap-for-detail; bottom dock + contextual
  action popup; acted-unit dimming; one combined pass). Shipped in four
  verified steps: (1) shared `src/ui/kit.ts` (`Button`/`Card`, rounded via
  `Graphics.fillRoundedRect` since `GameObjects.Rectangle` can't) + acted-
  unit color desaturation; (2) `src/ui/UnitStatusBar.ts` — compact strip
  (either team, read-only for enemies) + tap-to-expand detail overlay; (3)
  `UIScene`'s bottom dock + `ActionMenu` rewritten as a unit-anchored,
  edge-clamped popup, `SystemMenu` trimmed to Restart+Cancel; (4) the
  remaining panels (ForecastPanel/BlessingPicker/EquipScreen) reskinned
  onto the same kit. Caught and fixed two real bugs along the way: a wrong
  board-height assumption (7 rows, not the actual 8) put the status bar's
  hit zone over the board's real last row, silently eating taps; the
  detail overlay's fixed card height overflowed its own content and now
  resizes to the real rendered text height. Verified via Playwright at
  every step (dock buttons, anchored menu on both screen edges, live status
  updates, restart resetting all the new component state correctly, zero
  console errors); ForecastPanel's live combat rendering specifically
  wasn't screenshotted (the browser client isn't seeded like the CLI sim,
  making a specific attack scenario non-reproducible across runs) but
  shares the identical, already-verified kit widgets. Typecheck, build,
  sim, and map validation green throughout. Bumped to `0.3.0` (feature).
- 2026-08-22 Claude: Held enemy AI actions off until the "Enemy Phase"
  banner is fully gone, per request. First attempt used a second
  `delayedCall` in `TacticalScene` guessing the banner's total animation
  duration (`PHASE_BANNER_TOTAL_MS`) — verified via Playwright screenshots
  that this actually fired the CPU's first move while the banner was still
  fully visible on screen. Root cause: Phaser's `Time`/`Tweens` clocks
  didn't advance 1:1 with wall time in this sandbox's software-rendered
  headless Chromium, so two independently-run timers assuming the same
  nominal duration drifted apart. Replaced with an event-driven handshake:
  `PhaseBanner.show()` now takes an `onComplete` callback, fired only once
  the slide-out tween genuinely finishes; `TacticalScene.scheduleAutoAdvance()`
  holds off entirely on a fresh enemy phase and waits for UIScene to call
  its new `onEnemyPhaseBannerDone()` instead of guessing a delay. Re-verified
  via Playwright (both a fresh battle and after `restartBattle()`): enemies
  provably stationary while the banner is up, first move starts right after
  it's gone. Bumped to `0.2.1` (fix, since it corrects `0.2.0`'s shipped
  banner behavior rather than adding new gameplay surface).
- 2026-08-22 Claude: Added the classic Fire Emblem "Player Phase"/"Enemy
  Phase" banner (`src/ui/PhaseBanner.ts`) — slides across the board on
  every real turn transition, colored per team. `UIScene` triggers it off a
  `ctx.turn` diff in `refreshHud()` (the same signal `simulate.ts` already
  used for its own turn-change logging), so it fires once per actual phase
  change and never re-fires on unrelated state updates within a turn (unit
  moves, attacks). Verified via Playwright: fires on battle start, on each
  End Turn, and correctly resets across `restartBattle()` (which reuses the
  same `UIScene` instance — `lastTurnSeen` is reset in `create()`, the same
  discipline the restart-freeze fix established for `TacticalScene`). Bumped
  to `0.2.0` (feature bump) per the versioning convention below.
- 2026-08-22 Claude: Switched versioning to `0.x.y` (x = feature/gameplay
  change, y = fix) per the repo owner; set current version to `0.1.2` in
  both `package.json` and `src/version.ts`, and documented the scheme in
  the README's Workflow section.
- 2026-08-22 Claude: Fixed two bugs. (1) Restart Battle froze the game —
  `TacticalScene.create()` never reset its own instance fields
  (`unitSprites`, `lastUnits`, etc.), so `scene.restart()` (which reuses the
  same Scene instance, not a fresh one) left `syncUnits()` finding stale
  sprite references Phaser had already destroyed, throwing inside Phaser's
  own scene-boot step and hanging the game — reproduced via Playwright with
  the exact stack trace, now resets all mutable fields at the top of
  `create()`. (2) The Danger Zone button never visually updated on press —
  `toggleThreatOverlay()` flips scene-local UI state, not G/ctx, so
  `UIScene`'s `client.subscribe()`-driven `refreshHud()` never fired from
  it (the board overlay itself was fine, only the button was stale); it now
  calls `ui.refreshHud()` directly. Both verified fixed via Playwright
  before/after screenshots, with sim/map-validate still green.
- 2026-08-22 Claude: Pushed straight to `main` per the repo owner's new
  workflow instruction (no more feature branches — see Workflow above) and
  noted it in the README.
- 2026-08-22 Claude: Fixed blur on both mobile and desktop web — the canvas
  backing-store resolution (`src/systems/viewport.ts`) was sized off
  `devicePixelRatio` alone, ignoring the separate stretch `Scale.FIT` applies
  to fit the actual container box. `DPR` now folds in the measured display
  scale too, so the buffer always matches what FIT displays it at, at the
  screen's real density — verified the backing-store/CSS pixel ratio now
  matches real device pixel ratio exactly across a phone viewport and two
  desktop viewports (1x and 2x). Also restores the 3x quality ceiling the
  Aug 22 perf-cap commit had narrowed to 2x, now applied to the combined
  multiplier instead of DPR alone so the GPU-cost tradeoff still holds.
- 2026-08-22 Gemini: Added game version system (`src/version.ts`) initialized at `0.01` with bottom-right HUD watermark in `UIScene` and title subtitle in `BootScene`
- 2026-08-22 Gemini: Optimized mobile browser performance — capped DPR to 2x (cutting GPU fill-rate by >55%), capped FPS at 60 (preventing 120Hz thermal throttling), enabled high-performance WebGL render flags, and guarded redundant UI text re-rasterization
- 2026-08-22 Gemini: Restored tactical menus & HUD controls — End Turn button, Danger Zone (enemy threat range) overlay toggle, Map/System Menu, and Victory/Defeat restart dialog
- 2026-08-21 Claude: Unit sprite now previews the move to its destination before the action menu opens (reverts on Cancel)
- 2026-08-20 Claude: Auto-scale rendering to device pixel ratio (`src/systems/viewport.ts`), fixing game/UI blur on real phones
- 2026-08-20 Gemini: Action menu, forecast panel, blessing picker, and equip screen — `TacticalScene`/`UIScene` split, verified working
- 2026-08-20 Claude: Fixed portrait/mobile layout — `Scale.FIT`, restacked HUD below the board
- 2026-08-20 Claude: GitHub Pages deploy workflow, verified live and asset-hash-matched
- 2026-08-20 Claude: Basic playable `TacticalScene` — grid, unit sprites, move/attack, AI auto-play
- 2026-08-20 Claude: Scaffolded Phaser 4 + Vite + TS, ported pure game core, implemented hit/crit rebuild
