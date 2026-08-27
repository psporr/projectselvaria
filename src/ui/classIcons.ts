import type { ClassName } from '../game/classes';

/**
 * Single-letter glyph for a class — used wherever there's no room for the
 * full name (`UnitSprite`, `UnitStatusBar`). Lives here rather than in
 * `src/game/classes.ts` because it's a presentation detail, not a rule: the
 * `game/` boundary is load-bearing (HANDOFF.md §7 — nothing in it may
 * import Phaser or know about rendering), and this is exactly the kind of
 * thing that boundary exists to keep out, even though it happens to have no
 * Phaser import itself today.
 */
export const CLASS_LETTER: Record<ClassName, string> = {
  Swordsman: 'S',
  Archer: 'A',
  Lancer: 'L',
  Mage: 'M',
  Barbarian: 'B',
  Cleric: 'C',
  Dancer: 'D',
  General: 'G',
  Thief: 'T',
  // Assassin and Mercenary can't use their own first letter (Archer, Mage
  // already claim A/M); Dark Mage can't use D (Dancer). Picked for visual
  // distinctness, not a mnemonic.
  Assassin: 'K',
  Mercenary: 'R',
  'Dark Mage': 'X',
  // Class-tree rework Part 3 (2026-08-27).
  Fighter: 'F',
  Swordmaster: 'W',
  Sniper: 'N',
  Lancemaster: 'V',
  Sorcerer: 'O',
  Sage: 'E',
  Priest: 'P',
  Hero: 'H',
  Berserker: 'Z',
  'Axe Master': 'U',
};
