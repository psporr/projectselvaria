/**
 * Campaign save data: persisted through an injected KeyValueStorage (see
 * src/systems/storage.ts) so progress survives a page reload. One slot only —
 * saving overwrites whatever was there, the same as the "always the latest"
 * semantics of a single save file.
 *
 * Scoped to chapter boundaries, same as the carry-over system it wraps: this
 * remembers which chapter to resume and what the squad carried into it, not
 * mid-battle state (unit positions, turn, HP). A save is written
 * automatically every time the player continues to a new chapter — there is
 * no separate manual "save" step, since nothing changes worth saving between
 * one chapter-clear and the next.
 */

import type { CampaignCarryOver } from './maps';
import type { KeyValueStorage } from '../systems/storage';

const SAVE_KEY = 'project-selvaria:campaign-save';

export interface CampaignSave {
  /** The chapter to resume at. */
  chapterId: string;
  carryOver: CampaignCarryOver;
  /** ISO timestamp, for display only. */
  savedAt: string;
}

/** Null if there's no save or the saved data is corrupt. */
export function loadCampaignSave(storage: KeyValueStorage): CampaignSave | null {
  const raw = storage.get(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CampaignSave;
  } catch {
    return null;
  }
}

export function saveCampaign(storage: KeyValueStorage, save: CampaignSave): void {
  storage.set(SAVE_KEY, JSON.stringify(save));
}

export function clearCampaignSave(storage: KeyValueStorage): void {
  storage.remove(SAVE_KEY);
}
