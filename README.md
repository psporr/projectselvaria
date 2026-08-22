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
  colored). A **Squad** button opens an **equip screen** per unit. **End Turn**
  button instantly advances the phase; **Danger Zone** toggle paints enemy
  threat ranges across the map; tapping an empty tile opens the tactical **System Menu**
  (End Turn, Squad, Danger Zone, Restart, Cancel). Victory/Defeat dialog includes
  interactive battle restart. Enemy turns still auto-play.
- Portrait/mobile scaling fixed: `Scale.FIT` + `CENTER_BOTH` on a 480x854
  base, verified at real phone/tablet/desktop viewports.
- Rendering is DPR-aware (`src/systems/viewport.ts`) — the canvas backing
  store scales with device pixel ratio (capped at 2x) instead of a fixed
  size the browser stretches, fixing blur on real phones while preventing
  GPU fill-rate bottlenecks. 60 FPS cap and high-performance WebGL settings
  prevent mobile thermal throttling. Every scene's own layout math is untouched
  (still authored against the 480x854 logical space); `applyDprZoom()` handles
  the compensating camera zoom + centering.
  If you add a new `Scene`, call `applyDprZoom(this)` in `create()`; if you
  add a new `Text` object anywhere, give it `resolution: DPR`.

### Not built yet

- `CombatOverlayScene` (HANDOFF.md §7 phase 2 — GBA-style combat presentation)
- Campaign chapters in the UI (maps/story exist in `src/game/`, no chapter
  select or dialogue rendering)
- Multiplayer, mobile app wrap (both explicitly deferred, HANDOFF.md §9/§10)

### In progress

*(Add a line here when you start something. Format: `- [Name] what, since when`.)*

### Recent changes

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
