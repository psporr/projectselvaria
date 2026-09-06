/**
 * Meta-progression: Embers, the currency that survives a roguelike run
 * ending (bank or wipe) and carries into the next one — the
 * tactics-roguelike-design skill's meta-progression.md, "a middle path"
 * section. Kept minimal and capped on purpose: the one thing Embers buy
 * right now (a Head Start house pick, MainMenuScene) is a one-time, hard-
 * capped unlock, not open-ended power growth, so a veteran's run stays
 * comparable to a first-timer's rather than trivializing early waves.
 *
 * Persisted through an injected KeyValueStorage (systems/storage.ts), same
 * pattern as save.ts's campaign save and settings.ts's GameSettings — this
 * file itself never touches localStorage.
 */

import type { BlessingHouse, GameState } from './types';
import type { KeyValueStorage } from '../systems/storage';

const META_KEY = 'project-selvaria:meta-progress';

export interface MetaProgress {
  embers: number;
  /** Paid once, permanently — true once the Head Start unlock has been bought at all, regardless of which house is currently selected. */
  headStartPurchased: boolean;
  /** Which house a fresh roguelike run starts with 1 pick already counted toward its Duo threshold. Free to change once purchased; null means no head start even if purchased (the player backed it out). */
  headStartHouse: BlessingHouse | null;
}

export const DEFAULT_META_PROGRESS: MetaProgress = {
  embers: 0,
  headStartPurchased: false,
  headStartHouse: null,
};

export function loadMetaProgress(storage: KeyValueStorage): MetaProgress {
  const raw = storage.get(META_KEY);
  if (!raw) return { ...DEFAULT_META_PROGRESS };
  try {
    const parsed = JSON.parse(raw) as Partial<MetaProgress>;
    return { ...DEFAULT_META_PROGRESS, ...parsed };
  } catch {
    return { ...DEFAULT_META_PROGRESS };
  }
}

export function saveMetaProgress(storage: KeyValueStorage, progress: MetaProgress): void {
  storage.set(META_KEY, JSON.stringify(progress));
}

/** Cost, in Embers, of unlocking the Head Start choice for the first time. */
export const HEAD_START_COST = 50;

export const EMBERS_PER_WAVE_CLEARED = 3;
/** Bonus for a deliberate, in-time stop at a boss-wave checkpoint (game.ts's chooseRunPath) — on top of the same per-wave rate a wipe earns, so banking is always at least as good as the run it caps, never a tax on stopping. */
export const EMBERS_BANK_BONUS = 15;

/**
 * Embers earned from a finished roguelike run. Awarded on a wipe as well as
 * a bank — meta-progression.md's "failing forward": a lost run should still
 * bank something toward the next attempt, reframing a wipe as progress
 * rather than wasted time. `banked` is passed explicitly (rather than read
 * off `G.runBanked`) so the run-choice panel can preview "bank now" numbers
 * before the player actually commits to that choice.
 */
export function computeEmbersEarned(G: GameState, banked: boolean): number {
  const wavesCleared = banked ? G.wave : Math.max(0, G.wave - 1);
  const base = wavesCleared * EMBERS_PER_WAVE_CLEARED;
  return banked ? base + EMBERS_BANK_BONUS : base;
}
