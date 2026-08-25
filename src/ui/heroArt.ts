/**
 * Named-hero map sprites — one hand-drawn PNG per specific character
 * (`public/units/<name>.png`), not the class-generic/team-tinted convention
 * `ART_BRIEF.md` originally specced (see its 2026-08-25 update). A unit only
 * gets real art if its display `name` matches one of these; everyone else
 * (every enemy, and any hero not yet drawn) keeps the circle+class-letter
 * placeholder (`UnitSprite`/`UnitStatusBar`'s own fallback branch) — so
 * adding a name here is the entire integration step for a new piece of art,
 * no code change needed elsewhere.
 */
export const HERO_SPRITE_NAMES = ['eirika', 'ephraim', 'jill', 'lyn', 'natasha', 'takumi'] as const;

/** Phaser texture key a given unit's display name loads under, if it has real art. */
export function heroTextureKey(unitName: string): string {
  return `unit-${unitName.toLowerCase()}`;
}
