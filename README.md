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
the spec for unit sprites (shipped) and the terrain tileset (open again —
a first pick shipped 2026-09-01 and was removed 2026-09-02; see that
doc's §2 for the current status and what a replacement needs to match).
If you're
generating a new chapter's map image, see [`MAP_BRIEF.md`](./MAP_BRIEF.md)
for the prompt and technical spec to hand an image generator.

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
  combat, grid, skills, equipment, blessings, waves, maps (Roguelike's
  `RIVER_CROSSING` plus 2 campaign chapters, The Iron Gate and The Long
  March), story triggers, AI, the boardgame.io `Game` definition. All
  exercised by the headless simulator (`npm run sim -- --batch N`) and map
  validator (`npm run validate-maps`).
- Hit/crit implemented (HANDOFF.md §3, Option A) — flat per-class rates,
  terrain avoid, probabilistic combat throughout. Class hit/crit numbers are
  a first-pass design, not final balance.
- EXP grants a permanent 2x pace (`classes.ts`'s `EXP_RATE_MULTIPLIER`,
  2026-09-01) — started as a 5x testing multiplier, kept at 2x as the
  intended default once that testing pass was done, not reverted to 1x.
- Campaign chapters carry real dialogue — `DialoguePanel` (bottom-anchored,
  tap-to-advance) plays each chapter's intro before the board opens, its
  outro before the chapter-clear handoff, and mid-battle `MapEvent`
  triggers (a unit falling, a turn count, a tile reached) interrupt play
  for a line or two, all gated through the same `inputSuspended` contract
  everything else in `TacticalScene` uses.
- Combat has two presentations, picked via the main menu's **Battle
  Style** setting (`systems/settings.ts`, on-grid by default): the on-grid
  lunge/damage-number/particle pass, or `CombatOverlayScene`'s full-screen
  GBA-style cut-in (portraits, HP bars draining live, tap-to-skip). Two
  heroes (Luffy, Zoro) have real frame animation instead of a static
  portrait in either presentation — `heroArt.ts`'s `ANIMATED_HERO_NAMES`,
  sourced from `.aseprite` files via `npm run extract-aseprite`
  (`src/scripts/extractAseprite.ts`) rather than commissioned frame-by-
  frame; see that script's doc comment for the extraction method. Neither
  is in the real 6-hero roster yet — proven in the dev-only Hero
  Animation Test stage (main menu's "Hero Anim Test" button).
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

- Terrain tileset — Chapter 1/Chapter 2 render `TacticalScene.ts`'s flat
  `TERRAIN_COLOR` fills again; a first pick shipped 2026-09-01 and was
  removed 2026-09-02, per the repo owner (didn't look good in-game), a
  replacement is pending (`ART_BRIEF.md` §2). `RIVER_CROSSING`'s own
  painted background image is unaffected either way.
- A third campaign chapter — Chapter Select structurally supports more
  than 2, nothing past The Long March is written yet.
- Multiplayer, mobile app wrap (both explicitly deferred, HANDOFF.md §9/§10)

### In progress

*(Add a line here when you start something. Format: `- [Name] what, since when`.)*

*(Nothing currently in flight.)*

### Recent changes

- 2026-09-02 Claude: Removed the terrain tileset, per the repo owner ("I
  don't think tileset look good so lets remove it from project, i will
  find new one") — the McMagister "32px FE-style Tileset" crops shipped
  2026-09-01 (`public/tiles/plain.png`/`forest.png`/`wall.png`/`water.png`)
  are deleted, along with `TacticalScene.ts`'s `TERRAIN_TILE_KEY` map, its
  preload loop, and the `hasTileArt` branch in `drawBoard()` that rendered
  a per-cell tile image. Chapter 1 (The Iron Gate) and Chapter 2 (The Long
  March) are back to `TERRAIN_COLOR`'s flat per-terrain-type fill, exactly
  the pre-2026-09-01 look. `RIVER_CROSSING` and the Hero Animation Test
  stage are unaffected either way — they draw a painted background image
  (`CHAPTERS_WITH_BACKGROUND_ART`), a separate code path the tileset never
  touched. `ART_BRIEF.md` §2 and `CREDITS.md`'s tileset entry updated to
  "removed, replacement pending" rather than deleted outright — same
  attribution-preserved pattern already used for the retired bust-portrait
  category. `TerrainType` dropped from `TacticalScene.ts`'s import list
  (only use left was the now-removed `TERRAIN_TILE_KEY`'s type annotation).
  Verified: typecheck/build clean, no other file referenced the removed
  symbols or the deleted `public/tiles/` assets.

- 2026-09-02 Claude: Enemy Swordsman/Fighter art reassignment, per the repo
  owner. `heroArt.ts`'s `ENEMY_CLASS_SPRITE_BASENAMES` used to give Swordsman
  the `fighter_m128.png` art (a leftover from before Fighter was its own
  `ClassName` — see the 2026-08-26 CREDITS.md note this entry updates).
  Swapped: Swordsman now has no enemy art (circle+letter placeholder), and
  Fighter — a real base class since Part 3's class-tree rework — has
  `fighter_m128.png` instead. Three follow-on questions this raised got
  answered directly by the repo owner rather than guessed at:
  - Three hardcoded enemies that were `className: 'Swordsman'` (Gate Guard
    in Chapter 1, Vale Guard and Vale Scout in Chapter 2) got reclassed to
    `'Fighter'` in `maps.ts` so they keep real art instead of falling back to
    the placeholder — a real (small) stat change too, Fighter's base stats
    differ slightly from Swordsman's.
  - `classes.ts`'s `ALL_CLASSES` (the pool random enemy spawns — bandits,
    wave spawns — draw from) used to be restricted to classes with finished
    enemy art, which is how Swordsman ended up excluded from it despite
    being a base class. That restriction is gone: `ALL_CLASSES` is now every
    *base* class (the original 12 plus Fighter) regardless of art, so
    Mage/Cleric/Dancer/Fighter/Swordsman can all appear as random spawns now
    (some showing the placeholder) alongside the rest. The 9 Part 3
    *advanced* classes (Swordmaster, Sniper, Sorcerer, etc.) and the two
    animated test-stage classes (Luffy/Zoro) stay excluded — unrelated to
    art, the advanced 9 tested noticeably stronger than a wave-1 base class
    (documented in `ALL_CLASSES`'s own comment) and Luffy/Zoro are test-
    stage-only with untuned stats.
  Verified: typecheck/build/validate-maps clean; `npm run sim -- --batch 30`
  still comes back 0% wiped / 100% reaching the wave cap (mean wave 7.13 vs.
  the prior baseline's 7.23 — the larger, art-agnostic random-spawn pool
  doesn't meaningfully change difficulty at this batch size).

- 2026-09-02 Claude: Two follow-up fixes from the repo owner testing the
  previous entry's changes.
  `UnitStatusBar`'s portrait box grew back from 50×50 to **96×96** — the
  50×50 size (previous entry) turned out too small in practice; the fit/
  margin math in `show()` is formula-based off `PORTRAIT_W`/`PORTRAIT_H`, so
  bumping the two constants (plus reverting the class-letter fallback's font
  size from 20px back to 40px to match) was the whole fix, no layout code
  changed.
  Fixed a real bug, also reported by the repo owner: "when using battlescene
  option, unit hp on grid is updated before battle scene is played." Root
  cause was in `TacticalScene.syncUnits()` — the per-unit reconciliation
  loop synced every `UnitSprite` (including HP bar width) to the *live*,
  already-resolved `G.units` state the instant a move resolved, well before
  either presentation (the on-grid combat pass, or the battle-screen overlay
  selected by the Battle Style setting) had actually played out the
  exchange. Most visible in overlay mode, where the board sits on screen for
  a beat with the already-updated HP bar before the cut-in even opens. Fixed
  by holding a combat participant's displayed HP at its pre-exchange value
  (read from `this.lastUnits`, the pre-combat snapshot already kept for
  floating-damage-text purposes) while `combatUnitIds` marks it as part of
  the resolving exchange, then re-syncing every surviving participant's
  sprite to its real post-combat HP inside `finishPresentation` — the
  closure already responsible for lifting `inputSuspended` once a
  presentation completes, for both the grid and overlay paths. A dead
  participant needs no such re-sync: it has no `G.units` entry left to read
  and its sprite is already destroyed or about to be by the same closure's
  `deferredRemovals` pass.
  Found a second instance of the identical bug class in
  `UIScene.refreshUnitStatusBar()` — the panel that shows a tapped unit's
  full stat card, including its HP number directly. Unlike the gameover
  panel in `refreshHud()` (gated on `isInputSuspended()` in an earlier
  session's fix for "stage clear appears before battle overlay and on grid
  battle end"), this panel had no such gate and refreshed on every
  `client.subscribe()` state change, spoiling a combat outcome the instant
  it resolved if the affected unit's status bar happened to be open. Fixed
  the same way: added an `isInputSuspended()` gate at the top of
  `refreshUnitStatusBar()`, moved its only call site from standalone inside
  `client.subscribe()` to the tail of `refreshHud()` (so its three existing
  call sites — including `finishPresentation`'s own `refreshHud()` call —
  now catch the status bar up automatically once presentation completes),
  and removed the now-redundant standalone call.
  Verified: typecheck/build/validate-maps/`sim -- --batch 30` all clean.
  Live Playwright capture of the exact pre-reveal HP-hold window in overlay
  mode proved impractical to pin down through blind coordinate-based
  automation (RNG-driven exchanges and AI repositioning made it hard to
  land a specific damaging player attack reliably); relying instead on the
  code-level trace above and the fact that the fix mirrors the already-
  proven gameover-panel gating pattern from the earlier session.

- 2026-09-01 Claude: Retired the bust-portrait art category, per the repo
  owner — every panel that shows a unit's likeness now uses the same
  on-board map sprite everywhere (`heroArt.ts`'s new `resolveUnitArtTexture`,
  a two-tier map-sprite-then-enemy-class-art chain, replacing the old
  three-tier `resolveBattlePortraitTexture` that checked a dedicated bust
  portrait first). `HERO_PORTRAIT_NAMES`/`heroPortraitTextureKey` and the
  `TacticalScene.preload()` loop that loaded them are gone;
  `public/portrait/jill.png` (the one bust that had shipped) is deleted —
  CREDITS.md keeps the attribution history, ART_BRIEF.md's old "Portraits
  (later)" section now reads "retired."
  `UnitStatusBar`'s own portrait slot shrank from 96×164 to a **50×50**
  compact box (also per the repo owner) — it had kept its own inline copy
  of the same fallback chain rather than calling the shared helper (a
  pre-existing duplication now removed along the way), and its previous
  near-full-height size was originally sized for a tall bust crop that no
  longer exists. Everything below the box (banner/HP/terrain/stats/skills)
  is positioned off the box's Y coordinate, not its height, so the resize
  didn't ripple into the rest of the panel's layout — just freed up
  horizontal room for the stat grid.
  Verified: typecheck/build/validate-maps/sim clean; Playwright confirmed
  both a named hero (Jill, now showing her map sprite) and an unnamed
  enemy (Gate Chief, enemy-class art) render correctly at the new size
  with no console errors.

- 2026-09-01 Claude: EXP rate made a permanent default instead of leftover
  test scaffolding, per the repo owner — `classes.ts`'s multiplier was 5x
  since 2026-08-27, explicitly temporary to speed through testing the
  promotion system. Renamed `TESTING_EXP_MULTIPLIER` to
  `EXP_RATE_MULTIPLIER` and set it to 2x rather than reverting to 1x — the
  faster pace is the intended default now. `npm run sim -- --batch 30`
  comes back statistically unchanged (0 wiped, still 100% reaching the
  wave cap), so the slower-than-5x leveling doesn't hurt survivability at
  this batch size.
  Also refreshed the **Project Status** section (`Now`/`Not built yet`/
  `In progress`), which had drifted well behind reality — it still listed
  `CombatOverlayScene` as unbuilt and the terrain tileset as blocked on a
  commission, both shipped weeks/sessions ago. `Now` gained bullets for
  campaign dialogue (`DialoguePanel`), the two combat presentations
  (Battle Style setting) and the animated-hero pipeline (Luffy/Zoro,
  `extractAseprite.ts`), and the real terrain tileset; `Not built yet`
  now lists what's actually still open — portraits for 5 of 6 real
  roster heroes, terrain auto-tiling, a third campaign chapter, and the
  still-deferred multiplayer/mobile-wrap items (HANDOFF.md §9/§10).
  `In progress` is empty — nothing was actually in flight under that
  heading, it just hadn't been cleared.

- 2026-09-01 Claude: Switched the Hero Animation Test stage back to
  `river1.jpg`'s painted background, per the repo owner — it had picked up
  the new generic tile art for free when that shipped a moment earlier,
  but since `ANIMATED_HERO_TEST_STAGE` already reuses `RIVER_CROSSING`'s
  own `rows` (maps.ts), its board should look like River Crossing too
  rather than switch art styles for reasons unrelated to what it's
  actually testing (the animated-hero pipeline, not terrain art). One
  line added to `TacticalScene.ts`'s `CHAPTERS_WITH_BACKGROUND_ART`.

- 2026-09-01 Claude: Wired in a real terrain tileset, filling `ART_BRIEF.md`
  §2's long-open gap — per the repo owner, picked a free third-party set
  rather than waiting on a commission (see that section and CREDITS.md for
  the full pick process and license terms). Chapter 1 (The Iron Gate) and
  Chapter 2 (The Long March) now render real Plain/Forest/Wall/Water tiles
  instead of flat color fills; the Hero Animation Test stage gets the same
  tiles for free since it never had its own background-art entry either.
  River Crossing (Roguelike's map) is unaffected — it already had its own
  painted background image and that path didn't change.
  Source: McMagister's "32px FE-style Tileset" (CC BY-SA 3.0,
  `github.com/McMagister/srpg-studio-stuff`), one representative 32x32 tile
  cropped per terrain type — `Grass.png`/`Trees.png`/`Mountains.png` for
  Plain/Forest/Wall, and (after the `Rivers.png` sheet turned out to be a
  bounded river/lake autotile with no pure open-water tile anywhere in it,
  confirmed by scanning it programmatically rather than assuming) the
  dedicated `!8#WaterAnimation.png` sheet's first frame for Water instead.
  New `TERRAIN_TILE_KEY` in `TacticalScene.ts` maps each `TerrainType` to
  its `public/tiles/<type>.png`; `drawBoard()` now draws that image per
  grid cell (falling back to the old flat-color fill if a texture somehow
  fails to load, same defensive pattern `CHAPTERS_WITH_BACKGROUND_ART`
  already used) instead of branching only between "one painted background
  image" and "flat color." v1 scope, matching the brief: one static tile
  per type, no auto-tiled edge blending between neighboring cells yet.
  Verified: typecheck/build/validate-maps/sim clean (map data unchanged,
  purely visual); Playwright confirmed real tiles render correctly on both
  Iron Gate and the much larger Long March board, River Crossing's
  painted-background path is untouched, and the Hero Anim Test stage
  picked up the new tiles automatically.

- 2026-09-01 Claude: Removed the dead/unwired concept-test maps, per the
  repo owner — `CHAPTER_1` (`frozen-pass`), `TEST_MAP_1` (`test-map1`), and
  `TEST_MAP_1_DETAILED` (`test-map1-detailed`). `CHAPTER_1` had been
  entirely unreferenced since Roguelike moved onto `TEST_MAP_2` a few
  sessions back (its own doc comment still said "swap back to CHAPTER_1
  once testing's done" — that swap was never coming); `TEST_MAP_1`/
  `TEST_MAP_1_DETAILED` were never routed anywhere reachable, and their
  shared background image (`public/maps/test-map1.png`) never actually
  existed — the 404 flagged in an earlier session's changelog entry.
  Removing them resolves that for good rather than leaving it as a known
  issue.
  `TEST_MAP_2` — the map this all along that was Roguelike's real board —
  is promoted from a concept test to the permanent one: renamed
  `RIVER_CROSSING` (id `river-crossing`, display name "River Crossing",
  dropping the "Concept Test:"/"(Test)" branding that no longer fit once
  it stopped being a test). No terrain, unit roster, or gameplay changed —
  `npm run sim -- --batch 30` comes back numerically identical to before.
  `game.ts`'s `ProjectSelvaria` and every place that referenced
  `TEST_MAP_2`/`CHAPTER_1` (`TacticalScene.ts`'s board-sizing doc comments,
  `CHAPTERS_WITH_BACKGROUND_ART`, `validateMaps.ts`'s chapter list) updated
  to match — down to one background-art entry now instead of three.

- 2026-09-01 Claude: Fixed animated heroes rendering off-center (shifted
  toward the left edge of their tile, per the repo owner's screenshot —
  Luffy's foot sitting right on the grid line). `extractAseprite.ts`'s
  first version unioned *every* frame's content bounds together — idle and
  attack alike — to compute one shared crop window. The attack pose's
  fist/sword reaching well to the right widened that window asymmetrically,
  so the idle frames' own content (which never reaches that far) ended up
  sitting in the left portion of the resulting box instead of centered in
  it — exactly what the screenshot showed. The extractor now unions each
  animation group separately (idle frames together, the attack frame on
  its own), the same per-group scoping `scanSpriteAtlas.ts`'s `--stabilize`
  already used and for the same reason: real motion in one animation
  shouldn't distort another's. Confirmed by rendering each extracted frame
  with a center-line marker before and after — idle content now sits on
  the frame's own midline for both Luffy and Zoro. Regenerated both
  heroes' atlases; no code outside the extractor needed to change, since
  atlas frames were already allowed to have independent sizes per name.

- 2026-09-01 Claude: Replaced the hand-cut-PNG animated-hero pipeline with
  an Aseprite-source one, per the repo owner (commissioning full animation
  for the whole roster costs too much — the plan going forward is a cheap
  per-hero `.aseprite` file, a handful of poses on one fixed canvas, run
  through a new extractor). Added Zoro as a second animated hero alongside
  Luffy, both now sourced from `public/aseprite/<name>.aseprite`.
  New `npm run extract-aseprite` (`src/scripts/extractAseprite.ts`, replacing
  `scanSpriteAtlas.ts`, now removed along with the old placeholder Luffy PNG
  sheets) decodes cels with `ase-parser` and composites each frame onto its
  own transparent canvas at the cel's own recorded position — provably
  aligned by construction, not scanned for transparent-pixel gaps. Checked
  directly against both source files: every idle frame's content bottom
  lands on the same canvas row despite what a tight per-frame crop would
  measure as differing heights, confirming the artist draws every pose
  against one fixed ground line. The extractor crops every frame (idle and
  attack alike) to the *union* of every frame's content bounds rather than
  each frame's own tight box — every output frame ends up the exact same
  pixel size with zero drift, derived from data Aseprite already recorded
  rather than a heuristic like the old `--stabilize` flag had to be.
  Also corrected a wrong assumption from the previous entry: rendering
  Luffy's old sheets showed idle and attack facing opposite ways, but that
  was specific to that placeholder art — both new Aseprite sources have
  idle and attack facing the *same* direction, so `heroAnimations.ts`'s
  flip logic (`heroFlipX`, replacing `luffyFlipX`) no longer needs to key
  off which animation is currently playing, just which side a fighter
  stands on.
  Each hero's atlas is now a single merged idle+attack sheet (one source
  file, so no more two-atlas split), and "attack" is a single held pose
  (`HERO_ATTACK_FRAME`) rather than a played animation — the old ~20-frame
  windup/impact/flurry timing this replaced doesn't apply to one frame.
  That pose now shows on the **on-grid** lunge too
  (`UnitSprite.playAttackPose()`/`resumeIdlePose()`, wired into
  `TacticalScene.playCombatSequence()`), something a full run/attack
  animation cycle couldn't do at a ~130ms tween's on-board scale — a
  single-frame swap has no cycle to desync from. Per-hero scale
  (`heroAnimScale()`) is now read from the loaded atlas frame at runtime
  instead of a hand-tuned constant, since different heroes' extracted
  frames are different sizes (Luffy 53x46, Zoro 69x57).
  `LUFFY_TEST_STAGE` is now `ANIMATED_HERO_TEST_STAGE` (menu button "Hero
  Anim Test"), a 2v2 with one Luffy and one Zoro per side, and
  `SpriteTestScene`'s standalone viewer gained a character switcher
  (dropped its Run button — there are no run frames in this pipeline).

- 2026-09-01 Claude: Corrected the previous entry's root cause for the
  battle-screen facing bug, per the repo owner. Both Luffy's sheets — idle/run
  and attack — are drawn facing **right**; they were never mismatched with
  each other. The actual bug was the *static*-portrait branch (every other
  hero, `heroArt.ts`'s `HERO_SPRITE_NAMES`/bust portraits/enemy-class art,
  all drawn facing **left**) never getting a flip at all, so a static
  fighter placed on the left side of the overlay stood facing away from
  its opponent regardless of which side it was on.
  `heroAnimations.ts`'s `luffyFlipX` is now a one-argument helper
  (`faceRight`) wrapping a new shared `heroArt.ts` primitive,
  `artFlipX(artFacesRight, faceRight)`, that both the animated and static
  branches call with their own art's known orientation
  (`LUFFY_ART_FACES_RIGHT = true`, `STATIC_ART_FACES_RIGHT = false`) —
  so a future art source states which way it's drawn once, rather than
  re-deriving the flip boolean per call site. `CombatOverlayScene`'s static
  branch (`buildFighter`'s `image` path) now calls `setFlipX` the same way
  the animated branch always did.

- 2026-08-31 Claude: Fixed the battle screen's fighters facing **away** from
  each other, and made **On Grid** the default battle style, both per the
  repo owner. The facing bug had a non-obvious cause: Luffy's two sprite
  sheets are drawn pointing *opposite* ways — the idle/run sheet faces
  **left**, the attack sheet faces **right** (placeholder art from different
  sources, so nothing ever made them agree). Confirmed by rendering `idle-0`
  and `attack-0` at 6x and looking, rather than assuming. The overlay had
  been flipping purely on which side a fighter stood (`setFlipX(lungeSign
  === -1)`), which happened to make the *attack* read correctly and left
  both fighters *idling* turned away — and idle is what plays for most of
  the cut-in, so that's what you notice. The fix inverts the relationship:
  `heroAnimations.ts` gained `luffyFlipX(animKey, faceRight)`, so call sites
  state the direction they want and the helper works out the flag from which
  way that particular sheet's art points. A future sheet only needs its own
  entry there instead of every call site learning its orientation.
  `Fighter` now carries `faceRight`, and the flip is re-applied at all three
  points the animation changes (build, attack-play, return-to-idle) — the
  return-to-idle one is the one that was actually missing. Note this
  necessarily corrects the enemy side too: fixing only the player would
  leave the enemy idling turned away, which is the same bug mirrored.
  Separately, `DEFAULT_SETTINGS.battleStyle` flipped `'overlay'` →
  `'grid'` (with `TacticalScene`'s field initializer now reading
  `DEFAULT_SETTINGS.battleStyle` rather than repeating the literal, so the
  two can't drift) — an exchange resolves on the board in a fraction of the
  cut-in's few seconds, so the battle screen is now the deliberate choice
  rather than what you get without asking. Anyone who already toggled the
  setting keeps their saved choice; only fresh installs see the change.

- 2026-08-31 Claude: Added a **Battle Style** setting to the main menu, per
  the repo owner — choose between combat playing **On Grid** (the on-board
  lunge, floating damage, particles, crit shake) or on the **Battle Screen**
  (`CombatOverlayScene`'s full-screen cut-in). New `src/systems/settings.ts`
  persists it through the same injected `KeyValueStorage` seam `game/save.ts`
  uses (nothing reads `localStorage` directly — storage.ts's rule), stored as
  one JSON object read back merged over defaults so a blob written by an
  older build can't come back half-undefined. It lives in `systems/` rather
  than `game/` because it changes how a battle is *shown*, never what it
  resolves to — the headless simulator neither reads nor needs it.
  The menu gained a SETTINGS section holding a single two-state toggle row
  that relabels itself on tap, matching the in-battle "Danger: OFF" dock
  button rather than spawning a whole settings screen for one choice; the
  hand-rolled section dividers were folded into an `addDivider()` helper
  while adding the fourth one. `TacticalScene` reads the setting once per
  battle in `create()` (there's no in-battle settings screen, so it can't
  change mid-fight) and `syncUnits()`'s combat branch now routes to one
  presentation or the other, with the shared tail — deferred death fades,
  the input unlock, the HUD/auto-advance re-check — factored into a single
  `finishPresentation()` both paths reach.
  **Note:** the previous behavior of playing *both* back-to-back is gone;
  the setting replaced it rather than joining it as a third option, which is
  what was asked for. Re-adding "Both" is a small change if it's wanted.
  Default is Battle Screen.
  Verified both modes end-to-end in the browser rather than assuming:
  in On Grid the board stays visible and the exchange resolves in ~400ms
  with no cut-in; in Battle Screen the cut-in plays and no on-grid pass
  follows; both return to a playable board with no stuck input suspension
  (checked through to a Chapter Clear with a working Continue). Also
  confirmed the toggle writes `{"battleStyle":"grid"}` / `"overlay"` on
  alternate taps, relabels, and survives a reload.
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean.
- 2026-08-31 Claude: Fixed the combat overlay being skipped for any killing
  blow — "combat overlay is not show for the last fight", and the chapter
  clear arriving "instantly after confirm attack" as a direct consequence.
  One root cause for both: `playCombatOverlay()` looked both combatants up
  in `G.units`, but a unit killed by the exchange is already removed from
  there by the same move, so the `!attacker || !defender` guard fired and
  skipped the cut-in for exactly the fight that most deserves one. With the
  multi-second overlay gone, only the ~400ms on-grid pass stood between
  Confirm and the panel — hence "instantly"; the gating added earlier was
  working, there was just almost nothing left to gate. Now a missing unit
  falls back to the pre-combat snapshot `lastUnits` already keeps for the
  HP-before values, with `hp` zeroed so the overlay's closing snap lands on
  0 rather than resurrecting it.
  Verified by actually driving a killing blow in the browser rather than
  reasoning about it — worth noting because two earlier passes at this area
  looked conclusive and weren't. Temporary instrumentation (since removed)
  traced the real sequence: on the lethal exchange the overlay now reaches
  `create()` and runs a full 2.4s before `finish()`, and a screenshot 1.0s
  in shows the cut-in mid-punch with the defender's HP bar draining 4/26
  toward 0 and **no** chapter-clear panel — it appears only once the
  presentation completes. The same instrumentation also caught two of my
  own earlier screenshots being mistimed (the kill had happened during an
  auto-advanced enemy phase, not the tap I thought), which is why the
  previous round read as "still broken".
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean.
- 2026-08-31 Claude: Two fixes from the repo owner's testing.
  **Stage clear appearing mid-battle**: `UIScene.refreshHud()`'s gameover
  panel had no `isInputSuspended()` gate, so the killing blow that ends a
  battle popped "VICTORY"/"CHAPTER CLEAR" the instant `ctx.gameover` flipped
  — over the combat overlay and the on-grid pass still visibly playing.
  Exactly the same bug class as the phase banner mid-attack one fixed
  2026-08-28, and the same fix: gate the show, don't consume anything, and
  let the combat sequence's own `onComplete` (which already clears
  `inputSuspended` then calls `refreshHud()`) show it a moment later.
  Verified the ordering holds — `onStateChange()` sets the flag inside
  `syncUnits()` synchronously, and UIScene subscribes after TacticalScene,
  so the flag is always set before the HUD refresh reads it.
  **Idle still bouncy on the grid**: measured rather than re-guessed, and
  the previous day's stabilization *had* worked — with the atlas uniform on
  both axes, the feet sit a constant 22px below the render anchor in all
  four frames, provably planted. What remained was the art's own motion: the
  character's top squashes down 1px a frame, then the loop **snaps the full
  3px back** to frame 0. That sawtooth is what reads as a bounce. The viewer
  doesn't show it as badly because it draws at 5x, where the same motion has
  the screen pixels to look like breathing; on the board at ~1.2x, with the
  game's global `roundPixels`, those 1px steps quantize unevenly and the
  reset lands as one hard jump. Fixed with a map-specific idle
  (`LUFFY_ANIM_IDLE_MAP`) — same frames, `yoyo: true` and half the frame
  rate, so the motion is a triangle wave (0,1,2,3,2,1,0) with no
  discontinuity, at a breathing pace rather than a pulse. `SpriteTestScene`
  deliberately keeps playing the raw un-yoyo'd `LUFFY_ANIM_IDLE`: showing
  the frames exactly as authored is that scene's whole job. If it still
  reads wrong at board size, the honest next step is a static map pose —
  plenty of tactics games animate nothing on the map — rather than tuning
  this further.
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean.
- 2026-08-31 Claude: Fixed a real bug the repo owner spotted after shipping
  the idle-only revert — Luffy's idle loop still looked "bouncy" on the grid
  even though the standalone `SpriteTestScene` viewer looked fine, same
  sheet, same animation. Root-caused with actual pixel data, not guessed:
  every idle frame's bottom ink row sits on the exact same absolute row
  (56) even though `frame.h` varies 43-46px — the feet never move, only the
  top crept down as a hat shrank frame to frame. `UnitSprite`'s on-grid
  render uses `setOrigin(0.5, 0.5)` (center-anchored, so it matches how the
  circle/portrait placeholders render — see `CombatOverlayScene`'s own entry
  below for why), and center-anchoring a *varying* height means the frame's
  midpoint drifts even when the feet don't, which reads as the character
  bobbing up and down. The viewer never showed this because it uses
  `setOrigin(0.5, 1)` (bottom-anchored) instead, which is immune to a height
  change by construction. This is the vertical sibling of the horizontal
  drift bug fixed earlier the same day, but a *structurally different* fix,
  not a copy-paste: the horizontal case has no shared value across the
  group to anchor on (each frame sits in a different strip region), so it
  derives an offset from the narrowest frame's own half-width; the vertical
  case is simpler — every frame already shares one absolute Y coordinate
  system, so padding every shorter frame's top out to the group's *tallest*
  height (verified against real transparent pixels, same safety check as
  the horizontal pass) does the whole job with no offset math needed, since
  holding the bottom edge fixed is automatic once the heights match.
  `scanSpriteAtlas.ts`'s `--stabilize` now runs both passes together;
  regenerated `luffy-atlas.json` via the tool rather than hand-editing.
  Confirmed the fix can't affect `SpriteTestScene`: the bottom edge
  (`frame.y + frame.h`) is provably unchanged by a top-only pad, which is
  exactly what that scene's own `setOrigin(0.5, 1)` reads.
  Also added a **DEV TESTS** section to the main menu (`SpriteTestScene`
  and `LUFFY_TEST_STAGE`, per the repo owner — typing `?spriteTest=1`/
  `?luffyTest=1` each time got old now that there are two) — both URL params
  still work unchanged (BootScene), this is just a faster way in. Styled
  with no primary accent so it doesn't read as a third real game mode.
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean; Playwright
  confirmed the resized main-menu card lays out with no overlap and both new
  buttons actually navigate (Sprite Test screen, and a live Luffy Test Stage
  battle) — the only console errors present were the two known pre-existing
  ones unrelated to this change (a connection-reset on an unrelated asset,
  and the already-flagged missing `test-map1.png` background).
- 2026-08-31 Claude: Built `CombatOverlayScene` — `HANDOFF.md` §7's
  long-deferred "Phase 2" full-screen combat cut-in, GBA Fire Emblem style —
  and pulled the on-map animation back to idle only. Per the repo owner after
  seeing the on-map version live: a run cycle during a 150-180ms movement
  tween read as a twitch, not a stride, at the board's small sprite size, so
  `UnitSprite.walkTo()` no longer switches animation at all and
  `playRun`/`playIdle`/`playAttack` came off `UnitSprite` entirely; an
  on-board animated hero now just holds its idle loop through everything.
  Run/attack belong to the cut-in, which has the screen space and time budget
  to show them properly (and where the attack animation's ~1.8s length, an
  awkward fit against the grid's ~130ms lunge, is finally the right size).
  Both presentations play, in the order the repo owner asked for: confirm an
  attack, the overlay takes the screen, and once it closes the existing
  on-grid pass re-states the same result on the board. The overlay slots into
  the §7 contract unchanged — combat still fully resolves first
  (`G.lastCombat`), presentation only consumes that finished `CombatResult`,
  and completion still comes back by callback with `inputSuspended` held for
  the whole chain.
  Layout is portrait-first (480x854): player always left, enemy always right
  regardless of who's swinging, so a counter doesn't visually swap the two
  units mid-exchange; name/class/HP-bar panels below, HP draining live per
  beat with the number label and traffic-light color tweened in step. Per the
  repo owner it covers **everyone**, not just animated heroes — a unit with
  real frame animation plays it, and the whole rest of the cast falls back to
  a static portrait (the same bust → map-sprite → enemy-class chain the
  forecast panel uses, now shared out of `heroArt.ts` as
  `resolveBattlePortraitTexture` rather than becoming a third copy) doing the
  same lunge the on-grid version uses. Impact for an animated attacker is
  pinned to the punch's own landing frame via `animationupdate`
  (`LUFFY_ATTACK_IMPACT_FRAME`) rather than a hardcoded delay that would
  silently desync the next time that animation's per-frame timing is retuned.
  Tap anywhere to skip (with a 400ms grace so the confirming tap can't
  instantly dismiss it), which snaps both bars to the units' real
  post-combat HP.
  Two correctness details worth knowing: a unit killed in the exchange now
  has its board sprite's death fade **deferred** until the whole presentation
  finishes — previously it faded and destroyed itself immediately, which was
  survivable at ~300ms but with a multi-second overlay in front would have
  left nothing on the board for the on-grid pass to play the killing blow on
  (exactly what §7's contract already said: apply visible consequences after
  presentation signals completion). And `playCombatOverlay()` holds a 12s
  watchdog: everything downstream (clearing `inputSuspended`, the deferred
  fade, the enemy AI's next step) hangs off the overlay's `onComplete`, so a
  stall there would soft-lock the battle behind suspended input — the
  watchdog bounds that into a pause instead. It should never fire.
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean, plus a
  console-only boot check of `?luffyTest=1` (no screenshots — per the repo
  owner, visual review is theirs): no errors from the overlay, the atlases,
  or scene registration. Unrelated pre-existing finding from that check:
  `public/maps/` only holds `river1.jpg`, so the `test-map1.png` background
  in the chapter art table 404s on any chapter boot — left alone here.
- 2026-08-31 Claude: Wired Luffy's idle/run/attack animations into the real
  battle scene, not just SpriteTestScene's standalone viewer — a new
  `LUFFY_TEST_STAGE` chapter (`?luffyTest=1`, same hidden-dev-route
  convention as `?spriteTest=1`), one player-controlled and one
  AI-controlled Luffy, reusing River Crossing's terrain. New `ClassName`
  `Luffy` (`classes.ts`, untuned test-stage stats — a fast, hard-hitting
  melee brawler; also needed a `CLASS_LETTER`/`SKILLS` entry, both
  exhaustively-typed per-class records) backs it.
  `UnitSprite` gains a third render mode alongside the circle placeholder
  and static hero-art `Image`: an animated hero (`heroArt.ts`'s new
  `ANIMATED_HERO_NAMES`) gets a `Sprite` playing real frame animations,
  checked before the static-art path. It centers on the tile
  (`setOrigin(0.5, 0.5)`) rather than SpriteTestScene's bottom-anchored
  ground-line alignment — this board draws every unit centered in its
  tile, and matching that keeps a Luffy level with its teammates; the
  tradeoff (documented on the class) is a little vertical wobble on the
  attack sheet's much taller frames, which the viewer's foot-anchor
  approach didn't have to accept.
  New `UnitSprite.walkTo()` centralizes what were 4 separate
  `this.tweens.add({x, y, ...})` call sites in `TacticalScene` (a
  confirmed move, the pre-confirm preview, a cancel snap-back, enemy AI
  stepping) into one method that also plays the run loop for the tween's
  duration and idle again after — "Run animation is used on moving," per
  the repo owner, now holds for every movement path at once instead of
  needing four separate call sites updated by hand. `playAttack()` plays
  the attack animation once during a combat beat's existing lunge
  (layered on top of it, not replacing it) and reverts to idle after.
  The animation definitions themselves (per-frame timing, the flurry
  loop) moved out of `SpriteTestScene.ts` into a new shared
  `src/ui/heroAnimations.ts` so the real game and the standalone viewer
  play the exact same tuned frames instead of two copies drifting apart —
  the viewer now asks for a continuous loop at play time
  (`sprite.play({key, repeat: -1})`) rather than that being baked into
  the shared definition, since a real combat hit should play once.
  Known unresolved rough edge, flagged rather than guessed at: the full
  attack animation (windup + impact + 3x flurry + ease, ~1.1s+) runs much
  longer than the existing combat beat's own pacing (~130ms lunge,
  ~600ms between attack/counter) — timing/whether to trim it for real
  combat is left for the repo owner's own feel-check in `?luffyTest=1`.
  Also known: winning this chapter and continuing clears any real
  in-progress campaign save (its id isn't in `CAMPAIGN_CHAPTERS`, so
  `finishCampaignContinue`'s next-chapter lookup misses the same way
  finishing the real last chapter does) — harmless for a hidden dev route,
  documented on the chapter itself.
  `typecheck`/`build`/`validate-maps` (now covers the new chapter too)/
  `sim -- --batch 30` clean. No Playwright — per the repo owner, checking
  this one themselves in `?luffyTest=1`.
- 2026-08-31 Claude: Replaced the attack animation's flat 15fps with
  per-frame timing, per the repo owner's read of the 22 raw frames. Phaser
  supports this natively — confirmed in its own type definitions before
  writing anything, not assumed from memory —
  `Types.Animations.AnimationFrame.duration` (ms) overrides the parent
  animation's `frameRate` for just that one frame, so `SpriteTestScene`
  now builds `luffy-attack`'s frame list explicitly (`buildAttackFrames()`)
  instead of a bare `generateFrameNames()` call, tagging each with its own
  duration: anticipation/snap/hold/ease shape — held longest at the
  windup's cocked-back peak (frame 3) and the frame-8 impact (max
  stretch), fast through the middle, slowing back down through the final
  ease-out. Also: the repo owner read frames 11-17 as one full punch cycle
  (arm re-coils compact at 11, extends to a peak at 15, starts retracting
  by 17) rather than a single continuous motion, so that slice now repeats
  3x (`ATTACK_FLURRY_REPEATS`) before continuing into the ease-out — the
  same 7 frames playing three times over reads as a flurry of jabs instead
  of one long reach, without needing new art or a second animation.
  `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean. No
  Playwright — per the repo owner, checking this one themselves in
  `?spriteTest=1`.
- 2026-08-31 Claude: Added an attack animation to `SpriteTestScene`
  (`public/test/luffy-attack.png`, a stretch-punch sequence, committed to
  `main` directly by Gemini — also working this repo — then wired in here)
  and generalized `scanSpriteAtlas.ts` to actually handle it, since neither
  of its two real shapes fit the existing single-row-strip scanner. First:
  the sheet is laid out as **two rows** (22 poses total, long enough that
  one strip would've been unwieldy) — the tool now finds row bands the
  same way it already found frame columns (a gap of fully-transparent rows
  separates them), so a grid layout works with no new flag, reading
  top-to-bottom then left-to-right. Second: several poses have a fist/
  speed-line motion trail that fades to fully transparent for a column
  before resuming, which the column scan read as its own throwaway 1px
  "frame" — confirmed by actually rendering the pixels (a 3x crop) rather
  than guessing, and confirmed which real pose each trail belongs to the
  same way (visually, it's the *trailing* streak off the punch to its
  left, not connected to the next pose at all). New `--min-fragment-width`
  (default 8px, 0 disables) merges any run narrower than that into
  whichever real neighbor sits closer, extending that neighbor's span —
  ran a contact-sheet render of all 22 detected frames to confirm every
  one is a complete pose with no stray slivers before wiring anything up.
  Generated `public/test/luffy-attack-atlas.json` via the tool
  (`--names=attack-0,attack-1,...`, **no `--stabilize`** — a stretch punch
  has real, intentional horizontal travel as the fist extends, exactly
  what that flag can't tell apart from drift, per its own doc comment).
  `SpriteTestScene` gained an Attack button (idle/run/attack now a 3-up
  row) playing `luffy-attack` at 15fps looped; one `Sprite` plays
  animations from either atlas interchangeably since Phaser's
  `sprite.play()` swaps texture to match whichever atlas the requested
  animation's frames belong to — no second sprite needed.
  Confirmed the single-row idle/run sheet still re-scans byte-identical
  through the generalized detector (no regression). `typecheck`/`build`/
  `validate-maps`/`sim -- --batch 30` clean. No Playwright pass — per the
  repo owner, they're checking this one themselves in `?spriteTest=1`.
- 2026-08-31 Claude: Fixed the idle-loop foot slide reported after the
  speed-selector work below, and taught `scanSpriteAtlas.ts` to fix this
  class of bug automatically going forward. Root cause, confirmed with
  direct pixel inspection (not guessed): in every `idle-N` frame the
  leftmost foot pixel sat at exactly `frame.x` — zero drift there — but
  something above the feet (arm/hair) grew the tight-crop bounding box by
  1px to the right each frame (30/31/32/33px wide), and since
  `setOrigin(0.5, ...)` anchors to *that frame's own* box-center, the
  growing box dragged the center-anchor sideways even though the feet
  never moved. New `--stabilize[=prefix,...]` flag: for each named,
  consecutive-run animation group (e.g. all `idle-N` frames), treats the
  group's narrowest frame as the balanced reference and pads every wider
  frame's *left* edge outward (verified against the raw pixel data to
  land only on fully-transparent columns — never crops, never guesses)
  until each frame's own center re-aligns to a fixed point. Deliberately
  scoped per-prefix rather than sheet-wide: running it against this same
  sheet's `run-N` group first (a sanity check before touching anything)
  inflated `run-0` from 38px to a nonsensical 50px, because a run cycle's
  leg-reach is *real* intentional horizontal motion that this technique
  can't tell apart from drift — confirms the technique is a real fix for
  a stationary pose, not a general-purpose one; `--stabilize=idle` scopes
  it correctly. Re-ran `npm run scan-atlas -- public/test/luffy-sheet.png
  public/test/luffy-atlas.json --names=... --stabilize=idle` to regenerate
  the committed atlas (`idle-1/2/3` shift left 1-3px, widen to 32/34/36px;
  `idle-0` and all `run-N` frames unchanged) instead of hand-editing the
  JSON, so the committed file and the tool that produces it never drift
  apart. `typecheck`/`build`/`validate-maps`/`sim -- --batch 30` clean;
  Playwright at 0.1x confirms `idle-1`/`idle-3` now hold the same stance
  position instead of visibly shifting right/up frame to frame.
- 2026-08-31 Claude: Added a playback-speed selector to `SpriteTestScene`
  (0.1x/0.25x/0.5x/1x/2x buttons, `sprite.anims.timeScale` — no need to
  touch the animation definitions or re-`play()`), per the repo owner
  after testing the idle loop themselves: the character's feet look like
  they're sliding between frames. Confirmed the cause via 0.1x playback —
  `idle-0` (30x46px) to `idle-1` (31x45px) visibly shifts the whole
  character right/up, which is the known limitation `scanSpriteAtlas.ts`'s
  doc comment already flags: `setOrigin(0.5, 1)` anchors each frame's
  *own* tight bounding box (recomputed per frame), so the vertical anchor
  (bottom = lowest ink pixel) is solid, but the horizontal anchor
  (0.5 = that frame's own bbox center) drifts whenever a hat brim, hair,
  or raised arm shifts which pixels are the tight-crop's left/right
  extremes — the feet didn't move, the crop box's center of mass did.
  Not fixed yet — needs a per-frame horizontal anchor (foot-region
  centroid, or a shared untrimmed canvas per TexturePacker/Aseprite's
  `trimmed: true` convention) rather than a bbox-center guess; flagging
  as the next real step on this rather than shipping a guessed fix.
  `typecheck`/`build` clean; Playwright confirmed the button row renders
  without overlap and correctly highlights/updates the speed label on tap
  (screenshots at default 1x and after selecting 0.1x).
- 2026-08-31 Claude: Turned the sprite-sheet frame scanner from the
  `SpriteTestScene` work below into a real, reusable tool instead of a
  one-off Python script — the repo owner asked whether it could be re-run
  cheaply on a future sheet, and it hadn't been saved anywhere. New
  `npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...]`
  (`src/scripts/scanSpriteAtlas.ts`, new `pngjs`/`@types/pngjs` devDeps —
  pure-JS PNG decode, no native bindings, keeping this a plain Node/tsx
  script like `validate-maps`/`sim`): same transparent-pixel-gap scan as
  before, ported from Python to TypeScript, writing the same
  `trimmed: false` TexturePacker JSON-Hash shape `SpriteTestScene`
  consumes. `--names` assigns frame names left-to-right (errors with the
  detected rects printed if the count doesn't match); omit it for
  sequential `frame-0`, `frame-1`, ... Verified byte-identical to the
  committed `public/test/luffy-atlas.json` when re-run against
  `luffy-sheet.png` with its original names. Documented in the script's
  own header when to prefer this over Aseprite's native sprite-sheet
  export (Aseprite when a `.aseprite` source exists — its `trimmed: true`
  + `spriteSourceSize` offsets survive a frame whose ink genuinely sits at
  a different height, e.g. a hop, which this tight-crop scan can't
  distinguish from misalignment; this scanner when only a flattened,
  non-uniform PNG exists with no source to re-export from).
  `typecheck`/`build` clean. No Playwright pass (CLI tool, not a UI
  change).
- 2026-08-31 Claude: New standalone dev tool, `SpriteTestScene`
  (`src/scenes/SpriteTestScene.ts`), proving out frame-based sprite-sheet
  animation ahead of any real art commission. The repo owner's friend
  handed over an old hand-drawn Luffy idle/run sheet
  (`public/test/luffy-sheet.png`, 512x64px) with a real concern: each
  frame is a different pixel size, not a fixed grid, so Phaser's
  grid-slicing `load.spritesheet()` can't cut it. Used `load.atlas()`
  instead (`public/test/luffy-atlas.json`, TexturePacker JSON-Hash
  format) with per-frame pixel rects generated by scanning the sheet for
  transparent-pixel column/row gaps (Python/PIL one-off, not committed) —
  found exactly 10 frames (idle-0..3 at 30-33px wide x 43-46px tall,
  run-0..5 at 26-38px wide x 43-48px tall), no manual measurement.
  The frame-size worry turned out to have a built-in answer: each frame
  is trimmed *tight* to its own ink (no padding), and Phaser's
  `setOrigin(0.5, 1)` is a fraction of *that specific frame's* own
  width/height, recomputed every frame — so feet stay glued to the same
  point across every frame with zero TexturePacker `sourceSize`/
  `spriteSourceSize` padding tricks needed. Verified this directly:
  Playwright screenshots of both the idle cycle and every run frame
  (differing 26-38px widths) show feet landing on the same on-screen
  reference ground line every time.
  The scene itself is deliberately isolated from the real game — not
  wired to `UnitSprite`, not reachable from `MainMenuScene` — only via a
  new `?spriteTest=1` boot param (`BootScene`, same debug-redirect
  convention as the existing `?debugChapter=`), with Idle/Run toggle
  buttons and a live frame-name/size readout. Per the repo owner, this
  stays in the codebase as a real dev tool (a more permanent "test
  stage" is planned separately, later) rather than being reverted after
  verification. `typecheck`/`build`/`validate-maps`/`sim -- --batch 30`
  all clean (no map/game-logic files touched); Playwright confirmed both
  animations play and the ground-anchoring holds across all 10 frames.
- 2026-08-28 Claude: Crit feedback tuned again, per the repo owner:
  `cameras.main.flash()` removed entirely (shake stays, alone), the impact
  particle burst nearly doubled for a crit specifically (14 -> 24, normal
  hits unchanged at 7), and a separate **"Crit!"** floating label now
  appears just above the damage number (own `spawnFloatingText` call, gold
  `#f0ad4e`, offset 16px above where the damage number itself starts) —
  the damage number itself dropped its old crit-only `!` suffix now that
  the label says it explicitly instead. `typecheck`/`build` clean; no
  other change.
- 2026-08-28 Claude: Fixed a real bug the repo owner hit testing the combat
  sequencing/juice work above: **the phase banner (and enemy AI stepping)
  could fire while an attack's own animation was still playing**, since
  nothing gated either on "is a combat sequence currently on screen" —
  exactly the gap HANDOFF.md §7's item 3 had already flagged as open
  ("no input lock and no completion signal yet"). A killing blow that also
  ends the phase would cross the turn boundary in the same move whose
  lunge/impact/counter animation had barely started, and UIScene's
  "Enemy Phase" banner would pop up mid-swing.
  Fixed by actually building that seam: `TacticalScene` now sets
  `inputSuspended` for the *whole* combat sequence (not just the tile-tap
  gate it already was) and passes `playCombatSequence()` a real
  `onComplete` callback, chained beat-to-beat (each beat's own tween
  `onComplete`, not the earlier `onYoyo` impact hook) so it fires exactly
  when the *last* beat's lunge actually finishes returning — not a
  separately-guessed timer. `scheduleAutoAdvance()` now bails out at the
  top while `inputSuspended` (new `isInputSuspended()` getter,
  `setInputSuspended()`'s read-only counterpart) instead of only the
  blessing/promotion/dialogue branches guarding themselves individually —
  enemy AI stepping and story-event checks now wait too. `UIScene
  .refreshHud()`'s phase-banner trigger checks the same getter and, when
  suspended, deliberately leaves `lastTurnSeen` stale rather than
  "consuming" the turn-change event — `playCombatSequence`'s `onComplete`
  calls `refreshHud()` directly afterward, so the held-back banner shows
  the moment the sequence actually finishes instead of waiting on some
  unrelated later state change to happen to trigger it. Also added a
  `COMBAT_SEQUENCE_START_DELAY_MS` (150ms) beat before the first lunge, so
  the cut from the forecast panel closing straight into the attacker
  swinging isn't instant — the other half of "attack playing too fast
  after confirm."
  **Side effect worth knowing about**: since `stepEnemyAi()`'s own
  `ENEMY_STEP_DELAY_MS` pacing timer is scheduled from inside
  `scheduleAutoAdvance()`, an enemy phase with several attacking units now
  waits out each attack's *full* combat-sequence animation (up to ~1s:
  150ms pre-roll + up to two ~260ms lunges plus the 600ms gap between
  them) before the next enemy action is even considered, not just the
  previous flat 450ms step timer — enemy phases with a lot of attacking
  will run noticeably slower than before. Flagging rather than tuning
  blind — if that drags, the fix is probably a shorter/simplified sequence
  specifically for enemy-initiated attacks, not shrinking the player-facing
  timings that were just tuned.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the last shipped baseline exactly (0/30 wiped, mean wave 7.27,
  max 8) — the sim harness drives moves directly against a headless
  client, never touches TacticalScene/UIScene, so none of this pacing
  logic is even reachable from it. No Playwright pass — the repo owner
  found this by playing it and will confirm the fix the same way
  (HANDOFF.md §11).
- 2026-08-28 Claude: Camera shake and flash reserved for crits only, per
  the repo owner's feel-test of the combat juice above — a normal hit was
  shaking the camera too (just a lighter one); now only `beat.crit` triggers
  either effect at all, so a crit's camera punch actually reads as
  distinct from a normal connecting hit instead of every hit doing some
  version of the same thing. `typecheck`/`build` clean; no other change.
- 2026-08-28 Claude: On-grid combat juice, per the repo owner — while they
  commission real combat-overlay assets, keep improving the version that
  needs none. All of this rides Phaser 4's own built-ins, no new art:
  - **Attacker lunge, always** — each beat's attacker tweens ~28% of the
    way toward its defender and back (`yoyo: true`), whether the swing
    connects or not, since a real attack always swings; only the *outcome*
    at the peak differs. Phaser fires `onYoyo` at the exact reversal point,
    so impact effects land the instant the swing "arrives" instead of on a
    separately-guessed delay.
  - **On a hit**: the existing white flash + floating damage number, plus
    a new tinted particle burst (`this.add.particles(x, y, '__WHITE',
    ...).explode(count)` — `__WHITE` is Phaser's own built-in 1x1 texture,
    not a new asset) and `this.cameras.main.shake(duration, intensity)` —
    both scaled up on a crit (bigger burst, harder shake, plus a brief
    `this.cameras.main.flash()` red-orange tint). Camera shake/flash are
    Phaser's own built-in Camera effects (`Cameras.Scene2D.Effects.Shake`/
    `.Flash`), not hand-rolled.
  - **On a miss**: no flash/shake/burst — the defender just sidesteps away
    from its attacker (a small tween), reading clearly as "dodged" rather
    than "nothing happened."
  Found while checking what Phaser 4 actually ships (verified against the
  installed package's own type definitions, not assumed from memory):
  camera `shake()`/`flash()` are unchanged from Phaser 3; the per-object
  `Filters` system (already used for the acted-unit grayscale toggle) also
  has `Glow`/`Shadow`/`Blur`/`Vignette`/`Pixelate`/`Wipe` available — Glow
  in particular reads like a natural next crit effect, but it only applies
  to a `Container`'s individual art/circle piece, not the whole
  `UnitSprite`, so it's a bigger change than this pass and stayed out of
  scope for now.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the last shipped baseline exactly (0/30 wiped, mean wave 7.27,
  max 8) — this is presentation-only. No Playwright pass, per the repo
  owner's standing preference — but flagging explicitly this time: several
  of these are Phaser APIs new to this codebase (particles, camera FX,
  `onYoyo`), checked against the type definitions but never actually
  rendered, so the usual "typecheck passed" confidence is thinner than
  normal here — worth a close look at pacing/intensity specifically.
- 2026-08-28 Claude: `COMBAT_BEAT_DELAY_MS` (the attack-beat -> counter-beat
  gap added earlier today) bumped 350 -> 600ms, per the repo owner's own
  feel-test. `typecheck`/`build` clean; no other change.
- 2026-08-28 Claude: First concrete step of the "cut-in battle scene"
  discussion with the repo owner (HANDOFF.md §7's deferred
  `CombatOverlayScene`) — the "easy" half they asked to start with: attack
  and counter now play as a real sequence instead of landing simultaneously.
  `attackUnit` (game.ts) now snapshots the resolved exchange into a new
  `G.lastCombat` field (`CombatBeat`/`CombatResult`, types.ts) — the
  attack's hit/crit/damage, and the counter's if one happened (`null` on a
  miss, a kill, or out of counter range) — instead of the client only ever
  seeing a before/after HP diff (which is all `syncUnits()`'s existing
  diffing could see, and couldn't tell "attack landed for 12, then a
  counter landed for 4" from any other kind of double-hit). `TacticalScene
  .syncUnits()` diffs `lastCombat.seq` — the same "ever-increasing counter,
  diffed against a last-seen value" pattern already established for loot
  toasts (`nextItemInstance`) — and plays the attack beat, then (after a
  350ms `COMBAT_BEAT_DELAY_MS`) the counter beat, via a new
  `playCombatSequence()`. Every other HP change (heals, regen, skills)
  keeps using the original instant diff; only the two unit ids `lastCombat`
  names get routed to the new sequenced path. A fatal beat's target/
  attacker sprite is captured before `syncUnits()`'s own cleanup pass can
  remove it from `this.unitSprites` (it's still mid fade-out, just no
  longer in that map), and every delayed touch checks `sprite.scene !==
  undefined` first — the same "destroyed GameObject" hazard `create()`'s
  reset-block comment already documents for a different scenario (a stale
  scene restart), reachable here too if a mid-sequence restart lands
  between the attack beat and the delayed counter beat.
  No input lock and no `COMBAT_FINISHED` event yet (HANDOFF.md §7's item 3)
  — the move's already fully resolved by the time this plays, so queuing
  another action mid-sequence is rendering-order sloppiness today, not a
  correctness bug, but real input-gating is still open before a full
  overlay scene (the other half of the discussion) can own a board-hidden
  transition.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the last shipped baseline exactly (0/30 wiped, mean wave 7.27,
  max 8) — this is presentation-only, the sim harness never touches Phaser
  and `G.lastCombat` isn't read by any move/logic. A temp headless script
  drove `attackUnit` directly (queued `random.Number()` values for
  deterministic hit/miss/crit) through five real exchanges — miss (no
  counter), hit+counter-hit, hit+counter-miss, a lethal hit (counter is
  null even though the target would otherwise be in range — a kill
  prevents any counter), and `seq` incrementing across two separate
  exchanges — all passing. No Playwright pass — the repo owner will judge
  the feel of the sequencing themselves (HANDOFF.md §11).
- 2026-08-28 Claude: Rebalanced promotion so it's always a power gain, per
  the repo owner. Through this change, `promoteUnit` (classes.ts) reset a
  unit's level to 1 on promotion and evaluated the new class's stats there
  — since `LEVEL_GROWTH` is flat and identical for every class (+1 Atk, +1
  Def, +2 maxHp/level), that discarded every level of growth earned before
  promoting and replaced it with just the new class's base: a level-10
  Swordsman promoting to Swordmaster dropped from 18/14/42 (Atk/Def/maxHp)
  to 11/6/28 — a real stat *cut*, not the power spike a promotion is
  supposed to be. Fixed by not resetting the level: `promoteUnit` now calls
  `statsAtLevel(nextClass, unit.level)`, so the new class's curve picks up
  from the level the unit already reached. Advanced classes' `CLASS_STATS`
  were already tuned higher than their base class's — that difference *is*
  the promotion's power jump, it just needed evaluating at the right level.
  `exp` is no longer reset either (no reason to waste in-progress exp). A
  class's own stat *identity* still comes through — Fighter->Berserker
  still trades 1 Def for +3 Atk at the same level, a deliberate glass-cannon
  archetype choice in `CLASS_STATS`, not something this fix papers over —
  but total power always goes up.
  `PromotionPicker`'s stat-comparison screen now reads both classes at the
  unit's current level (was: current level vs. new class's level 1).
  `npm run sim`'s AI harness used to decline every promotion offered
  specifically to avoid skewing survival numbers against the old stat drop
  — now that promoting is a real gain, it auto-promotes into each eligible
  unit's first branch instead (`promoteAllIntoFirstBranch`, simulate.ts).
  Verified: `typecheck`/`build`/`validate-maps` clean. A temp headless
  script confirmed level/exp survive promotion unchanged, Atk/Def/maxHp
  never drop for a same-archetype promotion (Swordsman->Swordmaster), that
  Fighter->Berserker's total power (Atk+Def+maxHp) still rises even with
  its deliberate -1 Def trade, and that an invalid promotion is still a
  no-op. `sim -- --batch 30` — unlike every other change today, this one is
  *expected* to move the baseline, since the harness now actually uses
  promotion instead of avoiding it: still 0/30 wiped (same survival floor),
  but mean wave reached rose from 7.00 to 7.27 (max 7 -> 8), confirming the
  fix is a real improvement, not just a stat-math change with no in-game
  effect. No Playwright pass — the repo owner will feel the difference
  testing it themselves (HANDOFF.md §11).
- 2026-08-28 Claude: Enemy classes with both an `_f128`/`_m128` art variant
  now use both, per the repo owner (noticed for Archer specifically —
  `public/enemy/archer_f128.png` and `archer_m128.png` both exist, but only
  the `_f` one was ever wired in). `heroArt.ts`'s enemy-art table
  (`ENEMY_CLASS_SPRITE_BASENAMES`, renamed from the old singular
  `ENEMY_CLASS_SPRITE_BASENAME`) now lists every available basename per
  class instead of hardcoding one — Archer, Lancer, Assassin, Mercenary,
  and Dark Mage all had a second variant sitting unused in `public/enemy/`
  and now use it too; classes with only one file (Swordsman, Barbarian,
  General, Thief) are unaffected. Which variant a given enemy renders as is
  picked once, deterministically, from a stable seed (a unit's own `id`, or
  a `DialogueLine.speaker` name for campaign dialogue) via a new
  `enemyClassTextureKeyFor()` — not re-rolled per render, which would make
  the same archer flicker between the `_f`/`_m` art across
  `UnitSprite`/`UnitStatusBar`/`CombatForecastPanel`/`DialoguePanel` or even
  frame to frame in the same one. `TacticalScene.preload()` now loads every
  listed basename per class instead of just one.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (art-only change, doesn't touch
  `game.ts`/`classes.ts`'s actual rules). A temp headless script confirmed
  `enemyClassTextureKeyFor` is stable per seed (same id always resolves to
  the same key), that both Archer variants actually turn up across many
  distinct unit ids (not always picking index 0), and that single-variant
  classes and classes with no enemy art still resolve exactly as before.
  No Playwright pass — the repo owner will confirm the variety visually
  themselves (HANDOFF.md §11).
- 2026-08-28 Claude: Fixed a real bug the repo owner hit testing yesterday's
  graphical forecast/status-bar work: **enemy art in `UnitStatusBar`
  rendered grayscale during the player's own turn**, as if every enemy had
  already acted. `Unit.hasActed` only resets at the start of *that unit's
  own* team's turn (game.ts's `turn.onBegin`), so an enemy unit stays
  `hasActed: true` for the player's entire turn — it doesn't clear until
  the enemy's own next turn begins. `UnitStatusBar.show()` was dimming
  straight off that raw flag, so any enemy tapped mid-player-turn looked
  permanently "spent." `UnitSprite`'s on-board rendering already solved
  this exact problem (its `sync()` takes an explicit `dimmed` boolean from
  the caller rather than reading `hasActed` alone — see its own doc
  comment) but `UnitStatusBar` never got the same treatment when it was
  built. Applied the identical fix: `show()` now takes a `dimmed` parameter,
  and all 5 call sites (`TacticalScene`'s four, `UIScene`'s
  `refreshUnitStatusBar()`) compute it the same way `syncUnits()` already
  does for the on-board sprites — `unit.hasActed && unit.team ===
  teamOf(ctx.currentPlayer)`.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (UI-only fix). No Playwright pass
  — the repo owner found this by testing themselves and will confirm the
  fix the same way (HANDOFF.md §11).
- 2026-08-28 Claude: Graphical combat forecast screen, per the repo owner
  (reference: Fire Emblem Fates/Awakening's own combat prediction screens).
  New `CombatForecastPanel` (`src/ui/`) replaces the old plain-text confirm
  card for basic attacks — attacker and defender portraits face off
  (resolved through the same fallback chain `UnitStatusBar` already uses:
  bust portrait, then map sprite, then anonymous enemy-class art, then the
  class-letter placeholder), each with a name banner, an equipped-weapon
  label (`ITEMS`, equipment.ts — falls back to the unit's class name for
  every enemy, since `Unit.equipment` is only ever populated for player
  units), and a bordered HP bar (enemy always red, matching the on-board
  sprite/`UnitStatusBar` convention). Below that, two stat columns read
  straight off the same `CombatForecast` the old text card did — no new
  math, just a new face: the attacker's `forecast.attack` (Dmg/Hit/Crit) on
  the left, the defender's `forecast.counter` on the right, or "Cannot
  Counter" in its place when the defender is out of range. A terrain note
  still shows when the defender is standing on a tile that grants Def or
  Avoid.
  Skill previews (`enterSkillConfirm`) are untouched — still the original
  plain-text `ForecastPanel`, kept deliberately separate rather than
  stretched to fit both: a basic attack always has the same "two units, an
  exchange of hit/dmg/crit, maybe a counter" shape, but a skill preview
  covers heals/buffs/AoE too, which don't map onto attacker/defender stat
  columns. `formatAttackForecast` (the old text-line formatter for attacks)
  is gone — nothing calls it anymore.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (UI-only change, doesn't touch
  `game.ts`/`classes.ts`/`combat.ts`). No Playwright pass this time either —
  per the repo owner's standing preference (HANDOFF.md §11), they're
  testing this one visually themselves.
- 2026-08-28 Claude: Split the main menu's Campaign section into three rows,
  per the repo owner. It used to be one "Continue" row (when a save
  exists) plus a flat "New: <chapter name>" row per campaign chapter,
  growing by one row every time a chapter gets added. Now: **New Game**
  (starts Chapter 1 fresh, same as the old first "New:" row), **Load
  Game** (only shown when a `localStorage` save exists — same behavior as
  the old "Continue" row, just renamed to pair with New Game), and
  **Chapter Select**, which now hands off to its own scene
  (`ChapterSelectScene`) listing every individual chapter to jump straight
  into. The old all-in-one scene is split into two: `MainMenuScene`
  (`main.ts`'s first real scene now, `BootScene` hands off to it) owns mode
  selection, `ChapterSelectScene` is now purely the per-chapter picker
  (plus a Back button). Both share a new `menuBackground.ts` helper for the
  full-bleed background + scrim so they read as one visual space instead of
  a flash/reload between them. Updated the two places that used to send the
  player back to `'ChapterSelect'` after a battle (`TacticalScene`'s
  `returnToMainMenu()` and `finishCampaignContinue()`) to target
  `'MainMenu'` instead, since "go back" should land on the actual main
  menu, not the chapter list.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (menu-only change, doesn't touch
  `game.ts`/`classes.ts`). No Playwright pass — the repo owner tests in a
  real browser themselves (HANDOFF.md §11).
- 2026-08-28 Claude: Fixed a real bug the repo owner hit in the actual
  build, plus a follow-up to the System Menu's new Main Menu option from
  earlier today:
  1. **Roguelike booted into a stale campaign chapter after returning to
     the main menu.** `ChapterSelectScene.startRoguelike()` called
     `this.scene.start('Tactical')` with no data argument — Phaser's
     `Systems.start(data)` only overwrites `settings.data` when `data` is
     truthy, so a previous campaign run's `TacticalSceneData` (`mode:
     'campaign'`, a real `chapterId`, etc.) was still sitting there, and
     `TacticalScene.create()` read it straight back. Repro: play a campaign
     chapter, System Menu -> Main Menu, then Start Run — it silently
     booted the same campaign chapter instead of the roguelike map. Fixed
     by passing an explicit `{ mode: 'roguelike' }` instead of omitting the
     argument, matching the other two call sites
     (`startCampaignChapter`/`continueCampaign`), which already always
     passed explicit data and were never affected.
  2. **Main Menu now confirms before leaving.** New generic `ConfirmDialog`
     (`src/ui/`, same centered/dimmed-backdrop shape as `BlessingPicker`/
     `DialoguePanel`, tapping the backdrop cancels like `SystemMenu`'s own
     backdrop) — `onSystemMenuChosen`'s `'main-menu'` branch now shows
     "Return to the main menu? This battle's progress will be lost." before
     calling `returnToMainMenu()`. Restart Battle deliberately stays
     unconfirmed (it's a fresh attempt at the same fight, not a dead end
     the way leaving to the main menu is).
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (neither change touches
  `game.ts`/`classes.ts`). No Playwright pass — the repo owner tests in a
  real browser themselves now (see HANDOFF.md §11).
- 2026-08-28 Claude: Two follow-ups to yesterday's dialogue rendering, per
  the repo owner:
  1. **`DialoguePanel` redesigned as a centered, dimmed modal** instead of
     the bottom-anchored bar it originally shipped with — matches
     `BlessingPicker`/`PromotionPicker`'s treatment (0.7-alpha backdrop)
     rather than being the one panel that left the board visible
     underneath. The portrait slot now shows the **speaking unit's actual
     map sprite** (`heroArt.ts`'s `heroTextureKey`, the same texture
     `UnitSprite` renders on the board — not the separate bust-portrait
     art category `UnitStatusBar` prefers), falling back to the enemy-class
     sprite for an unnamed enemy speaker (Gate Chief/Vale Captain ->
     Barbarian) and finally to the existing class-letter placeholder if
     neither resolves — same three-tier convention `UnitStatusBar`'s own
     portrait slot already established, just resolved from
     `DialogueLine.speaker`/`.portraitClass` instead of a live `Unit`. Also
     added a **Skip** button (top-right of the card) that dismisses the
     entire remaining script in one tap, distinct from tapping the backdrop
     to advance one line at a time.
  2. **"Main Menu" added to the System Menu** (the dock's bottom-right
     "Menu" button) — `SystemMenuChoice` gets a `'main-menu'` option
     between Restart Battle and Cancel; `TacticalScene`'s new
     `returnToMainMenu()` does the same `scene.stop('UI')` +
     `scene.start('ChapterSelect')` pairing `finishCampaignContinue()`
     already uses on a real chapter clear, so a mid-battle exit tears down
     the same way a real one does. No confirmation prompt — matches
     Restart Battle, the existing option right above it, which also
     abandons the current battle with no "are you sure."
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (neither change touches
  `game.ts`/`classes.ts`). Per the repo owner's own request, no Playwright
  screenshot pass this time — they're testing this round themselves.
- 2026-08-27 Claude: Campaign dialogue rendering — the last "Not built yet"
  item from campaign mode's launch now actually reads `ChapterDef.intro`/
  `.outro` and `story.ts`'s mid-battle `MapEvent` triggers, instead of the
  data sitting unread. New bottom-anchored `DialoguePanel` (`src/ui/`,
  `Card`/`Button` kit, tap-to-advance, class-letter portrait tinted by
  `DialogueLine.side`) wired into `TacticalScene` at three points: `create()`
  suspends input and shows `chapter.intro` before the board goes live (a new
  `lookupCampaignChapter()` helper replaces the one already inlined in
  `finishCampaignContinue()`); a new `scheduleAutoAdvance()` branch tracks
  per-team `turnCounts` (for `story.ts`'s `turnReached` trigger, nothing else
  tracked this) and fires the first not-yet-fired `MapEvent` whose
  `isTriggerMet()` is true, re-entering itself on completion so two events
  that become true simultaneously both fire in sequence instead of only the
  first; `continueCampaign()` shows the cleared chapter's `outro` (if any)
  before the promotion picker / chapter-select handoff it already drove.
  Also **rewrote both authored chapters' intro/outro/event dialogue to the
  current 6-hero roster** (`maps.ts`, speaker/portraitClass only, line text
  unchanged) — the existing content spoke through Eirika/Corrin/Lissa/Selva/
  Ike, an older cast that predates this session's roster reshuffle and
  doesn't match any current squad member; per the repo owner, reassigned
  rather than left broken (Jill/Ephraim/Natasha/Solen/Marisa each pick up a
  class-matched voice; Lyn doesn't get a line in either chapter — no
  Archer-flavored line existed to reassign, flagged as a future-content gap
  rather than invented).
  **Found and fixed a real bug while verifying, not part of the plan**:
  `TacticalScene.create()`'s new intro-dialogue call ran `this.ui
  .showDialogue(...)` synchronously right after `this.scene.launch('UI', ...)`
  — but launching a scene only queues its `create()`, it doesn't run it
  inline, so `this.ui.dialoguePanel` didn't exist yet on that same call
  stack. Any campaign chapter with an intro (both authored chapters have
  one) would have thrown a `TypeError` immediately on boot. Fixed by
  deferring the intro call to `this.ui.events.once('create', ...)` — Phaser's
  own signal that the UI scene's `create()` has actually finished — instead
  of assuming same-frame execution. Every other `this.ui.*` call in the file
  stays untouched: those are all driven by later player input, by which
  point both scenes have long since finished their first frame.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (the sim harness never boots a
  campaign chapter or touches `story.ts`, so this is the expected no-op
  result, not a false pass). A temp headless script cross-checked every
  authored dialogue line's `portraitClass` against the real roster's actual
  class (via `buildGameState`) and every real `MapEvent` trigger
  (`gate-chief-falls`, `march-second-wave`, `march-breach-center`,
  `march-garrison-thinning`, `march-captain-falls`) against `isTriggerMet`,
  all passing. Playwright (temporary debug hooks — a `?debugChapter=` boot
  skip and a `debugKillUnit` move for reaching a specific battle state
  reliably, both fully reverted after) drove all three flows end to end on
  Chapter 1: intro shown before the board went live, cycled through all 4
  lines on tap, dismissed into normal play; `gate-chief-falls` killed via a
  real move dispatch (not direct state mutation — `client.getState().G` is
  Immer-frozen in dev, so a raw `delete` silently no-ops) correctly
  interrupted play with its 2-line script and resumed after; `outro` shown
  (3 lines) before the chapter-select handoff, confirming the promotion
  picker is correctly skipped for a level-1 squad with nobody eligible yet.
- 2026-08-27 Claude: Two more fixes/features, per the repo owner:
  1. **Enemy HP bars are now always red with a border** (`UnitSprite.ts`'s
     on-board bar and `UnitStatusBar.ts`'s panel bar), instead of the same
     HP-ratio traffic-light coloring player units use — reads as "this is
     an enemy" before the eye even gets to the HP amount. Player bars are
     unchanged.
  2. **Promotion is now a two-screen flow** (`PromotionPicker.ts` rewrite)
     instead of one screen with inline branch buttons and no detail: a
     **list** of eligible units (tap one to open it, Continue always
     available to finish with whatever's picked so far); then a per-unit
     **detail** screen with a tab per branch option (skipped for a
     single-option class), a full stat-change comparison (current level
     vs. the new class's level 1, colored green/red per stat — makes the
     "promotion resets to level 1" stat dip [see HANDOFF.md's Promotion
     section, "Worth knowing"] fully visible before committing, instead of
     a surprise), and the new class's active skill(s) with descriptions.
     `resolvePromotions`/`game.ts` untouched — this is purely
     `PromotionPicker`'s own internal layout, still confirming the same
     `{unitId, toClass}[]` shape it always did. Every element position is
     computed via a running layout cursor, then shifted into place once
     the total content height is known — the only way to lay out the
     detail screen's variable-length wrapped skill descriptions without
     guessing a fixed height per skill.
  Verified: `typecheck`/`build`/`validate-maps` clean (this doesn't touch
  `game.ts`/`classes.ts`, so `sim` doesn't apply — headless sim never
  renders Phaser/UI at all). Playwright (temporary debug hook, reverted)
  drove the full new flow end to end: opened a single-branch unit's detail
  screen (no tabs, matching old UX), promoted it, confirmed the list
  reflected the pick; opened a two-branch unit, switched tabs and watched
  the stat/skill detail update live, promoted the other branch; hit
  Continue and confirmed the callback received exactly the expected
  `{unitId, toClass}[]` for both units. Also incidentally confirmed the
  enemy HP bar fix and the trimmed random-enemy pool (v0.16.2) are both
  rendering correctly in the same screenshots.
- 2026-08-27 Claude: Three small fixes from the repo owner's own testing
  pass on today's class-tree rework:
  1. **Status bar bug**: selecting a unit (showing its walkable tiles),
     then tapping a *different* unit that wasn't itself selectable (an
     already-acted ally, an enemy out of quick-attack range) correctly
     refreshed `UnitStatusBar` to that unit (`onTileClicked`'s
     `'unit-selected'` branch already did this), but the very next line
     always fell through to `finishSelection()`, which — unconditionally —
     re-showed the *original* (now-deselected) unit, clobbering that
     refresh back to stale info. Fixed by having `finishSelection()` take
     an optional `skipStatusBarRefresh` flag, set only at that one call
     site (`TacticalScene.ts`).
  2. **Random enemy pool trimmed to classes with real art**: `ALL_CLASSES`
     (`classes.ts`, drawn from by `spawnWave`/`randomClass: true` units)
     was letting several classes with no `heroArt.ts` enemy sprite spawn
     as random mobs, rendering as the generic circle+letter placeholder —
     now correctly rare/intentional-looking rather than "half the enemies
     are broken." Trimmed to the 9 classes that actually have anonymous
     enemy art (Swordsman/Archer/Lancer/Barbarian/General/Thief/Assassin/
     Mercenary/Dark Mage) — Mage/Cleric/Dancer (no art, predates today) and
     Fighter (new base class, also no art yet) all drop out of the random
     pool until art exists; none of this affects the named hero roster,
     which is never drawn from this pool. Add a class back here the moment
     it gets real enemy art.
  3. **5x EXP for testing** — see "In progress" above; temporary, revert
     `TESTING_EXP_MULTIPLIER` to 1 once the testing pass wraps up.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  still matches the historical baseline exactly (30/30 wave cap) even with
  5x EXP driving far more promotion offers per run (the harness still
  declines them all, per the Part 3 entry below). Playwright reproduced
  the exact status-bar bug (select a unit, tap a distant enemy, confirm
  the panel showed the enemy and stayed there) and confirmed the trimmed
  enemy pool — every random spawn in the test run rendered with real
  sprite art, no placeholder circles.
- 2026-08-27 Claude: Main menu redesign (`ChapterSelectScene`, plus a
  matching touch-up to `BootScene`'s splash) — per the repo owner, it "look
  weird in mobile and not beautiful." The old menu was a flat navy screen
  with two bare text headings and buttons clustered at the top, leaving
  most of a tall phone viewport empty. Now: a full-bleed background (the
  same painted map art `TEST_MAP_2` already uses, `public/maps/river1.jpg`,
  darkened with a scrim for legibility — no new asset), the real game logo
  (`public/project selvaria icon.png`, previously unused anywhere but the
  repo root) in place of plain "Project Selvaria" text, and both mode
  sections consolidated into one `Card` panel (matching every other panel
  in the game) with a divider between Roguelike/Campaign and the primary
  action in each section (Start Run, Continue) accent-colored to stand out.
  The whole logo+card block is computed and vertically centered as one
  group, so the layout balances regardless of viewport aspect ratio instead
  of pinning to the top. `BootScene`'s brief title beat now shows the same
  logo instead of plain text too, for consistent first impression.
  Verified: `typecheck`/`build` clean (no game-logic touched, so `sim`/
  `validate-maps` don't apply here). Playwright confirmed the redesigned
  menu at two phone viewports (390x844 and 428x926) balances well at both,
  the splash screen, the 3-row "Continue" layout when a campaign save
  exists, and that "Start Run" still actually boots the battle scene (no
  functional regression from the layout rewrite).
- 2026-08-27 Claude: New class content (class tree rework, Part 3 of 3 —
  the rework is now complete). Added a **Fighter** base class plus 9 new
  advanced classes (Swordmaster, Sniper, Lancemaster, Sorcerer, Sage,
  Priest, Hero, Berserker, Axe Master — `classes.ts`'s `CLASS_STATS`, 22
  classes total now) and wired the full promotion tree (`PROMOTES_TO`):
  Swordsman->[Swordmaster], Archer->[Sniper], Lancer->[Lancemaster,
  General], Mage->[Sorcerer, Sage], Cleric->[Priest], Mercenary->[Hero],
  Thief->[Assassin] (unchanged), Fighter->[Berserker, Axe Master] — Lancer
  and Mage are the first real branch points, proving Part 2's mechanism on
  actual content. Jill reclasses Barbarian -> Fighter (all 6 chapters,
  `maps.ts`) so she has a promotion path — Barbarian is now enemy-only.
  Each new class got a new skill (`skills.ts`): Heavy Swing, Triple Strike,
  Deadeye, Armor Pierce, Meteor, Sanctuary, Vital Strike, Bloodlust, True
  Strike, plus **Sage's two independent skills** (Arcane Bolt + Arcane
  Ward) — the first class to actually use Part 1's multi-skill capacity.
  Arcane Ward is also the game's first **buff** mechanic: `Unit.buffAtk`/
  `buffTurns`, folded into `effectiveStats()` and decremented in
  `turn.onBegin`, mirroring Curse's existing debuff shape but positive-sign
  and self-targeted. `CLASS_LETTER` (`classIcons.ts`) got the 10 new
  letters; no enemy art is wired for any of them yet, so they render with
  the existing circle+letter placeholder, same as every class that's
  launched before its art existed.
  **Found and fixed a real bug while verifying, not part of the plan**:
  `npm run sim`'s headless AI harness never handled `G.awaitingPromotion`
  (only `G.awaitingBlessing`) — harmless while only Thief->Assassin
  existed (rarely reachable within a sim's short window), but now that
  *every* starting class can promote, a run reliably stalls forever the
  moment any unit dings level 10, since the paused wave-clear never
  resolves. Fixed by having the sim decline every promotion offered
  (`resolvePromotions([])`, a fully valid "skip" already built into the
  move) rather than auto-accepting one — auto-accepting was tried first
  and made 87% of runs *wipe*, because promoting resets a unit to level 1
  (a locked design decision from earlier this session, "matching classic
  FE promotion feel") and the advanced classes' level-1 base stats don't
  come close to covering what a level-10 unit in the old class had grown
  — a real, working-as-designed trade a player would need to time
  carefully, but not one a dumb "always promote" heuristic should be
  exercising when the point of this batch is measuring baseline survival.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  matches the historical baseline exactly (30/30 wave cap, wave 7 min/
  median/mean/max) with promotions declined, confirming the new content
  doesn't silently reshape roguelike difficulty on its own. A temporary
  script (deleted after, not committed) exercised the real new content
  directly: Jill spawns as Fighter with the documented stats; the full
  branch tree is live (Lancer/Mage/Fighter each show 2 options, Barbarian/
  Dancer/Dark Mage still show none); promoting a Mage to each of Sorcerer
  and Sage independently produces the right resulting class and level-1
  stats; Sage's two skills are on independent cooldowns (using one leaves
  the other's cooldown untouched); and `effectiveStats()` correctly folds
  in Arcane Ward's buffAtk. Playwright (temporary source edits, reverted
  after — a real hero briefly set to Sage, a debug call to pop the
  branch-picker with real Mage options) confirmed the picker renders a
  real 2-branch class correctly and that the status bar's 2-skill layout
  (built generically back in Part 1, never previously exercised by a real
  2-skill class) actually renders both rows without overlap.
- 2026-08-27 Claude: Branching promotion infrastructure (class tree
  rework, Part 2 of 3 — Part 3 below finishes the rework). `PROMOTES_TO`
  (`src/game/classes.ts`) changed from `Partial<Record<ClassName,
  ClassName>>` to `Partial<Record<ClassName, ClassName[]>>` — a base class
  can now offer more than one advanced option (nothing does yet; today's
  only live entry, `Thief: ['Assassin']`, still has exactly one, so this
  ships as pure architecture with **zero player-visible change** against
  current data). `promoteUnit` gained a required `toClass` param,
  validated against the unit's own `PROMOTES_TO` options (a mismatch is a
  silent no-op, not a crash — same defensive shape as any other
  stale/forged move). `resolvePromotions` (`game.ts`) now takes
  `{unitId, toClass}[]` instead of a bare `unitId[]`, revalidating each
  pair before applying it. `PromotionPicker` (`src/ui/`) was redesigned
  from one toggle-per-unit to one row per unit with a cluster of branch
  buttons (a single-option unit still renders one full-width button,
  identical to before) — mutually exclusive within a unit's own row,
  selection tracked as `Map<unitId, ClassName>` instead of a `Set` of
  unit ids. Both call sites in `TacticalScene.ts` (end-of-wave and
  end-of-chapter promotion) updated to build `toClassOptions` from
  `PROMOTES_TO` and thread the picker's `{unitId, toClass}[]` result
  through instead of re-deriving the class from a fixed 1:1 mapping.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  produced the same 30/30-wave-cap result as the Part-1 baseline (the AI
  never triggers a real promotion in that batch, same as before). A
  temporary script (deleted after, not committed) temporarily seeded
  `PROMOTES_TO.Thief` with a second option (`['Assassin', 'Mercenary']`)
  to exercise the branching path for real: called `promoteUnit` with each
  branch independently and confirmed the right resulting class/stats for
  both, confirmed an illegal branch (not in the unit's own options) is a
  no-op, and called the real `resolvePromotions` move directly with one
  valid and one forged `{unitId, toClass}` pair, confirming the valid one
  applied, the forged one was silently ignored, and the wave-transition
  tail still ran — then the seed was reverted before shipping. Playwright
  (via a temporary debug hook, also reverted) confirmed the picker itself:
  a single-option unit renders one full-width button, a two-option unit
  renders side-by-side buttons that highlight mutually exclusively
  (tapping the second clears the first, doesn't add to it), multiple
  units can be selected independently, and Continue's callback received
  the exact expected `{unitId, toClass}[]`.
- 2026-08-27 Claude: Multi-skill infrastructure (class tree rework, Part 1
  of 3 — see "In progress"). `SKILLS` (`src/game/skills.ts`) changed shape
  from `Record<ClassName, SkillDef>` to `Record<ClassName, SkillDef[]>`,
  and `Unit.skillCooldown: number` became `Unit.skillCooldowns:
  Record<string, number>` keyed by skill id — every one of the 12 existing
  classes still has exactly one skill, wrapped in a 1-element array, so
  this ships as pure architecture with **zero player-visible change**; it
  exists so a future class (Sage, in Part 3) can carry two independent
  skills on separate cooldowns with no further plumbing. `useSkill` gained
  a `skillId` middle argument (`useSkill(unitId, skillId, targetId)`);
  `skillRange`/`skillTargets`/`canUseSkill`/`describeSkillEffect`
  (`skills.ts`) all take an explicit `SkillDef` now instead of resolving
  `SKILLS[unit.className]` internally. `TacticalScene`'s action menu loops
  over a unit's skill array, one menu option per skill (`skill:${id}`
  choice ids — `ActionMenu.ts`'s `ActionMenuChoice` widened to a template
  literal type); a new `selectedSkillId` field threads the choice through
  targeting/confirm. `UnitStatusBar`'s skill row became up to 2 rows in
  the same fixed footprint — a single-skill class (all of them, today)
  renders byte-for-byte the same as before.
  Verified: `typecheck`/`build`/`validate-maps` clean; `sim -- --batch 30`
  produced the exact same 30/30-wave-cap result as the pre-Part-1
  baseline, proving the refactor didn't move any numbers. Since the
  headless AI never calls `useSkill` (it only moves/attacks/waits), that
  alone doesn't exercise the new code — so a temporary script (deleted
  after, not committed) drove a real seeded `Client` through actual AI
  play until a unit had a legal in-range skill use, called the new 3-arg
  `useSkill`, and asserted: the move was accepted, `skillCooldowns[id]`
  was set to the skill's cooldown (not the old scalar), it ticked down on
  the unit's own next turn, and reached 0 (ready) again on schedule — an
  actual run hit this via Lyn's Snipe. Playwright confirmed the single-
  skill status bar row (e.g. Marisa's "Snatch — Ready") renders unchanged,
  and that the action menu still correctly omits any skill option when no
  target is in range from the selected tile.
- 2026-08-27 Claude: Campaign mode is reachable for the first time — a main
  menu (`ChapterSelectScene`, now the game's first scene) picks Roguelike
  or a Campaign chapter (fresh, or Continue from a save). Closes out the
  promotion plan's "part 2" and the standing "no chapter select" gap
  (`README`'s old "Not built yet" line, `HANDOFF.md` §4).
  `createGameClient` (`systems/gameClient.ts`) takes `mode`/`chapter`/
  `carryOver`/`baseLevel` now instead of hardcoding the roguelike game
  object; `TacticalScene` reads them via a new `init(data)`, defaulting to
  today's exact roguelike behavior when nothing's passed (`BootScene`'s
  old direct hand-off, or anything else that doesn't know about chapter
  selection). `restartBattle()` re-passes that data explicitly — Phaser's
  `scene.restart()` doesn't automatically re-supply `init()`'s data on its
  own, which would've silently dropped a campaign battle back to the
  roguelike default on restart.
  Clearing a `'rout'` campaign chapter now does something: builds a real
  `CampaignCarryOver` from the surviving squad's level/exp/equipment
  (`TacticalScene.continueCampaign()`), offers promotion to anyone
  eligible first (reusing `PromotionPicker`, applied to the carry-over
  record being built rather than a live unit, since the match is already
  over), saves via the already-existing but previously-uncalled
  `save.ts`/`storage.ts`, and returns to Chapter Select. `CampaignCarryOver`
  gained a `className?` field so a promoted unit's new class carries into
  the next chapter (`buildGameState`, `maps.ts`, reads it as an override).
  Verified end-to-end in the browser, not just headlessly: typecheck/
  build/validate-maps/sim (30-batch, unaffected — the roguelike default
  path is provably unchanged) all clean; Playwright confirmed the menu,
  the unaffected "Start Run" path, a fresh campaign chapter starting at
  the documented `PLAYER_START_LEVEL + chapterIndex`, a real chapter
  clear (driven via direct move dispatch, not blind UI taps, since the
  actual click-to-quick-attack sequencing proved too fragile to script
  reliably) producing the new "CHAPTER CLEAR" screen, Continue building
  and saving a correct carry-over, Chapter Select then offering "Continue
  — The Long March", and — seeding a save directly to test the promotion
  path without replaying combat — a unit's carried `className` override
  (e.g. "Assassin") correctly replacing the next chapter's authored
  default class on load.
  Story rendering (chapter `intro`/`outro` dialogue, mid-battle map
  events) is still unbuilt — campaign chapters play through without their
  narrative beats for now; see the corrected note in HANDOFF.md §4 (its
  old "all implemented and working" claim was wrong — only the pure
  trigger-evaluation logic and data exist, nothing renders it).
- 2026-08-27 Claude: Wired the first promotion pair (Thief -> Assassin,
  `classes.ts`'s `PROMOTES_TO`) and reshuffled the 6-hero roster
  (`maps.ts`, across all 6 chapters) so it's actually reachable in a real
  playthrough: **Jill** (Barbarian), **Marisa** (Thief — new to the
  lineup, chosen specifically so the wired pair has a real unit to level),
  **Ephraim** (Lancer), **Lyn** (moved from Swordsman to Archer),
  **Solen** (Mage — also new), **Natasha** (Cleric). Eirika and Takumi
  drop out of the starting lineup (still valid heroes with their own art,
  just not deployed) — one hero per class again, no duplicates.
  Verified with typecheck/build/validate-maps/sim (30-batch: 30/30 reached
  the wave cap this roster, vs. 28/30 previously — a genuinely different
  balance profile, not a bug, from swapping which classes are in play),
  plus Playwright confirming all 6 heroes render their real art with no
  broken textures or console errors.
  Also ran a real end-to-end promotion check (a temporary headless script,
  not part of the repo): with a throwaway lowered level threshold, the
  live roster's Eirika/Lyn/Natasha promoted correctly through the real
  `resolvePromotions` move. With the real level-10 threshold and no
  threshold hack, 5 AI-driven seeded runs (20-wave cap each) never
  actually got Marisa to level 10 in time — she consistently died before
  other units reached level 40+, so nobody triggered a real promotion in
  those runs. That's the built-in AI's play pattern for a fragile,
  low-HP/low-Def class like Thief, not a bug in the promotion pipeline
  itself (already proven correct above) — a human player keeping Marisa
  safe should reach level 10 well before wave 20. Worth a real playtest.
- 2026-08-27 Claude: Class promotion, part 1 of 2 (roguelike wave-end).
  Reworked the class system toward base -> advanced pairs: promoting
  swaps a unit's class entirely (stats reset to the new class's level 1,
  full heal, its one active skill swaps automatically since `SKILLS` is
  already keyed by class — `classes.ts`'s new `promoteUnit`). Gated at
  level 10 (`PROMOTION_LEVEL`) and only for a class with an entry in
  `PROMOTES_TO` — that table ships **empty on purpose**; which classes
  pair into which is a separate decision not made yet, so the feature is
  fully wired but dormant until it's filled in (a one-line data edit,
  same pattern as `heroArt.ts`'s named-hero lookup).
  The prompt appears after a wave clears, following the blessing pick —
  `chooseBlessing` (`game.ts`) now pauses on a new `awaitingPromotion`
  flag instead of spawning the next wave directly, if anyone's eligible;
  a new `resolvePromotions` move (mirrors `chooseBlessing`'s structure)
  promotes whichever units the player selects — all eligible units at
  once, not one-at-a-time — then continues, via a `finishWaveTransition`
  helper both moves now share. New `PromotionPicker` UI (`src/ui/`)
  mirrors `BlessingPicker`'s container/show/hide pattern but as a
  multi-select checklist instead of pick-one.
  Verified two ways: `npm run typecheck`/`build`/`sim -- --batch
  30`/`validate-maps` all clean and identical to the pre-change baseline
  (expected — an empty `PROMOTES_TO` means no unit is ever eligible, so
  `chooseBlessing` takes the exact same code path as before). Then, with
  a throwaway temporary seed (`PROMOTION_LEVEL = 5`, one temp pairing)
  and a small headless script driving the real `Client`/moves
  end-to-end (not part of the repo, deleted after), confirmed the whole
  pipeline for real: eligibility detection, the pause, `resolvePromotions`
  correctly promoting multiple units in one call with correct new
  stats/skill/full-heal, and the wave correctly advancing afterward.
  Campaign mode's end-of-chapter promotion (the other locked-in trigger
  point) is a separate, larger piece — campaign mode has no live
  chapter-to-chapter flow at all yet (see the entry below) — tracked
  separately, not done here.
- 2026-08-26 Claude: Jill's portrait was replaced with a proper 150×250
  portrait-shaped crop (supplied directly, not Claude's earlier square
  crop). `UnitStatusBar`'s portrait slot was forcing every portrait/sprite
  into a square display size regardless of its actual shape, which would
  have squished the new tall portrait — `show()` now scales whatever
  texture's showing (portrait, hero map sprite, or enemy-class sprite) to
  fit inside the box at its own aspect ratio instead, so the 128×128 square
  sprites still land square (unchanged) and the portrait now displays at
  its real proportions.
- 2026-08-26 Claude: 5 new classes — General, Thief, Assassin, Mercenary,
  Dark Mage — plus anonymous enemy-class art for 7 of the game's 12 classes
  (see CREDITS.md). Design discussion first (`tactical-rpg-design` skill's
  "overlap is fine, redundancy isn't" rule): of the 9 enemy-art class names
  that shipped in the 2026-08-26 art commit, Fighter and Spearfighter had no
  identity distinct from Swordsman/Lancer, so their art became those two
  classes' enemy skin instead of new classes; the other 7 (2 existing —
  Archer, Barbarian — plus the 5 new ones) got real anonymous enemy art
  (`heroArt.ts`'s new `ENEMY_ART_CLASSES`/`enemyClassTextureKey`,
  `UnitSprite`/`UnitStatusBar` fall back to it for any enemy with no named-
  hero art). `b_eirika128.png` wasn't touched — reads as a boss/named unit,
  not a class skin.
  New class stats/skills (`classes.ts`, `skills.ts`): General (HP32/Def10/
  Mov2, Shield Slam ignores terrain avoid) is the tank niche nothing else
  filled; Thief (Mov5, Snatch heals the Thief for damage dealt) and
  Assassin (Crit35, Execute bonus damage vs. a wounded target) are two
  independent standalone classes, not a promotion pair — the game has no
  promotion system yet, so that was staying in scope; Mercenary (Hit90,
  Focused Strike adds flat Hit/Crit to one swing) is a reliable duelist,
  distinct from Barbarian's crit-gambling brawler. Dark Mage's Curse is the
  first debuff in the game — a small new mechanic (`Unit.debuffDef`/
  `debuffTurns`, decremented in `turn.onBegin` the same way skillCooldown
  is, folded into `effectiveStats()`'s Def so every damage/hit calculation
  picks it up for free) rather than a Mage reskin, so it has a real
  identity: Curse lowers a target's Def for 2 turns.
  Verified with typecheck/build/validate-maps/a 30-batch sim (all classes
  get exercised through `ALL_CLASSES`-driven roguelike waves), and
  confirmed live in Playwright — a wave spawned a "Dark Mage Shadow" with
  the right stats, skill, and real enemy art on both the board sprite and
  the status panel, with no page errors.
- 2026-08-26 Claude: Fixed the hero art the 2026-08-26 art commit broke, and
  wired in the first bust portrait. That commit renamed every hero map
  sprite to add a `128` suffix (`eirika.png` -> `eirika128.png`) and two
  don't lowercase-match their filename at all (`Ephraim` -> `emphraim128.png`,
  a typo in the source file; `L'Arachel` -> `larachel128.png`, punctuation
  stripped) — `heroArt.ts` now has an explicit override table for those two
  and everything else derives `<name>128.png`, so all 24 named heroes (the
  original 6 plus 18 new ones added in that commit) resolve correctly again.
  The 18 new heroes aren't in any chapter's roster yet — art-only for now,
  roster growth is a separate decision. `public/portrait/jill.png` (a
  1024x1024 bust, a new higher-detail art category from the 128px map
  sprites) is cropped square around the face/shoulders, background keyed
  to transparent, downscaled to 256x256, and now shows in
  `UnitStatusBar`'s portrait slot in place of the map sprite when a unit
  has one (`heroArt.ts`'s new `HERO_PORTRAIT_NAMES`/`heroPortraitTextureKey`,
  same layered-fallback pattern as the map sprites). The enemy-class
  sprites that same commit added aren't wired in yet — their filenames
  don't map to any existing class, so that's pending a class-roster design
  discussion.
- 2026-08-26 Claude: Custom favicon. `public/favicon.png` is now a 32×32
  crop of the shield emblem from `public/project selvaria icon.png` (the
  project's logo, added in the same commit as the new unit/enemy/portrait
  art), replacing the old generic Phaser-template icon. The "PROJECT
  SELVARIA" wordmark under the shield was cropped out since it isn't
  legible at favicon size; `index.html`'s existing `<link rel="icon">`
  needed no change since the path and MIME type already matched.
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
