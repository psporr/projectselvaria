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
  | 'Dark Mage'
  // Class-tree rework Part 3 (2026-08-27) — a new base class (Fighter) plus
  // 9 new advanced classes, see PROMOTES_TO below for which base each
  // branches from.
  | 'Fighter'
  | 'Swordmaster'
  | 'Sniper'
  | 'Lancemaster'
  | 'Sorcerer'
  | 'Sage'
  | 'Priest'
  | 'Hero'
  | 'Berserker'
  | 'Axe Master'
  // Animated hero test stage (2026-08-31, Zoro added 2026-09-01) —
  // named-hero-only classes backing the two animated units (heroArt.ts's
  // ANIMATED_HERO_NAMES), used by both sides in maps.ts's
  // ANIMATED_HERO_TEST_STAGE. Neither is in ALL_CLASSES (no anonymous enemy
  // art, and a random spawn drawing one would need a second copy of that
  // same animated sprite on screen at once, which the pipeline was never
  // meant to support) or PROMOTES_TO (the test stage has no leveling arc to
  // promote through).
  | 'Luffy'
  | 'Zoro';

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
  // got real enemy art (Spearfighter didn't become its own class; its art
  // became Lancer's alt skin instead — see that file's comment).
  General: { maxHp: 32, atk: 8, def: 10, move: 2, range: 1, hit: 80, crit: 5 },
  Thief: { maxHp: 16, atk: 6, def: 2, move: 5, range: 1, hit: 90, crit: 10 },
  Assassin: { maxHp: 14, atk: 10, def: 2, move: 4, range: 1, hit: 75, crit: 35 },
  Mercenary: { maxHp: 20, atk: 8, def: 4, move: 3, range: 1, hit: 90, crit: 12 },
  'Dark Mage': { maxHp: 16, atk: 8, def: 3, move: 3, range: 2, hit: 85, crit: 5 },
  // Class-tree rework Part 3 (2026-08-27) — Fighter is a new axe-wielding
  // base class; the other 9 are advanced classes reached only through
  // PROMOTES_TO (below) — see ALL_CLASSES's doc comment for why they're
  // deliberately excluded from the random-enemy pool. See skills.ts's
  // SKILLS for each one's active skill.
  Fighter: { maxHp: 26, atk: 10, def: 4, move: 3, range: 1, hit: 75, crit: 15 },
  Swordmaster: { maxHp: 28, atk: 11, def: 6, move: 4, range: 1, hit: 90, crit: 25 },
  Sniper: { maxHp: 20, atk: 11, def: 4, move: 3, range: 2, hit: 95, crit: 20 },
  Lancemaster: { maxHp: 25, atk: 11, def: 7, move: 4, range: 1, hit: 82, crit: 12 },
  Sorcerer: { maxHp: 19, atk: 12, def: 3, move: 3, range: 2, hit: 85, crit: 8 },
  Sage: { maxHp: 20, atk: 10, def: 4, move: 3, range: 2, hit: 85, crit: 5 },
  Priest: { maxHp: 22, atk: 8, def: 6, move: 3, range: 1, hit: 85, crit: 5 },
  Hero: { maxHp: 25, atk: 10, def: 6, move: 3, range: 1, hit: 92, crit: 14 },
  Berserker: { maxHp: 30, atk: 13, def: 3, move: 3, range: 1, hit: 60, crit: 30 },
  'Axe Master': { maxHp: 29, atk: 11, def: 6, move: 3, range: 1, hit: 88, crit: 18 },
  // A fast, hard-hitting melee brawler, fitting the animated punch attack —
  // untuned test-stage numbers, not balanced against `npm run sim`.
  Luffy: { maxHp: 26, atk: 11, def: 4, move: 4, range: 1, hit: 85, crit: 15 },
  // A bladed duelist, fitting the animated sword-slash attack — same
  // untuned-test-stage caveat as Luffy above, tuned for visual contrast
  // (a bit less durable, more crit-leaning) rather than balance.
  Zoro: { maxHp: 23, atk: 12, def: 3, move: 4, range: 1, hit: 88, crit: 20 },
};

/**
 * The pool `spawnWave` (waves.ts) and `buildGameState`'s `randomClass: true`
 * units (maps.ts) draw from for a fresh enemy — every class here can appear
 * as a random, unpromoted, wave-1-strength mob.
 *
 * Every *base* class — the original 12-class roster plus Fighter (Part 3's
 * new base class) — is in the pool regardless of whether it currently has
 * anonymous enemy art (`heroArt.ts`'s `ENEMY_CLASS_SPRITE_BASENAMES`); a
 * class with none just renders the circle+letter placeholder (2026-09-02,
 * per the repo owner — reverses the 2026-08-27 restriction that used to
 * gate this list on art completeness).
 *
 * The 9 class-tree-rework *advanced* classes (Part 3, 2026-08-27 —
 * Swordmaster, Sniper, Lancemaster, Sorcerer, Sage, Priest, Hero, Berserker,
 * Axe Master) stay excluded on their own merits: they tested noticeably
 * stronger than a wave-1 base class (confirmed the hard way, `npm run sim
 * -- --batch 30` — see README's "Recent changes"), so a random spawn drawing
 * one would be a real balance problem, not just a missing-art one. They stay
 * reachable only through `PROMOTES_TO`, never a random spawn. Luffy/Zoro are
 * excluded too, for the unrelated reason `ClassName`'s own doc comment gives
 * (animated test-stage-only units, untuned stats, no second copy of their
 * sprite to draw).
 */
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
  'Fighter',
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

