# Credits

## Skills

**Phaser 4 Agent Skills** (`.claude/skills/phaser/`) — copied verbatim from
[`phaserjs/phaser`](https://github.com/phaserjs/phaser)'s own `skills/`
directory, by Phaser Studio Inc. Licensed under the
[MIT License](https://github.com/phaserjs/phaser/blob/master/LICENSE.md).
28 skills covering scenes, tweens, particles, tilemaps, cameras, input, audio,
physics (Arcade + Matter), filters/postFX, and Phaser 4's new rendering
features. Unmodified; re-copy from upstream periodically to stay current.

## Scaffold

Project boilerplate (`index.html`, `public/style.css`, `vite/config.*.mjs`)
adapted from Phaser Studio's official
[`phaserjs/template-vite-ts`](https://github.com/phaserjs/template-vite-ts),
MIT licensed, Copyright (c) 2025 Phaser Studio Inc. The template's build-time
analytics ping (`log.js`) was dropped. `public/favicon.png` started as this
template's generic icon; replaced 2026-08-26 (see Art below).

## Art

Hero map sprites (`public/units/*.png` — Eirika, Ephraim, Jill, Lyn,
Natasha, Takumi, added 2026-08-25) are original pixel art, hand-drawn for
this project by a friend of the developer. No external license involved.

18 more named-hero map sprites (Amelia, Claude, Dmitri, Edelgard, Eliwood,
Forde, Hector, Ike, Joshua, L'Arachel, Lissa, Lute, Lyon, Marisa, Mikoto,
Sakura, Solen, Velouria) and 15 anonymous enemy-class sprites
(`public/enemy/*.png`) were added 2026-08-26, same source as above. The new
heroes aren't in any chapter's roster yet, but their art resolves correctly
the moment they are. The enemy sprites are wired in as anonymous enemy art (`heroArt.ts`'s
`ENEMY_ART_CLASSES`): 7 mapped to their same-named class — 2 existing
(Archer, Barbarian), 5 new ones added the same day (General, Thief,
Assassin, Mercenary, Dark Mage — a 2026-08-26 class-roster expansion, see
README) — and 2 more (Fighter, Spearfighter) folded in as the enemy skin
for Swordsman/Lancer since they didn't earn distinct classes of their own.
`b_eirika128.png` isn't wired in — it reads as a specific boss/named enemy
unit, not a class skin, so it's unused pending a story decision.

`public/portrait/jill.png` (added 2026-08-26, same source) is a bust
portrait — the first of a separate, higher-detail art category from the
map sprites (`ART_BRIEF.md`'s "Portraits (later)" section). Originally
cropped square by Claude; replaced 2026-08-26 with a 150×250 portrait-
shaped crop supplied directly, which `UnitStatusBar`'s portrait slot now
displays at its real aspect ratio (scaled to fit, not squished to a
square) in place of the map sprite when a unit has one.

`public/favicon.png` (added 2026-08-26) is a 32×32 crop of the shield
emblem from `public/project selvaria icon.png` (the project's logo,
original art, same source as the hero sprites above) — the "PROJECT
SELVARIA" wordmark underneath the shield was cropped out since it isn't
legible at favicon size.

**Terrain tileset** (`public/tiles/plain.png`, `forest.png`, `wall.png`,
`water.png`, added 2026-09-01, per the repo owner) fills `ART_BRIEF.md` §2's
long-open gap — a real tile per `TerrainType` in place of the flat color
fills `TacticalScene.ts`'s `TERRAIN_COLOR` used to draw. One representative
32×32 tile per terrain type, cropped from **McMagister's "32px FE-style
Tileset"** ([`McMagister/srpg-studio-stuff`](https://github.com/McMagister/srpg-studio-stuff),
`32px FE-style Tileset/Graphics/mapchip/`), licensed
[**CC BY-SA 3.0**](https://creativecommons.org/licenses/by-sa/3.0/) —
attribution required, and any redistributed derivative of the tileset
itself must stay under a compatible license (the game's own code is
unaffected; this applies to the art files). Source crops: `plain.png` from
`Grass.png` (0,0); `forest.png` from `Trees.png` (128,32); `wall.png` from
`Mountains.png` (0,0); `water.png` from the dedicated
`!8#WaterAnimation.png` sheet's first frame (0,0) — the `Rivers.png` sheet
itself is a bounded river/lake autotile with no pure open-water tile at any
position, so the standalone water-animation sheet was the actual source for
a flat water fill. Wired in `TacticalScene.ts`'s `drawBoard()`: a chapter
without its own painted background image (`CHAPTERS_WITH_BACKGROUND_ART`)
now draws one of these per grid cell instead of a solid color rectangle —
Chapter 1 (The Iron Gate) and Chapter 2 (The Long March) are the first to
show it. No auto-tiled edge blending between neighboring cells (v1 scope,
matching the brief) — one static tile per type.

## Design lineage

`HANDOFF.md` carries the game design, rules, and technical lessons forward
from [`psporr/winteremblem`](https://github.com/psporr/winteremblem), the
original prototype. See that repo's own `CREDITS.md` for the third-party art
and audio assets used there — none of those asset files are copied into this
repo; new assets are being sourced for Phaser fresh.
