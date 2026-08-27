import type { Ctx, Game, MoveMap } from 'boardgame.io';
import { INVALID_MOVE } from 'boardgame.io/core';

import type { CampaignCarryOver, ChapterDef } from './maps';
import type { GameMode, GameState, ItemSlot, Team, Unit } from './types';
import { PLAYER_ID, teamOf } from './types';
import { buildGameState, CAMPAIGN_CHAPTER_1, CHAPTER_1, TEST_MAP_2, type ShuffleAPI } from './maps';
import { computeReachable, manhattan, tileKey, unitsOf } from './grid';
import {
  canCounter,
  computeAttackChances,
  computeCounterChances,
  computeCritChance,
  computeDamage,
  computeHitChance,
  type AttackChances,
} from './combat';
import { BLESSINGS, drawBlessings } from './blessings';
import { spawnWave } from './waves';
import { canPromote, EXP_PER_ATTACK, EXP_PER_HEAL, EXP_PER_KILL, grantExp as grantExpToUnit, promoteUnit } from './classes';
import { effectiveStats, equippedKillHeal, ITEMS, rollDrop, type DropRandomAPI } from './equipment';
import {
  CURSE_DEBUFF_DEF,
  CURSE_DEBUFF_TURNS,
  EXECUTE_BONUS,
  FOCUSED_STRIKE_CRIT_BONUS,
  FOCUSED_STRIKE_HIT_BONUS,
  HEAL_BONUS,
  NOVA_DAMAGE_MULTIPLIER,
  SKILLS,
  SNIPE_BONUS,
  novaBlastTargets,
  skillTargets,
} from './skills';
import { pushLog } from './log';

/**
 * The slice of boardgame.io's EventsAPI we actually need. Defined locally,
 * same reasoning as ShuffleAPI in maps.ts — not re-exported from the
 * package's `types` entry.
 */
interface EndTurnAPI {
  endTurn?: () => void;
}

/**
 * Resolves the unit a move is allowed to command: it must exist, belong to the
 * side whose turn it is, and still have an action left.
 */
function activeUnit(G: GameState, ctx: Ctx, unitId: string): Unit | null {
  const unit = G.units[unitId];
  if (!unit) return null;
  if (unit.team !== teamOf(ctx.currentPlayer)) return null;
  if (unit.hasActed) return null;
  return unit;
}

export const moveUnit = (
  { G, ctx }: { G: GameState; ctx: Ctx },
  unitId: string,
  x: number,
  y: number,
) => {
  const unit = activeUnit(G, ctx, unitId);
  if (!unit || unit.hasMoved) return INVALID_MOVE;

  const destination = computeReachable(G, unit).get(tileKey(x, y));
  if (!destination) return INVALID_MOVE;

  unit.x = x;
  unit.y = y;
  unit.hasMoved = true;
};

interface RolledAttack {
  hit: boolean;
  crit: boolean;
  /** 0 on a miss. */
  damage: number;
}

/**
 * The one place any attack — basic or skill — actually consumes the
 * injected seeded random to decide hit/miss and crit (HANDOFF.md §3). Takes
 * a plain AttackChances rather than recomputing it, so a skill with
 * non-standard damage (Guard Break, Snipe, Nova) can still share this same
 * roll procedure by building its own chances object first.
 */
function rollAttack(chances: AttackChances, random: DropRandomAPI): RolledAttack {
  const hit = random.Number() * 100 < chances.hitChance;
  if (!hit) return { hit: false, crit: false, damage: 0 };
  const crit = random.Number() * 100 < chances.critChance;
  return { hit: true, crit, damage: crit ? chances.critDamage : chances.normalDamage };
}

/**
 * Called whenever a unit dies. On a 'waves' objective (roguelike) an empty
 * enemy side pauses play for a blessing pick and the run continues; on
 * 'rout' (campaign) there's nothing to do here — the chapter is simply over,
 * which `endIf` picks up on its own.
 */
function checkWaveCleared(G: GameState, random: DropRandomAPI): void {
  if (unitsOf(G, 'enemy').length > 0) return;
  if (G.objectiveType !== 'waves') return;

  G.awaitingBlessing = true;
  G.offeredBlessingIds = drawBlessings(G, random);
  pushLog(G, 'All enemies defeated! Choose your blessing.');
}

