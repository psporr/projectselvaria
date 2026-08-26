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
currently 100% placeholder shapes, zero art assets). If you're generating
a new chapter's map image, see [`MAP_BRIEF.md`](./MAP_BRIEF.md) for the
prompt and technical spec to hand an image generator.

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
  Terrain art now has two supported paths going forward, not one
  replacing the other — a hand-authored tileset (`ART_BRIEF.md` §2) or a
  painted map image classified into terrain data (proven this session,
  `TEST_MAP_1` in `src/game/maps.ts`) — a chapter picks whichever fits it.

### Recent changes

- 2026-08-26 Claude: Replaced the canvas-baked grayscale texture (the
  previous entry below) with Phaser 4's actual built-in mechanism —
  turns out this Phaser build does have grayscale, just renamed from
  Phaser 3's per-object FX to "Filters" (`Image.enableFilters()` +
  `filters.internal.addColorMatrix()`, wrapping
  `Display.ColorMatrix.grayscale()`), which I'd missed searching under
  the old names. `UnitSprite`/`UnitStatusBar` now add one `ColorMatrix`
  filter per hero portrait at construction and just flip its `.active`
  flag for `hasActed` — a live GPU effect, not a second texture, so
  `heroArt.ts` no longer bakes or exports anything grayscale-related
  (`ensureGrayscaleHeroTexture`/`heroGrayTextureKey` are gone). Also
  answered: no, CSS can't do this — the whole game draws into one shared
  `<canvas>`, and CSS filters apply to a DOM element as a whole, not a
  region within one. Verified with Playwright: on-board sprite and
  status-panel portrait both render true grayscale for an acted unit,
  and a combat sequence (attack, counter, hit-flash) still renders
  correctly with the filter active throughout.
- 2026-08-26 Claude: Two fixes.
  (1) The terrain-bonus "+2"-style suffix next to Def in `UnitStatusBar`
  could get stuck showing a stale bonus — it was left out of
  `setContentVisible`'s force-hide (so `showTerrain()`/`hide()` never
  cleared it), and picking a move destination never refreshed the panel
  at all (so it kept showing whichever tile the unit was standing on when
  first selected, not the destination — the more common way to hit this,
  since moving off a forest tile without the panel ever updating made a
  stale "+2" outlive the tile it came from). Fixed all three: `defBonusText`
  now force-hides with everything else, picking a destination re-shows the
  unit against that tile's terrain, and `finishSelection` (Cancel, or an
  action resolving) re-shows the unit against its real post-selection
  terrain instead of leaving the panel on whatever it last had.
  (2) Acted units now render **grayscale** instead of faded/transparent —
  `heroArt.ts`'s new `ensureGrayscaleHeroTexture` bakes a one-time
  luminance-converted copy of each hero PNG (canvas pixel pass; alpha
  channel untouched, so transparency/silhouette survives) since this
  Phaser build has no built-in grayscale FX pipeline, and both
  `UnitSprite` (on-board) and `UnitStatusBar` (portrait) swap to it at
  full opacity for `hasActed` instead of dropping alpha — reads as
  "spent," not "hard to see." The placeholder circle (no art yet) already
  desaturated via a color blend; it just lost its extra alpha fade too, so
  it's consistent with the art path. Verified with Playwright: `+2`
  correctly appears/disappears across select → move → cancel, and an
  acted unit's on-board sprite and status-panel portrait both show true
  grayscale, not transparency.
- 2026-08-25 Claude: Tile cursor now blinks and clears itself after 2
  seconds (`CURSOR_LIFETIME_MS`, `CURSOR_BLINK_HALF_MS`) instead of
  lingering indefinitely on the last-tapped tile — a yoyo alpha tween
  plus a `time.delayedCall` in `showTileCursor`, both tracked
  (`tileCursorBlinkTween`/`tileCursorHideTimer`) and torn down in
  `hideTileCursor` so a fresh tap never leaves a stale timer running
  against the wrong tile. Also now clears immediately once an action
  actually resolves — attack confirm, skill confirm, and Wait — rather
  than waiting out the blink, since "which tile did I select" stops
  mattering the moment that's decided. Verified with Playwright: alpha
  visibly cycles over the first ~600ms, the cursor is gone by 2.2s if
  untouched, and it disappears right away when an attack is confirmed.
