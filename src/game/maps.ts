import type { EquipmentSlots, GameMode, GameState, Item, ObjectiveType, Team, TerrainType, Unit } from './types';
import { ALL_CLASSES, PLAYER_START_LEVEL, statsAtLevel, type ClassName } from './classes';
import type { DialogueScript, MapEvent } from './story';

/**
 * What a player squad carries from one campaign chapter into the next:
 * level/exp/equipment per surviving unit (keyed by the unit id shared
 * across every chapter's roster) plus the shared inventory. A unit id with
 * no entry here just starts that chapter at its authored defaults — covers
 * both a fallen unit (rejoins fresh rather than staying dead across
 * chapters) and a unit new to a later chapter.
 *
 * `className` is only present if the unit was promoted (`classes.ts`'s
 * `PROMOTES_TO`) before carrying over — absent means "use next chapter's
 * authored default class," preserving every non-promoted unit's usual
 * behavior. Promotion at chapter-end resets level/exp the same way
 * `promoteUnit` does for a live unit, just applied to this carry-over
 * record instead of a `Unit` directly, since the match is already over by
 * then (no more moves to dispatch).
 */
export interface CampaignCarryOver {
  units: Record<string, { level: number; exp: number; equipment: EquipmentSlots; className?: ClassName }>;
  inventory: Item[];
  nextItemInstance: number;
}

/**
 * The slice of boardgame.io's RandomAPI we actually need. Defined locally
 * rather than imported — boardgame.io's package `types` entry doesn't
 * re-export RandomAPI, only uses it internally.
 */
export interface ShuffleAPI {
  Shuffle<T>(deck: T[]): T[];
}

/**
 * Maps are authored as ASCII art so they stay easy to eyeball and tweak:
 *   '.' plain   'f' forest   '#' wall   'w' water
 */
const LEGEND: Record<string, TerrainType> = {
  '.': 'plain',
  f: 'forest',
  '#': 'wall',
  w: 'water',
};

interface UnitPlacement {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
}

/**
 * Player roster (2026-08-27, reshuffled): Jill (Fighter), Marisa (Thief),
 * Ephraim (Lancer), Lyn (Archer), Solen (Mage), Natasha (Cleric) — 6 named
 * heroes with real map art (`heroArt.ts`), repeated with per-chapter spawn
 * coordinates across every chapter below. One hero per class again, no
 * duplicates.
 *
 * Jill moved from Barbarian to the new Fighter base class (2026-08-27,
 * class-tree rework Part 3) — Barbarian has no promotion and was reserved
 * for enemy use going forward (`classes.ts`'s `PROMOTES_TO`), so Jill needed
 * a promotable base class to be eligible for the new Berserker/Axe Master
 * branch like the rest of the roster is eligible for their own.
 *
 * Marisa is Thief specifically so `classes.ts`'s first wired promotion pair
 * (Thief -> Assassin) is actually reachable by leveling a real roster
 * member, not just provable headlessly. Lyn moved from Swordsman to Archer
 * in the same pass (Takumi, the previous Archer, and Eirika, the previous
 * second Swordsman, both dropped from the lineup — still valid
 * `ClassName`-having heroes with their own art in principle, just not in
 * any chapter's starting lineup right now).
 *
 * `id: 'lyn'` used to mean Eirika (a since-fixed naming leftover from
 * before that character was renamed) — with Eirika dropped, that id is
 * retired too; the real Lyn keeps her existing `id: 'lyn2'` rather than
 * reclaiming `'lyn'`, so no local save's carry-over data silently orphans.
 * Every hero not currently in the lineup (including Eirika/Takumi now) is
 * re-addable by inserting their old `UnitSpec` line with a free spawn tile
 * — nothing else to undo.
 */

/** A unit whose class (and therefore stats) is fixed at authoring time. */
export interface FixedClassUnitSpec extends UnitPlacement {
  className: ClassName;
}

/** A unit whose class is drawn from the full class pool when the chapter starts. */
export interface RandomClassUnitSpec extends UnitPlacement {
  randomClass: true;
}

export type UnitSpec = FixedClassUnitSpec | RandomClassUnitSpec;