/**
 * How much EXP landing an attack, a kill, or a heal grants, and how much a
 * level costs. Started as a 5x multiplier (2026-08-27) explicitly to speed
 * through testing the promotion system; kept as a permanent 2x pace
 * instead of reverting to 1x (2026-09-01, per the repo owner — the faster
 * pace is the intended default now, not leftover test scaffolding).
 */
const EXP_RATE_MULTIPLIER = 2;
export const EXP_PER_ATTACK = 20 * EXP_RATE_MULTIPLIER;
export const EXP_PER_KILL = 50 * EXP_RATE_MULTIPLIER;
export const EXP_PER_HEAL = 50 * EXP_RATE_MULTIPLIER;
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

/** A unit must reach this level (in its current class) before it's eligible to promote. */
export const PROMOTION_LEVEL = 10;

/**
 * Base -> advanced class options (2026-08-27, branching as of the class-tree
 * rework — a base class can list more than one advanced option, e.g. Lancer
 * -> Lancemaster or General; the player picks the branch in PromotionPicker).
 * Thief -> [Assassin] is the first pair, wired in to prove the promotion
 * mechanism end-to-end; the rest of the roster is still unpaired — every
 * function below already works correctly with a partial table, so adding
 * another entry here is the entire integration step, same "just add data"
 * pattern as heroArt.ts's named-hero lookup.
 */
export const PROMOTES_TO: Partial<Record<ClassName, ClassName[]>> = {
  Swordsman: ['Swordmaster'],
  Archer: ['Sniper'],
  Lancer: ['Lancemaster', 'General'],
  Mage: ['Sorcerer', 'Sage'],
  Cleric: ['Priest'],
  Mercenary: ['Hero'],
  Thief: ['Assassin'],
  Fighter: ['Berserker', 'Axe Master'],
  // Barbarian, Dancer, and Dark Mage have no promotion — Barbarian and Dark
  // Mage are reserved for enemy use going forward, Dancer's utility kit
  // doesn't have an obvious advanced form yet.
};

/** Whether `unit` can promote right now — player-only, level-gated, and only if its class has at least one advanced option. */
export function canPromote(unit: Unit): boolean {
  return unit.team === 'player' && unit.level >= PROMOTION_LEVEL && (PROMOTES_TO[unit.className]?.length ?? 0) > 0;
}

/**
 * Promotes `unit` in place to `toClass` (must be one of `PROMOTES_TO`'s
 * options for the unit's current class — a no-op if not, so a stale or
 * forged choice can't smuggle in an illegal class change): re-evaluates
 * `statsAtLevel` for the new class **at the unit's current level**, and
 * fully heals.
 *
 * CHANGED 2026-08-28, per the repo owner: this used to reset `unit.level`
 * to 1 first, which meant a level-10 unit's 9 levels of growth (`+1 Atk,
 * +1 Def, +2 maxHp` each, `LEVEL_GROWTH`) were discarded and replaced with
 * just the new class's level-1 base — a real stat *drop* on promotion (a
 * level-10 Swordsman -> level-1 Swordmaster lost 7 Atk and 8 Def), the
 * opposite of what a promotion is supposed to feel like. `PROMOTION_LEVEL`
 * already gates *when* a unit can promote; every advanced class's base
 * stats (`CLASS_STATS`) were already tuned higher than its base class's —
 * that difference *is* the promotion's power jump, it just needs to be
 * evaluated at the level the unit actually reached instead of at 1. Not
 * resetting the level is the entire fix: same flat `LEVEL_GROWTH` curve,
 * now applied to the new class starting from where the unit already was.
 * `exp` isn't reset either — no reason to waste in-progress exp toward the
 * next level just because the class changed underneath it.
 *
 * `SKILLS[unit.className]` (skills.ts) is already keyed by class, so the
 * unit's active skill(s) swap automatically with no separate step. Resets
 * skillCooldowns/debuffDef/debuffTurns/buffAtk/buffTurns too, so a promoted
 * unit starts its new loadout fresh rather than carrying over old-class
 * leftovers.
 * Caller's responsibility to have checked `canPromote` first.
 */
export function promoteUnit(unit: Unit, toClass: ClassName): void {
  const options = PROMOTES_TO[unit.className];
  if (!options?.includes(toClass)) return;
  const nextClass = toClass;
  unit.className = nextClass;
  const stats = statsAtLevel(nextClass, unit.level);
  unit.maxHp = stats.maxHp;
  unit.atk = stats.atk;
  unit.def = stats.def;
  unit.move = stats.move;
  unit.range = stats.range;
  unit.hit = stats.hit;
  unit.crit = stats.crit;
  unit.hp = stats.maxHp;
  unit.skillCooldowns = {};
  unit.debuffDef = 0;
  unit.debuffTurns = 0;
  unit.buffAtk = 0;
  unit.buffTurns = 0;
}
