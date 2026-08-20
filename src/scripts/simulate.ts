/**
 * Headless battle runner.
 *
 * Drives both armies with the built-in AI to prove the wave-survival loop
 * holds up: phases alternate, units act, waves advance via blessings, and
 * the run eventually ends (either the squad wipes, or we've proven several
 * waves clear cleanly).
 *
 *   npm run sim                 single verbose run
 *   npm run sim -- --batch 100  100 seeded runs, aggregate win rate / wave depth
 *
 * CHANGED FOR THE REBUILD (HANDOFF.md §3): with hit/crit, a single run no
 * longer says anything about balance — a lucky or unlucky string of rolls
 * can carry (or sink) one run regardless of whether the numbers are sound.
 * Batch mode runs N *seeded* battles (via boardgame.io's Game.seed, so each
 * one is independently reproducible) and reports the distribution instead of
 * one anecdote.
 */
import { Client } from 'boardgame.io/client';

import { ProjectSelvaria, type GameOver } from '../game/game';
import { decideAction } from '../game/ai';
import { teamOf } from '../game/types';
import { unitsOf } from '../game/grid';
import { BLESSINGS } from '../game/blessings';

const MAX_ACTIONS = 20000;
const WAVE_CAP = 6;

interface RunResult {
  wiped: boolean;
  waveReached: number;
  actions: number;
}

function runOnce(seed: string | number): RunResult {
  const client = Client({ game: { ...ProjectSelvaria, seed }, numPlayers: 2 });
  client.start();

  let actions = 0;
  let lastWave = 0;

  while (actions < MAX_ACTIONS) {
    const state = client.getState();
    if (!state) throw new Error('Client produced no state');
    if (state.ctx.gameover) break;

    const { G, ctx } = state;

    if (G.wave !== lastWave) lastWave = G.wave;

    if (G.awaitingBlessing) {
      // Only 3 of the 20-strong pool are actually offered each wave-clear —
      // pick the first one actually on offer rather than cycling blindly.
      const offeredId = G.offeredBlessingIds[0];
      const blessing = BLESSINGS.find((candidate) => candidate.id === offeredId) ?? BLESSINGS[0];
      client.moves.chooseBlessing(blessing.id);
      const waveAfter = client.getState()?.G.wave ?? G.wave;
      if (waveAfter > WAVE_CAP) break;
      continue;
    }

    const action = decideAction(G, teamOf(ctx.currentPlayer));
    if (!action) {
      client.events.endTurn?.();
      continue;
    }

    if (action.type === 'move') client.moves.moveUnit(action.unitId, action.x, action.y);
    else if (action.type === 'attack') client.moves.attackUnit(action.attackerId, action.targetId);
    else client.moves.waitUnit(action.unitId);

    actions++;
  }

  const final = client.getState();
  const gameover = final?.ctx.gameover as GameOver | undefined;
  client.stop();

  return {
    wiped: gameover?.winner === 'enemy',
    waveReached: final?.G.wave ?? 0,
    actions,
  };
}

function runVerboseOnce(): void {
  const client = Client({ game: ProjectSelvaria, numPlayers: 2 });
  client.start();

  let actions = 0;
  let lastTurn = -1;
  let lastWave = 0;

  while (actions < MAX_ACTIONS) {
    const state = client.getState();
    if (!state) throw new Error('Client produced no state');
    if (state.ctx.gameover) break;

    const { G, ctx } = state;

    if (G.wave !== lastWave) {
      lastWave = G.wave;
      console.log(`\n=== Wave ${G.wave} (${unitsOf(G, 'enemy').length} enemies) ===`);
    }

    if (G.awaitingBlessing) {
      const offeredId = G.offeredBlessingIds[0];
      const blessing = BLESSINGS.find((candidate) => candidate.id === offeredId) ?? BLESSINGS[0];
      console.log(`  choosing blessing: ${blessing.name}`);
      client.moves.chooseBlessing(blessing.id);
      const waveAfter = client.getState()?.G.wave ?? G.wave;
      if (waveAfter > WAVE_CAP) break;
      continue;
    }

    if (ctx.turn !== lastTurn) {
      lastTurn = ctx.turn;
      const player = unitsOf(G, 'player').length;
      const enemy = unitsOf(G, 'enemy').length;
      console.log(
        `turn ${String(ctx.turn).padStart(3)}  ${teamOf(ctx.currentPlayer).padEnd(6)}  ` +
          `player:${player} enemy:${enemy}`,
      );
    }

    const action = decideAction(G, teamOf(ctx.currentPlayer));
    if (!action) {
      client.events.endTurn?.();
      continue;
    }

    if (action.type === 'move') client.moves.moveUnit(action.unitId, action.x, action.y);
    else if (action.type === 'attack') client.moves.attackUnit(action.attackerId, action.targetId);
    else client.moves.waitUnit(action.unitId);

    actions++;
  }

  const final = client.getState();
  const gameover = final?.ctx.gameover as GameOver | undefined;
  const waveReached = final?.G.wave ?? 0;

  if (!gameover && waveReached <= WAVE_CAP) {
    console.error(`\nFAIL: neither wiped nor reached wave ${WAVE_CAP} after ${actions} actions`);
    process.exitCode = 1;
    return;
  }

  console.log(
    gameover
      ? `\nRun ended: squad wiped on wave ${waveReached}  (${actions} actions)`
      : `\nRun ended: reached wave ${waveReached} without wiping  (${actions} actions)`,
  );
  console.log('Recent log:');
  for (const entry of (final?.G.log ?? []).slice(0, 8)) console.log('  ' + entry);
}

function runBatch(count: number): void {
  const results: RunResult[] = [];
  for (let i = 0; i < count; i++) {
    results.push(runOnce(`sim-${i}`));
  }

  const wipes = results.filter((r) => r.wiped).length;
  const reachedCap = results.filter((r) => !r.wiped && r.waveReached > WAVE_CAP).length;
  const stalled = results.filter((r) => !r.wiped && r.waveReached <= WAVE_CAP).length;

  const waves = results.map((r) => r.waveReached).sort((a, b) => a - b);
  const mean = waves.reduce((sum, w) => sum + w, 0) / waves.length;
  const median = waves[Math.floor(waves.length / 2)];
  const min = waves[0];
  const max = waves[waves.length - 1];

  console.log(`Batch of ${count} seeded runs:`);
  console.log(`  wiped:            ${wipes} (${((wipes / count) * 100).toFixed(1)}%)`);
  console.log(`  reached wave cap: ${reachedCap} (${((reachedCap / count) * 100).toFixed(1)}%)`);
  if (stalled > 0) {
    console.log(`  STALLED (neither wiped nor reached cap): ${stalled} — investigate, this shouldn't happen`);
  }
  console.log(`  wave reached — min:${min} median:${median} mean:${mean.toFixed(2)} max:${max}`);

  if (stalled > 0) {
    process.exitCode = 1;
  }
}

const args = process.argv.slice(2);
const batchIndex = args.indexOf('--batch');

if (batchIndex !== -1) {
  const count = Number(args[batchIndex + 1] ?? '100');
  runBatch(count);
} else {
  runVerboseOnce();
}
