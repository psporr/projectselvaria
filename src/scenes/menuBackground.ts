import { Scene } from 'phaser';

import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';

const BG_KEY = 'menu-bg';

/** Shared by every full-screen menu scene (`MainMenuScene`, `ChapterSelectScene`) so they read as one visual space instead of the background flashing/reloading between them. */
export function preloadMenuBackground(scene: Scene): void {
  if (!scene.textures.exists(BG_KEY)) scene.load.image(BG_KEY, 'maps/river1.jpg');
}

/** Full-bleed cover-fit background image with a dark scrim on top so a menu's own text/cards stay legible over a busy painted map — same darken-for-legibility idea as every other panel's Card backdrop, just applied to the whole screen instead of one widget. */
export function drawMenuBackground(scene: Scene): void {
  const bg = scene.add.image(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, BG_KEY);
  const coverScale = Math.max(LOGICAL_WIDTH / bg.width, LOGICAL_HEIGHT / bg.height);
  bg.setScale(coverScale);

  const scrim = scene.add.graphics();
  scrim.fillStyle(0x0d0f1a, 0.8);
  scrim.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}