export interface ChapterDef {
  id: string;
  /** Full title, shown on the chapter-select screen. */
  name: string;
  /**
   * Compact title for the in-battle header, which sits beside the icon row
   * and has very little width on a phone. Explicit rather than derived by
   * splitting `name` on ':' so a chapter can choose its own abbreviation.
   */
  shortName: string;
  objective: string;
  objectiveType: ObjectiveType;
  rows: string[];
  units: UnitSpec[];
  /** Shown once, full-screen, before the battle becomes playable. Roguelike chapters have none. */
  intro?: DialogueScript;
  /** Shown once the objective is cleared, before returning to chapter select. */
  outro?: DialogueScript;
  /** Story beats that can interrupt play once their trigger condition is met. */
  events?: MapEvent[];
}

function parseTiles(rows: string[]): TerrainType[][] {
  return rows.map((row, y) =>
    [...row].map((char, x) => {
      const terrain = LEGEND[char];
      if (!terrain) {
        throw new Error(`Unknown map character "${char}" at (${x}, ${y})`);
      }
      return terrain;
    }),
  );
}

/**
 * Expands a chapter definition into the initial mutable game state.
 *
 * `random` resolves any `randomClass` units — each draws a distinct class
 * from a single shuffle of the full class pool, so a chapter with up to
 * `ALL_CLASSES.length` random units gets balanced, no-duplicate coverage
 * that's still shuffled differently every battle.
 */
export function buildGameState(
  chapter: ChapterDef,
  mode: GameMode,
  random: ShuffleAPI,
  carryOver?: CampaignCarryOver,
  /**
   * What a player unit starts at when it has no carry-over entry. Defaults
   * to PLAYER_START_LEVEL — the caller only overrides this for a campaign
   * chapter entered directly through Chapter Select, where it's set to
   * PLAYER_START_LEVEL plus the chapter's position in the list, so jumping
   * straight into a later chapter doesn't leave the squad under-levelled
   * for it the way a flat starting level would.
   */
  baseLevel: number = PLAYER_START_LEVEL,
): GameState {
  const tiles = parseTiles(chapter.rows);
  const width = tiles[0]?.length ?? 0;

  if (tiles.some((row) => row.length !== width)) {
    throw new Error(`Chapter "${chapter.name}" has rows of differing widths`);
  }

  const shuffledClasses = random.Shuffle(ALL_CLASSES);
  let nextRandomClassIndex = 0;

  const units: Record<string, Unit> = {};
  for (const spec of chapter.units) {
    // A unit carried over from a previous campaign chapter picks up where it
    // left off; anyone else — roguelike, a fresh campaign chapter, a unit
    // that fell and wasn't in the carry-over — starts at its authored
    // default. Enemies never carry over.
    const carried = spec.team === 'player' ? carryOver?.units[spec.id] : undefined;
    // A promoted unit's carried className overrides the chapter's authored
    // one; everyone else resolves exactly as before.
    const className =
      carried?.className ?? ('className' in spec ? spec.className : shuffledClasses[nextRandomClassIndex++ % shuffledClasses.length]);
    // The squad starts battle-tested; a fresh wave-1 enemy hasn't seen combat yet.
    const level = carried?.level ?? (spec.team === 'player' ? baseLevel : 1);
    const stats = statsAtLevel(className, level);

    units[spec.id] = {
      id: spec.id,
      // Roguelike enemies are anonymous rank-and-file, so their display name
      // is always derived from class — matches the convention spawnWave uses
      // for later waves. Campaign enemies keep their authored name instead:
      // chapters are hand-written and carry story around named individuals
      // (a chapter boss, a recurring rival), which a class-derived label
      // would erase.
      name: spec.team === 'enemy' && mode === 'roguelike' ? `${className} Shadow` : spec.name,
      team: spec.team,
      className,
      x: spec.x,
      y: spec.y,
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
      exp: carried?.exp ?? 0,
      equipment: carried?.equipment ?? {},
      skillCooldowns: {},
      debuffDef: 0,
      debuffTurns: 0,
      buffAtk: 0,
      buffTurns: 0,
    };
  }

  return {
    mode,
    objectiveType: chapter.objectiveType,
    chapterId: chapter.id,
    chapterName: chapter.name,
    chapterShortName: chapter.shortName,
    objective: chapter.objective,
    playerStart: playerStartPositions(chapter),
    width,
    height: tiles.length,
    tiles,
    units,
    log: [mode === 'campaign' ? chapter.name : 'Wave 1 Starts'],
    wave: 1,
    awaitingBlessing: false,
    inventory: carryOver?.inventory ?? [],
    nextItemInstance: carryOver?.nextItemInstance ?? 0,
    modifiers: {
      counterBonus: 0,
      cooldownReduction: 0,
      healPerTurn: 0,
      terrainDefMultiplier: 1,
      executionerBonus: 0,
      guardianAngelMax: 0,
      guardianAngelCharges: 0,
      dropChanceMultiplier: 1,
    },
    fallenUnits: [],
    offeredBlessingIds: [],
    awaitingPromotion: false,
    promotionEligibleUnitIds: [],
    lastCombat: null,
  };
}

