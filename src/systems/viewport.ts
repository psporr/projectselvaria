import type { Scene } from 'phaser';

/**
 * DPR-aware, auto-scaling rendering setup — fixes the whole game/UI looking
 * blurred on real phones. Phaser's canvas backing-store resolution defaults
 * to the game's configured width/height regardless of device pixel density;
 * on any DPR 2-3 screen (virtually every modern phone) the browser then
 * stretches that fixed-resolution buffer across far more physical pixels
 * than it has data for. This Phaser version has no built-in "match device
 * resolution" toggle (verified against the installed package's own type
 * definitions — no such field exists on GameConfig/ScaleConfig), so it's
 * handled explicitly:
 *
 * - main.ts multiplies the canvas's actual backing-store size by DPR.
 * - Every scene calls `applyDprZoom(this)` (below), so nothing that
 *   positions game objects (TacticalScene, UIScene, and every panel in
 *   src/ui/) ever needs to know DPR exists — they keep authoring against
 *   the same LOGICAL_WIDTH x LOGICAL_HEIGHT space as before.
 * - Every Text object still needs `resolution: DPR` set explicitly (Text
 *   rasterizes to its own internal texture at a fixed pixel size — camera
 *   zoom scales that texture up but can't add detail that was never
 *   rendered into it).
 *
 * This adapts automatically to whatever device it loads on — a DPR-1
 * desktop browser renders at native resolution (no wasted memory), a DPR-3
 * phone renders 3x sharper — rather than a fixed multiplier chosen up front.
 */

/** Capped to bound GPU fill-rate/memory on extreme-DPR devices — visual returns diminish well before 3x anyway. */
export const DPR = Math.min(window.devicePixelRatio || 1, 3);

/** The world-space every scene and UI panel is authored in. Never multiply this by DPR yourself — see module comment. */
export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 854;

/**
 * `camera.setZoom(DPR)` alone isn't enough: Phaser's camera zoom pivots
 * around the camera's own origin, which defaults to (0.5, 0.5) — the
 * viewport's center — not world (0,0). With scroll left at its default
 * (0,0), that leaves the visible world rect centered on world (0,0) instead
 * of starting there, i.e. showing [-W/2, W/2] x [-H/2, H/2] instead of
 * [0, W] x [0, H] — a quarter of the board, in the wrong place. `centerOn`
 * re-anchors the camera on the *actual* center of our logical space,
 * independent of zoom or origin, so [0, LOGICAL_WIDTH] x [0, LOGICAL_HEIGHT]
 * fills the viewport exactly like it did before any of this existed.
 */
export function applyDprZoom(scene: Scene): void {
  scene.cameras.main.setZoom(DPR);
  scene.cameras.main.centerOn(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2);
}
