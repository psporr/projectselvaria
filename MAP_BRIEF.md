# Map Brief: Generating a Battle Map with Gemini

Companion to `ART_BRIEF.md` (character art) — this one's for the painted-
map-image half of the two map-authoring paths decided 2026-08-23 (see
README's Project Status). Use this whenever generating a new chapter's
background art with Gemini.

## Why the prompt is this specific

This game's board is a strict grid: every tile is read independently as
one of 4 terrain types (`src/game/maps.ts`'s `LEGEND`), and `TacticalScene`
stretches the generated image to fit that grid exactly. Two failure modes
already happened once each while building `TEST_MAP_1` and are designed
out below:

- **Terrain features smaller than one grid cell get lost.** A rock outcrop
  or tree clump that's only a fraction of a cell reads as "mostly plain"
  once that cell's classified — the fix was making every terrain feature
  roughly cell-sized or bigger, which the prompt asks for directly instead
  of hoping it works out.
- **Forest and mountain/wall look alike in a painted style** (both read as
  "a dark clump" at a glance) — the prompt asks for a specific, distinct
  palette per terrain type so they're unambiguous even before any
  classification happens.

Asking Gemini to hand back the terrain grid as text alongside the image
(rather than classifying pixels after the fact, like `TEST_MAP_1`'s first
pass did) skips the whole color-clustering pipeline — worth trying first;
fall back to pixel classification only if the returned grid doesn't
actually match what it drew.

## Picking a grid size first

Decide **columns × rows** before prompting — it's baked into the prompt
(aspect ratio) and can't be changed after the fact without a re-crop.
`TacticalScene` fits the board into a fixed on-screen budget and picks
the largest tile size that fits both dimensions, so size is a real
gameplay concern, not just aesthetics — too many columns/rows shrinks
every tile and makes them harder to tap on a phone. Good presets (all
land at a comfortable ~56–64px tile, matching the existing chapters):

| Columns × Rows | Aspect ratio | Tile size |
| --- | --- | --- |
| 6 × 8 | 3:4 (portrait) | 64px — what `TEST_MAP_1` uses |
| 7 × 8 | ~7:8 (near-square) | 64px — what `CHAPTER_1` uses |
| 5 × 8 | 5:8 (tall portrait) | 64px |
| 6 × 9 | 2:3 (portrait) | 56px |

Stick to 6–7 columns and 8–9 rows unless there's a specific reason to go
bigger — this game is portrait/phone-first, and a wider or taller map
than these presets makes every tile noticeably smaller.

## The prompt

Copy this into Gemini, filling in the two bracketed spots:

> Generate a top-down (bird's-eye, directly overhead, no perspective tilt
> or isometric angle) painted battle map for a Fire Emblem–style tactical
> RPG, in a **[6 columns × 8 rows]** grid, portrait aspect ratio **[3:4]**.
> Theme: **[e.g. "a river valley with a stone bridge crossing, forested
> banks, and a rocky outcrop"]**.
>
> The map must be readable as exactly a **6×8 grid of tiles**, each tile
> one of 4 terrain types, and every terrain feature must be roughly one
> full grid-tile in size or larger — no detail smaller than a tile, since
> smaller features won't read correctly when the map is used as game data.
> Use a clearly distinct color/texture per terrain type so they're never
> ambiguous at a glance:
>
> - **Plain** (open, walkable): bright grass green or open dirt/sand path
> - **Forest** (walkable, distinct from plain): saturated dark green,
>   visible individual treetops/canopy texture
> - **Wall** (impassable — mountain, cliff, or rock): gray/brown stone
>   texture with visible rock facets — must NOT read as green or be
>   confusable with forest
> - **Water** (impassable — river, lake): blue tones, clearly distinct
>   from the other three
>
> Flat, even lighting across the whole image — no strong directional
> shadow, vignette, or gradient that darkens one side or corner, since
> that would bias how the tiles are read. No characters, units, creatures,
> or people anywhere on the map (they're rendered separately by the game).
> No text, labels, UI, legend, border, or watermark baked into the image.
> All open (plain/forest) tiles must form a single connected region — no
> patch of walkable ground sealed off entirely by water or mountain with
> no path around it.
>
> Alongside the image, also write out the terrain grid as plain text: one
> line per row (top to bottom), one character per column (left to right,
> matching the image exactly), using exactly these characters and nothing
> else: `.` for plain, `f` for forest, `#` for wall, `w` for water.

## After it comes back

1. **Check the aspect ratio matches the requested grid** — if Gemini
   returned a different ratio than asked, either re-prompt or accept a
   slight stretch (`TacticalScene` force-fits the image to the board's
   pixel size regardless, so a mismatch just looks slightly stretched,
   it won't break).
2. **Eyeball the returned text grid against the image** — spot-check a
   handful of cells (especially anything near the wall/water/forest
   boundary) to confirm the text actually matches what's drawn. If it's
   off, either correct it by hand off the image or fall back to the
   pixel-classification approach `TEST_MAP_1`'s first pass used (ask
   Claude to re-derive the grid from the image directly).
3. **Save the image** to `public/maps/<chapter-id>.png`.
4. **Paste the grid** into a new `ChapterDef` in `src/game/maps.ts`
   (`rows: [...]`, one string per row) and register the chapter id in
   `TacticalScene.ts`'s `CHAPTERS_WITH_BACKGROUND_ART` map.
5. **Run `npm run validate-maps`** — it checks every unit spawn lands on
   passable ground and that all passable tiles are one connected region;
   fix anything it flags before picking unit spawn positions.
