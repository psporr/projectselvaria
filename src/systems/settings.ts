/**
 * Player-facing presentation settings, persisted through the same injected
 * `KeyValueStorage` seam `src/game/save.ts` uses (see storage.ts's module
 * comment for why nothing reads `localStorage` directly). Kept in
 * `systems/` rather than `game/` because none of this is game state — it
 * changes how a battle is *shown*, never what it resolves to, so the
 * headless simulator neither reads nor needs it.
 *
 * Stored as one JSON object rather than a key per setting, and read back
 * merged over `DEFAULT_SETTINGS`, so a settings blob written by an older
 * build (missing a field added later) still loads instead of coming back
 * half-undefined.
 */

import type { KeyValueStorage } from './storage';

const SETTINGS_KEY = 'project-selvaria:settings';

/**
 * Which combat presentation plays (2026-08-31, per the repo owner).
 *
 * - `grid` — the on-board pass only: attacker lunge, floating damage,
 *   impact particles, crit shake. Fast, and keeps the player looking at the
 *   board the whole time.
 * - `overlay` — the full-screen cut-in only (`CombatOverlayScene`). The
 *   dramatic beat, at the cost of a few seconds per exchange.
 *
 * Both ran back-to-back for one build before this setting existed; the
 * choice replaced that rather than joining it as a third option.
 */
export type BattleStyle = 'grid' | 'overlay';

export interface GameSettings {
  battleStyle: BattleStyle;
}

export const DEFAULT_SETTINGS: GameSettings = {
  battleStyle: 'overlay',
};

export function loadSettings(storage: KeyValueStorage): GameSettings {
  const raw = storage.get(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(storage: KeyValueStorage, settings: GameSettings): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** Human-readable name for a battle style, for the menu row's label. */
export function battleStyleLabel(style: BattleStyle): string {
  return style === 'grid' ? 'On Grid' : 'Battle Screen';
}

/** The other style — the menu row is a two-state toggle, same as the in-battle "Danger: OFF" dock button. */
export function nextBattleStyle(style: BattleStyle): BattleStyle {
  return style === 'grid' ? 'overlay' : 'grid';
}
