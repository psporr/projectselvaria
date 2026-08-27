import type { ClassName } from './classes';
import type { GameState, Unit } from './types';
import { effectiveStats } from './equipment';
import { manhattan, unitsOf, type Coord } from './grid';
import { computeAttackChances } from './combat';

/** Flat bonus healed on top of the healer's own atk. */
export const HEAL_BONUS = 4;
/** Flat bonus damage Snipe deals on top of a normal hit. */
export const SNIPE_BONUS = 4;
/** Nova's per-target damage multiplier — a blast hits several tiles, so each hit is softened. */
export const NOVA_DAMAGE_MULTIPLIER = 0.6;
/** Flat bonus damage Execute deals against a target at or below half HP. */
export const EXECUTE_BONUS = 6;
/** Flat Hit/Crit bonus Focused Strike adds to its one attack. */
export const FOCUSED_STRIKE_HIT_BONUS = 15;
export const FOCUSED_STRIKE_CRIT_BONUS = 15;
/** Flat Def penalty, and how many of the target's own turns it lasts, from Curse. */
export const CURSE_DEBUFF_DEF = 3;
export const CURSE_DEBUFF_TURNS = 2;
/** Flat bonus damage Heavy Swing deals, traded for reduced Hit — the inverse tradeoff of Focused Strike. */
export const HEAVY_SWING_BONUS = 6;
export const HEAVY_SWING_HIT_PENALTY = 15;
/** Bonus damage and crit Deadeye adds on top of Snipe's shape. */
export const DEADEYE_BONUS_DAMAGE = 4;
export const DEADEYE_CRIT_BONUS = 20;
/** Flat Def ignored by Armor Pierce — a stronger, non-terrain version of Guard Break. */
export const ARMOR_PIERCE_DEF_IGNORE = 4;
/** Meteor's per-target damage multiplier — Nova's blast, hit harder. */
export const METEOR_DAMAGE_MULTIPLIER = 0.8;
/** Flat bonus damage Arcane Bolt deals, Snipe-shaped. */
export const ARCANE_BOLT_BONUS = 4;
/** Arcane Ward's self Atk buff, and how many of the Sage's own turns it lasts. */
export const ARCANE_WARD_BUFF_ATK = 4;
export const ARCANE_WARD_BUFF_TURNS = 3;
/** Flat self-heal Vital Strike grants on top of its attack. */
export const VITAL_STRIKE_SELF_HEAL = 5;
/** Bloodlust's bonus damage at 0 HP, scaled down linearly by the Berserker's own current HP fraction. */
export const BLOODLUST_MAX_BONUS = 8;

export type SkillTargetType = 'ally' | 'enemy';

/**
 * Drives the action menu's color-coding — not the same axis as targetType
 * (both Heal and Dance target allies, but they're visually distinct: green
 * for restoring HP, yellow for a non-damage utility effect).
 */
export type SkillCategory = 'attack' | 'heal' | 'utility';

export interface SkillDef {
  id: string;
  name: string;
  description: string;
  /** Turns of cooldown after use, ticking down on the unit's own phases. */
  cooldown: number;
  targetType: SkillTargetType;
  category: SkillCategory;
  /** Added on top of the unit's normal effective attack range, for this skill only. */
  rangeBonus: number;
}

const SKILL_COOLDOWN = 3;

/**
 * One or more signature active skills per class, usable from level 1.
 * Deliberately built to feel structurally different from each other, not
 * just stat tweaks: two support skills that never touch damage, and several
 * offensive skills that each break a different normal-attack rule (extra
 * hit, ignores terrain, guaranteed no counter, hits everyone in range, or
 * refunds the turn on a kill).
 *
 * Every class currently has exactly one skill, but the array shape is the
 * general case — a class with two independent skills (each with its own
 * cooldown, tracked by id in Unit.skillCooldowns) just lists two entries
 * here, no other infrastructure changes.
 *
 * Every offensive skill still rolls hit/crit like a basic attack (HANDOFF.md
 * §3) — a skill changes *what* an attack does, not whether it can miss.
 * Guard Break is the one deliberate exception to "ignores terrain": it
 * ignores the target's terrain *defence* bonus (breaking their guard), but
 * not their terrain *avoid* — the target can still dodge.
 */