- 2026-08-25 Claude: Generalized the tile cursor to follow every board tap
  (any mode — idle, unit-selected, targeting) instead of only appearing
  for a "committed" move-destination/attack-target pick — `onTileClicked`
  now calls `showTileCursor` once, unconditionally, near the top, and the
  scattered `hideTileCursor` calls tied to specific state transitions
  (`selectUnit`, `beginAttackTargeting`/`beginSkillTargeting`,
  `finishSelection`) are gone: the cursor just tracks the last-tapped
  tile and stays there (e.g. still visible on a quick-attack's target
  after Cancel, rather than vanishing). Tapping an enemy already showed
  its status in `UnitStatusBar` — now confirmed working with the cursor
  too, in both idle and unit-selected modes. New: tapping an **empty**
  tile now shows that tile's terrain name and bonus (`UnitStatusBar`'s
  new `showTerrain`, reusing its pre-first-tap hint slot) instead of
  opening the System Menu — that menu is now dock-button-only
  (`openSystemMenu`'s doc comment). Verified with Playwright: cursor +
  terrain info on an empty tap, cursor + status on an enemy tap, the
  Menu dock button still opens the system menu, and the cursor
  correctly persists on the quick-attack target tile after Cancel.
- 2026-08-25 Claude: Added a corner-bracket tile cursor (`TacticalScene`'s
  `showTileCursor`/`hideTileCursor`) — a classic tactics-RPG reticle
  marking exactly which single tile the player just selected, on top of
  (not instead of) the existing flat-color range/target overlays. Shows
  on a move destination once picked (stays through the action menu) and
  on an attack or skill target once picked, whether via the manual
  destination→menu→target flow or the quick-attack shortcut (stays
  through the forecast confirm); clears on cancel, on a fresh
  selection, or once target-picking starts (replacing a destination
  cursor). Verified with Playwright across the move-destination,
  quick-attack-target, and cancel-clears-it cases.
- 2026-08-25 Claude: Trimmed the player starting lineup from 12 heroes back
  down to just the 6 with real map art — Eirika, Lyn, Takumi, Natasha,
  Jill, Ephraim — across every chapter, dropping Byleth/Corrin/Selva/
  Ike/Lissa/Olivia (all still placeholder circle+letter, no art yet) from
  the starting units array for now. Their `UnitSpec` entries are simple to
  re-add once they have art too (see `maps.ts`'s updated roster doc
  comment). `EquipScreen`'s Squad card reverted from 680 back to its
  original 520 (6 rows fits comfortably; the 680 bump was specifically for
  the brief 12-hero roster). `npm run sim` still shows a 0% wipe rate over
  20 seeds at 6 units, same as at 12 — not obviously a difficulty signal
  either way, so leaving real balance judgment to actual play.
- 2026-08-25 Claude: First real hero art shipped — 6 hand-drawn 128×128
  map sprites (Eirika, Ephraim, Jill, Lyn, Natasha, Takumi; see
  `ART_BRIEF.md`'s 2026-08-25 status update for the full story, including
  how the delivered convention diverges from the original spec: per-named-
  character unique-palette art instead of per-class neutral-tinted art).
  New `src/ui/heroArt.ts` maps a unit's display name to its texture; both
  `UnitSprite` (on-board token, scaled down) and `UnitStatusBar` (portrait
  slot, larger) render the same file at two sizes when a match exists,
  falling back to the original colored-circle/box placeholder otherwise —
  every enemy, and any hero not yet drawn. Also **grew the player roster
  from 7 to 12** across every chapter (Lyn, Takumi, Natasha, Jill, and
  Ephraim added; Ike's class changed from Barbarian to Swordsman so Jill
  could take Barbarian) — classes can now have more than one hero.
  `EquipScreen`'s Squad list card grew taller to fit all 12 rows without
  overflowing. Known tradeoff, not yet addressed: existing chapters'
  enemy counts weren't increased to match, so every fight is noticeably
  easier than before this change (confirmed via `npm run sim`, 0% wipe
  rate over 20 seeds) — a rebalance pass is a follow-up, not done here.
  Verified with Playwright: real art renders correctly on-board and in
  the status panel, placeholder fallback still works for undrawn heroes,
  and the Squad screen's 12 rows all fit on-card.
- 2026-08-25 Claude: Fixed `UnitStatusBar` not refreshing when re-selecting
  a different ally (or tapping an enemy) while already in `unit-selected`
  mode — `onTileClicked`'s `'idle'` branch already called
  `unitStatusBar.show()` on every unit tap, but the `'unit-selected'`
  branch only called `selectUnit()` on a reselect, leaving the panel
  showing whichever unit was tapped first. It now calls `show()` there
  too, matching the idle branch's "any tap refreshes the panel" rule.
- 2026-08-25 Claude: Fixed a quick-attack bug — canceling from the forecast
  left the unit stranded at the auto-picked attack tile instead of
  returning to its original position with the move/quick-attack highlights
  showing again. `enterAttackConfirm` now takes an explicit `onCancel`
  rather than always reusing `resumeTargeting` (which assumes a
  deliberately-chosen destination, true for the manual Attack-from-menu
  flow but not for quick attack's auto-picked one): quick attack's cancel
  now goes through a new `cancelQuickAttack`, which snaps the sprite back
  and re-enters `unit-selected` so `selectUnit` recomputes both highlight
  sets. The manual flow's cancel behavior (stay at the chosen tile,
  re-show valid targets) is unchanged. Verified with Playwright for both
  the quick-attack cancel (unit returns, highlights reappear) and the
  manual-flow cancel (unit stays put, no regression).
- 2026-08-25 Claude: Quick attack — while choosing a destination
  (`unit-selected` mode), any enemy strikeable from some reachable tile now
  lights up on its own tile (red, same color the manual awaiting-target
  highlight already uses) and can be tapped directly: `quickAttackPositions`
  (`grid.ts`) picks the cheapest-to-reach in-range tile per enemy, and
  `TacticalScene.onTileClicked` jumps straight from that tap to the attack
  forecast/confirm panel, skipping the destination-then-menu-then-target
  sequence the manual flow still uses (Cancel from the forecast still falls
  back to manual target-picking from the chosen tile, via the existing
  `resumeTargeting`). Matches the direct-tap-to-attack flow recent Fire
  Emblem games use. Manual move-then-Attack-from-menu is unchanged — this
  is an added shortcut, not a replacement. Verified with Playwright: the
  quick-attack highlight appears once an enemy is in range, tapping it
  opens the correct forecast, and Confirm moves + attacks + applies the
  counter in one step.
- 2026-08-25 Claude: Two `UnitStatusBar`/`UnitSprite` legibility fixes —
  the Def stat now shows the current terrain's bonus inline as green
  `+2`-style text (measured off the Def text's own rendered width, so it
  sits flush after both single- and double-digit values) instead of only
  being stated in the terrain row below; and both HP bars (the status
  panel's and the on-board one over each unit in `UnitSprite`) gained a
  dark stroke around their background rectangle, since the on-board bar
  in particular could get lost against image-backed maps whose grass art
  runs close to the fill's own green. Verified with Playwright: a unit
  moved onto a forest tile shows both the green `+2` and a clearly
  bordered HP bar over the map's grass background.
- 2026-08-24 Claude: `UnitStatusBar` now shows the terrain a unit is
  standing on and what it's actually granting (e.g. "Forest — +2 Def, -30
  enemy Hit", or "Plain — no bonus") — a real gap before this, since
  terrain's defBonus/avoid apply at combat-resolution time
  (`computeDamage`/`computeHitChance`) and never showed up in the unit's
  own listed stats, so there was no way to confirm "am I actually getting
  the forest bonus right now." `UnitStatusBar.show()` now takes the
  `Terrain` under the unit alongside the `Unit` itself (read off G by the
  two callers, `TacticalScene`/`UIScene` — the component itself still
  never reads G directly). Verified with Playwright on both plain and
  forest tiles.
- 2026-08-24 Claude: Rebuilt `UnitStatusBar` as a graphical panel — a
  portrait-slot box + big class letter (stand-in until real portrait art
  exists, see `ART_BRIEF.md` §3), a colored name banner, a big HP bar with
  the number overlaid, and a boxed Atk/Def/Hit/Crit/Mov/Rng stat grid,
  loosely modeled on Fire Emblem Heroes' unit-detail screen but condensed
  to fit this panel's fixed HUD footprint. Shapes/color only, no new art —
  the portrait box and skill-icon slot are sized so real art drops in
  later as a texture swap, not a layout change. Equipment dropped from
  this always-visible view (Squad still has the full gear list) to make
  room. Acted-unit dimming now applies to the portrait/banner too,
  matching the on-board sprite convention. Verified with Playwright.
- 2026-08-23 Claude: Moved the battle log off the always-visible board
  screen into an on-demand panel (`LogPanel`, new — Menu → Battle Log),
  freeing the space it used to occupy for a bigger `UnitStatusBar`.
  `UnitStatusBar` dropped its old compact-strip-plus-tap-to-expand-overlay
  split (there wasn't room to show everything at once before; there is
  now) — it's one always-visible panel showing name/class/level, HP,
  full stats (Atk/Def/Mov/Rng, Hit/Crit), skill status, and equipment
  (player units) with no tap needed. Hit one real bug building this: the
  first content pass overflowed the card and ran text under the dock
  buttons — fixed by dropping a blank spacer line and the "Equipment:"
  header and tightening line spacing, caught by Playwright before
  shipping. `SystemMenu` gained a "Battle Log" option alongside End
  Turn/Restart/Cancel. Verified with `validate-maps`, a 50-run batch
  sim, and a Playwright pass (both player and enemy status content fit
  cleanly, log panel opens/shows real entries/closes correctly).
- 2026-08-23 Claude: First map generated straight from `MAP_BRIEF.md`'s
  prompt (Gemini, 7x8, `public/maps/test-map2.png`) — a clean result, every
  wall/forest cell lined up with visible rock/tree art on the first
  classification pass, no ambiguous cells needed manual resolution this
  time (unlike `TEST_MAP_1`'s two passes). Added as `TEST_MAP_2` in
  `src/game/maps.ts`, `ProjectSelvaria` temporarily pointed at it (was
  `TEST_MAP_1`) to playtest — swap back to `CHAPTER_1` once done.
  Verified with 100 seeded batch runs and a Playwright pass (mountains
  correctly block movement, action menu, full board renders at 64px
  tiles).
- 2026-08-23 Claude: Decided both map-authoring paths stay — a
  hand-authored tileset (`ART_BRIEF.md` §2, art not commissioned yet) and
  a painted map image classified into terrain data (this session's
  `TEST_MAP_1` pipeline). Neither replaces the other; a chapter picks
  whichever fits it. No code change — `TacticalScene` already renders
  either off the same `ChapterDef`/`rows` grid (`CHAPTERS_WITH_BACKGROUND_ART`
  picks tile sprites vs. one background image per chapter). Updated
  `ART_BRIEF.md` §2 and this file's "In progress" entry to record it.
- 2026-08-23 Claude: Pixelify Sans (previous entry) didn't read well in
  play — swapped to Geist Pixel instead, same mechanism (one `FONT_FAMILY`
  constant in `kit.ts`, Google Fonts `<link>` in `index.html`). Note for
  next time: Geist Pixel has no variable weight axis (single static 400
  weight), unlike most Google Fonts — the `<link>` requests it plain, no
  `:wght@...` range, since that 400-only request against a range returns a
  400 "Missing font family" error instead of silently ignoring the range.
- 2026-08-23 Claude: Swapped the game's font from the browser's plain
  `monospace` to Pixelify Sans (Google Fonts), loaded via a `<link>` in
  `index.html`. Centralized the 25 scattered `fontFamily: 'monospace'`
  literals across every `src/ui/`/`src/scenes/` file into one
  `FONT_FAMILY` constant in `src/ui/kit.ts` — `'"Pixelify Sans",
  monospace'`, so monospace is still the fallback if the web font fails
  to load. `main.ts` explicitly waits on `document.fonts.load()` before
  booting the Phaser game, since the `<link>` alone only declares the
  @font-face — the browser doesn't fetch the file until something
  renders with it, and Phaser's canvas-drawn text doesn't wait around for
  that on its own. Verified the resource itself (valid @font-face CSS,
  200) and that the fallback renders cleanly with no breakage if the font
  never loads; couldn't get a clean *rendered* screenshot of the actual
  pixel font in this session's sandbox (a Playwright-proxy routing quirk,
  not a game issue) — worth an eyeball check on a normal connection.
- 2026-08-23 Claude: Fixed the mountain outcrops on the painted test map —
  after the 6x8 resample they'd been (wrongly) walkable, so units could
  stand right on top of visible rock art. Root cause was the per-cell
  color-averaging approach: a small rock patch that's a minority of a
  90x90px cell got averaged into "plain." Switched to per-pixel k-means
  classification (no averaging to dilute small features) at the original
  9x12 resolution, then downsampled that to the playable 6x8 grid with
  wall votes given priority so a mountain still blocks its whole coarse
  tile. Also kept the 9x12 reading around as a second, unwired chapter
  (`TEST_MAP_1_DETAILED`) per request, rather than discarding it —
  TacticalScene's background-art lookup is now id → image-basename so two
  chapters can share one source image. Mountains are plain `wall`
  (blocks everyone) rather than a new flying-only terrain type — no
  flying unit class exists yet, so that's equivalent for now; revisit
  when one does.
  Along the way, batch-simulating the new terrain surfaced a real AI bug
  unrelated to the map art: `ai.ts`'s "move toward the enemy" heuristic
  ranked candidate tiles by straight-line Manhattan distance, which gets
  a unit stuck forever refusing to step sideways around a wide obstacle
  (every tile it can actually reach looks farther away in a straight
  line, even though going around is the only way to close the gap).
  Replaced it with real BFS path-distance (`grid.ts`'s new
  `pathDistances`). Verified with 100 seeded batch runs (previously 1 in
  20 stalled indefinitely on this map, now zero in 100) and a Playwright
  pass confirming mountains actually block the move-highlight.
- 2026-08-23 Claude: Tested on a real phone, the previous entry's map was
  too small to tap comfortably (~42px tiles, from sampling the source
  image at 9x12). Re-ran the classification at a coarser 6x8 grid instead
  (matches the image's aspect ratio, lands tile size at a full 64px —
  same as CHAPTER_1) rather than adding camera scrolling, trading away a
  handful of small rock-outcrop details that get averaged into their
  neighboring plain cell at that coarser sampling. Map now has no wall
  tiles at all — the water band + its bridge crossing is the whole
  chokepoint, which reads fine for a "Riverlands" map. Verified on a
  matching viewport with Playwright.
- 2026-08-23 Claude: Proved out a "read terrain off a painted map image"
  concept end-to-end. Took a user-generated map image, classified its 9x12
  grid into plain/forest/wall/water tiles via k-means color clustering +
  an HSV-saturation split (forest vs. mountain), and turned that into a
  real playable chapter (`TEST_MAP_1` in `src/game/maps.ts`, spawns picked
  by hand off the classified grid). To render it, `TacticalScene` now
  draws that image as the board background instead of flat terrain-color
  tiles (see `CHAPTERS_WITH_BACKGROUND_ART`) and computes tile size
  per-chapter rather than a fixed 64px, since this map is wider/taller
  than any existing one (`BOARD_AREA_WIDTH`/`BOARD_AREA_HEIGHT`); existing
  chapters render identically since the math reduces to the old constant
  for their dimensions. **`ProjectSelvaria` is temporarily pointed at
  `TEST_MAP_1` instead of `CHAPTER_1`** so the map is actually reachable
  in the UI (no chapter-select exists yet) — swap it back once you're done
  poking at it. Verified with Playwright (tile clicks, unit selection,
  move + action menu, all render correctly over the background image).
  If this concept sticks, next steps are: a real chapter-select so test
  maps don't have to steal the roguelike slot, and deciding whether
  painted-background maps or a tileset (`ART_BRIEF.md` §2) is the actual
  art direction going forward — probably worth a discussion before
  investing in more maps either way.
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
