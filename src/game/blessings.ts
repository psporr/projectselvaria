import type { BlessingHouse, GameState, Unit } from './types';
import { unitsOf } from './grid';
import { grantExp } from './classes';
import { pushLog } from './log';
import type { DropRandomAPI } from './equipment';

/**
 * Buffs offered after clearing a wave. Every blessing gets one handler that
 * takes the whole GameState — some loop over the squad, some touch a single
 * unit, some just bump a running total in G.modifiers — rather than forcing
 * every effect through a per-unit shape that only fit the original 3.
 *
 * Per the tactics-roguelike-design skill's build-variety-and-choice-design.md:
 * most blessings belong to a `BlessingHouse` (types.ts) so the pool reads as
 * a handful of directions rather than 29 independent stat deltas, and
 * picking 2+ from one House unlocks that House's Duo blessing (a legendary,
 * `isAvailable`-gated entry with no `house` of its own) — Hades' god-pair
 * boon system adapted to "commit to a direction, get rewarded for it."
 */
export type BlessingRarity = 'common' | 'rare' | 'legendary';

export interface Blessing {
  id: string;
  name: string;
  description: string;
  /**
   * Classification by effect magnitude — also what `drawBlessings` weights
   * the draw odds by (common most likely, legendary rarest). Not purely
   * display: a Duo blessing is 'legendary' since it's meant to feel like a
   * payoff, but stays hidden from the draw until `isAvailable` says so.
   */
  rarity: BlessingRarity;
  /** Thematic identity group — absent for Duo blessings, which sit outside any single House and don't bump one when picked. */
  house?: BlessingHouse;
  apply: (G: GameState) => void;
  /** Hidden from the draw pool unless this returns true — used by The Fallen (needs someone to revive) and every Duo blessing (needs 2+ picks in its House). */
  isAvailable?: (G: GameState) => boolean;
}

const WISDOM_EXP = 40;

function lowestLevelUnit(units: Unit[]): Unit | undefined {
  return units.reduce<Unit | undefined>((lowest, unit) => (!lowest || unit.level < lowest.level ? unit : lowest), undefined);
}

function highestLevelUnit(units: Unit[]): Unit | undefined {
  return units.reduce<Unit | undefined>((highest, unit) => (!highest || unit.level > highest.level ? unit : highest), undefined);
}

/** The Last Stand cares about how close to death a unit is, not its level — a different "pick the extreme unit" axis than underdog/champion use. */
function lowestHpPercentUnit(units: Unit[]): Unit | undefined {
  return units.reduce<Unit | undefined>(
    (lowest, unit) => (!lowest || unit.hp / unit.maxHp < lowest.hp / lowest.maxHp ? unit : lowest),
    undefined,
  );
}

