/**
 * The run's branching path — Slay the Spire's map, adapted per
 * tactics-roguelike-design's procedural-vs-handcrafted.md ("proceduralize
 * the draw, not the underlying content"): rather than rendering a full
 * zoomable node graph, the player is shown "pick your next stop" — 2-3
 * `MapNodeOption` cards generated fresh at each junction. The underlying
 * shape is still a real branching path (which node you took determines
 * what happens next), just presented one junction at a time instead of as
 * a whole-map overview — a deliberately smaller UI lift for a first
 * version, not a smaller mechanic.
 *
 * A "segment" is the stretch between one Boss node and the next —
 * `SEGMENT_LENGTH` junctions of battle/elite/rest/shop, then the segment's
 * Boss is the only option. `GameState.segmentDepth` tracks progress through
 * the current segment; game.ts's chooseRunPath resets it to 0 on Descend,
 * which is what makes the whole run read as one continuous path rather
 * than a fresh separate map per phase.
 */

import type { DropRandomAPI } from './equipment';
import type { GameState, MapNodeOption, MapNodeType } from './types';

/** Junctions per segment before the next node is forced to be the Boss. */
export const SEGMENT_LENGTH = 7;

/** How many options are offered at a normal (non-final, non-first) junction. */
const OPTIONS_PER_JUNCTION = 3;

const JUNCTION_WEIGHTS: Record<'battle' | 'elite' | 'rest' | 'shop', number> = {
  battle: 45,
  elite: 20,
  rest: 15,
  shop: 20,
};

function weightedJunctionType(random: DropRandomAPI): MapNodeType {
  const entries = Object.entries(JUNCTION_WEIGHTS) as [MapNodeType, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random.Number() * total;
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll < 0) return type;
  }
  return entries[entries.length - 1][0];
}

/**
 * The node options offered at the player's current point in the run.
 * segmentDepth 0 (a fresh segment, right after descending past a Boss, or
 * the very start of the run) is always battle-only — a safe, known
 * re-entry point, mirroring how a Spire act's first floor eases back in
 * rather than risking an Elite or empty-handed Shop right away. Once
 * segmentDepth reaches SEGMENT_LENGTH, the only option is the segment's
 * Boss — shown as a single card rather than silently auto-entered, so the
 * player gets the same "here it comes" beat Spire's map gives before a
 * boss floor.
 */
export function generateNodeChoices(segmentDepth: number, random: DropRandomAPI): MapNodeOption[] {
  if (segmentDepth >= SEGMENT_LENGTH) return [{ id: 'boss-0', type: 'boss' }];

  if (segmentDepth === 0) {
    return Array.from({ length: OPTIONS_PER_JUNCTION }, (_, i) => ({ id: `battle-${i}`, type: 'battle' as const }));
  }

  return Array.from({ length: OPTIONS_PER_JUNCTION }, (_, i) => {
    const type = weightedJunctionType(random);
    return { id: `${type}-${i}`, type };
  });
}

const GOLD_BASE = 15;
const GOLD_PER_WAVE = 2;

/**
 * Gold earned clearing the current combat node (checkWaveCleared, game.ts)
 * — Elite pays 1.5x, Boss pays 2x, scaled by the same wave-based ramp
 * either way so late-run Gold keeps pace with Shop prices.
 */
export function computeGoldEarned(G: GameState): number {
  const base = GOLD_BASE + G.wave * GOLD_PER_WAVE;
  if (G.currentNodeType === 'elite') return Math.round(base * 1.5);
  if (G.currentNodeType === 'boss') return base * 2;
  return base;
}
