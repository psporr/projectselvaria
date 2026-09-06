/**
 * Core data model for Project Selvaria.
 *
 * Everything in `GameState` must stay JSON-serialisable: boardgame.io transports
 * it as plain data today, and it's the seam multiplayer and replay build on later.
 */

import type { ClassName } from './classes';

export type Team = 'player' | 'enemy';

/**
 * A blessing's thematic identity group (blessings.ts) — Vanguard/Bulwark/
 * Farsight/Fortune, per the tactics-roguelike-design skill's
 * build-variety-and-choice-design.md: grouping the pool gives picks a
 * legible direction before the tooltip's numbers do, and lets picking
 * 2+ from the same House unlock a bonus Duo blessing (GameState's
 * `housePicks`), the same "commit to a direction, get rewarded for it"
 * lever Hades' god-pair duo boons use. Lives in types.ts rather than
 * blessings.ts so GameState (this file) can reference it without a
 * circular import — same reasoning as Team/GameMode/TerrainType above.
 */
export type BlessingHouse = 'vanguard' | 'bulwark' | 'farsight' | 'fortune';

/**
 * An opt-in, player-chosen difficulty modifier (src/game/trials.ts) — Hades'
 * Pact of Punishment/Slay the Spire's Ascension adapted to this game: chosen
 * before a run starts (MainMenuScene's Trials panel), never sprung on the
 * player mid-run, each contributing a visible Embers bonus in exchange for
 * a harder run. Lives in types.ts rather than trials.ts for the same
 * circular-import reason as BlessingHouse above.
 */
export type TrialId = 'grueling' | 'swarming' | 'ironclad-foes' | 'grim-bosses';

/**
 * A node on the run's branching path (src/game/runMap.ts) — Slay the
 * Spire's map, adapted: 'battle'/'elite' are fights (Elite is a harder
 * Warband with a guaranteed better blessing reward), 'rest' is a heal-or-
 * permanent-upgrade choice, 'shop' spends the run's Gold on blessings,
 * 'boss' is the segment's checkpoint (game.ts's existing Bank/Descend
 * choice). Lives in types.ts for the same circular-import reason as
 * BlessingHouse/TrialId above.
 */
export type MapNodeType = 'battle' | 'elite' | 'rest' | 'shop' | 'boss';

/** One of the choices offered at a path junction (GameState's `nodeChoices`) — `id` is only unique within that one offer, not across the run. */
export interface MapNodeOption {
  id: string;
  type: MapNodeType;
}

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
  /** Blood Oath (Vanguard duo): HP a melee player unit heals whenever it lands a killing blow, on top of any equipped kill-heal gear. */
  meleeKillHeal: number;
  /** Unbreakable (Bulwark duo): a player unit's counterattack is always a critical hit. */
  counterAlwaysCrit: boolean;
  /** Perfect Aim (Farsight duo): a ranged (range 2+) player unit's attacks always hit. */
  rangedAlwaysHit: boolean;
  /** Windfall: this many of the next blessing draws are guaranteed to include a legendary option (decrements by 1 each draw it applies to). */
  guaranteedLegendaryDraws: number;
  /** The Phoenix (Fortune duo): The Fallen, when available, is always offered as a bonus option alongside the normal 3 — see `drawBlessings`. */
  phoenixActive: boolean;
  /** Berserker: bonus damage a player unit deals while at or below half its own HP — the attacker-side mirror of Executioner's defender-side check. */
  berserkerBonus: number;
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
  /** How many blessings picked so far this run belong to each House — drives Duo-blessing unlocks (blessings.ts's `isAvailable` gates check this). Counts every pick, including repeats; a Duo blessing itself has no `house` and doesn't bump its own House's count. */
  housePicks: Record<BlessingHouse, number>;
  /** Every blessing id picked so far this run, in order (repeats included) — free (chooseBlessing) or bought (buyShopOffer). Presentation-only, like lastCombat: nothing in game/ reads this back, it exists purely for PathScene's Blessings review to show what the run has actually collected, since housePicks/modifiers alone can't reconstruct "which blessings" from their aggregate totals. */
  pickedBlessingIds: string[];
  /** Player units that have died this run, kept around for The Fallen to revive. */
  fallenUnits: Unit[];
  /** True right after clearing a Boss node's blessing pick (game/runMap.ts's SEGMENT_LENGTH), while the player chooses to bank the run's Embers or push into the Depths — see game.ts's chooseRunPath. */
  awaitingRunChoice: boolean;
  /** True once the player has chosen to bank the run at a Boss-node checkpoint. endIf reads this as a player win; src/game/meta.ts's computeEmbersEarned reads it to award the bank bonus on top of the same per-wave rate a wipe earns. */
  runBanked: boolean;
  /** Roguelike-only, chosen before the run starts (empty for campaign): which Trials (src/game/trials.ts) are active this run. Read by waves.ts's spawnWave/spawnBossWave for their effects and by meta.ts's computeEmbersEarned for the matching Embers bonus. */
  activeTrials: TrialId[];
  /** How many junctions resolved since the current path segment began (game/runMap.ts). 0 means "just entered a fresh segment" — the next junction offered is battle-only, a safe re-entry after a Boss. Resets to 0 on Descend (chooseRunPath) so the run reads as one continuous path rather than a new, separate map. */
  segmentDepth: number;
  /** The type of the node currently being resolved (a fight in progress, or Rest/Shop open) — null while awaitingNodeChoice is true, between nodes. */
  currentNodeType: MapNodeType | null;
  /** True while the player is choosing which of `nodeChoices` to enter next — the run's branching-path decision point. */
  awaitingNodeChoice: boolean;
  /** The 2-3 node options currently on offer; empty unless awaitingNodeChoice. */
  nodeChoices: MapNodeOption[];
  /** Per-run currency (src/game/runMap.ts) — resets to 0 every run, earned clearing battle/elite/Boss nodes, spent at Shop nodes. Distinct from Embers (meta.ts), which persists across runs. */
  gold: number;
  /** True while a Shop node's offer is open. */
  awaitingShop: boolean;
  /** Blessing ids currently offered at the open Shop — same shape as offeredBlessingIds, priced by rarity (blessings.ts's SHOP_PRICE_BY_RARITY). Bought ids are removed as they're purchased. */
  shopOfferIds: string[];
  /** True while a Rest node's heal-or-upgrade choice is open. */
  awaitingRest: boolean;
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