export const SKILLS: Record<ClassName, SkillDef[]> = {
  Cleric: [
    {
      id: 'heal',
      name: 'Heal',
      description: 'Restore HP to an ally in range.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'ally',
      category: 'heal',
      rangeBonus: 0,
    },
  ],
  Dancer: [
    {
      id: 'dance',
      name: 'Dance',
      description: "Refresh an ally who's already acted, so they can move and act again.",
      cooldown: SKILL_COOLDOWN,
      targetType: 'ally',
      category: 'utility',
      rangeBonus: 0,
    },
  ],
  Swordsman: [
    {
      id: 'sword-dance',
      name: 'Sword Dance',
      description: 'Strike the same target twice in one action.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Lancer: [
    {
      id: 'guard-break',
      name: 'Guard Break',
      description: "Attack ignoring the target's terrain defense bonus.",
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Archer: [
    {
      id: 'snipe',
      name: 'Snipe',
      description: 'Bonus damage from +1 range; the target cannot counter.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 1,
    },
  ],
  Mage: [
    {
      id: 'nova',
      name: 'Nova',
      description: 'A plus-shaped blast centered on the target, for reduced damage each.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Barbarian: [
    {
      id: 'rampage',
      name: 'Rampage',
      description: 'A normal attack, but a kill lets the unit act again immediately.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  General: [
    {
      id: 'shield-slam',
      name: 'Shield Slam',
      description: "Attack ignoring the target's terrain avoid bonus.",
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Thief: [
    {
      id: 'snatch',
      name: 'Snatch',
      description: 'Attack that heals the Thief for the damage dealt.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Assassin: [
    {
      id: 'execute',
      name: 'Execute',
      description: 'Bonus damage against a target at or below half HP.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Mercenary: [
    {
      id: 'focused-strike',
      name: 'Focused Strike',
      description: 'A precise attack with bonus Hit and Crit.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  'Dark Mage': [
    {
      id: 'curse',
      name: 'Curse',
      description: `Attack that also lowers the target's Def by ${CURSE_DEBUFF_DEF} for ${CURSE_DEBUFF_TURNS} turns.`,
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  // Class-tree rework Part 3 (2026-08-27) — Fighter is a new base class;
  // the rest are advanced classes reached through classes.ts's PROMOTES_TO.
  Fighter: [
    {
      id: 'heavy-swing',
      name: 'Heavy Swing',
      description: `Bonus damage, but reduced Hit — the inverse tradeoff of Focused Strike.`,
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Swordmaster: [
    {
      id: 'triple-strike',
      name: 'Triple Strike',
      description: 'Strike the same target three times in one action.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Sniper: [
    {
      id: 'deadeye',
      name: 'Deadeye',
      description: 'Bonus damage and crit from +1 range; the target cannot counter.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 1,
    },
  ],
  Lancemaster: [
    {
      id: 'armor-pierce',
      name: 'Armor Pierce',
      description: `Attack ignoring ${ARMOR_PIERCE_DEF_IGNORE} of the target's real Def.`,
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Sorcerer: [
    {
      id: 'meteor',
      name: 'Meteor',
      description: 'A plus-shaped blast centered on the target, for heavy damage each.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  // Sage is the first class with 2 independent skills, each on its own
  // cooldown (Unit.skillCooldowns, keyed by id) — proving the multi-skill
  // infrastructure (class-tree rework Part 1) on real content.
  Sage: [
    {
      id: 'arcane-bolt',
      name: 'Arcane Bolt',
      description: 'Bonus damage from +1 range; the target cannot counter.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 1,
    },
    {
      id: 'arcane-ward',
      name: 'Arcane Ward',
      description: `Boosts the Sage's own Atk by ${ARCANE_WARD_BUFF_ATK} for ${ARCANE_WARD_BUFF_TURNS} turns.`,
      cooldown: SKILL_COOLDOWN,
      targetType: 'ally',
      category: 'utility',
      rangeBonus: 0,
    },
  ],
  Priest: [
    {
      id: 'sanctuary',
      name: 'Sanctuary',
      description: 'A plus-shaped blast centered on an ally, healing everyone caught in it.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'ally',
      category: 'heal',
      rangeBonus: 0,
    },
  ],
  Hero: [
    {
      id: 'vital-strike',
      name: 'Vital Strike',
      description: `Attack that also heals the Hero for ${VITAL_STRIKE_SELF_HEAL}.`,
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  Berserker: [
    {
      id: 'bloodlust',
      name: 'Bloodlust',
      description: "Bonus damage that grows the more wounded the Berserker is.",
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
  'Axe Master': [
    {
      id: 'true-strike',
      name: 'True Strike',
      description: 'This attack cannot miss.',
      cooldown: SKILL_COOLDOWN,
      targetType: 'enemy',
      category: 'attack',
      rangeBonus: 0,
    },
  ],
};

/** The reach a unit's skill can target from its current tile. */
export function skillRange(unit: Unit, skill: SkillDef): number {
  return effectiveStats(unit).range + skill.rangeBonus;
}

/** Valid single-select targets for a unit's skill from its current tile. */
export function skillTargets(G: GameState, unit: Unit, skill: SkillDef): Unit[] {
  const range = skillRange(unit, skill);

  if (skill.targetType === 'ally') {
    // Arcane Ward is self-only — no range to check, and unit itself is
    // deliberately excluded from `allies` below, so this returns before that.
    if (skill.id === 'arcane-ward') return [unit];

    const allies = unitsOf(G, unit.team).filter(
      (ally) => ally.id !== unit.id && manhattan(unit, ally) <= range,
    );
    if (skill.id === 'heal' || skill.id === 'sanctuary') return allies.filter((ally) => ally.hp < ally.maxHp);
    if (skill.id === 'dance') return allies.filter((ally) => ally.hasActed);
    return allies;
  }

  return Object.values(G.units).filter(
    (other) => other.team !== unit.team && manhattan(unit, other) <= range,
  );
}

/** The five tiles a plus-shaped blast covers, centered on the picked target. */
export function novaBlastCoords(target: Coord): Coord[] {
  return [
    { x: target.x, y: target.y },
    { x: target.x, y: target.y - 1 },
    { x: target.x, y: target.y + 1 },
    { x: target.x - 1, y: target.y },
    { x: target.x + 1, y: target.y },
  ];
}

/** Enemies of `unit` caught in Nova's (or Meteor's) plus-shaped blast around `target`. */
export function novaBlastTargets(G: GameState, unit: Unit, target: Coord): Unit[] {
  const coords = novaBlastCoords(target);
  return Object.values(G.units).filter(
    (other) => other.team !== unit.team && coords.some((c) => c.x === other.x && c.y === other.y),
  );
}

/** Allies of `unit` (itself included) caught in Sanctuary's plus-shaped blast around `target` — the heal-side mirror of novaBlastTargets. */
export function sanctuaryBlastTargets(G: GameState, unit: Unit, target: Coord): Unit[] {
  const coords = novaBlastCoords(target);
  return Object.values(G.units).filter(
    (other) => other.team === unit.team && coords.some((c) => c.x === other.x && c.y === other.y),
  );
}

/** Whether a given skill of a unit's has any legal use right now — cooldown and targets both. */
export function canUseSkill(G: GameState, unit: Unit, skill: SkillDef): boolean {
  if ((unit.skillCooldowns[skill.id] ?? 0) > 0) return false;
  return skillTargets(G, unit, skill).length > 0;
}

/**
 * A short, human-readable preview of what confirming a skill would do —
 * shown on the confirm card before the player commits. Reuses the same
 * chance/damage math the actual move applies (HEAL_BONUS, SNIPE_BONUS,
 * NOVA_DAMAGE_MULTIPLIER, computeAttackChances) so the preview can't drift
 * from what happens. Damage figures shown are "if it hits" — Hit%/Crit% are
 * reported alongside rather than folded into a single expected number, the
 * same convention the Fire Emblem combat forecast uses.
 */
export function describeSkillEffect(G: GameState, unit: Unit, target: Unit | null, skill: SkillDef): string {
  switch (skill.id) {
    case 'heal': {
      if (!target) return '';
      const amount = Math.min(target.maxHp - target.hp, unit.atk + HEAL_BONUS);
      return `Heals ${target.name} for ${amount} HP.`;
    }
    case 'dance':
      return target ? `${target.name} can move and act again this turn.` : '';
    case 'sword-dance': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `Two hits for ${chances.normalDamage} each (${chances.hitChance}% hit, ${chances.critChance}% crit).`;
    }
    case 'guard-break': {
      if (!target) return '';
      const dmg = Math.max(1, effectiveStats(unit).atk - effectiveStats(target).def);
      const hitChance = computeAttackChances(G, unit, target).hitChance;
      return `${dmg} damage, ignoring terrain defense (${hitChance}% hit).`;
    }
    case 'snipe': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const dmg = chances.normalDamage + SNIPE_BONUS;
      return `${dmg} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Target cannot counter.`;
    }
    case 'nova': {
      if (!target) return '';
      const hits = novaBlastTargets(G, unit, target);
      return `Hits ${hits.length} enem${hits.length === 1 ? 'y' : 'ies'} in a plus-shaped blast, for reduced damage each.`;
    }
    case 'rampage': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Acts again immediately if this kills.`;
    }
    case 'shield-slam': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage, ignoring terrain avoid (${chances.critChance}% crit).`;
    }
    case 'snatch': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Heals the Thief for the damage dealt.`;
    }
    case 'execute': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const bonus = target.hp <= target.maxHp / 2 ? EXECUTE_BONUS : 0;
      return `${chances.normalDamage + bonus} damage (${chances.hitChance}% hit, ${chances.critChance}% crit)${bonus > 0 ? `, +${EXECUTE_BONUS} vs a wounded target` : ''}.`;
    }
    case 'focused-strike': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const hitChance = Math.min(100, chances.hitChance + FOCUSED_STRIKE_HIT_BONUS);
      const critChance = Math.min(100, chances.critChance + FOCUSED_STRIKE_CRIT_BONUS);
      return `${chances.normalDamage} damage (${hitChance}% hit, ${critChance}% crit).`;
    }
    case 'curse': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Lowers Def by ${CURSE_DEBUFF_DEF} for ${CURSE_DEBUFF_TURNS} turns.`;
    }
    case 'heavy-swing': {
      if (!target) return '';
      const base = computeAttackChances(G, unit, target);
      const normalDamage = base.normalDamage + HEAVY_SWING_BONUS;
      const hitChance = Math.max(5, base.hitChance - HEAVY_SWING_HIT_PENALTY);
      return `${normalDamage} damage (${hitChance}% hit, ${base.critChance}% crit).`;
    }
    case 'triple-strike': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `Three hits for ${chances.normalDamage} each (${chances.hitChance}% hit, ${chances.critChance}% crit).`;
    }
    case 'deadeye': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const dmg = chances.normalDamage + DEADEYE_BONUS_DAMAGE;
      const critChance = Math.min(100, chances.critChance + DEADEYE_CRIT_BONUS);
      return `${dmg} damage (${chances.hitChance}% hit, ${critChance}% crit). Target cannot counter.`;
    }
    case 'armor-pierce': {
      if (!target) return '';
      const dmg = Math.max(1, effectiveStats(unit).atk - Math.max(0, effectiveStats(target).def - ARMOR_PIERCE_DEF_IGNORE));
      const hitChance = computeAttackChances(G, unit, target).hitChance;
      return `${dmg} damage, ignoring ${ARMOR_PIERCE_DEF_IGNORE} Def (${hitChance}% hit).`;
    }
    case 'meteor': {
      if (!target) return '';
      const hits = novaBlastTargets(G, unit, target);
      return `Hits ${hits.length} enem${hits.length === 1 ? 'y' : 'ies'} in a plus-shaped blast, for heavy damage each.`;
    }
    case 'arcane-bolt': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const dmg = chances.normalDamage + ARCANE_BOLT_BONUS;
      return `${dmg} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Target cannot counter.`;
    }
    case 'arcane-ward':
      return `${unit.name} gains +${ARCANE_WARD_BUFF_ATK} Atk for ${ARCANE_WARD_BUFF_TURNS} turns.`;
    case 'sanctuary': {
      if (!target) return '';
      const hits = sanctuaryBlastTargets(G, unit, target);
      return `Heals ${hits.length} all${hits.length === 1 ? 'y' : 'ies'} in a plus-shaped blast.`;
    }
    case 'vital-strike': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage (${chances.hitChance}% hit, ${chances.critChance}% crit). Heals the Hero for ${VITAL_STRIKE_SELF_HEAL}.`;
    }
    case 'bloodlust': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      const missingFraction = 1 - unit.hp / unit.maxHp;
      const bonus = Math.round(BLOODLUST_MAX_BONUS * missingFraction);
      return `${chances.normalDamage + bonus} damage (${chances.hitChance}% hit, ${chances.critChance}% crit)${bonus > 0 ? `, +${bonus} from own wounds` : ''}.`;
    }
    case 'true-strike': {
      if (!target) return '';
      const chances = computeAttackChances(G, unit, target);
      return `${chances.normalDamage} damage (100% hit, ${chances.critChance}% crit). Cannot miss.`;
    }
    default:
      return '';
  }
}
