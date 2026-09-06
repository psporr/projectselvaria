import type { ClassName } from './classes';
import { statsAtLevel } from './classes';
import type { GameState, TrialId, Unit } from './types';
import type { ShuffleAPI } from './maps';
import { terrainAt } from './grid';

const BASE_ENEMY_COUNT = 4;
const MAX_ENEMIES = 6;

/**
 * Run structure (tactics-roguelike-design skill's run-structure.md): the
 * Crossing is a fixed, hand-tunable opening ramp; the Stretch escalates
 * toward the run's first real checkpoint; every 10th wave from then on is a
 * Boss wave — a distinct encounter type (see `spawnBossWave`), not just
 * "another wave" — and clearing one pauses the run on `awaitingRunChoice`
 * (game.ts) so the player can bank their Embers or push into the Depths,
 * the run's opt-in infinite tail. `wave % BOSS_INTERVAL === 0` is checked
 * first, so a Depths wave that lands on a multiple of 10 (20, 30, ...) is
 * still a Boss wave, giving the endless tail the same periodic checkpoint
 * rhythm the finite Crossing/Stretch has, rather than escalating unchecked
 * forever with no chance to stop.
 */
export type RunPhase = 'crossing' | 'stretch' | 'boss' | 'depths';

const CROSSING_LENGTH = 5;
const STRETCH_LENGTH = 4;
const BOSS_INTERVAL = 10;

export function runPhaseForWave(wave: number): RunPhase {
  if (wave % BOSS_INTERVAL === 0) return 'boss';
  if (wave <= CROSSING_LENGTH) return 'crossing';
  if (wave <= CROSSING_LENGTH + STRETCH_LENGTH) return 'stretch';
  return 'depths';
}

/** Enemies spawn in the top two rows — mirrors the player's own start rows. */
const ENEMY_ZONE_ROWS = [0, 1];

interface Coord {
  x: number;
  y: number;
}

function enemySpawnPool(G: GameState): Coord[] {
  const pool: Coord[] = [];
  for (const y of ENEMY_ZONE_ROWS) {
    for (let x = 0; x < G.width; x++) {
      if (terrainAt(G, x, y).passable) pool.push({ x, y });
    }
  }
  return pool;
}

/** Swarming (trials.ts) adds 1 to both the base count and the cap — more enemies from the first wave on, not just a higher ceiling nothing reaches until late. */
function enemyCountForWave(G: GameState, wave: number): number {
  const swarming = G.activeTrials.includes('swarming') ? 1 : 0;
  return Math.min(BASE_ENEMY_COUNT + swarming + Math.floor((wave - 1) / 2), MAX_ENEMIES + swarming);
}

/**
 * Named enemy compositions — tactics-adaptation.md: "enemy count and
 * composition variety... reads as fairer and more interesting" than pure
 * stat scaling, and procedural-vs-handcrafted.md: hand-author the
 * compositions, proceduralize which one is drawn, rather than rolling each
 * unit's class independently. Base classes only, matching classes.ts's
 * ALL_CLASSES restriction to what's actually balance-tested at wave-1
 * strength — the 9 class-tree-rework advanced classes stay reserved for
 * PROMOTES_TO, never a random spawn (that file's own doc comment has the
 * balance-testing history). A composition shorter than a wave's enemy
 * count repeats through it via modulo, same as the old shuffled-class-order
 * draw used to.
 */
interface Warband {
  name: string;
  classes: ClassName[];
}

const WARBANDS: Warband[] = [
  { name: 'Iron Vanguard', classes: ['Fighter', 'General', 'Barbarian', 'Mercenary'] },
  { name: 'Arcane Circle', classes: ['Mage', 'Dark Mage', 'Cleric', 'Mage'] },
  { name: 'Skirmish Line', classes: ['Archer', 'Thief', 'Assassin', 'Archer'] },
  { name: 'Steel Guard', classes: ['Swordsman', 'Lancer', 'Fighter', 'Cleric'] },
  { name: 'Shadow Pack', classes: ['Thief', 'Assassin', 'Dancer', 'Assassin'] },
];

/** Boss-wave pairings (spawnBossWave) — kept distinct from WARBANDS since a 2-unit Boss wave reads better as a themed duo than a slice of a 4-class list. */
const BOSS_DUOS: Warband[] = [
  { name: 'Twin Blades', classes: ['Fighter', 'Fighter'] },
  { name: 'Iron Wall', classes: ['General', 'Fighter'] },
  { name: 'Arcane Pair', classes: ['Mage', 'Dark Mage'] },
  { name: 'Vanguard & Support', classes: ['Barbarian', 'Cleric'] },
];

/** Grueling (trials.ts): every enemy spawns as if the wave were this many levels further along. */
const GRUELING_LEVEL_BONUS = 2;
/** Ironclad Foes (trials.ts): flat Def added to every spawned enemy. */
const IRONCLAD_DEF_BONUS = 2;