/**
 * Removes a fallen unit, rolls its loot if it was an enemy, and checks
 * whether that was the wave's last one. Shared by plain attacks and any
 * skill that can kill, so drops and the wave-clear check never drift out of
 * sync between the two. Also the single chokepoint for two blessing
 * effects: Guardian Angel (a lethal hit on a player unit can be survived
 * instead) and The Fallen (a player unit that does die is remembered for
 * revival), plus Vampiric Fang's kill-heal for whoever landed the blow.
 */
function killUnit(G: GameState, unit: Unit, random: DropRandomAPI, killer?: Unit): void {
  if (unit.team === 'player' && G.modifiers.guardianAngelCharges > 0) {
    G.modifiers.guardianAngelCharges -= 1;
    unit.hp = 1;
    pushLog(G, `${unit.name} is saved by a Guardian Angel!`);
    return;
  }

  pushLog(G, `${unit.name} has fallen!`);
  delete G.units[unit.id];
  if (unit.team === 'player') {
    G.fallenUnits.push(unit);
  } else {
    const drop = rollDrop(G, G.wave, random);
    if (drop) {
      G.inventory.push(drop);
      pushLog(G, `${unit.name} dropped ${ITEMS[drop.defId].name}!`);
    }
  }

  if (killer) {
    const heal = equippedKillHeal(killer);
    if (heal > 0 && killer.hp > 0) {
      killer.hp = Math.min(killer.maxHp, killer.hp + heal);
      pushLog(G, `${killer.name} drains ${heal} HP from the kill.`);
    }
  }

  checkWaveCleared(G, random);
}

/**
 * Shared counter step for skills that behave like a modified single attack
 * (Sword Dance, Guard Break, Rampage). The counter rolls its own hit/crit
 * just like a basic attack's counter — it can miss too. Returns false if the
 * attacker died to the counter — the caller should stop immediately in that
 * case, same as attackUnit does for a plain attack.
 */
function resolveSkillCounter(G: GameState, attacker: Unit, target: Unit, random: DropRandomAPI): boolean {
  if (!canCounter(attacker, target)) return true;

  const chances = computeCounterChances(G, target, attacker);
  const roll = rollAttack(chances, random);
  if (!roll.hit) {
    pushLog(G, `${target.name}'s counter misses!`);
    return true;
  }

  attacker.hp = Math.max(0, attacker.hp - roll.damage);
  pushLog(G, `${target.name} counters for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);
  if (attacker.hp <= 0) {
    killUnit(G, attacker, random, target);
    return false;
  }
  return true;
}

/** Only the player squad grows — enemy stats are fixed by wave/chapter, not combat performance. */
function grantExp(G: GameState, unit: Unit, amount: number = EXP_PER_ATTACK): void {
  if (unit.team !== 'player') return;
  grantExpToUnit(unit, amount, (leveled) => pushLog(G, `${leveled.name} reached level ${leveled.level}!`));
}

export const attackUnit = (
  { G, ctx, random }: { G: GameState; ctx: Ctx; random: DropRandomAPI },
  attackerId: string,
  targetId: string,
) => {
  const attacker = activeUnit(G, ctx, attackerId);
  const target = G.units[targetId];
  if (!attacker || !target) return INVALID_MOVE;
  if (target.team === attacker.team) return INVALID_MOVE;
  if (manhattan(attacker, target) > effectiveStats(attacker).range) return INVALID_MOVE;

  attacker.hasMoved = true;
  attacker.hasActed = true;

  const roll = rollAttack(computeAttackChances(G, attacker, target), random);
  if (!roll.hit) {
    pushLog(G, `${attacker.name} misses ${target.name}!`);
    // A whiffed swing still counts as a taken action for exp purposes.
    grantExp(G, attacker, EXP_PER_ATTACK);
    return;
  }

  target.hp = Math.max(0, target.hp - roll.damage);
  pushLog(G, `${attacker.name} hits ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);

  if (target.hp <= 0) {
    killUnit(G, target, random, attacker);
    grantExp(G, attacker, EXP_PER_KILL);
    return;
  }

  // A killing blow prevents any counter (checked above); otherwise the
  // defender strikes back if attacker is within the defender's own reach.
  if (canCounter(attacker, target)) {
    const counterRoll = rollAttack(computeCounterChances(G, target, attacker), random);
    if (!counterRoll.hit) {
      pushLog(G, `${target.name}'s counter misses!`);
    } else {
      attacker.hp = Math.max(0, attacker.hp - counterRoll.damage);
      pushLog(G, `${target.name} counters for ${counterRoll.damage}${counterRoll.crit ? ' (Critical!)' : ''}.`);
      if (attacker.hp <= 0) {
        killUnit(G, attacker, random, target);
        return;
      }
    }
  }

  grantExp(G, attacker, EXP_PER_ATTACK);
};

