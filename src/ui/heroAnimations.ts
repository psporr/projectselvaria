import { Scene } from 'phaser';

import { artFlipX, HERO_DISPLAY_SCALE, heroAnimAtlasKey } from './heroArt';

/**
 * Animated-hero playback (2026-09-01 pipeline: `extractAseprite.ts`,
 * replacing the earlier hand-cut-PNG one this file used to hold). Every
 * animated hero (`heroArt.ts`'s `ANIMATED_HERO_NAMES`) shares this same
 * shape now — a 4-frame idle loop plus one static attack pose, both frames
 * of one merged atlas (`heroAnimAtlasKey`) — so nothing here is keyed to a
 * specific hero name; a name is a runtime parameter throughout, not part of
 * a constant.
 *
 * That single shape is also why there's no more per-frame attack timing
 * (windup/impact/flurry durations, `Types.Animations.AnimationFrame`
 * overrides) or a `LUFFY_ATTACK_IMPACT_FRAME` to watch for: the earlier
 * pipeline's ~20-frame commissioned punch sequence made that machinery
 * worth having, but a single attack pose is just a texture-frame swap,
 * timed by whatever's driving it (a lunge tween), not a played animation.
 */

/** Registered idle-loop animation key for a hero's frames. */
export function heroIdleAnimKey(unitName: string): string {
  return `${unitName.toLowerCase()}-idle`;
}

/**
 * The on-board idle (2026-08-31, carried over from the previous pipeline) —
 * same four frames as `heroIdleAnimKey`, but yoyo'd and slower. Kept even
 * though the new Aseprite-sourced frames are already provably alignment-
 * stable (`extractAseprite.ts`'s union-bounds crop, unlike the old
 * transparent-pixel-scanned sheet this was originally worked around) —
 * a raw loop's hard snap back to frame 0 can still read as a tiny pulse at
 * on-board scale, and yoyo's smooth triangle wave costs nothing to keep.
 */
export function heroIdleMapAnimKey(unitName: string): string {
  return `${unitName.toLowerCase()}-idle-map`;
}

/** The single attack-pose frame name every hero's atlas has, per `extractAseprite.ts`'s default `--attack-frames=1`. */
export const HERO_ATTACK_FRAME = 'attack-0';

/**
 * Every animated hero's frames face **right** — confirmed 2026-09-01 by
 * rendering both `luffy.aseprite` and `zoro.aseprite`'s extracted idle-0
 * and attack-0 frames, not assumed (an earlier guess in this file, before
 * that check, had the two source sheets facing opposite ways). Every
 * static art source (`heroArt.ts`'s `STATIC_ART_FACES_RIGHT`) faces the
 * other way — the two constants exist separately because there's no reason
 * to expect a future art source to agree with either.
 */
export const ANIMATED_ART_FACES_RIGHT = true;

/** Whether an animated hero's sprite needs `setFlipX` to face `faceRight` — wraps `heroArt.ts`'s `artFlipX` with the known orientation above. */
export function heroFlipX(faceRight: boolean): boolean {
  return artFlipX(ANIMATED_ART_FACES_RIGHT, faceRight);
}

/**
 * Scale factor to render `unitName`'s animated sprite at `desiredHeight`
 * (display pixels), read from its own atlas frame — safe to compare across
 * that one hero's own frames because `extractAseprite.ts` crops all of them
 * (idle and attack alike) to one shared union-bounds size. Not safe to
 * assume frame height means the same thing *across* different heroes,
 * though — `heroArt.ts`'s `HERO_DISPLAY_SCALE` corrects for the one hero
 * (Gear5) where it doesn't; see that constant's own doc comment. Call once
 * the atlas is loaded (after `preload()`, e.g. in `create()`).
 */
export function heroAnimScale(scene: Scene, unitName: string, desiredHeight: number): number {
  const frame = scene.textures.getFrame(heroAnimAtlasKey(unitName), 'idle-0');
  const correction = HERO_DISPLAY_SCALE[unitName.toLowerCase()] ?? 1;
  return (desiredHeight * correction) / frame.height;
}

/**
 * Registers `unitName`'s idle animations on `scene.anims` (Phaser's
 * animation registry is global across every Scene, not per-scene, so this
 * only needs to run once per game session per hero — guarded on that
 * hero's idle key already existing, so a second call from a second scene,
 * or a `create()` re-run via `TacticalScene.restartBattle()`, is a safe
 * no-op). No attack animation is registered — `HERO_ATTACK_FRAME` is a
 * plain `setFrame()` target, not something `anims.create()` needs to know
 * about.
 */
export function ensureHeroAnimations(scene: Scene, unitName: string): void {
  const idleKey = heroIdleAnimKey(unitName);
  if (scene.anims.exists(idleKey)) return;

  const atlas = heroAnimAtlasKey(unitName);
  const idleFrames = scene.anims.generateFrameNames(atlas, { prefix: 'idle-', start: 0, end: 3 });
  scene.anims.create({ key: idleKey, frames: idleFrames, frameRate: 6, repeat: -1 });
  scene.anims.create({ key: heroIdleMapAnimKey(unitName), frames: idleFrames, frameRate: 3, yoyo: true, repeat: -1 });
}
