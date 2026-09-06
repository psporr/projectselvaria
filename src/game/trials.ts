/**
 * Trials: opt-in, pre-run difficulty modifiers — Hades' Pact of Punishment/
 * Slay the Spire's Ascension, adapted here. risk-reward-and-difficulty-
 * pacing.md's throughline for every reference game's version of this: the
 * risk is visible and chosen *before* the player commits, never a surprise
 * sprung mid-run, and it's matched with a legible reward. Each Trial here
 * toggles independently (no ordering/prerequisite), and the reward is a
 * flat Embers bonus (src/game/meta.ts's computeEmbersEarned) rather than
 * unlocking new content — this game's Embers economy already handles "the
 * payoff for going deeper," so Trials only need to answer "why go deeper
 * *harder*."
 *
 * Each Trial's actual gameplay effect lives where it's consumed
 * (waves.ts's spawnWave/spawnBossWave) — this file only owns the catalog
 * (id/name/description/reward) and the Embers-multiplier math, so the UI
 * (MainMenuScene's Trials panel) and the reward calculation share one
 * source of truth for what each Trial is worth.
 */

import type { TrialId } from './types';

export interface TrialDef {
  id: TrialId;
  name: string;
  description: string;
  /** Added to the run's Embers multiplier (1.0 = no bonus) if this Trial is active. */
  embersBonus: number;
}

export const TRIALS: TrialDef[] = [
  {
    id: 'grueling',
    name: 'Grueling',
    description: 'Every enemy spawns 2 levels stronger than the wave calls for.',
    embersBonus: 0.15,
  },
  {
    id: 'swarming',
    name: 'Swarming',
    description: 'One extra enemy in every wave, including the wave cap.',
    embersBonus: 0.15,
  },
  {
    id: 'ironclad-foes',
    name: 'Ironclad Foes',
    description: 'Every enemy gets +2 Def.',
    embersBonus: 0.1,
  },
  {
    id: 'grim-bosses',
    name: 'Grim Bosses',
    description: "Boss waves' Warlords spawn 3 levels stronger still.",
    embersBonus: 0.1,
  },
];

/** 1.0 with no Trials active; +embersBonus per active Trial, additively. */
export function embersMultiplier(activeTrials: TrialId[]): number {
  return 1 + TRIALS.filter((trial) => activeTrials.includes(trial.id)).reduce((sum, trial) => sum + trial.embersBonus, 0);
}
