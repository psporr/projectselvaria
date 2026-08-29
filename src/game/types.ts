/**
 * Core data model for Project Selvaria.
 *
 * Everything in `GameState` must stay JSON-serialisable: boardgame.io transports
 * it as plain data today, and it's the seam multiplayer and replay build on later.
 */

import type { ClassName } from './classes';

export type Team = 'player' | 'enemy';

/**
 * Roguelike is the endless wave-survival run; campaign is a sequence of
 * hand-authored chapters with their own win conditions. Both share every
 * rule below this line — they differ only in how a battle starts and what
 * counts as clearing it.
 */
export type GameMode = 'roguelike' | 'campaign';

/**
 * What clearing a battle means. 'waves' never ends on its own (roguelike
 * loops until the squad wipes); 'rout' ends the chapter the moment the last
 * enemy falls.
 */
export type ObjectiveType = 'waves' | 'rout';

export type TerrainType = 'plain' | 'forest' | 'wall' | 'water';

export interface Terrain {
  type: TerrainType;
  name: string;
  /** Movement points consumed to enter this tile. Ignored when `passable` is false. */
  moveCost: number;
  passable: boolean;
  /** Added to the occupant's defence while standing here. */
  defBonus: number;
  /** Subtracted from an attacker's hit chance against an occupant standing here. */
  avoid: number;
}

export const TERRAIN: Record<TerrainType, Terrain> = {
  plain: { type: 'plain', name: 'Plain', moveCost: 1, passable: true, defBonus: 0, avoid: 0 },
  forest: { type: 'forest', name: 'Forest', moveCost: 2, passable: true, defBonus: 2, avoid: 30 },
  wall: { type: 'wall', name: 'Wall', moveCost: 0, passable: false, defBonus: 0, avoid: 0 },
  // No unit in the roster can swim or fly, so water blocks movement outright
  // the same way a wall does — it reads as a river/lake obstacle rather than
  // rubble, but plays identically: a chokepoint the squad has to go around.
  water: { type: 'water', name: 'Water', moveCost: 0, passable: false, defBonus: 0, avoid: 0 },
};

/** A slot an item occupies. Each unit has exactly one of each. */
export type ItemSlot = 'weapon' | 'armor' | 'accessory';

/** A physical dropped item — `defId` looks up its stats in the ITEMS catalog. */
export interface Item {
  instanceId: string;
  defId: string;
}

export type EquipmentSlots = Partial<Record<ItemSlot, Item>>;

/**
 * Squad-wide effects accumulated from "permanent" blessing picks. Each is a
 * running total rather than a boolean, so drawing the same blessing again
 * on a later wave stacks rather than being wasted.
 */
export interface SquadModifiers {
  /** Thorns: bonus damage on a player unit's counterattack. */
  counterBonus: number;
  /** Focus: skill cooldowns reduced by this many turns (floored at 1). */
  cooldownReduction: number;
  /** Mending: squad-wide HP regen at the start of each player phase. */
  healPerTurn: number;
  /** Ironclad: multiplies the terrain defence bonus for player units standing on it. */
  terrainDefMultiplier: number;
  /** Executioner: bonus damage a player unit deals to a target at or below half HP. */
  executionerBonus: number;
  /** Guardian Angel: charges granted at the start of each wave. */
  guardianAngelMax: number;
  /** Guardian Angel: charges remaining this wave. */
  guardianAngelCharges: number;
  /** Fortune: multiplies drop chance for the wave right after it's picked, then resets to 1. */
  dropChanceMultiplier: number;
}

