/**
 * Map validation.
 *
 * NEW for the rebuild — HANDOFF.md §5/§9 describes this as a script that
 * "caught real problems" in the old prototype (a water tile dropped on a
 * spawn point would silently brick that unit), but no such script survived
 * in the old repo to port. Written fresh here, run before shipping any map
 * change:
 *
 *   npm run validate-maps
 *
 * Checks, per chapter:
 *   1. Every authored unit spawn lands on passable ground.
 *   2. No passable tile is isolated — every passable tile is reachable from
 *      every other passable tile by BFS over plain adjacency (ignoring move
 *      cost and unit occupancy, since this is about map topology, not any
 *      one unit's move stat).
 */
import { CAMPAIGN_CHAPTER_1, CAMPAIGN_CHAPTER_2, CHAPTER_1, TEST_MAP_1, TEST_MAP_1_DETAILED, type ChapterDef } from '../game/maps';
import { TERRAIN, type TerrainType } from '../game/types';

const LEGEND: Record<string, TerrainType> = { '.': 'plain', f: 'forest', '#': 'wall', w: 'water' };

interface Coord {
  x: number;
  y: number;
}

function parseTiles(rows: string[]): TerrainType[][] {
  return rows.map((row) => [...row].map((char) => LEGEND[char]));
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** BFS over 4-directional adjacency between passable tiles only. */
function connectedComponents(tiles: TerrainType[][]): Map<string, number> {
  const height = tiles.length;
  const width = tiles[0]?.length ?? 0;
  const componentOf = new Map<string, number>();
  let nextComponent = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!TERRAIN[tiles[y][x]].passable) continue;
      const key = tileKey(x, y);
      if (componentOf.has(key)) continue;

      const component = nextComponent++;
      const queue: Coord[] = [{ x, y }];
      componentOf.set(key, component);

      while (queue.length > 0) {
        const current = queue.pop()!;
        const neighbours: Coord[] = [
          { x: current.x + 1, y: current.y },
          { x: current.x - 1, y: current.y },
          { x: current.x, y: current.y + 1 },
          { x: current.x, y: current.y - 1 },
        ];
        for (const n of neighbours) {
          if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
          if (!TERRAIN[tiles[n.y][n.x]].passable) continue;
          const nKey = tileKey(n.x, n.y);
          if (componentOf.has(nKey)) continue;
          componentOf.set(nKey, component);
          queue.push(n);
        }
      }
    }
  }

  return componentOf;
}

function validateChapter(chapter: ChapterDef): string[] {
  const errors: string[] = [];
  const tiles = parseTiles(chapter.rows);
  const width = tiles[0]?.length ?? 0;

  if (tiles.some((row) => row.length !== width)) {
    errors.push(`rows of differing widths`);
    return errors;
  }

  for (const unit of chapter.units) {
    if (unit.y < 0 || unit.y >= tiles.length || unit.x < 0 || unit.x >= width) {
      errors.push(`unit "${unit.id}" spawns out of bounds at (${unit.x}, ${unit.y})`);
      continue;
    }
    const terrain = TERRAIN[tiles[unit.y][unit.x]];
    if (!terrain.passable) {
      errors.push(`unit "${unit.id}" spawns on impassable ${terrain.name} at (${unit.x}, ${unit.y})`);
    }
  }

  const componentOf = connectedComponents(tiles);
  const components = new Set(componentOf.values());
  if (components.size > 1) {
    // Report a representative tile from each isolated pocket rather than
    // every tile in it — plenty to locate the problem on the ASCII map.
    const sampleByComponent = new Map<number, Coord>();
    for (let y = 0; y < tiles.length; y++) {
      for (let x = 0; x < width; x++) {
        const key = tileKey(x, y);
        const component = componentOf.get(key);
        if (component !== undefined && !sampleByComponent.has(component)) {
          sampleByComponent.set(component, { x, y });
        }
      }
    }
    errors.push(
      `passable tiles split into ${components.size} disconnected regions: ` +
        [...sampleByComponent.values()].map((c) => `(${c.x}, ${c.y})`).join(', '),
    );
  }

  return errors;
}

const CHAPTERS: ChapterDef[] = [CHAPTER_1, CAMPAIGN_CHAPTER_1, CAMPAIGN_CHAPTER_2, TEST_MAP_1, TEST_MAP_1_DETAILED];

let anyErrors = false;
for (const chapter of CHAPTERS) {
  const errors = validateChapter(chapter);
  if (errors.length === 0) {
    console.log(`OK    ${chapter.id} (${chapter.name})`);
  } else {
    anyErrors = true;
    console.log(`FAIL  ${chapter.id} (${chapter.name})`);
    for (const error of errors) console.log(`        ${error}`);
  }
}

if (anyErrors) process.exitCode = 1;
