import type { Unit } from './types';

/**
 * Base stats per class. A unit's className always determines its stats —
 * player and enemy units of the same class share the same numbers — so
 * balance changes happen in exactly one place.
 */
export type ClassName =
  | 'Swordsman'
  | 'Archer'
  | 'Lancer'
  | 'Mage'
  | 'Barbarian'
  | 'Cleric'
  | 'Dancer'
  | 'General'
  | 'Thief'
  | 'Assassin'
  | 'Mercenary'
  | 'Dark Mage';

export interface ClassStats {
  maxHp: number;
  atk: number;
  def: number;
  /** Movement points per turn. */
  move: number;
  /** Attack reach in tiles (Manhattan distance). 1 = melee, 2 = ranged. */
  range: number;
  /** Base chance (0-100) an attack connects, before terrain avoid. */
  hit: number;
  /** Base chance (0-100) a connecting attack is a critical hit. */
  crit: number;
}

/**
 * Stats at level 1.
 *
 * hit/crit are the rebuild's one genuine rules change (HANDOFF.md §3, Option
 * A): no new stats, just a flat rate per class, which gives each one
 * personality beyond raw numbers — Archer is reliable but rarely crits,
 * Barbarian swings wild but hits hard when it lands, Swordsman is solid at
 * both. These are a first-pass design (nothing to port from the old
 * prototype, which had no hit/crit at all) — tune against batch `npm run
 * sim` results, not by eye.
 *
 * Cleric and Dancer are stat-balanced as ordinary combatants for now — they
 * fight like any other class. Their classic Fire Emblem roles (healing
 * staff, refreshing an ally's turn) aren't implemented yet; these numbers
 * are a placeholder until that's built.
 */
export const CLASS_STATS: Record<ClassName, ClassStats> = {
  Swordsman: { maxHp: 24, atk: 9, def: 5, move: 3, range: 1, hit: 85, crit: 15 },
  Archer: { maxHp: 18, atk: 8, def: 3, move: 3, range: 2, hit: 95, crit: 5 },
  Lancer: { maxHp: 22, atk: 8, def: 6, move: 3, range: 1, hit: 80, crit: 10 },
  Mage: { maxHp: 16, atk: 9, def: 2, move: 3, range: 2, hit: 85, crit: 5 },
  Barbarian: { maxHp: 27, atk: 11, def: 3, move: 3, range: 1, hit: 65, crit: 25 },
  Cleric: { maxHp: 18, atk: 6, def: 4, move: 3, range: 1, hit: 80, crit: 5 },
  Dancer: { maxHp: 16, atk: 6, def: 2, move: 4, range: 1, hit: 85, crit: 5 },
  // Added 2026-08-26 alongside the enemy-class art commit — see skills.ts's
  // SKILLS for each one's signature ability and heroArt.ts for which classes
  // got real enemy art (Fighter/Spearfighter didn't become classes; their art
  // became alt skins for Swordsman/Lancer instead — see that file's comment).
  General: { maxHp: 32, atk: 8, def: 10, move: 2, range: 1, hit: 80, crit: 5 },
  Thief: { maxHp: 16, atk: 6, def: 2, move: 5, range: 1, hit: 90, crit: 10 },
  Assassin: { maxHp: 14, atk: 10, def: 2, move: 4, range: 1, hit: 75, crit: 35 },
  Mercenary: { maxHp: 20, atk: 8, def: 4, move: 3, range: 1, hit: 90, crit: 12 },
  'Dark Mage': { maxHp: 16, atk: 8, def: 3, move: 3, range: 2, hit: 85, crit: 5 },
};

export const ALL_CLASSES: ClassName[] = [
  'Swordsman',
  'Archer',
  'Lancer',
  'Mage',
  'Barbarian',
  'Cleric',
  'Dancer',
  'General',
  'Thief',
  'Assassin',
  'Mercenary',
  'Dark Mage',
];

/**
 * Flat stat gain per level above 1 — the same curve for every class.
 * Exported so the level-up card can report the real gains rather than
 * repeating these numbers in the UI. hit/crit never scale with level, same
 * as move/range — they're a class identity, not a growth stat.
 */
export const LEVEL_GROWTH = { atk: 1, def: 1, maxHp: 2 };

/** The player squad starts stronger than a fresh wave-1 recruit. */
export const PLAYER_START_LEVEL = 5;

/** How much EXP landing an attack, a kill, or a heal grants, and how much a level costs. */
export const EXP_PER_ATTACK = 20;
export const EXP_PER_KILL = 50;
export const EXP_PER_HEAL = 50;
export const EXP_TO_LEVEL = 100;

/**
 * A class's stats at a given level. Move, range, hit, and crit don't scale
 * with level — only atk/def/maxHp do — so higher levels make units hit
 * harder and survive longer without letting them outrun the map's pacing or
 * quietly become unhittable.
 */
export function statsAtLevel(className: ClassName, level: number): ClassStats {
  const base = CLASS_STATS[className];
  const steps = level - 1;
  return {
    maxHp: base.maxHp + LEVEL_GROWTH.maxHp * steps,
    atk: base.atk + LEVEL_GROWTH.atk * steps,
    def: base.def + LEVEL_GROWTH.def * steps,
    move: base.move,
    range: base.range,
    hit: base.hit,
    crit: base.crit,
  };
}

/**
 * Grants EXP and rolls any level-ups it crosses, recomputing atk/def/maxHp
 * from the class curve and healing by the maxHp gained so leveling never
 * feels like a step backwards. Shared by combat (game.ts) and the Wisdom
 * blessing (blessings.ts) — `onLevelUp` lets each caller log the moment in
 * its own voice without this module needing to know about the battle log.
 */
export function grantExp(unit: Unit, amount: number, onLevelUp?: (unit: Unit) => void): void {
  unit.exp += amount;
  while (unit.exp >= EXP_TO_LEVEL) {
    unit.exp -= EXP_TO_LEVEL;
    unit.level += 1;
    const stats = statsAtLevel(unit.className, unit.level);
    const hpGain = stats.maxHp - unit.maxHp;
    unit.maxHp = stats.maxHp;
    unit.atk = stats.atk;
    unit.def = stats.def;
    unit.hp = Math.min(stats.maxHp, unit.hp + hpGain);
    onLevelUp?.(unit);
  }
}
