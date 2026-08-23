import { GameObjects, Scene } from 'phaser';

import type { Team } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';

const BAR_HEIGHT = 56;
const BANNER_Y = LOGICAL_HEIGHT * 0.32;
const SLIDE_MS = 220;
const HOLD_MS = 900;

const TEAM_STYLE: Record<Team, { bar: number; accent: number; label: string }> = {
  player: { bar: 0x1f3a63, accent: 0x4a90d9, label: 'Player Phase' },
  enemy: { bar: 0x5a2226, accent: 0xd9534f, label: 'Enemy Phase' },
};

/**
 * The classic Fire Emblem "Player Phase" / "Enemy Phase" banner: slides in
 * from off-screen, holds, slides out the other side. Purely cosmetic —
 * UIScene calls show() off a ctx.turn diff (refreshHud) — so it doesn't
 * touch input; nothing dangerous can happen in the beat before a fresh
 * phase's units have had a chance to act.
 *
 * Animates the container's own x rather than each child, so the bar and its
 * accent stripes/label move as one rigid group across the fixed logical
 * width — LOGICAL_WIDTH off to either side is exactly one screen's worth of
 * travel, whatever DPR/camera zoom the scene is running at (children stay
 * authored in the same logical space as everything else, per viewport.ts).
 */
export class PhaseBanner extends GameObjects.Container {
  private readonly bar: GameObjects.Rectangle;
  private readonly accentTop: GameObjects.Rectangle;
  private readonly accentBottom: GameObjects.Rectangle;
  private readonly label: GameObjects.Text;

  constructor(scene: Scene) {
    super(scene, -LOGICAL_WIDTH, 0);

    const centerX = LOGICAL_WIDTH / 2;

    this.bar = scene.add.rectangle(centerX, BANNER_Y, LOGICAL_WIDTH, BAR_HEIGHT, 0x1f3a63, 0.94);
    this.accentTop = scene.add.rectangle(centerX, BANNER_Y - BAR_HEIGHT / 2, LOGICAL_WIDTH, 3, 0x4a90d9);
    this.accentBottom = scene.add.rectangle(centerX, BANNER_Y + BAR_HEIGHT / 2, LOGICAL_WIDTH, 3, 0x4a90d9);
    this.label = scene.add
      .text(centerX, BANNER_Y, '', {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#ffffff',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([this.bar, this.accentTop, this.accentBottom, this.label]);
    this.setDepth(25);
    scene.add.existing(this);
    this.setVisible(false);
  }

  /**
   * `onComplete` fires once the banner has fully slid back out — TacticalScene
   * uses this (for the enemy team only) to hold the CPU's opening move until
   * the banner is genuinely gone, rather than a separately-run timer guessing
   * this animation's total duration and hoping the two don't drift apart.
   */
  show(team: Team, onComplete?: () => void): void {
    const style = TEAM_STYLE[team];
    this.bar.setFillStyle(style.bar, 0.94);
    this.accentTop.setFillStyle(style.accent);
    this.accentBottom.setFillStyle(style.accent);
    this.label.setText(style.label);

    this.scene.tweens.killTweensOf(this);
    this.setX(-LOGICAL_WIDTH);
    this.setVisible(true);
    this.scene.tweens.add({
      targets: this,
      x: 0,
      duration: SLIDE_MS,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          x: LOGICAL_WIDTH,
          duration: SLIDE_MS,
          delay: HOLD_MS,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.setVisible(false);
            onComplete?.();
          },
        });
      },
    });
  }
}
