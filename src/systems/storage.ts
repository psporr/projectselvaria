/**
 * Thin key-value storage seam (HANDOFF.md §10). `src/game/` must never call
 * `localStorage` directly — that's the load-bearing rule that keeps the
 * headless simulator possible and the eventual Capacitor wrap uneventful.
 * Pure logic takes a KeyValueStorage as a parameter instead; this module is
 * the only place that's allowed to touch the browser API. Swapping in
 * Capacitor Preferences later means adding one more implementation here,
 * not touching src/game/save.ts.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Storage can be unavailable (private browsing, quota) — losing a save is better than crashing the game over it. */
export const browserStorage: KeyValueStorage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Swallowed deliberately — see module comment.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Swallowed deliberately — see module comment.
    }
  },
};
