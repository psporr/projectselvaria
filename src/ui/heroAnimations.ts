import { Scene, Types } from 'phaser';

import { heroAttackAtlasKey, heroIdleRunAtlasKey } from './heroArt';

/** Phaser animation keys for Luffy's three animated-sprite states — shared between SpriteTestScene (the standalone viewer) and the real game (UnitSprite), so both play the exact same tuned frames instead of two copies drifting apart. */
export const LUFFY_ANIM_IDLE = 'luffy-idle';
export const LUFFY_ANIM_RUN = 'luffy-run';
export const LUFFY_ANIM_ATTACK = 'luffy-attack';

/**
 * The on-board idle (2026-08-31) — same four frames as `LUFFY_ANIM_IDLE`,
 * but yoyo'd and slower, and it exists because the plain loop read as
 * "bouncy" on the grid while looking fine in SpriteTestScene's viewer.
 *
 * Measured rather than guessed: with the atlas stabilized on both axes, the
 * feet are provably planted (bottom ink sits a constant 22px below the
 * render anchor in all four frames) — what moves is the character's *top*,
 * squashing down 1px a frame, then snapping the full 3px back when the loop
 * restarts. That sawtooth is the bounce. The viewer doesn't show it as
 * badly because it draws at 5x, where the same motion has enough screen
 * pixels to read as smooth breathing; on the board at roughly 1.2x, with
 * the game's global `roundPixels`, those 1px steps quantize unevenly and
 * the reset lands as one hard jump.
 *
 * Yoyo replaces that sawtooth with a triangle wave — 0,1,2,3,2,1,0 — so
 * there's no discontinuity to read as a bounce, and the halved frame rate
 * makes the remaining squash a slow breath rather than a pulse. The viewer
 * deliberately keeps playing the raw, un-yoyo'd `LUFFY_ANIM_IDLE`: its
 * whole job is showing the frames exactly as authored.
 */
export const LUFFY_ANIM_IDLE_MAP = 'luffy-idle-map';

/**
 * The frame the punch actually lands on — `CombatOverlayScene` watches for
 * it (`animationupdate`) to time the defender's hit reaction, rather than a
 * hardcoded delay that would silently drift out of sync the next time the
 * ATTACK_*_DURATIONS below get retuned. Frame 8 is the first full-extension
 * punch, before the flurry repeats.
 */
export const LUFFY_ATTACK_IMPACT_FRAME = 'attack-8';

/**
 * The two Luffy sheets are drawn facing *opposite* directions — the
 * idle/run sheet points left, the attack sheet points right (they're
 * placeholder art from different sources, so there was never a reason for
 * them to agree). That means "make this fighter face right" isn't one flip
 * flag: it's a flip on one sheet and no flip on the other.
 *
 * Left unnoticed until the repo owner spotted it in the battle screen
 * (2026-08-31): flipping purely by which side a fighter stood on made the
 * attack read correctly but left both fighters *idling* turned away from
 * each other, since idle is what plays for most of the cut-in.
 *
 * Callers state the direction they want and this works out the flag, so a
 * future sheet only needs its own entry here rather than every call site
 * learning which way its art happens to point.
 */
export function luffyFlipX(animKey: string, faceRight: boolean): boolean {
  const artFacesRight = animKey === LUFFY_ANIM_ATTACK;
  return faceRight !== artFacesRight;
}

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
    key: LUFFY_ANIM_IDLE_MAP,
    frames: scene.anims.generateFrameNames(idleRunAtlas, { prefix: 'idle-', start: 0, end: 3 }),
    frameRate: 3,
    yoyo: true,
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