/** Where each player unit starts — waves reset the squad here between fights. */
export function playerStartPositions(chapter: ChapterDef): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const spec of chapter.units) {
    if (spec.team === 'player') positions[spec.id] = { x: spec.x, y: spec.y };
  }
  return positions;
}

/**
 * 7x8 portrait grid — one column wider than a 6x8 standard, added as an open
 * flanking lane on the right. Tile size is meant to stay responsive so this
 * fits a mobile viewport without horizontal scrolling.
 */
export const CHAPTER_1: ChapterDef = {
  id: 'frozen-pass',
  name: 'The Frozen Pass',
  shortName: 'The Frozen Pass',
  objective: 'Survive as many waves as you can',
  objectiveType: 'waves',
  rows: [
    '..##...',
    '.......',
    '.ff.ww.',
    '...ff..',
    '.ww.ff.',
    '...ww..',
    '.......',
    '..##...',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 1, y: 6 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 0, y: 6 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 6, y: 6 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 0, y: 7 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 5, y: 7 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 6, y: 7 },
    { id: 'bandit-1', name: 'Bandit 1', team: 'enemy', randomClass: true, x: 1, y: 0 },
    { id: 'bandit-2', name: 'Bandit 2', team: 'enemy', randomClass: true, x: 4, y: 0 },
    { id: 'bandit-3', name: 'Bandit 3', team: 'enemy', randomClass: true, x: 1, y: 1 },
    { id: 'bandit-4', name: 'Bandit 4', team: 'enemy', randomClass: true, x: 4, y: 1 },
  ],
};

/**
 * First campaign chapter. Unlike the roguelike map, enemy classes are fixed
 * rather than drawn at random — a campaign encounter is hand-balanced, so
 * the player can plan around a known composition. The wall band across the
 * middle splits the field into two chokepoints, making the approach a real
 * decision instead of a straight charge.
 */
export const CAMPAIGN_CHAPTER_1: ChapterDef = {
  id: 'iron-gate',
  name: 'Chapter 1: The Iron Gate',
  shortName: 'The Iron Gate',
  objective: 'Defeat all enemies',
  objectiveType: 'rout',
  intro: [
    { speaker: 'Jill', portraitClass: 'Fighter', text: 'That wall ahead is the Iron Gate. Whoever holds it controls the whole pass.' },
    { speaker: 'Ephraim', portraitClass: 'Lancer', text: "And right now that's a garrison that isn't expecting company." },
    { speaker: 'Natasha', portraitClass: 'Cleric', text: "Then let's make sure they regret that. I'll keep everyone standing." },
    { speaker: 'Jill', portraitClass: 'Fighter', text: 'Two chokepoints, archers on the walls. Watch your approach — we go together.' },
  ],
  outro: [
    { speaker: 'Ephraim', portraitClass: 'Lancer', text: 'Gate secured. Whatever they were guarding, it was ours today.' },
    { speaker: 'Jill', portraitClass: 'Fighter', text: "This was only the first line. There's a longer road past this ridge — the Long March, the scouts call it." },
    { speaker: 'Jill', portraitClass: 'Fighter', text: "Rest while you can. We move again soon." },
  ],
  events: [
    {
      id: 'gate-chief-falls',
      trigger: { type: 'unitDefeated', unitId: 'gate-chief' },
      script: [
        { speaker: 'Gate Chief', portraitClass: 'Barbarian', side: 'right', text: "The gate... was never meant to hold..." },
        { speaker: 'Jill', portraitClass: 'Fighter', text: "Their chief's down. Stay sharp — the rest will scatter or dig in." },
      ],
    },
  ],
  rows: [
    '..###..',
    '.......',
    'ff.w.ff',
    '..###..',
    '..www..',
    '.ff.ff.',
    '.......',
    '...#...',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 1, y: 6 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 0, y: 6 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 6, y: 6 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 0, y: 7 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 2, y: 7 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 5, y: 7 },
    { id: 'gate-chief', name: 'Gate Chief', team: 'enemy', className: 'Barbarian', x: 3, y: 1 },
    { id: 'gate-bow-1', name: 'Gate Archer', team: 'enemy', className: 'Archer', x: 0, y: 1 },
    { id: 'gate-bow-2', name: 'Gate Archer', team: 'enemy', className: 'Archer', x: 6, y: 1 },
    { id: 'gate-guard-1', name: 'Gate Guard', team: 'enemy', className: 'Swordsman', x: 2, y: 2 },
    { id: 'gate-guard-2', name: 'Gate Guard', team: 'enemy', className: 'Lancer', x: 4, y: 2 },
  ],
};