/** Ends a unit's turn where it stands. */
export const waitUnit = ({ G, ctx }: { G: GameState; ctx: Ctx }, unitId: string) => {
  const unit = activeUnit(G, ctx, unitId);
  if (!unit) return INVALID_MOVE;

  unit.hasMoved = true;
  unit.hasActed = true;
};

/**
 * Every class's active skill(s), dispatched from one move since each case is
 * short and they share the activeUnit/cooldown gate. A class with more than
 * one skill (SKILLS[unit.className] is an array) picks which one to use via
 * `skillId`, each tracked on its own cooldown in unit.skillCooldowns.
 * `targetId` is null for Nova, the only AoE skill — there's nothing to pick,
 * it just hits everything in range.
 *
 * Every offensive skill rolls hit/crit the same way a basic attack does
 * (HANDOFF.md §3) — a skill changes what an attack does, not whether it can
 * miss. Guard Break, Snipe, and Nova build their own AttackChances (they
 * modify damage or bypass the counter step) but still resolve through the
 * shared rollAttack.
 */
export const useSkill = (
  { G, ctx, random }: { G: GameState; ctx: Ctx; random: DropRandomAPI },
  unitId: string,
  skillId: string,
  targetId: string | null,
) => {
  const unit = activeUnit(G, ctx, unitId);
  if (!unit) return INVALID_MOVE;

  const skill = SKILLS[unit.className].find((candidate) => candidate.id === skillId);
  if (!skill || (unit.skillCooldowns[skillId] ?? 0) > 0) return INVALID_MOVE;

  const target = targetId ? G.units[targetId] : undefined;
  // Set by any case whose hit killed its target, so the shared exp grant at
  // the bottom can credit a kill rather than a plain hit.
  let killedTarget = false;

  switch (skill.id) {
    case 'heal': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const healAmount = Math.min(target.maxHp - target.hp, unit.atk + HEAL_BONUS);
      target.hp += healAmount;
      pushLog(G, `${unit.name} heals ${target.name} for ${healAmount}.`);
      break;
    }

    case 'dance': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      target.hasMoved = false;
      target.hasActed = false;
      pushLog(G, `${unit.name} dances for ${target.name} — they can act again!`);
      break;
    }

    case 'sword-dance': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      let dealt = 0;
      let landed = 0;
      let crits = 0;
      for (let i = 0; i < 2 && target.hp > 0; i++) {
        const roll = rollAttack(computeAttackChances(G, unit, target), random);
        if (!roll.hit) continue;
        landed++;
        if (roll.crit) crits++;
        target.hp = Math.max(0, target.hp - roll.damage);
        dealt += roll.damage;
      }
      pushLog(
        G,
        `${unit.name} strikes ${target.name} (${landed}/2 landed) for ${dealt}${crits > 0 ? ` (${crits} critical)` : ''}.`,
      );
      if (target.hp <= 0) {
        killUnit(G, target, random, unit);
        killedTarget = true;
      } else if (!resolveSkillCounter(G, unit, target, random)) {
        return;
      }
      break;
    }

    case 'guard-break': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      // Ignores the target's terrain *defence* bonus, not its terrain
      // *avoid* — Guard Break breaks their guard, not their footing.
      const normalDamage = Math.max(1, effectiveStats(unit).atk - effectiveStats(target).def);
      const chances: AttackChances = {
        hitChance: computeHitChance(G, unit, target),
        critChance: computeCritChance(unit),
        normalDamage,
        critDamage: normalDamage * 2,
      };
      const roll = rollAttack(chances, random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s guard break misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(G, `${unit.name} breaks ${target.name}'s guard for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    case 'snipe': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const base = computeAttackChances(G, unit, target);
      const normalDamage = base.normalDamage + SNIPE_BONUS;
      const chances: AttackChances = { ...base, normalDamage, critDamage: normalDamage * 2 };
      const roll = rollAttack(chances, random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s snipe misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(
          G,
          `${unit.name} snipes ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}. No counter possible.`,
        );
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        }
      }
      break;
    }

    case 'nova': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const hits = novaBlastTargets(G, unit, target);
      let totalDealt = 0;
      let connected = 0;
      for (const hitTarget of hits) {
        const normalDamage = Math.max(1, Math.round(computeDamage(G, unit, hitTarget) * NOVA_DAMAGE_MULTIPLIER));
        const chances: AttackChances = {
          hitChance: computeHitChance(G, unit, hitTarget),
          critChance: computeCritChance(unit),
          normalDamage,
          critDamage: normalDamage * 2,
        };
        const roll = rollAttack(chances, random);
        if (!roll.hit) continue;
        connected++;
        hitTarget.hp = Math.max(0, hitTarget.hp - roll.damage);
        totalDealt += roll.damage;
        if (hitTarget.hp <= 0) {
          killUnit(G, hitTarget, random, unit);
          killedTarget = true;
        }
      }
      pushLog(
        G,
        `${unit.name} casts Nova on ${target.name}, hitting ${connected}/${hits.length} enem${hits.length === 1 ? 'y' : 'ies'} for ${totalDealt} total.`,
      );
      break;
    }

    case 'rampage': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const roll = rollAttack(computeAttackChances(G, unit, target), random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s rampage misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(G, `${unit.name} rampages into ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          unit.skillCooldowns[skillId] = Math.max(1, skill.cooldown - G.modifiers.cooldownReduction);
          grantExp(G, unit, EXP_PER_KILL);
          // Deliberately leaves hasMoved/hasActed false — a kill refunds the turn.
          return;
        }
        if (!resolveSkillCounter(G, unit, target, random)) return;
      }
      break;
    }

    case 'shield-slam': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      // Ignores the target's terrain *avoid*, not its terrain *defence* —
      // the mirror image of Guard Break, which breaks guard but not footing.
      const chances: AttackChances = {
        hitChance: Math.max(5, Math.min(100, effectiveStats(unit).hit)),
        critChance: computeCritChance(unit),
        normalDamage: computeDamage(G, unit, target),
        critDamage: computeDamage(G, unit, target) * 2,
      };
      const roll = rollAttack(chances, random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s shield slam misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(G, `${unit.name} slams ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}, ignoring cover.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    case 'snatch': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const roll = rollAttack(computeAttackChances(G, unit, target), random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s snatch misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        unit.hp = Math.min(unit.maxHp, unit.hp + roll.damage);
        pushLog(G, `${unit.name} snatches ${roll.damage} HP from ${target.name}${roll.crit ? ' (Critical!)' : ''}.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    case 'execute': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const base = computeAttackChances(G, unit, target);
      const bonus = target.hp <= target.maxHp / 2 ? EXECUTE_BONUS : 0;
      const normalDamage = base.normalDamage + bonus;
      const chances: AttackChances = { ...base, normalDamage, critDamage: normalDamage * 2 };
      const roll = rollAttack(chances, random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s execute misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(G, `${unit.name} strikes ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    case 'focused-strike': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const base = computeAttackChances(G, unit, target);
      const chances: AttackChances = {
        ...base,
        hitChance: Math.min(100, base.hitChance + FOCUSED_STRIKE_HIT_BONUS),
        critChance: Math.min(100, base.critChance + FOCUSED_STRIKE_CRIT_BONUS),
      };
      const roll = rollAttack(chances, random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s focused strike misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        pushLog(G, `${unit.name} strikes ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    case 'curse': {
      if (!target || !skillTargets(G, unit, skill).some((candidate) => candidate.id === target.id)) return INVALID_MOVE;
      const roll = rollAttack(computeAttackChances(G, unit, target), random);
      if (!roll.hit) {
        pushLog(G, `${unit.name}'s curse misses ${target.name}!`);
      } else {
        target.hp = Math.max(0, target.hp - roll.damage);
        target.debuffDef = CURSE_DEBUFF_DEF;
        target.debuffTurns = CURSE_DEBUFF_TURNS;
        pushLog(G, `${unit.name} curses ${target.name} for ${roll.damage}${roll.crit ? ' (Critical!)' : ''}, lowering their Def.`);
        if (target.hp <= 0) {
          killUnit(G, target, random, unit);
          killedTarget = true;
        } else if (!resolveSkillCounter(G, unit, target, random)) {
          return;
        }
      }
      break;
    }

    default:
      return INVALID_MOVE;
  }

  unit.skillCooldowns[skillId] = Math.max(1, skill.cooldown - G.modifiers.cooldownReduction);
  grantExp(G, unit, skill.id === 'heal' ? EXP_PER_HEAL : killedTarget ? EXP_PER_KILL : EXP_PER_ATTACK);
  unit.hasMoved = true;
  unit.hasActed = true;
};

/**
 * Equips an item from the shared inventory onto a player unit, returning
 * whatever was already in that slot back to the inventory. Doesn't cost a
 * turn — equipping is available any time during the player phase, not
 * gated behind a unit's move/attack the way Attack/Wait are.
 */
export const equipItem = ({ G, ctx }: { G: GameState; ctx: Ctx }, unitId: string, instanceId: string) => {
  const unit = G.units[unitId];
  if (!unit || unit.team !== 'player' || teamOf(ctx.currentPlayer) !== 'player') return INVALID_MOVE;

  const itemIndex = G.inventory.findIndex((item) => item.instanceId === instanceId);
  if (itemIndex === -1) return INVALID_MOVE;
  const [item] = G.inventory.splice(itemIndex, 1);

  const slot: ItemSlot = ITEMS[item.defId].slot;
  const previous = unit.equipment[slot];
  if (previous) G.inventory.push(previous);
  unit.equipment[slot] = item;
};

/** Returns an equipped item to the shared inventory. */
export const unequipItem = ({ G, ctx }: { G: GameState; ctx: Ctx }, unitId: string, slot: ItemSlot) => {
  const unit = G.units[unitId];
  if (!unit || unit.team !== 'player' || teamOf(ctx.currentPlayer) !== 'player') return INVALID_MOVE;

  const item = unit.equipment[slot];
  if (!item) return INVALID_MOVE;
  delete unit.equipment[slot];
  G.inventory.push(item);
};

/**
 * Advances the wave counter and spawns the next wave — the shared tail of
 * the wave-clear pause once every step (blessing, and promotion if anyone
 * was eligible) has resolved. If the last enemy fell during the enemy's own
 * turn (e.g. a counterattack), also force-ends that turn so the fresh
 * wave's enemies don't get immediately auto-played by the CPU before the
 * player has a turn.
 */
function finishWaveTransition(G: GameState, ctx: Ctx, events: EndTurnAPI, random: ShuffleAPI): void {
  G.wave += 1;
  spawnWave(G, G.wave, random);
  pushLog(G, `— Wave ${G.wave} —`);

  if (teamOf(ctx.currentPlayer) !== 'player') {
    events.endTurn?.();
  }
}

/**
 * Applies the chosen blessing and resets the squad to their start tiles.
 * Only valid right after a wave is cleared, and only for one of the 3 ids
 * actually offered this pause (drawn in checkWaveCleared) — not just any id
 * in the full 20-strong pool.
 *
 * Doesn't spawn the next wave directly — if any player unit is now eligible
 * to promote (classes.ts's canPromote), it pauses on `awaitingPromotion`
 * instead so the player can act on that first; resolvePromotions carries on
 * from there via the shared finishWaveTransition tail. If nobody's
 * eligible, this calls it directly, same as before promotion existed.
 */
export const chooseBlessing = (
  { G, ctx, events, random }: { G: GameState; ctx: Ctx; events: EndTurnAPI; random: ShuffleAPI },
  blessingId: string,
) => {
  if (!G.awaitingBlessing) return INVALID_MOVE;
  if (!G.offeredBlessingIds.includes(blessingId)) return INVALID_MOVE;

  const blessing = BLESSINGS.find((candidate) => candidate.id === blessingId);
  if (!blessing) return INVALID_MOVE;

  // Fortune's boost only ever covers the single wave right after it's
  // picked — reset before applying, so picking anything else lets it lapse.
  G.modifiers.dropChanceMultiplier = 1;
  blessing.apply(G);

  for (const unit of unitsOf(G, 'player')) {
    unit.hasMoved = false;
    unit.hasActed = false;
    const start = G.playerStart[unit.id];
    if (start) {
      unit.x = start.x;
      unit.y = start.y;
    }
  }

  G.modifiers.guardianAngelCharges = G.modifiers.guardianAngelMax;
  G.awaitingBlessing = false;
  G.offeredBlessingIds = [];

  const eligible = unitsOf(G, 'player').filter(canPromote);
  if (eligible.length > 0) {
    G.awaitingPromotion = true;
    G.promotionEligibleUnitIds = eligible.map((unit) => unit.id);
    return;
  }

  finishWaveTransition(G, ctx, events, random);
};

/**
 * Resolves the post-blessing promotion pause: promotes every unit id passed
 * (each checked against promotionEligibleUnitIds, so a stale or forged id is
 * silently ignored rather than crashing), then always continues to the next
 * wave via finishWaveTransition — passing an empty array is a valid
 * "promote nobody, continue" skip. Only valid while awaitingPromotion.
 */
export const resolvePromotions = (
  { G, ctx, events, random }: { G: GameState; ctx: Ctx; events: EndTurnAPI; random: ShuffleAPI },
  unitIds: string[],
) => {
  if (!G.awaitingPromotion) return INVALID_MOVE;

  for (const id of unitIds) {
    if (!G.promotionEligibleUnitIds.includes(id)) continue;
    const unit = G.units[id];
    if (!unit) continue;
    const fromClass = unit.className;
    promoteUnit(unit);
    pushLog(G, `${unit.name} is promoted: ${fromClass} -> ${unit.className}!`);
  }

  G.awaitingPromotion = false;
  G.promotionEligibleUnitIds = [];
  finishWaveTransition(G, ctx, events, random);
};

const moves: MoveMap<GameState> = {
  moveUnit,
  attackUnit,
  waitUnit,
  useSkill,
  chooseBlessing,
  resolvePromotions,
  equipItem,
  unequipItem,
};

export interface GameOver {
  winner: Team;
}

/**
 * Both modes share every rule in this file — they differ only in which
 * chapter loads and what counts as clearing it, so they're the same Game
 * definition built with different setup data rather than two engines.
 */
export function createSelvariaGame(
  mode: GameMode,
  chapter: ChapterDef,
  carryOver?: CampaignCarryOver,
  baseLevel?: number,
): Game<GameState> {
  return {
    ...SelvariaGameBase,
    setup: ({ random }) => buildGameState(chapter, mode, random, carryOver, baseLevel),
  };
}

const SelvariaGameBase: Game<GameState> = {
  name: 'project-selvaria',

  setup: ({ random }) => buildGameState(CHAPTER_1, 'roguelike', random),

  // Two sides: '0' is the player's army, '1' is the CPU army.
  minPlayers: 2,
  maxPlayers: 2,

  moves,

  turn: {
    onBegin: ({ G, ctx }) => {
      const team = teamOf(ctx.currentPlayer);
      for (const unit of unitsOf(G, team)) {
        unit.hasMoved = false;
        unit.hasActed = false;
        for (const skillId of Object.keys(unit.skillCooldowns)) {
          if (unit.skillCooldowns[skillId] > 0) unit.skillCooldowns[skillId] -= 1;
        }
        if (unit.debuffTurns > 0) unit.debuffTurns -= 1;
      }
      if (team === 'player' && G.modifiers.healPerTurn > 0) {
        for (const unit of unitsOf(G, 'player')) {
          unit.hp = Math.min(unit.maxHp, unit.hp + G.modifiers.healPerTurn);
        }
      }
      pushLog(G, team === 'player' ? '— Player phase —' : '— Enemy phase —');
    },

    // The phase ends on its own once every unit on the active side is spent.
    endIf: ({ G, ctx }) => {
      const units = unitsOf(G, teamOf(ctx.currentPlayer));
      return units.length > 0 && units.every((unit) => unit.hasActed);
    },
  },

  // A squad wipe always ends the battle. Beyond that it's objective-driven:
  // 'waves' never ends in victory (clearing one just spawns the next via
  // chooseBlessing), while 'rout' is won the moment the last enemy falls.
  endIf: ({ G }): GameOver | undefined => {
    if (unitsOf(G, 'player').length === 0) return { winner: 'enemy' };
    if (G.objectiveType === 'rout' && unitsOf(G, 'enemy').length === 0) return { winner: 'player' };
    return undefined;
  },
};

/**
 * The endless wave-survival run.
 *
 * Temporarily pointed at TEST_MAP_2 (the first map generated straight from
 * MAP_BRIEF.md's Gemini prompt) instead of CHAPTER_1, to playtest it —
 * there's no chapter-select UI, so swapping the one active roguelike
 * chapter is the only way to make a new map reachable. Was TEST_MAP_1
 * before this; swap back to CHAPTER_1 once testing's done. CHAPTER_1
 * itself is untouched.
 */
export const ProjectSelvaria = createSelvariaGame('roguelike', TEST_MAP_2);

/** Campaign chapter 1, a fixed-composition rout on its own map. */
export const ProjectSelvariaCampaign = createSelvariaGame('campaign', CAMPAIGN_CHAPTER_1);

export { PLAYER_ID };
