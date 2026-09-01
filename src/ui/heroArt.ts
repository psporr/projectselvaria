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
 * Bust portraits (`public/portrait/<name>.png`) — a separate, higher-detail
 * art category from the map sprites above (ART_BRIEF.md's originally-
 * deferred "Portraits (later)" section), shown in UnitStatusBar's portrait
 * slot instead of the map sprite when a unit has one. Falls back to the map
 * sprite, then the letter placeholder, same layered pattern as everywhere
 * else in this file.
 */
export const HERO_PORTRAIT_NAMES = ['jill'] as const;

/** Phaser texture key a given unit's display name loads its bust portrait under, if it has one. */
export function heroPortraitTextureKey(unitName: string): string {
  return `portrait-${unitName.toLowerCase()}`;
}

/**
 * Frame-based animated map art (2026-08-31, source pipeline replaced
 * 2026-09-01) — idle/attack, a separate category from the single-PNG
 * `HERO_SPRITE_NAMES` above. Each name here has a `public/aseprite/
 * <name>.aseprite` source file (a handful of poses on one fixed canvas —
 * cheap to produce, unlike a full commissioned animation set) run through
 * `npm run extract-aseprite` to produce `public/heroes/<name>-atlas.png`/
 * `.json` (see that script's own doc comment for the extraction method).
 * `UnitSprite` checks this list *before* `HERO_SPRITE_NAMES` — an animated
 * name takes priority if a unit somehow matched both.
 */
export const ANIMATED_HERO_NAMES = ['luffy', 'zoro'] as const;

/**
 * Every static art source in this file — `HERO_SPRITE_NAMES` map sprites,
 * `HERO_PORTRAIT_NAMES` busts, and the anonymous enemy-class art — is drawn
 * facing left (confirmed by the repo owner, 2026-08-31). The animated
 * sources are the opposite (`heroAnimations.ts`'s `ANIMATED_ART_FACES_RIGHT`
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
 * Anonymous enemy-class art (`public/enemy/*.png`) — only ever applies to
 * enemy-team units with no name match above (heroes always render as
 * themselves, never as their class). Fighter and Spearfighter didn't become
 * their own `ClassName`s (2026-08-26 class-roster discussion — no distinct
 * tactical identity from Swordsman/Lancer beyond flavor), so their art
 * became those two classes' enemy skin instead. Several classes have both a
 * `_f128`/`_m128` variant in the asset folder — rather than hardcoding one
 * per class (as this file did through 2026-08-28), every available variant
 * is listed and a specific unit/dialogue speaker picks between them
 * deterministically (`enemyClassTextureKeyFor` below); `Unit` still has no
 * gender field, this just means "which piece of art" instead of "which
 * gender" (v1 approach the doc comment 2 lines up used to reference, now
 * moot). `b_eirika128.png` isn't wired here — it reads as a specific
 * boss/named enemy unit, not a class skin.
 */
const ENEMY_CLASS_SPRITE_BASENAMES: Partial<Record<string, readonly string[]>> = {
  Swordsman: ['fighter_m128'],
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

/**
 * The three-tier portrait fallback (bust portrait, then map sprite, then
 * anonymous enemy-class art) shared by `CombatForecastPanel` and
 * `CombatOverlayScene`. `UnitStatusBar` keeps its own copy — it reads
 * `unit.team`/`unit.hasActed` extras these two don't need, and inlines the
 * result into a texture swap on a long-lived Image rather than resolving a
 * key up front. Returns undefined when a unit has no art at all, leaving the
 * caller to fall back to its own class-letter placeholder.
 */
export function resolveBattlePortraitTexture(scene: Scene, unit: Unit): string | undefined {
  const portraitKey = heroPortraitTextureKey(unit.name);
  if (scene.textures.exists(portraitKey)) return portraitKey;
  const heroKey = heroTextureKey(unit.name);
  if (scene.textures.exists(heroKey)) return heroKey;
  if (unit.team === 'enemy') {
    const enemyKey = enemyClassTextureKeyFor(unit.className, unit.id);
    if (enemyKey && scene.textures.exists(enemyKey)) return enemyKey;
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