/**
 * The large map type: 11x14, roughly double the small map's footprint.
 *
 * Campaign-only: the roguelike's wave spawner is tuned around the small
 * map's two-row enemy zone. The squad starts along the bottom edge and the
 * garrison holds the top and the middle band, so closing the distance is a
 * real part of the chapter rather than a first-turn scrap. Two broken wall
 * lines split the field into three bands with gaps at the centre and both
 * flanks, and paired forest blocks give cover on the approach to each.
 */
export const CAMPAIGN_CHAPTER_2: ChapterDef = {
  id: 'longmarch-vale',
  name: 'Chapter 2: The Long March',
  shortName: 'The Long March',
  objective: 'Defeat all enemies',
  objectiveType: 'rout',
  intro: [
    { speaker: 'Jill', portraitClass: 'Fighter', text: "This is the vale the scouts warned us about. Three bands of wall, garrison dug into all of them." },
    { speaker: 'Solen', portraitClass: 'Mage', text: "I'm reading at least one adept among them. Save your charges for whoever's holding the center." },
    { speaker: 'Marisa', portraitClass: 'Thief', text: "Long march, they call it. Feels more like a long line of people about to have a bad day." },
    { speaker: 'Jill', portraitClass: 'Fighter', text: "Stay together at the gaps. We push through band by band." },
  ],
  outro: [
    { speaker: 'Jill', portraitClass: 'Fighter', text: "The vale's ours. Whatever they were massing here, it stops today." },
    { speaker: 'Ephraim', portraitClass: 'Lancer', text: "Two gates down. I'd like to say it gets easier from here." },
    { speaker: 'Jill', portraitClass: 'Fighter', text: "It won't. But neither will we." },
  ],
  events: [
    {
      id: 'march-second-wave',
      trigger: { type: 'turnReached', team: 'enemy', turn: 2 },
      script: [
        { speaker: 'Vale Captain', portraitClass: 'Barbarian', side: 'right', text: "They're already past the outer wall? Signal the inner bands — hold nothing back." },
      ],
    },
    {
      id: 'march-breach-center',
      trigger: { type: 'unitReachesTile', x: 5, y: 9, team: 'player' },
      script: [
        { speaker: 'Ephraim', portraitClass: 'Lancer', text: "We're through the center band. The vale opens up from here." },
      ],
    },
    {
      id: 'march-garrison-thinning',
      trigger: { type: 'enemyCountAtMost', count: 4 },
      script: [
        { speaker: 'Solen', portraitClass: 'Mage', text: "Their line's breaking. Just the captain and a handful left holding the far wall." },
      ],
    },
    {
      id: 'march-captain-falls',
      trigger: { type: 'unitDefeated', unitId: 'march-captain' },
      script: [
        { speaker: 'Vale Captain', portraitClass: 'Barbarian', side: 'right', text: "Impossible... the vale was supposed to hold..." },
        { speaker: 'Jill', portraitClass: 'Fighter', text: "Captain's down. Finish this and let's get everyone home." },
      ],
    },
  ],
  rows: [
    '..##...##..',
    '...........',
    '.ff.....ff.',
    '.ff.....ff.',
    '....www....',
    '..###.###..',
    '...........',
    '..ff...ff..',
    '..ff...ff..',
    '...........',
    '..###.###..',
    '..ww...ww..',
    '.ff.....ff.',
    '...........',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 2, y: 13 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 1, y: 13 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 7, y: 13 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 8, y: 13 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 9, y: 13 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 10, y: 13 },
    { id: 'march-captain', name: 'Vale Captain', team: 'enemy', className: 'Barbarian', x: 5, y: 0 },
    { id: 'march-bow-1', name: 'Vale Archer', team: 'enemy', className: 'Archer', x: 1, y: 1 },
    { id: 'march-bow-2', name: 'Vale Archer', team: 'enemy', className: 'Archer', x: 9, y: 1 },
    { id: 'march-guard-1', name: 'Vale Guard', team: 'enemy', className: 'Swordsman', x: 2, y: 4 },
    { id: 'march-guard-2', name: 'Vale Guard', team: 'enemy', className: 'Lancer', x: 8, y: 4 },
    { id: 'march-mage', name: 'Vale Adept', team: 'enemy', className: 'Mage', x: 5, y: 6 },
    { id: 'march-scout-1', name: 'Vale Scout', team: 'enemy', className: 'Swordsman', x: 1, y: 6 },
    { id: 'march-scout-2', name: 'Vale Scout', team: 'enemy', className: 'Lancer', x: 9, y: 6 },
  ],
};