export const BLESSINGS: Blessing[] = [
  {
    id: 'fury',
    name: 'Blessing of Fury',
    description: '+2 Atk for every surviving unit.',
    rarity: 'common',
    house: 'vanguard',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) unit.atk += 2;
    },
  },
  {
    id: 'stone',
    name: 'Blessing of Stone',
    description: '+2 Def for every surviving unit.',
    rarity: 'common',
    house: 'bulwark',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) unit.def += 2;
    },
  },
  {
    id: 'vitality',
    name: 'Blessing of Vitality',
    description: 'Fully heal every surviving unit.',
    rarity: 'rare',
    house: 'fortune',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) unit.hp = unit.maxHp;
    },
  },
  {
    id: 'growth',
    name: 'Blessing of Growth',
    description: '+4 max HP for every surviving unit, healed by the same amount.',
    rarity: 'rare',
    house: 'fortune',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) {
        unit.maxHp += 4;
        unit.hp = Math.min(unit.maxHp, unit.hp + 4);
      }
    },
  },
  {
    id: 'vanguard',
    name: 'Blessing of the Vanguard',
    description: '+3 Atk for every melee unit (range 1).',
    rarity: 'rare',
    house: 'vanguard',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) if (unit.range <= 1) unit.atk += 3;
    },
  },
  {
    id: 'farsight',
    name: 'Blessing of Farsight',
    description: '+2 Atk for every ranged unit (range 2+).',
    rarity: 'rare',
    house: 'farsight',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) if (unit.range >= 2) unit.atk += 2;
    },
  },
  {
    id: 'bulwark',
    name: 'Blessing of the Bulwark',
    description: '+3 Def for every melee unit (range 1).',
    rarity: 'rare',
    house: 'bulwark',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) if (unit.range <= 1) unit.def += 3;
    },
  },
  {
    id: 'underdog',
    name: "Blessing of the Underdog",
    description: 'Your lowest-level unit gets +2 Atk, +2 Def, +6 max HP.',
    rarity: 'common',
    house: 'bulwark',
    apply: (G) => {
      const unit = lowestLevelUnit(unitsOf(G, 'player'));
      if (!unit) return;
      unit.atk += 2;
      unit.def += 2;
      unit.maxHp += 6;
      unit.hp = Math.min(unit.maxHp, unit.hp + 6);
    },
  },
  {
    id: 'champion',
    name: 'Blessing of the Champion',
    description: 'Your highest-level unit gets +3 Atk.',
    rarity: 'common',
    house: 'vanguard',
    apply: (G) => {
      const unit = highestLevelUnit(unitsOf(G, 'player'));
      if (unit) unit.atk += 3;
    },
  },
  {
    id: 'renewal',
    name: 'Blessing of Renewal',
    description: "Every unit's skills are ready to use again immediately.",
    rarity: 'common',
    house: 'farsight',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) unit.skillCooldowns = {};
    },
  },
  {
    id: 'swiftness',
    name: 'Blessing of Swiftness',
    description: '+1 Move for every surviving unit.',
    rarity: 'common',
    house: 'farsight',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) unit.move += 1;
    },
  },
  {
    id: 'wisdom',
    name: 'Blessing of Wisdom',
    description: `+${WISDOM_EXP} EXP for every surviving unit.`,
    rarity: 'common',
    house: 'fortune',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) {
        grantExp(unit, WISDOM_EXP, (leveled) => pushLog(G, `${leveled.name} reached level ${leveled.level}!`));
      }
    },
  },
  {
    id: 'the-fallen',
    name: 'Blessing of the Fallen',
    description: 'Revive one fallen ally at half HP.',
    rarity: 'legendary',
    house: 'fortune',
    isAvailable: (G) => G.fallenUnits.length > 0,
    apply: (G) => {
      const revived = G.fallenUnits.shift();
      if (!revived) return;
      revived.hp = Math.max(1, Math.floor(revived.maxHp / 2));
      revived.hasMoved = false;
      revived.hasActed = false;
      G.units[revived.id] = revived;
      pushLog(G, `${revived.name} returns to the fight!`);
    },
  },
  {
    id: 'fortune',
    name: 'Blessing of Fortune',
    description: "Doubles next wave's item drop chance.",
    rarity: 'common',
    house: 'fortune',
    apply: (G) => {
      G.modifiers.dropChanceMultiplier = 2;
    },
  },
  {
    id: 'thorns',
    name: 'Blessing of Thorns',
    description: 'Permanent: your counterattacks deal +2 damage.',
    rarity: 'rare',
    house: 'bulwark',
    apply: (G) => {
      G.modifiers.counterBonus += 2;
    },
  },
  {
    id: 'focus',
    name: 'Blessing of Focus',
    description: 'Permanent: skill cooldowns are 1 turn shorter (minimum 1).',
    rarity: 'rare',
    house: 'farsight',
    apply: (G) => {
      G.modifiers.cooldownReduction += 1;
    },
  },
  {
    id: 'mending',
    name: 'Blessing of Mending',
    description: 'Permanent: the squad heals 2 HP at the start of every player phase.',
    rarity: 'rare',
    house: 'fortune',
    apply: (G) => {
      G.modifiers.healPerTurn += 2;
    },
  },
  {
    id: 'ironclad',
    name: 'Blessing of the Ironclad',
    description: 'Permanent: doubles the defence bonus your units get from terrain.',
    rarity: 'legendary',
    house: 'bulwark',
    apply: (G) => {
      G.modifiers.terrainDefMultiplier *= 2;
    },
  },
  {
    id: 'executioner',
    name: "Blessing of the Executioner",
    description: 'Permanent: +3 damage against enemies at or below half HP.',
    rarity: 'legendary',
    house: 'vanguard',
    apply: (G) => {
      G.modifiers.executionerBonus += 3;
    },
  },
  {
    id: 'guardian-angel',
    name: 'Blessing of the Guardian Angel',
    description: 'Permanent: once per wave, a lethal hit leaves a unit at 1 HP instead.',
    rarity: 'legendary',
    house: 'bulwark',
    apply: (G) => {
      G.modifiers.guardianAngelMax += 1;
    },
  },
  {
    id: 'blood-for-steel',
    name: 'Blessing of Blood for Steel',
    description: 'Melee units (range 1) get +5 Atk, -2 Def — a real trade-off, not a flat upgrade.',
    rarity: 'rare',
    house: 'vanguard',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) {
        if (unit.range <= 1) {
          unit.atk += 5;
          unit.def -= 2;
        }
      }
    },
  },
  {
    id: 'blood-oath',
    name: 'Blood Oath',
    description: 'Vanguard duo: melee units heal 4 HP whenever they land a killing blow.',
    rarity: 'legendary',
    isAvailable: (G) => G.housePicks.vanguard >= 2,
    apply: (G) => {
      G.modifiers.meleeKillHeal += 4;
    },
  },
  {
    id: 'last-stand',
    name: 'Blessing of the Last Stand',
    description: 'Your lowest-HP% unit gets +4 Def, +15 max HP.',
    rarity: 'rare',
    house: 'bulwark',
    apply: (G) => {
      const unit = lowestHpPercentUnit(unitsOf(G, 'player'));
      if (!unit) return;
      unit.def += 4;
      unit.maxHp += 15;
      unit.hp = Math.min(unit.maxHp, unit.hp + 15);
    },
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    description: 'Bulwark duo: your counterattacks are always critical hits.',
    rarity: 'legendary',
    isAvailable: (G) => G.housePicks.bulwark >= 2,
    apply: (G) => {
      G.modifiers.counterAlwaysCrit = true;
    },
  },
  {
    id: 'volley',
    name: 'Blessing of the Volley',
    description: 'Ranged units (range 2+) get +3 Atk, +1 Range.',
    rarity: 'rare',
    house: 'farsight',
    apply: (G) => {
      for (const unit of unitsOf(G, 'player')) {
        if (unit.range >= 2) {
          unit.atk += 3;
          unit.range += 1;
        }
      }
    },
  },
  {
    id: 'perfect-aim',
    name: 'Perfect Aim',
    description: 'Farsight duo: ranged units (range 2+) always hit.',
    rarity: 'legendary',
    isAvailable: (G) => G.housePicks.farsight >= 2,
    apply: (G) => {
      G.modifiers.rangedAlwaysHit = true;
    },
  },
  {
    id: 'windfall',
    name: 'Blessing of Windfall',
    description: "Guarantees a legendary option in next wave's blessing draw.",
    rarity: 'rare',
    house: 'fortune',
    apply: (G) => {
      G.modifiers.guaranteedLegendaryDraws += 1;
    },
  },
  {
    id: 'phoenix-blessing',
    name: 'The Phoenix',
    description: 'Fortune duo: whenever an ally has fallen, the Blessing of the Fallen is always offered as a bonus option.',
    rarity: 'legendary',
    isAvailable: (G) => G.housePicks.fortune >= 2,
    apply: (G) => {
      G.modifiers.phoenixActive = true;
    },
  },
  {
    id: 'berserker',
    name: 'Blessing of the Berserker',
    description: 'Permanent: +4 damage while a unit is at or below half its own HP.',
    rarity: 'legendary',
    apply: (G) => {
      G.modifiers.berserkerBonus += 4;
    },
  },
];