function trialLevelBonus(activeTrials: TrialId[]): number {
  return activeTrials.includes('grueling') ? GRUELING_LEVEL_BONUS : 0;
}

function trialDefBonus(activeTrials: TrialId[]): number {
  return activeTrials.includes('ironclad-foes') ? IRONCLAD_DEF_BONUS : 0;
}

/**
 * Spawns a fresh, procedurally composed wave directly into G.units, drawn
 * from a random Warband (see above) rather than each unit rolling its
 * class independently. Enemy level equals the wave number (plus Grueling's
 * bonus, if active) — wave 1 is level 1, matching a fresh recruit — so
 * difficulty scales through the same level/stat system the player squad
 * levels up through. Returns the Warband's name so callers (game.ts's
 * finishWaveTransition) can name the wave in the battle log.
 */
export function spawnWave(G: GameState, wave: number, random: ShuffleAPI): string {
  const count = enemyCountForWave(G, wave);
  const pool = random.Shuffle(enemySpawnPool(G));
  if (pool.length < count) {
    throw new Error(`Not enough enemy spawn tiles (${pool.length}) for a wave of ${count}`);
  }

  const warband = random.Shuffle(WARBANDS)[0];
  const level = wave + trialLevelBonus(G.activeTrials);
  const defBonus = trialDefBonus(G.activeTrials);

  for (let i = 0; i < count; i++) {
    const className = warband.classes[i % warband.classes.length];
    const stats = statsAtLevel(className, level);
    const id = `enemy-w${wave}-${i}`;

    const unit: Unit = {
      id,
      name: `${className} Shadow`,
      team: 'enemy',
      className,
      x: pool[i].x,
      y: pool[i].y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def + defBonus,
      move: stats.move,
      range: stats.range,
      hit: stats.hit,
      crit: stats.crit,
      hasMoved: false,
      hasActed: false,
      level,
      exp: 0,
      equipment: {},
      skillCooldowns: {},
      debuffDef: 0,
      debuffTurns: 0,
      buffAtk: 0,
      buffTurns: 0,
    };

    G.units[id] = unit;
  }

  return warband.name;
}

const BOSS_ENEMY_COUNT = 2;
/** How far above the wave's own level a Boss wave's units are levelled — fewer, meaningfully stronger units instead of another mob, the "distinct encounter type" the room-grammar guidance (run-structure.md) calls for. */
const BOSS_LEVEL_BONUS = 4;
/** Grim Bosses (trials.ts): added on top of BOSS_LEVEL_BONUS (and Grueling's own bonus, if also active). */
const GRIM_BOSS_LEVEL_BONUS = 3;

/**
 * Spawns a Boss wave (runPhaseForWave) — 2 "Warlord"-named units well above
 * the wave's own level rather than the usual capped mob, so a boss
 * checkpoint reads as a real spike rather than just a bigger version of a
 * normal wave. Drawn from a themed Boss Duo (see BOSS_DUOS) rather than 2
 * independently-rolled classes, for the same composition-identity reason
 * spawnWave draws from a Warband. Shares spawnWave's spawn-tile pool and
 * Trials-effect helpers; returns the Duo's name for the battle log.
 */
export function spawnBossWave(G: GameState, wave: number, random: ShuffleAPI): string {
  const pool = random.Shuffle(enemySpawnPool(G));
  if (pool.length < BOSS_ENEMY_COUNT) {
    throw new Error(`Not enough enemy spawn tiles (${pool.length}) for a boss wave of ${BOSS_ENEMY_COUNT}`);
  }

  const duo = random.Shuffle(BOSS_DUOS)[0];
  const grimBonus = G.activeTrials.includes('grim-bosses') ? GRIM_BOSS_LEVEL_BONUS : 0;
  const level = wave + BOSS_LEVEL_BONUS + trialLevelBonus(G.activeTrials) + grimBonus;
  const defBonus = trialDefBonus(G.activeTrials);

  for (let i = 0; i < BOSS_ENEMY_COUNT; i++) {
    const className = duo.classes[i % duo.classes.length];
    const stats = statsAtLevel(className, level);
    const id = `enemy-w${wave}-boss-${i}`;

    const unit: Unit = {
      id,
      name: `${className} Warlord`,
      team: 'enemy',
      className,
      x: pool[i].x,
      y: pool[i].y,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      atk: stats.atk,
      def: stats.def + defBonus,
      move: stats.move,
      range: stats.range,
      hit: stats.hit,
      crit: stats.crit,
      hasMoved: false,
      hasActed: false,
      level,
      exp: 0,
      equipment: {},
      skillCooldowns: {},
      debuffDef: 0,
      debuffTurns: 0,
      buffAtk: 0,
      buffTurns: 0,
    };

    G.units[id] = unit;
  }

  return duo.name;
}
