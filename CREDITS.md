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
(`public/enemy/*.png`) were added 2026-08-26, same source as above. None
are wired into the game yet — the new heroes aren't in any chapter's
roster, and the enemy sprites are pending a class-roster design pass before
they're mapped to any class.

`public/portrait/jill.png` (added 2026-08-26, same source) is a bust
portrait — the first of a separate, higher-detail art category from the
map sprites (`ART_BRIEF.md`'s "Portraits (later)" section). Cropped square
around the face/shoulders and its white background keyed to transparent to
fit `UnitStatusBar`'s portrait slot, which now shows it in place of the map
sprite when a unit has one.

`public/favicon.png` (added 2026-08-26) is a 32×32 crop of the shield
emblem from `public/project selvaria icon.png` (the project's logo,
original art, same source as the hero sprites above) — the "PROJECT
SELVARIA" wordmark underneath the shield was cropped out since it isn't
legible at favicon size.

## Design lineage

`HANDOFF.md` carries the game design, rules, and technical lessons forward
from [`psporr/winteremblem`](https://github.com/psporr/winteremblem), the
original prototype. See that repo's own `CREDITS.md` for the third-party art
and audio assets used there — none of those asset files are copied into this
repo; new assets are being sourced for Phaser fresh.