/** Every chapter the campaign can load, in play order. */
export const CAMPAIGN_CHAPTERS: ChapterDef[] = [CAMPAIGN_CHAPTER_1, CAMPAIGN_CHAPTER_2];

/**
 * Concept-test maps: terrain read off a user-generated painted map image
 * (`public/maps/test-map1.png`) via a per-pixel color-clustering pass, not
 * hand-authored ASCII like the other chapters. TacticalScene renders that
 * same image as the board background for both chapter ids below instead of
 * flat terrain-color tiles (see `CHAPTERS_WITH_BACKGROUND_ART` there) — the
 * point is to prove that pipeline end-to-end, not to be a balanced
 * encounter.
 *
 * Two resolutions, kept side by side on purpose (not one replacing the
 * other): `TEST_MAP_1` at 6x8 is the one actually wired into
 * `ProjectSelvaria` below — its tiles land at a full 64px (same as
 * CHAPTER_1), which the 9x12 version's ~42px tiles turned out too small to
 * tap reliably on a phone. `TEST_MAP_1_DETAILED` keeps the original finer
 * read of the image, unwired for now (no chapter-select exists yet to
 * reach a second roguelike chapter) but around for whenever that changes,
 * or for a non-mobile-constrained context.
 *
 * Terrain classification: per-pixel k-means over the whole image (not a
 * per-cell color average, which washed out small rock outcrops into their
 * surrounding grass when tried at 90px cells) produces `TEST_MAP_1_DETAILED`'s
 * 9x12 grid directly; `TEST_MAP_1`'s 6x8 grid is that same classification
 * downsampled, with any wall-cell vote given priority over its neighbors so
 * a mountain still blocks its whole coarse tile even as a minority of that
 * tile's area — matching FE's convention that an obstacle's tile is fully
 * impassable, not partially. Both are confirmed fully connected (BFS over
 * passable tiles).
 *
 * Mountain tiles are `wall` (impassable to everyone) rather than a new
 * flying-only terrain type — there's no flying unit class yet, so that's
 * currently equivalent, and simpler than modeling terrain-by-unit-type
 * before there's a unit type that needs it. Revisit as `wall`
 * (categorically impassable) vs. a `mountain` type flying units can cross
 * when a flying class actually gets built (HANDOFF.md's class roster has
 * none yet).
 */
