import type { Scene } from 'phaser';

/**
 * DPR-aware, auto-scaling rendering setup — fixes the whole game/UI looking
 * blurred on real phones *and* on desktop web. Phaser's canvas backing-store
 * resolution defaults to the game's configured width/height regardless of
 * device pixel density; the browser then stretches that fixed-resolution
 * buffer to whatever CSS size `Scale.FIT` displays it at. Two multipliers
 * compound here, and conflating them (as an earlier version of this file
 * did — sizing the buffer off `devicePixelRatio` alone) is exactly the bug:
 *
 * - **Device pixel density** (CSS px -> physical px) — the classic "retina"
 *   factor.
 * - **The FIT display scale** — the ratio between our authored
 *   LOGICAL_WIDTH x LOGICAL_HEIGHT and whatever CSS box the game container
 *   actually is. A portrait 480x854 canvas inside a wide desktop window gets
 *   stretched well past 1x by FIT alone, even on a DPR-1 monitor; a phone
 *   narrower than 480 CSS px gets shrunk. Sizing the backing store only off
 *   DPR silently ignores this and leaves the browser to blur the gap with
 *   CSS scaling, in either direction.
 *
 * `DPR` below folds both into one multiplier, computed from the actual
 * measured container box, so the backing store always matches what FIT will
 * finally display it at, at the screen's real density — no residual CSS
 * stretch left for the browser to soften. This Phaser version has no
 * built-in "match device resolution" toggle (verified against the installed
 * package's own type definitions — no such field exists on
 * GameConfig/ScaleConfig), so it's handled explicitly:
 *
 * - main.ts sizes the canvas's actual backing store off `DPR`.
 * - Every scene calls `applyDprZoom(this)` (below), so nothing that
 *   positions game objects (TacticalScene, UIScene, and every panel in
 *   src/ui/) ever needs to know DPR exists — they keep authoring against
 *   the same LOGICAL_WIDTH x LOGICAL_HEIGHT space as before.
 * - Every Text object still needs `resolution: DPR` set explicitly (Text
 *   rasterizes to its own internal texture at a fixed pixel size — camera
 *   zoom scales that texture up but can't add detail that was never
 *   rendered into it).
 *
 * Not re-measured on resize/orientation change — matches this file's
 * existing single-computation-at-boot architecture; live window resizing
 * mid-session is an accepted gap, not a regression introduced here.
 */

/** The world-space every scene and UI panel is authored in. Never multiply this by DPR yourself — see module comment. */
export const LOGICAL_WIDTH = 480;
export const LOGICAL_HEIGHT = 854;

/**
 * The actual CSS box the canvas will be displayed in, measured directly from
 * the DOM rather than inferred from `window.innerWidth/innerHeight` — both
 * of those disagree with the real visible area on iOS Safari's dynamic
 * toolbar (see HANDOFF.md §8). `#game-container` fills `100dvh` via CSS
 * (index.html/style.css), so its measured box already accounts for that.
 * Falls back to `innerWidth/innerHeight` only if the element isn't
 * measurable yet (defensive; shouldn't happen given the stylesheet is a
 * blocking `<link>` that loads before this module-scope code runs).
 */
function measuredContainerSize(): { width: number; height: number } {
  const rect = document.getElementById('game-container')?.getBoundingClientRect();
  if (rect && rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * Combined display-scale x device-pixel-ratio multiplier — see module
 * comment. Capped at 3x total to bound GPU fill-rate/memory bandwidth on
 * large-window + high-DPR combinations; visual returns diminish past that
 * anyway.
 */
function computeResolution(): number {
  const { width, height } = measuredContainerSize();
  const displayScale = Math.min(width / LOGICAL_WIDTH, height / LOGICAL_HEIGHT);
  const rawDpr = window.devicePixelRatio || 1;
  return Math.min(displayScale * rawDpr, 3);
}

export const DPR = computeResolution();

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
