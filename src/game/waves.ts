import type { GameState, Unit } from './types';
import { ALL_CLASSES, statsAtLevel } from './classes';
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

function enemyCountForWave(wave: number): number {
  return Math.min(BASE_ENEMY_COUNT + Math.floor((wave - 1) / 2), MAX_ENEMIES);
}

/**
 * Spawns a fresh, procedurally composed wave directly into G.units.
 * Class assignment reuses the same "shuffle once, no duplicates until the
 * pool wraps" approach as the starting enemies, so composition is balanced
 * but different every wave. Enemy level equals the wave number — wave 1 is
 * level 1, matching a fresh recruit — so difficulty scales through the same
 * level/stat system the player squad levels up through.
 */
export function spawnWave(G: GameState, wave: number, random: ShuffleAPI): void {
  const count = enemyCountForWave(wave);
  const pool = random.Shuffle(enemySpawnPool(G));
  if (pool.length < count) {
    throw new Error(`Not enough enemy spawn tiles (${pool.length}) for a wave of ${count}`);
  }

  const classOrder = random.Shuffle(ALL_CLASSES);

  for (let i = 0; i < count; i++) {
    const className = classOrder[i % classOrder.length];
    const stats = statsAtLevel(className, wave);
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
      def: stats.def,
      move: stats.move,
      range: stats.range,
      hit: stats.hit,
      crit: stats.crit,
      hasMoved: false,
      hasActed: false,
      level: wave,
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
}

const BOSS_ENEMY_COUNT = 2;
/** How far above the wave's own level a Boss wave's units are levelled — fewer, meaningfully stronger units instead of another mob, the "distinct encounter type" the room-grammar guidance (run-structure.md) calls for. */
const BOSS_LEVEL_BONUS = 4;

/**
 * Spawns a Boss wave (runPhaseForWave) — 2 "Warlord"-named units well above
 * the wave's own level rather than the usual capped-at-6 mob, so a boss
 * checkpoint reads as a real spike rather than just a bigger version of a
 * normal wave. Shares spawnWave's spawn-tile pool and class-shuffle
 * approach, just with a different count/level formula.
 */
export function spawnBossWave(G: GameState, wave: number, random: ShuffleAPI): void {
  const pool = random.Shuffle(enemySpawnPool(G));
  if (pool.length < BOSS_ENEMY_COUNT) {
    throw new Error(`Not enough enemy spawn tiles (${pool.length}) for a boss wave of ${BOSS_ENEMY_COUNT}`);
  }

  const classOrder = random.Shuffle(ALL_CLASSES);
  const level = wave + BOSS_LEVEL_BONUS;

  for (let i = 0; i < BOSS_ENEMY_COUNT; i++) {
    const className = classOrder[i % classOrder.length];
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
      def: stats.def,
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
}
