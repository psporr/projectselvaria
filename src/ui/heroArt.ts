import type { Scene } from 'phaser';

import type { Unit } from '../game/types';

/**
 * Named-hero map sprites — one hand-drawn PNG per specific character
 * (`public/units/<name>128.png`), not the class-generic/team-tinted
 * convention `ART_BRIEF.md` originally specced (see its 2026-08-25 update).
 * A unit only gets real art if its display `name` matches one of these;
 * everyone else (every enemy, and any hero not yet drawn) keeps the
 * circle+class-letter placeholder (`UnitSprite`/`UnitStatusBar`'s own
 * fallback branch) — so adding a name here is the entire integration step
 * for a new piece of art, no code change needed elsewhere. None of the 18
 * added 2026-08-26 (everyone below `takumi`) are in any chapter's starting
 * roster yet — that's a separate decision — but their art loads and
 * resolves correctly the moment a unit with a matching name exists.
 */
export const HERO_SPRITE_NAMES = [
  'eirika',
  'ephraim',
  'jill',
  'lyn',
  'natasha',
  'takumi',
  'amelia',
  'claude',
  'dmitri',
  'edelgard',
  'eliwood',
  'forde',
  'hector',
  'ike',
  'joshua',
  "l'arachel",
  'lissa',
  'lute',
  'lyon',
  'marisa',
  'mikoto',
  'sakura',
  'solen',
  'velouria',
] as const;

/**
 * Sprite filenames don't all just lowercase to `<name>128.png` — a typo
 * baked into the source file (`ephraim` -> `emphraim128.png`) and
 * punctuation stripped from one filename (`l'arachel` -> `larachel128.png`)
 * need an explicit override rather than a smarter general rule.
 */
const SPRITE_FILE_OVERRIDES: Partial<Record<string, string>> = {
  ephraim: 'emphraim128',
  "l'arachel": 'larachel128',
};

/** `public/units/` filename (no extension) a given unit's display name loads its map sprite from, if it has real art. */
export function heroSpriteBasename(unitName: string): string {
  const key = unitName.toLowerCase();
  return SPRITE_FILE_OVERRIDES[key] ?? `${key}128`;
}

/** Phaser texture key a given unit's display name loads under, if it has real art. */
export function heroTextureKey(unitName: string): string {
  return `unit-${unitName.toLowerCase()}`;
}

/**
 * Frame-based animated map art (2026-08-31, source pipeline replaced
 * 2026-09-01) — idle/attack, a separate category from the single-PNG
 * `HERO_SPRITE_NAMES` above. Each name here has an `.aseprite` source file
 * under `public/aseprite/` (a handful of poses on one fixed canvas — cheap
 * to produce, unlike a full commissioned animation set) run through `npm
 * run extract-aseprite -- <source> <name>` to produce
 * `public/heroes/<name>-atlas.png`/`.json` (see that script's own doc
 * comment for the extraction method) — the source filename doesn't have to
 * match `<name>` (`gear5` here extracts from `luffy_gear5.aseprite`), only
 * the atlas output does, since that's the half every other lookup in this
 * file (`heroAnimAtlasKey`, `isAnimatedHero`) actually keys off. `UnitSprite`
 * checks this list *before* `HERO_SPRITE_NAMES` — an animated name takes
 * priority if a unit somehow matched both.
 */
export const ANIMATED_HERO_NAMES = ['luffy', 'zoro', 'gear5'] as const;

/**
 * Every static art source in this file — `HERO_SPRITE_NAMES` map sprites
 * and the anonymous enemy-class art — is drawn facing left (confirmed by
 * the repo owner, 2026-08-31). The animated sources are the opposite
 * (`heroAnimations.ts`'s `ANIMATED_ART_FACES_RIGHT`
 * — confirmed 2026-09-01 by rendering both `luffy.aseprite` and
 * `zoro.aseprite`'s extracted frames), which is why "which way does this
 * art face" has to be a fact each art source states rather than one flip
 * rule for the whole roster.
 */
export const STATIC_ART_FACES_RIGHT = false;

/**
 * Works out whether a sprite/image needs `setFlipX` to face a wanted
 * direction, given which way its art is actually drawn — shared by every
 * caller in `CombatOverlayScene` (static portraits here, animated heroes via
 * `heroAnimations.ts`'s `heroFlipX`) so a future art source only has to
 * state its own `artFacesRight`, not re-derive the boolean logic.
 */
export function artFlipX(artFacesRight: boolean, faceRight: boolean): boolean {
  return faceRight !== artFacesRight;
}

/** Whether `unitName` has frame-based animated art (checked before the static `HERO_SPRITE_NAMES`). */
export function isAnimatedHero(unitName: string): boolean {
  return (ANIMATED_HERO_NAMES as readonly string[]).includes(unitName.toLowerCase());
}

