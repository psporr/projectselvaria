# Art Brief: Unit Sprites & Portraits

Written for whoever draws the custom art for Project Selvaria (per the
2026-08-22 decision to commission real art rather than use generic asset
packs — see README's Project Status). Hand this to the artist directly;
everything here is scoped to be a reasonable v1 ask, not a full character
art bible.

## Status (2026-08-25)

**The plan below shipped differently than originally specced, and the
difference is now the actual convention going forward** — this section
describes what's real; §1's original spec further down is kept for
historical context but no longer describes what to draw.

6 named-hero map sprites are in (`public/units/*.png`, wired through
`heroArt.ts` into both `UnitSprite`'s on-board token and
`UnitStatusBar`'s portrait slot at two different display sizes off the one
file): **Eirika, Ephraim, Jill, Lyn, Natasha, Takumi.** Two changes from
the original spec:

- **128×128px, not 48×48.** Large enough to double as the `UnitStatusBar`
  portrait (native-ish size there) as well as the small on-board token
  (scaled down) — one file serves both instead of a separate portrait
  phase later. Draw at 128×128 going forward; the game scales down for the
  board automatically.
- **One unique full-color piece per specific named hero, not one
  neutral-palette piece per class.** No runtime team-tint — each
  character is hand-painted in their own palette (GBA Fire Emblem's own
  convention, actually, more than the tint-based approach originally
  specced). This means there's no "one sprite covers both teams" shortcut:
  every hero who needs art needs their own painting, and **enemies
  currently stay the flat-circle placeholder** (a deliberate short-term
  choice, not an oversight — see `HANDOFF.md`/README if that's changed).

Remaining roster without art yet, in case more sprites are coming: Byleth,
Corrin, Selva, Lissa, Olivia (`src/game/maps.ts` has the full 12-hero
roster and each one's class).

**Framing consistency note for future sprites:** the first batch varied in
how much of the 128×128 canvas each character's actual content fills (some
characters nearly edge-to-edge, others in a much smaller centered box) —
worth aiming for a consistent scale across characters so they read as the
same "camera distance" once several sit on the board together.

## Status (2026-08-26)

Two things line 33-34 above no longer describes:

- **18 more named-hero map sprites landed** (Amelia, Claude, Dmitri,
  Edelgard, Eliwood, Forde, Hector, Ike, Joshua, L'Arachel, Lissa, Lute,
  Lyon, Marisa, Mikoto, Sakura, Solen, Velouria — 24 total now,
  `heroArt.ts`'s `HERO_SPRITE_NAMES`), but none are in any chapter's
  starting roster yet — that's a separate decision from having the art.
- **Enemies now have real art.** A same-day batch of anonymous enemy-class
  sprites (`public/enemy/*.png`) shipped alongside the hero batch, plus 5
  new classes to go with them (General, Thief, Assassin, Mercenary, Dark
  Mage — a 2026-08-26 class-roster design pass; see `classes.ts`/
  `skills.ts`). An enemy with no name match now falls back to its class's
  enemy art if it has one (`heroArt.ts`'s `ENEMY_ART_CLASSES`) before
  falling back further to the circle+letter placeholder — no longer "stays
  the flat-circle placeholder" unconditionally. Two of the original 7
  classes' enemy art came from sprites that didn't become classes
  themselves (Fighter's art -> Swordsman's enemy skin, Spearfighter's art
  -> Lancer's) since neither had a tactical identity distinct from an
  existing class.
- **Portraits arrived too**, ahead of the "later" this doc's Sequencing
  section below still describes: `public/portrait/jill.png`, a 1024×1024
  bust cropped/keyed down for `UnitStatusBar`'s portrait slot
  (`heroArt.ts`'s `HERO_PORTRAIT_NAMES`). Same "add a name, it just
  resolves" pattern as the map sprites.

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

## 2. Terrain tileset (shipped 2026-09-01, removed 2026-09-02)

32×32px tiles covering Plain, Forest, Wall, Water (`src/game/types.ts`'s
`Terrain`) — one representative tile per type, cropped from a free,
third-party set (McMagister's "32px FE-style Tileset," CC BY-SA 3.0 — see
CREDITS.md for the exact source crops and license terms) rather than
commissioned. Wired in `TacticalScene.ts`'s `drawBoard()`, replacing the
flat-color `TERRAIN_COLOR` fill it used before.

**Removed 2026-09-02, per the repo owner** — didn't look good in-game; a
replacement is pending (the repo owner is sourcing one). The gap is open
again exactly as it was before 2026-09-01: `drawBoard()` is back to
`TERRAIN_COLOR`'s flat fill for any chapter without its own painted
background image. Whatever art lands next can drop into the same
`hasArt`-guarded slot that constant's own comment points to — no other
code needs to change.

**Decided 2026-08-23: this stays a permanent second way to author a map,
not a stopgap the painted-image pipeline replaces.** Two proven paths
exist for a chapter's board, and a chapter picks whichever fits it:

- **Hand-authored tileset** (this section) — an ASCII `rows` grid
  (`src/game/maps.ts`'s `LEGEND`) rendered as a tile sprite per cell from a
  terrain tileset. This is every hand-built chapter's approach
  (`CAMPAIGN_CHAPTER_1`/`2` — Iron Gate, The Long March).
- **Painted map image** — a full painted map image classified into the
  same `rows` grid via per-pixel color clustering (documented inline in
  `src/game/maps.ts` above `RIVER_CROSSING`), rendered as a single
  background image instead of per-tile sprites (`TacticalScene.ts`'s
  `CHAPTERS_WITH_BACKGROUND_ART`) — `RIVER_CROSSING`, the Roguelike mode's
  permanent map, is built this way.

Same `ChapterDef`/`rows` grid either way — the only difference is what
`TacticalScene` draws underneath it (tile sprites vs. one image), so
picking one doesn't foreclose the other for a later chapter.

## 3. Portraits (retired 2026-09-01, was "later")

Was speccing close-up bust portraits for dialogue/combat-forecast panels,
one per named player character. Dropped instead, per the repo owner:
every panel that shows a unit's likeness (`UnitStatusBar`,
`CombatForecastPanel`, `CombatOverlayScene`) now uses the same on-board
map sprite everywhere (`heroArt.ts`'s `resolveUnitArtTexture`) rather than
maintaining a separate higher-detail art category for one of them.
`public/portrait/jill.png`, the one bust that had shipped, was removed
along with the `HERO_PORTRAIT_NAMES` pipeline that loaded it — see
CREDITS.md for the asset's own history.

## Delivery & integration

- **Actual location (2026-08-25): `public/units/<name>.png`**, lowercase
  hero first name, loaded by `TacticalScene.preload()` and looked up via
  `heroArt.ts`'s `heroTextureKey()` — not `src/assets/` as originally
  planned here (Vite's `public/` convention matches how `public/maps/*.png`
  background art already loads, so map sprites followed the same pattern
  once it came time to actually wire them in).
- Adding a new hero's art is now just two steps: drop
  `public/units/<name>.png` (128×128, transparent, see the framing-
  consistency note above) and add that name (lowercase) to `heroArt.ts`'s
  `HERO_SPRITE_NAMES` — `UnitSprite` and `UnitStatusBar` both pick it up
  automatically for any unit whose display name matches, no other code
  change needed.
- Artist credit recorded in `CREDITS.md`.
