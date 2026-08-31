import { Scene, Types } from 'phaser';

import { heroAttackAtlasKey, heroIdleRunAtlasKey } from './heroArt';

/** Phaser animation keys for Luffy's three animated-sprite states — shared between SpriteTestScene (the standalone viewer) and the real game (UnitSprite), so both play the exact same tuned frames instead of two copies drifting apart. */
export const LUFFY_ANIM_IDLE = 'luffy-idle';
export const LUFFY_ANIM_RUN = 'luffy-run';
export const LUFFY_ANIM_ATTACK = 'luffy-attack';

/**
 * Per-frame durations (ms) for `luffy-attack`, replacing a flat frameRate —
 * anticipation/snap/hold/ease: held longest at the windup's cocked-back
 * peak (index 3) and the frame-8 impact (max stretch), fast through the
 * flurry, slowing back down through the final ease-out. Frames 11-17 read
 * (by eye, frame-stepping through the raw scan) as one full punch cycle —
 * the arm re-coils compact at 11, extends to a peak at 15, starts
 * retracting by 17 — so that slice repeats (`LUFFY_ATTACK_FLURRY_REPEATS`)
 * before continuing into the ease-out: the same 7 frames playing several
 * times over reads as a flurry of jabs instead of one long reach.
 */
const ATTACK_WINDUP_DURATIONS = [90, 70, 60, 90, 50, 40, 35, 30]; // 0-7
const ATTACK_IMPACT_DURATIONS = [120, 40, 35]; // 8-10
const ATTACK_PUNCH_CYCLE_DURATIONS = [35, 30, 30, 35, 50, 30, 30]; // 11-17
const ATTACK_EASE_DURATIONS = [60, 90, 120, 160]; // 18-21
const LUFFY_ATTACK_FLURRY_REPEATS = 3;

function buildLuffyAttackFrames(scene: Scene): Types.Animations.AnimationFrame[] {
  const all = scene.anims.generateFrameNames(heroAttackAtlasKey('luffy'), { prefix: 'attack-', start: 0, end: 21 });
  const windup = all.slice(0, 8);
  const impact = all.slice(8, 11);
  const punchCycle = all.slice(11, 18);
  const easeOut = all.slice(18, 22);

  const withDurations = (slice: Types.Animations.AnimationFrame[], durations: number[]): Types.Animations.AnimationFrame[] =>
    slice.map((f, i) => ({ ...f, duration: durations[i] }));

  const flurry = Array.from({ length: LUFFY_ATTACK_FLURRY_REPEATS }, () => withDurations(punchCycle, ATTACK_PUNCH_CYCLE_DURATIONS)).flat();

  return [...withDurations(windup, ATTACK_WINDUP_DURATIONS), ...withDurations(impact, ATTACK_IMPACT_DURATIONS), ...flurry, ...withDurations(easeOut, ATTACK_EASE_DURATIONS)];
}

/**
 * Registers Luffy's three animations on `scene.anims` (Phaser's animation
 * registry is global across every Scene, not per-scene, so this only needs
 * to run once per game session — guarded on `luffy-idle` already existing
 * so a second call, from a second scene, or a `create()` re-run via
 * `TacticalScene.restartBattle()`, is a safe no-op). `luffy-attack` defaults
 * to `repeat: 0` (play once) here, the sensible default for a real combat
 * hit — SpriteTestScene's standalone viewer asks for continuous looping
 * itself at play time (`sprite.play({ key: LUFFY_ANIM_ATTACK, repeat: -1 })`)
 * rather than that being baked into the shared definition.
 */
export function ensureLuffyAnimations(scene: Scene): void {
  if (scene.anims.exists(LUFFY_ANIM_IDLE)) return;

  const idleRunAtlas = heroIdleRunAtlasKey('luffy');
  scene.anims.create({
    key: LUFFY_ANIM_IDLE,
    frames: scene.anims.generateFrameNames(idleRunAtlas, { prefix: 'idle-', start: 0, end: 3 }),
    frameRate: 6,
    repeat: -1,
  });
  scene.anims.create({
    key: LUFFY_ANIM_RUN,
    frames: scene.anims.generateFrameNames(idleRunAtlas, { prefix: 'run-', start: 0, end: 5 }),
    frameRate: 10,
    repeat: -1,
  });
  scene.anims.create({
    key: LUFFY_ANIM_ATTACK,
    frames: buildLuffyAttackFrames(scene),
    repeat: 0,
  });
}
