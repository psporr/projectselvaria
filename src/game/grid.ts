import type { GameState, Team, Terrain, Unit } from './types';
import { TERRAIN } from './types';
import { effectiveStats, forestMoveCostFor } from './equipment';

export interface Coord {
  x: number;
  y: number;
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function manhattan(a: Coord, b: Coord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function inBounds(G: GameState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < G.width && y < G.height;
}

export function terrainAt(G: GameState, x: number, y: number): Terrain {
  return TERRAIN[G.tiles[y][x]];
}

export function unitAt(G: GameState, x: number, y: number): Unit | undefined {
  return Object.values(G.units).find((unit) => unit.x === x && unit.y === y);
}

export function unitsOf(G: GameState, team: Team): Unit[] {
  return Object.values(G.units).filter((unit) => unit.team === team);
}

const NEIGHBOURS: Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export interface ReachableTile extends Coord {
  /** Movement points spent getting here. */
  cost: number;
}

/**
 * Dijkstra over terrain move costs, Fire Emblem rules:
 * allied units can be passed through but not landed on, enemies block entirely.
 *
 * A unit that has already moved this turn is pinned to its current tile.
 */
export function computeReachable(G: GameState, unit: Unit): Map<string, ReachableTile> {
  const origin: ReachableTile = { x: unit.x, y: unit.y, cost: 0 };
  const reachable = new Map<string, ReachableTile>([[tileKey(unit.x, unit.y), origin]]);

  if (unit.hasMoved) return reachable;

  const move = effectiveStats(unit).move;

  // Best known cost to *enter* a tile, including tiles we may only pass through.
  const best = new Map<string, number>([[tileKey(unit.x, unit.y), 0]]);
  const frontier: ReachableTile[] = [origin];

  while (frontier.length > 0) {
    // The grid is small, so a linear scan for the cheapest node is plenty fast.
    let cheapestIndex = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[cheapestIndex].cost) cheapestIndex = i;
    }
    const current = frontier.splice(cheapestIndex, 1)[0];
    if (current.cost > (best.get(tileKey(current.x, current.y)) ?? Infinity)) continue;

    for (const step of NEIGHBOURS) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!inBounds(G, x, y)) continue;

      const terrain = terrainAt(G, x, y);
      if (!terrain.passable) continue;

      const occupant = unitAt(G, x, y);
      if (occupant && occupant.team !== unit.team) continue;

      const terrainCost = terrain.type === 'forest' ? forestMoveCostFor(unit, terrain.moveCost) : terrain.moveCost;
      const cost = current.cost + terrainCost;
      if (cost > move) continue;

      const key = tileKey(x, y);
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);

      const tile: ReachableTile = { x, y, cost };
      frontier.push(tile);
      // Allies are walked through, never stopped on.
      if (!occupant) reachable.set(key, tile);
    }
  }

  return reachable;
}

/**
 * BFS step-distance from `origin` to every tile reachable over passable
 * terrain, ignoring move cost and unit occupancy — unlike computeReachable,
 * this isn't "can I get there this turn," it's "how many tiles away is this,
 * going around walls/water rather than through them." Used by the AI's
 * approach heuristic (ai.ts's bestApproach) so a unit finds its way around a
 * chokepoint instead of refusing to step sideways away from an obstacle that
 * only *looks* farther in straight-line (Manhattan) terms.
 */
export function pathDistances(G: GameState, origin: Coord): Map<string, number> {
  const dist = new Map<string, number>([[tileKey(origin.x, origin.y), 0]]);
  const queue: Coord[] = [origin];

  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const d = dist.get(tileKey(current.x, current.y))!;
    for (const step of NEIGHBOURS) {
      const x = current.x + step.x;
      const y = current.y + step.y;
      if (!inBounds(G, x, y) || !terrainAt(G, x, y).passable) continue;
      const key = tileKey(x, y);
      if (dist.has(key)) continue;
      dist.set(key, d + 1);
      queue.push({ x, y });
    }
  }

  return dist;
}

/** Enemies of `unit` that could be struck if it attacked from (x, y). */
export function targetsFrom(G: GameState, unit: Unit, x: number, y: number): Unit[] {
  const range = effectiveStats(unit).range;
  return Object.values(G.units).filter(
    (other) => other.team !== unit.team && manhattan({ x, y }, other) <= range,
  );
}

/**
 * Every tile the unit could strike this turn — its movement range expanded by
 * its attack reach. Used to paint threat ranges in the UI.
 */
export function computeThreatTiles(
  G: GameState,
  unit: Unit,
  reachable: Map<string, ReachableTile>,
): Set<string> {
  const threatened = new Set<string>();
  const range = effectiveStats(unit).range;

  for (const tile of reachable.values()) {
    for (let dx = -range; dx <= range; dx++) {
      const remaining = range - Math.abs(dx);
      for (let dy = -remaining; dy <= remaining; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (!inBounds(G, x, y)) continue;
        if (!terrainAt(G, x, y).passable) continue;
        threatened.add(tileKey(x, y));
      }
    }
  }

  return threatened;
}