/**
 * Phaser atlas key a given animated hero's idle+attack frames load under —
 * one merged atlas per hero (`public/heroes/<name>-atlas.png`/`.json`),
 * unlike the old two-sheet split (idle/run sheet plus a separate attack
 * sheet) that pipeline needed when idle and attack came from two different
 * source images. A single `.aseprite` file holds every pose on one canvas,
 * so there's only ever one atlas to load per hero now.
 */
export function heroAnimAtlasKey(unitName: string): string {
  return `hero-anim-${unitName.toLowerCase()}`;
}

/**
 * Per-hero display-height correction for `heroAnimations.ts`'s
 * `heroAnimScale` (2026-09-04, per the repo owner — "luffy gear 5 look
 * small vs zoro, that because luffy gear 5 have effect on his head"). That
 * function normally scales every animated hero so its raw atlas frame
 * height matches the same on-board target — a safe assumption when frame
 * height is basically "how tall is this character," but Gear5's trademark
 * white hair eats close to half his 96px idle frame (`gear5-atlas.json`),
 * versus Zoro's 56px frame, which is tight to his body top-to-bottom.
 * Normalizing both by raw frame height left Gear5's actual torso/legs
 * visibly smaller than Zoro's or Luffy's at the same target height, even
 * though all three frames obey `extractAseprite.ts`'s per-hero union-bounds
 * crop correctly — that guarantee only promises *one hero's own* frames
 * stay pixel-stable relative to each other, never that two different
 * heroes' frames spend the same fraction of their height on hair/headwear
 * versus body. `1.3` was picked by rendering Gear5, Zoro, and Luffy side by
 * side at a few candidate multipliers and eyeballing which one brought
 * Gear5's shoulder/torso width in line with the other two — a per-hero
 * fudge factor, not derived from a formula, so it's fair game to retune by
 * eye again if it still doesn't look right in the actual game. Boosting
 * height also boosts width (`heroAnimScale`'s result feeds one uniform
 * `Sprite.setScale()`), so Gear5 ends up visibly taller overall too, hair
 * included — reads as the intended "imposing power-up" silhouette rather
 * than a bug, but worth knowing it's a side effect of there being no way to
 * scale just the body sub-region of a single texture frame.
 */
export const HERO_DISPLAY_SCALE: Partial<Record<string, number>> = {
  gear5: 1.3,
};

/**
 * Anonymous enemy-class art (`public/enemy/*.png`) — only ever applies to
 * enemy-team units with no name match above (heroes always render as
 * themselves, never as their class). `fighter_m128`/`spearfighter_*` were
 * originally Swordsman/Lancer's own enemy skin (2026-08-26 class-roster
 * discussion, back when Fighter/Spearfighter weren't their own
 * `ClassName`s) — Fighter has since become a real base class (Part 3
 * class-tree rework, 2026-08-27), so `fighter_m128` moved to it here
 * (2026-09-02, per the repo owner); Swordsman now has no enemy art of its
 * own and reads as an unfinished placeholder (circle+letter) until it gets
 * dedicated art. Spearfighter never became a `ClassName`, so Lancer keeps
 * `spearfighter_*`. Several classes have both a `_f128`/`_m128` variant in
 * the asset folder — rather than hardcoding one per class (as this file did
 * through 2026-08-28), every available variant is listed and a specific
 * unit/dialogue speaker picks between them deterministically
 * (`enemyClassTextureKeyFor` below); `Unit` still has no gender field, this
 * just means "which piece of art" instead of "which gender" (v1 approach
 * the doc comment 2 lines up used to reference, now moot). `b_eirika128.png`
 * isn't wired here — it reads as a specific boss/named enemy unit, not a
 * class skin.
 */
const ENEMY_CLASS_SPRITE_BASENAMES: Partial<Record<string, readonly string[]>> = {
  Fighter: ['fighter_m128'],
  Lancer: ['spearfighter_f128', 'spearfighter_m128'],
  Archer: ['archer_f128', 'archer_m128'],
  Barbarian: ['barbarian_m128'],
  General: ['general_m128'],
  Thief: ['theif_f128'], // typo baked into the source filename, not a repo typo
  Assassin: ['assassin_f128', 'assassin_m128'],
  Mercenary: ['mercenary_f128', 'mercenary_m128'],
  'Dark Mage': ['darkmage_f128', 'darkmage_m128'],
};

/** Classes with anonymous enemy art — TacticalScene.preload() loads every basename listed for each of these. */
export const ENEMY_ART_CLASSES = Object.keys(ENEMY_CLASS_SPRITE_BASENAMES);