export const TEST_MAP_1: ChapterDef = {
  id: 'test-map1',
  name: 'Concept Test: Riverlands',
  shortName: 'Riverlands (Test)',
  objective: 'Survive as many waves as you can',
  objectiveType: 'waves',
  rows: [
    '.#...f',
    '.....#',
    'w#f...',
    'f#w.ww',
    '....ff',
    '.f....',
    '.#....',
    'f....f',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 0, y: 6 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 2, y: 7 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 3, y: 7 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 0, y: 7 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 5, y: 7 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 2, y: 5 },
    { id: 'bandit-1', name: 'Bandit 1', team: 'enemy', randomClass: true, x: 0, y: 0 },
    { id: 'bandit-2', name: 'Bandit 2', team: 'enemy', randomClass: true, x: 4, y: 0 },
    { id: 'bandit-3', name: 'Bandit 3', team: 'enemy', randomClass: true, x: 1, y: 1 },
    { id: 'bandit-4', name: 'Bandit 4', team: 'enemy', randomClass: true, x: 4, y: 1 },
  ],
};

/** See `TEST_MAP_1`'s doc comment — the finer, unwired sibling of that chapter. */
export const TEST_MAP_1_DETAILED: ChapterDef = {
  id: 'test-map1-detailed',
  name: 'Concept Test: Riverlands (Detailed)',
  shortName: 'Riverlands (Detailed)',
  objective: 'Survive as many waves as you can',
  objectiveType: 'waves',
  rows: [
    '..#.....f',
    '.........',
    '........#',
    'ww#f.....',
    'fww......',
    '.#www.www',
    '......ff.',
    '..f....f.',
    '.ff......',
    '..#......',
    '..f......',
    'f......ff',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 3, y: 10 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 0, y: 10 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 1, y: 10 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 4, y: 10 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 6, y: 10 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 7, y: 10 },
    { id: 'bandit-1', name: 'Bandit 1', team: 'enemy', randomClass: true, x: 1, y: 0 },
    { id: 'bandit-2', name: 'Bandit 2', team: 'enemy', randomClass: true, x: 7, y: 0 },
    { id: 'bandit-3', name: 'Bandit 3', team: 'enemy', randomClass: true, x: 1, y: 1 },
    { id: 'bandit-4', name: 'Bandit 4', team: 'enemy', randomClass: true, x: 7, y: 1 },
  ],
};

/**
 * First map generated directly from `MAP_BRIEF.md`'s prompt (Gemini, 7x8,
 * `public/maps/river1.jpg`) rather than sourced from the user and
 * classified after the fact like `TEST_MAP_1`. Terrain read off the image
 * via per-cell color clustering (`src/game/maps.ts`'s classification notes
 * above `TEST_MAP_1` apply the same way here) — clean result, every
 * wall/forest cell lines up with visible rock/tree art, no ambiguous
 * cells needed a second pass this time. Confirmed connected.
 */
export const TEST_MAP_2: ChapterDef = {
  id: 'test-map2',
  name: 'Concept Test: River Crossing',
  shortName: 'River Crossing (Test)',
  objective: 'Survive as many waves as you can',
  objectiveType: 'waves',
  rows: [
    '.#...ff',
    '.....#.',
    'ww.....',
    '.ww.www',
    '....f..',
    '.f....f',
    '.#....f',
    '.....f.',
  ],
  units: [
    { id: 'marisa', name: 'Marisa', team: 'player', className: 'Thief', x: 0, y: 6 },
    { id: 'lyn2', name: 'Lyn', team: 'player', className: 'Archer', x: 6, y: 6 },
    { id: 'solen', name: 'Solen', team: 'player', className: 'Mage', x: 0, y: 7 },
    { id: 'natasha', name: 'Natasha', team: 'player', className: 'Cleric', x: 2, y: 7 },
    { id: 'jill', name: 'Jill', team: 'player', className: 'Fighter', x: 3, y: 7 },
    { id: 'ephraim', name: 'Ephraim', team: 'player', className: 'Lancer', x: 6, y: 7 },
    { id: 'bandit-1', name: 'Bandit 1', team: 'enemy', randomClass: true, x: 0, y: 0 },
    { id: 'bandit-2', name: 'Bandit 2', team: 'enemy', randomClass: true, x: 4, y: 0 },
    { id: 'bandit-3', name: 'Bandit 3', team: 'enemy', randomClass: true, x: 0, y: 1 },
    { id: 'bandit-4', name: 'Bandit 4', team: 'enemy', randomClass: true, x: 4, y: 1 },
  ],
};
