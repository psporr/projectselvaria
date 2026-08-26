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