/** Every `public/enemy/` basename (no extension) available for a class's anonymous enemy art — usually one, sometimes an m/f pair. */
export function enemyClassSpriteBasenames(className: string): readonly string[] {
  return ENEMY_CLASS_SPRITE_BASENAMES[className] ?? [];
}

/** Phaser texture key one specific enemy-art basename loads under. */
export function enemyBasenameTextureKey(basename: string): string {
  return `enemy-${basename}`;
}

/** A resolved art source: a plain texture (`frame` undefined), or one named frame of an atlas (animated heroes' `idle-0` — heroArt.ts's own still-image tier). */
export interface UnitArtRef {
  key: string;
  frame?: string;
}

/**
 * The art fallback (map sprite → animated-hero idle frame → anonymous
 * enemy-class art) shared by every panel that shows a unit's likeness —
 * `CombatForecastPanel` and `UnitStatusBar` (`CombatOverlayScene` calls
 * this too, but only for the non-animated branch of its own separate
 * `isAnimatedHero` check — it plays Luffy/Zoro's actual idle *animation*
 * there, not a single frame from it). Used to be a three-tier chain with a
 * dedicated bust-portrait category checked first; that category is retired
 * (2026-09-01, per the repo owner — every unit now shows the same map
 * sprite everywhere instead of a separate higher-detail art asset for one
 * panel).
 *
 * The animated-hero tier (2026-09-02, per the repo owner — "for unit that
 * use idle animation but dont have static sprite you can use first idle
 * frame for portrait") exists because `HERO_SPRITE_NAMES` and
 * `ANIMATED_HERO_NAMES` are two disjoint art categories: a name in the
 * latter never has a static `unit-<name>` texture to match on the tier
 * above, so without this a static-only panel (this function's callers,
 * unlike `UnitSprite`/`CombatOverlayScene` which play the real animation)
 * fell all the way through to the plain circle+letter placeholder for
 * Luffy/Zoro. `'idle-0'` is the same first-frame name every other
 * `heroAnimAtlasKey` consumer already hardcodes (`heroAnimations.ts`'s
 * `heroAnimScale`, `CombatOverlayScene`'s idle sprite, `UnitSprite`'s) —
 * not a new convention.
 *
 * Returns undefined when a unit has no art at all, leaving the caller to
 * fall back to its own class-letter placeholder.
 */
export function resolveUnitArtTexture(scene: Scene, unit: Unit): UnitArtRef | undefined {
  const heroKey = heroTextureKey(unit.name);
  if (scene.textures.exists(heroKey)) return { key: heroKey };
  if (isAnimatedHero(unit.name)) {
    const atlasKey = heroAnimAtlasKey(unit.name);
    if (scene.textures.exists(atlasKey)) return { key: atlasKey, frame: 'idle-0' };
  }
  if (unit.team === 'enemy') {
    const enemyKey = enemyClassTextureKeyFor(unit.className, unit.id);
    if (enemyKey && scene.textures.exists(enemyKey)) return { key: enemyKey };
  }
  return undefined;
}

/**
 * Fast, non-cryptographic string hash — only ever used below to turn a
 * stable id into a stable array index, never anything security-sensitive.
 */
function stableIndex(seed: string, count: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(hash) % count;
}

/**
 * Which of a class's enemy-art variants to render for one specific unit or
 * dialogue speaker — picked deterministically from `seed` (a unit's `id`,
 * or a `DialogueLine.speaker` name) rather than re-rolled on every render.
 * Has to be stable per seed, not random per call: the same enemy is drawn
 * repeatedly across many frames and panels (`UnitSprite`, `UnitStatusBar`,
 * `CombatForecastPanel`), and re-rolling independently in each would make
 * one archer flicker between the `_f`/`_m` art depending on which panel
 * last rendered it, or even frame to frame in the same one. A class with
 * only one variant (most of them) always resolves to it; a class with none
 * returns undefined the same way the old single-basename lookup did.
 */
export function enemyClassTextureKeyFor(className: string, seed: string): string | undefined {
  const basenames = enemyClassSpriteBasenames(className);
  if (basenames.length === 0) return undefined;
  return enemyBasenameTextureKey(basenames[stableIndex(seed, basenames.length)]);
}

// A "grayed out, already acted" look for hero art doesn't need a second
// baked texture per hero — Phaser 4's per-object Filters (its renamed
// successor to Phaser 3's FX; `Image.enableFilters()` +
// `filters.internal.addColorMatrix()`) apply `Display.ColorMatrix
// .grayscale()` live on the GPU, toggled via the filter controller's own
// `active` flag. See UnitSprite.ts's constructor/sync() (and
// UnitStatusBar.ts's matching portraitImage setup) for the actual usage —
// an earlier version of this file baked a desaturated PNG per hero via
// canvas pixel manipulation, which worked but cost double the texture
// memory for something this build already does natively in one line.
