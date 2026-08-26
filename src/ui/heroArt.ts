/**
 * Named-hero map sprites — one hand-drawn PNG per specific character
 * (`public/units/<name>.png`), not the class-generic/team-tinted convention
 * `ART_BRIEF.md` originally specced (see its 2026-08-25 update). A unit only
 * gets real art if its display `name` matches one of these; everyone else
 * (every enemy, and any hero not yet drawn) keeps the circle+class-letter
 * placeholder (`UnitSprite`/`UnitStatusBar`'s own fallback branch) — so
 * adding a name here is the entire integration step for a new piece of art,
 * no code change needed elsewhere.
 */
import type { Scene } from 'phaser';

export const HERO_SPRITE_NAMES = ['eirika', 'ephraim', 'jill', 'lyn', 'natasha', 'takumi'] as const;

/** Phaser texture key a given unit's display name loads under, if it has real art. */
export function heroTextureKey(unitName: string): string {
  return `unit-${unitName.toLowerCase()}`;
}

/** Texture key for a hero's desaturated ("acted") variant — baked once by `ensureGrayscaleHeroTexture`, never hand-drawn. */
export function heroGrayTextureKey(unitName: string): string {
  return `${heroTextureKey(unitName)}-gray`;
}

/**
 * Bakes a desaturated copy of `name`'s hero texture under
 * `heroGrayTextureKey(name)`, if one doesn't already exist — a one-time
 * canvas pixel pass (each pixel's RGB replaced by its luminance, alpha left
 * untouched so the art's silhouette/transparency shape survives) rather
 * than a runtime tint or shader, since this Phaser build has no built-in
 * grayscale FX pipeline. `UnitSprite`/`UnitStatusBar` swap to this texture
 * for an acted unit instead of fading its alpha — a true grayscale reads as
 * "spent" without also making the unit harder to see on a busy board.
 *
 * Call once per hero name, from `TacticalScene.create()` — after preload's
 * PNGs have actually finished loading (preload() only registers the load;
 * the image bytes aren't in the texture manager yet when preload()'s own
 * function body runs) and before any `UnitSprite` gets constructed. The
 * baked texture lives in the shared Phaser texture manager, so it doesn't
 * need re-baking per scene — `UnitStatusBar` (owned by the separate
 * `UIScene`) can reference the same key once `TacticalScene` has baked it.
 */
export function ensureGrayscaleHeroTexture(scene: Scene, name: string): void {
  const key = heroTextureKey(name);
  const grayKey = heroGrayTextureKey(name);
  if (scene.textures.exists(grayKey) || !scene.textures.exists(key)) return;

  const source = scene.textures.get(key).getSourceImage();
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.drawImage(source as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = luminance;
    data[i + 1] = luminance;
    data[i + 2] = luminance;
  }
  ctx.putImageData(imageData, 0, 0);
  scene.textures.addCanvas(grayKey, canvas);
}