export interface Unit {
  id: string;
  name: string;
  team: Team;
  className: ClassName;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Base attack, before any equipped item bonuses. */
  atk: number;
  /** Base defence, before any equipped item bonuses. */
  def: number;
  /** Base movement points per turn, before any equipped item bonuses. */
  move: number;
  /** Base attack reach in tiles (Manhattan distance), before item bonuses. 1 = melee, 2 = bow. */
  range: number;
  /** Base chance (0-100) an attack from this unit connects, before terrain avoid. */
  hit: number;
  /** Base chance (0-100) a connecting attack from this unit is a critical hit. */
  crit: number;
  /** Movement already spent this turn. */
  hasMoved: boolean;
  /** Unit is finished for this turn (attacked or waited). */
  hasActed: boolean;
  level: number;
  /** Progress toward the next level; reaching EXP_TO_LEVEL rolls over. */
  exp: number;
  /** Only ever populated for player units — enemies never carry loot. */
  equipment: EquipmentSlots;
  /** Turns until each of this unit's class skills is usable again, keyed by SkillDef.id. Absent = ready (0). */
  skillCooldowns: Record<string, number>;
  /** Flat Def penalty from Dark Mage's Curse, applied in effectiveStats() while debuffTurns > 0. */
  debuffDef: number;
  /** Turns left on the Curse debuff above; decremented in turn.onBegin the same way skillCooldowns are. */
  debuffTurns: number;
  /** Flat Atk bonus from Sage's Arcane Ward, applied in effectiveStats() while buffTurns > 0 — the buff mirror of debuffDef above. */
  buffAtk: number;
  /** Turns left on the Arcane Ward buff above; decremented in turn.onBegin the same way debuffTurns is. */
  buffTurns: number;
}

export interface GameState {
  mode: GameMode;
  objectiveType: ObjectiveType;
  /** Which ChapterDef this battle was built from — campaign uses it to know what comes next. */
  chapterId: string;
  chapterName: string;
  /** Compact chapter title for the in-battle header. */
  chapterShortName: string;
  objective: string;
  /**
   * Where each player unit began. Roguelike resets the squad here between
   * waves; kept in state rather than derived from a module-level chapter
   * constant so different chapters can be loaded at runtime.
   */
  playerStart: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
  /** Row-major terrain grid, indexed as tiles[y][x]. */
  tiles: TerrainType[][];
  units: Record<string, Unit>;
  /** Newest-first battle log, capped in length. */
  log: string[];
  /** 1-indexed; increments each time a wave of enemies is fully cleared. */
  wave: number;
  /** True between clearing a wave and the player picking a blessing to continue. */
  awaitingBlessing: boolean;
  /** Dropped items not currently equipped by any unit, shared across the squad. */
  inventory: Item[];
  /** Bumped on every drop so instance ids stay unique without a random source. */
  nextItemInstance: number;
  /** Running totals from every "permanent" blessing picked so far this run. */
  modifiers: SquadModifiers;
  /** Player units that have died this run, kept around for The Fallen to revive. */
  fallenUnits: Unit[];
  /** The 3 blessing ids drawn for the current wave-clear pause; empty until the first one. */
  offeredBlessingIds: string[];
  /** True after a blessing's been picked, while any level-10+ unit still has an unresolved promotion offer for this wave-clear pause. */
  awaitingPromotion: boolean;
  /** Player unit ids offered promotion this wave-clear pause; empty unless awaitingPromotion. */
  promotionEligibleUnitIds: string[];
  /**
   * The most recent `attackUnit` exchange's outcome — presentation-only,
   * like `nextItemInstance` (loot toasts): nothing in `game/` ever reads
   * this back, it exists purely so the UI can sequence the attack/counter
   * beats it animates instead of only seeing a combined before/after HP
   * diff. Never reset to null once combat has happened this battle —
   * `seq` (ever-increasing) is what a diff-based caller checks, the same
   * "last-seen count" pattern `nextItemInstance` already established.
   */
  lastCombat: CombatResult | null;
}

/** One resolved swing — already rolled, already applied to `hp`. Presentation reads it to decide what to animate; nothing here is itself a roll. */
export interface CombatBeat {
  attackerId: string;
  defenderId: string;
  hit: boolean;
  crit: boolean;
  /** 0 on a miss. */
  damage: number;
}

/** One `attackUnit` exchange: the attacker's swing, and the defender's counter if one happened (out of range, or the attack killed first, both read as `null` — no counter to animate). */
export interface CombatResult {
  /** Ever-increasing across the whole battle — never derived from anything else, so two exchanges with identical-looking beats still diff as distinct events. */
  seq: number;
  attack: CombatBeat;
  counter: CombatBeat | null;
}

/** boardgame.io player IDs mapped onto the two sides of a battle. */
export const PLAYER_ID: Record<Team, string> = { player: '0', enemy: '1' };

export function teamOf(playerID: string): Team {
  return playerID === PLAYER_ID.enemy ? 'enemy' : 'player';
}
