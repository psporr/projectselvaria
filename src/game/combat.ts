import type { GameState, Unit } from './types';
import { manhattan, terrainAt } from './grid';
import { effectiveStats, equippedCounterReduction } from './equipment';

/**
 * CHANGED FOR THE REBUILD (HANDOFF.md §3, Option A): the old prototype had no
 * hit rate and no criticals — every attack connected for an exact,
 * previewable number. This is the one genuine rules change in the rebuild.
 *
 * `computeDamage` stays deterministic — it's the damage *if the hit lands*,
 * unmodified by whether it actually does. Hit/miss and crit are resolved
 * separately (`computeAttackChances` for the pure probabilities,
 * `forecastCombat` for the full pure preview, and the actual dice rolls in
 * game.ts's moves via boardgame.io's injected seeded random). Every attack —
 * basic or skill — flows through this same trio, so the AI's expected-value
 * math, the UI forecast panel, and what actually happens can never disagree.
 */

/**
 * Damage if the hit connects (not accounting for crit). A minimum of 1 keeps
 * battles from stalling into unbreakable defences. Folds in two permanent
 * blessing effects: Ironclad doubles (or more, stacked) the terrain bonus for
 * a defending player unit, and Executioner adds flat damage for a player
 * attacker against a target at or below half HP.
 */
export function computeDamage(G: GameState, attacker: Unit, defender: Unit): number {
  const terrainBonus = terrainAt(G, defender.x, defender.y).defBonus;
  const cover = defender.team === 'player' ? terrainBonus * G.modifiers.terrainDefMultiplier : terrainBonus;

  let damage = effectiveStats(attacker).atk - (effectiveStats(defender).def + cover);
  if (attacker.team === 'player' && defender.hp <= defender.maxHp / 2) {
    damage += G.modifiers.executionerBonus;
  }
  return Math.max(1, damage);
}

/**
 * Chance (0-100) that an attack from `attacker` connects against `defender`,
 * and the chance (0-100) that a connecting hit is a critical — Option A's
 * flat per-class rates, reduced by the defender's terrain avoid. Floored at
 * 5% so no combination of stats makes an attack truly unmissable, and
 * capped at 100%.
 */
export function computeHitChance(G: GameState, attacker: Unit, defender: Unit): number {
  const terrainAvoid = terrainAt(G, defender.x, defender.y).avoid;
  return clamp(effectiveStats(attacker).hit - terrainAvoid, 5, 100);
}

export function computeCritChance(attacker: Unit): number {
  return clamp(effectiveStats(attacker).crit, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** A defender strikes back only if the attacker is within its own reach. */
export function canCounter(attacker: Unit, defender: Unit): boolean {
  return manhattan(attacker, defender) <= effectiveStats(defender).range;
}

/**
 * Damage `defender` deals back to `attacker` on a counter *if it connects* —
 * the one place Thorns (bonus for a player counterer) and Dragonscale
 * (reduction for the original attacker, who's on the receiving end of this
 * counter) both apply, so every counter calculation in the game shares this
 * and can't disagree with another. The counter's own hit/crit chance is
 * computed the same way as any other attack (computeHitChance/computeCritChance
 * with attacker/defender swapped) — a counter can miss too.
 */
export function computeCounterDamage(G: GameState, defender: Unit, attacker: Unit): number {
  let damage = computeDamage(G, defender, attacker);
  if (defender.team === 'player') damage += G.modifiers.counterBonus;
  return Math.max(1, damage - equippedCounterReduction(attacker));
}

/** The full set of probabilities and damage figures for one side of an exchange. */
export interface AttackChances {
  /** 0-100. */
  hitChance: number;
  /** 0-100. */
  critChance: number;
  /** Damage dealt on a connecting, non-critical hit. */
  normalDamage: number;
  /** Damage dealt on a connecting critical hit — normalDamage × 2 (HANDOFF.md §3). */
  critDamage: number;
}

function attackChances(chances: { hitChance: number; critChance: number; normalDamage: number }): AttackChances {
  return { ...chances, critDamage: chances.normalDamage * 2 };
}

/** Pure probabilities for attacker → defender, with no counter or exp side effects. */
export function computeAttackChances(G: GameState, attacker: Unit, defender: Unit): AttackChances {
  return attackChances({
    hitChance: computeHitChance(G, attacker, defender),
    critChance: computeCritChance(attacker),
    normalDamage: computeDamage(G, attacker, defender),
  });
}

/**
 * Pure probabilities for defender's counter against attacker — same shape as
 * computeAttackChances, but damage goes through computeCounterDamage (Thorns/
 * Dragonscale) instead of computeDamage. Callers are responsible for checking
 * canCounter first; this doesn't gate on range.
 */
export function computeCounterChances(G: GameState, defender: Unit, attacker: Unit): AttackChances {
  return attackChances({
    hitChance: computeHitChance(G, defender, attacker),
    critChance: computeCritChance(defender),
    normalDamage: computeCounterDamage(G, defender, attacker),
  });
}

export interface CombatForecast {
  /** The attacker's own chances against the defender. */
  attack: AttackChances;
  /** The defender's counter, or null if it's out of the defender's reach. */
  counter: AttackChances | null;
  /** P(0-1) the attack kills the defender outright. */
  killChance: number;
  /** Expected damage the attack deals to the defender this exchange. */
  expectedDamage: number;
  /**
   * Expected damage the counter deals back to the attacker — already
   * weighted by the chance the attack didn't kill first (a killing blow
   * prevents any counter, HANDOFF.md §3) and by the counter's own hit/crit.
   */
  expectedCounterDamage: number;
  /** P(0-1) the attacker dies to the counter this exchange. */
  attackerDeathChance: number;
}

/**
 * Pure preview of an exchange, used both by the UI forecast panel (Hit%/
 * Crit%, à la Fire Emblem) and the enemy AI's expected-value scoring — so
 * what the player is shown can never disagree with what actually happens.
 * Actual resolution (game.ts) rolls independently against these same
 * hitChance/critChance figures via the injected seeded random.
 */
export function forecastCombat(G: GameState, attacker: Unit, defender: Unit): CombatForecast {
  const attack = computeAttackChances(G, attacker, defender);
  const hitP = attack.hitChance / 100;
  const critP = attack.critChance / 100;

  // P(a connecting hit kills): once normalDamage alone kills, every connecting
  // hit kills (crit only deals more); if only critDamage kills, it takes the crit.
  const killChanceGivenHit = attack.normalDamage >= defender.hp ? 1 : attack.critDamage >= defender.hp ? critP : 0;
  const killChance = hitP * killChanceGivenHit;

  const expectedDamage = hitP * (attack.normalDamage * (1 - critP) + attack.critDamage * critP);

  const counter: AttackChances | null = canCounter(attacker, defender) ? computeCounterChances(G, defender, attacker) : null;

  let expectedCounterDamage = 0;
  let attackerDeathChance = 0;
  if (counter) {
    const survivesToCounter = 1 - killChance;
    const counterHitP = counter.hitChance / 100;
    const counterCritP = counter.critChance / 100;
    expectedCounterDamage =
      survivesToCounter * counterHitP * (counter.normalDamage * (1 - counterCritP) + counter.critDamage * counterCritP);

    const counterKillGivenHit = counter.normalDamage >= attacker.hp ? 1 : counter.critDamage >= attacker.hp ? counterCritP : 0;
    attackerDeathChance = survivesToCounter * counterHitP * counterKillGivenHit;
  }

  return { attack, counter, killChance, expectedDamage, expectedCounterDamage, attackerDeathChance };
}