const RARITY_WEIGHT: Record<BlessingRarity, number> = { common: 70, rare: 25, legendary: 5 };

/** Weighted pick without replacement from `pool` — common most likely, legendary rarest. */
function weightedPick(pool: Blessing[], random: DropRandomAPI): Blessing | undefined {
  if (pool.length === 0) return undefined;
  const totalWeight = pool.reduce((sum, blessing) => sum + RARITY_WEIGHT[blessing.rarity], 0);
  let roll = random.Number() * totalWeight;
  for (const blessing of pool) {
    roll -= RARITY_WEIGHT[blessing.rarity];
    if (roll < 0) return blessing;
  }
  return pool[pool.length - 1];
}

/**
 * Draws 3 distinct blessing ids for the wave-clear pause, excluding any not
 * currently available, weighted by rarity (RARITY_WEIGHT). Windfall
 * (`guaranteedLegendaryDraws`) forces one legendary into the 3 before the
 * weighted draw fills the rest; The Phoenix (`phoenixActive`) can append a
 * bonus 4th id — The Fallen, when available — on top of the normal 3, which
 * `BlessingPicker`'s already-dynamic card layout renders with no changes.
 */
export function drawBlessings(G: GameState, random: DropRandomAPI): string[] {
  let pool = BLESSINGS.filter((blessing) => !blessing.isAvailable || blessing.isAvailable(G));
  const picked: Blessing[] = [];

  if (G.modifiers.guaranteedLegendaryDraws > 0) {
    const forced = weightedPick(
      pool.filter((blessing) => blessing.rarity === 'legendary'),
      random,
    );
    if (forced) {
      picked.push(forced);
      pool = pool.filter((blessing) => blessing.id !== forced.id);
    }
    G.modifiers.guaranteedLegendaryDraws -= 1;
  }

  while (picked.length < 3 && pool.length > 0) {
    const chosen = weightedPick(pool, random);
    if (!chosen) break;
    picked.push(chosen);
    pool = pool.filter((blessing) => blessing.id !== chosen.id);
  }

  const ids = picked.map((blessing) => blessing.id);

  if (G.modifiers.phoenixActive) {
    const fallen = BLESSINGS.find((blessing) => blessing.id === 'the-fallen');
    if (fallen && fallen.isAvailable?.(G) && !ids.includes(fallen.id)) ids.push(fallen.id);
  }

  return ids;
}
