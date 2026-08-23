# Art Brief: Unit Sprites & Portraits

Written for whoever draws the custom art for Project Selvaria (per the
2026-08-22 decision to commission real art rather than use generic asset
packs — see README's Project Status). Hand this to the artist directly;
everything here is scoped to be a reasonable v1 ask, not a full character
art bible.

## Why this exists

The game currently renders every unit as a flat-colored circle with a
class-initial letter (`src/entities/UnitSprite.ts`) — functional but not
remotely "Fire Emblem." This brief specs the minimum art that replaces
that convincingly, sequenced so the highest-impact piece (map sprites)
ships first and the rest can follow later without redoing anything.

## Sequencing (decided 2026-08-22)

1. **Unit map sprites** — first priority.
2. **Terrain tileset** — deliberately held back to ship *together with* map
   sprites rather than separately, so the board doesn't look half-upgraded.
3. **Portraits** — later, once map sprites exist.

## 1. Unit map sprites (v1 scope)

**What's needed:** one standing/idle pose per class — **7 pieces of art**,
one for each class in the roster:

| Class | Player character | Notes |
| --- | --- | --- |
| Swordsman | Eirika | melee |
| Archer | Byleth | ranged (bow) |
| Lancer | Corrin | melee |
| Mage | Selva | ranged (spell) |
| Barbarian | Ike | melee, heavy |
| Cleric | Lissa | melee, support |
| Dancer | Olivia | melee, support |

Enemies reuse these same 7 class sprites (displayed as `"<Class> Shadow"`,
anonymous — see `HANDOFF.md` §4), just recolored — see "Team color" below.
**No separate enemy art needed.**

**Deliberately out of scope for v1:** walk-cycle animation, attack
animation, hit/death frames. A single static idle pose per class is
already a huge upgrade over the current circle+letter, and a full
animation set per class is a much larger ask — worth doing later as its
own pass once idle art is in and the game's overall look is validated.

### Technical spec

- **Canvas size:** 48×48px per sprite, transparent background. The board's
  tile size is 64×64 (`TacticalScene.ts`'s `TILE_SIZE`); the current
  placeholder circle is drawn at roughly 40px diameter (`tileSize * 0.32`
  radius) centered in the tile, so 48×48 leaves a comfortable margin
  without feeling cramped. This is a *fixed logical size* — the game
  auto-scales the whole canvas for device pixel density (`src/systems/
  viewport.ts`), so draw at 48×48 and it'll render crisply from a phone
  to a desktop without any extra sizes needed.
- **Anchor:** character centered in the frame (not bottom-anchored) — the
  game positions sprites by their center point, matching every other
  on-board element.
- **Format:** one PNG per class, named after the class in lowercase
  (`swordsman.png`, `archer.png`, `lancer.png`, `mage.png`, `barbarian.png`,
  `cleric.png`, `dancer.png`). No sprite sheet/atlas packing needed for v1
  — 7 individual files is simplest for both delivery and code integration.
- **Team color:** draw in a **single neutral palette** (doesn't need to be
  literally gray — just not already player-blue or enemy-red). The game
  applies team color at runtime via a tint (`UnitSprite`'s current
  `TEAM_COLOR` player `#4a90d9` / enemy `#d9534f`, `src/entities/
  UnitSprite.ts`), the same way the placeholder circles work now. This
  keeps the ask to 7 pieces instead of 14 — if you'd rather hand-paint
  both team palettes for a more polished, less flat-tinted look, that's
  also fine, just flag it so the loading code doesn't double-tint.
- **Style:** small/chibi proportions read best at this size and match the
  GBA-era Fire Emblem map-sprite convention (2-3 heads tall, exaggerated
  silhouette per class so they're readable at a glance — Swordsman's
  sword, Archer's bow, Mage's staff/tome, etc. should be identifiable even
  small). Palette should sit comfortably against the game's existing dark
  UI (`src/ui/kit.ts`'s palette: background `#1c2030`, blue accent
  `#4a90d9`, red accent `#d9534f`) — avoid anything that visually fights
  those.

## 2. Terrain tileset (held for later, spec'd for when it's time)

32×32 or 64×64px tiles (whichever the artist prefers — code will scale
either), covering: Plain, Forest, Wall, Water (`src/game/types.ts`'s
`Terrain`). Currently flat colors (`TacticalScene.ts`'s `TERRAIN_COLOR`).
Revisit sizing once map sprites are in hand and the overall visual scale
is locked.

## 3. Portraits (later)

Close-up bust portraits for dialogue/combat-forecast panels, one per
**named player character** (Eirika, Byleth, Corrin, Selva, Ike, Lissa,
Olivia — 7 portraits, not per-class, since these are specific people).
Enemies stay anonymous (no portrait needed) per the same naming
convention as map sprites. Size/format TBD when this phase starts —
likely a fixed square or portrait-aspect canvas sized against
`ForecastPanel`'s card width (`src/ui/ForecastPanel.ts`, currently 420px
wide capped to screen width).

## Delivery & integration

- Drop files in a new `src/assets/` directory (doesn't exist yet — the
  project has shipped zero art so far, confirmed via `CREDITS.md`).
- Once the 7 map-sprite PNGs exist, the loading/rendering code
  (`BootScene.ts` preload + `UnitSprite.ts` swapping its `Graphics` circle
  for a real texture) is a contained, low-risk change — happy to build
  that the moment files land, no need to wait for all 3 phases.
- Record the artist's name/license (or "original, no external license" —
  see how the old `winteremblem` prototype's art was credited) in
  `CREDITS.md` once delivered, matching the project's existing convention
  for tracking asset provenance.
