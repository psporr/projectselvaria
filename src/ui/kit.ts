import { GameObjects, Geom, Scene } from 'phaser';

import { DPR } from '../systems/viewport';

/**
 * Shared "mobile game style" visual language — one place for the palette
 * and the two building blocks (rounded button, rounded card) every panel in
 * `src/ui/` is built from. Centralized because the same shapes were about
 * to be hand-rolled from flat `scene.add.rectangle(...)` calls in 6+ files
 * with a slightly-drifting copy of the same colors; without this, the panels
 * would visually diverge over time.
 *
 * No art assets exist in this project — "mobile style" here means shape,
 * color, and motion (rounded corners, drop shadows, press feedback), not
 * icon art. `GameObjects.Rectangle` (used everywhere before this file) has
 * no rounded-corner support, so both widgets below draw with `Graphics`
 * (`fillRoundedRect`/`strokeRoundedRect`) instead.
 */
export const COLORS = {
  cardBg: 0x1c2030,
  cardStroke: 0x4a90d9,
  cardShadow: 0x000000,
  buttonFill: 0x2d3348,
  buttonFillDisabled: 0x22262f,
  buttonStroke: 0x3a4258,
  textPrimary: '#e0e0e0',
  textDisabled: '#5a6070',
  textAccent: '#f0ad4e',
  playerAccent: 0x4a90d9,
  enemyAccent: 0xd9534f,
  dangerOnFill: 0x5a2d33,
  dangerOnText: '#ff9999',
  successFill: 0x3a8f4a,
  successStroke: 0x5ab56a,
  cancelFill: 0x8a3a3a,
} as const;

const RADIUS = 12;

/**
 * A rounded-rect button: `Graphics` background + centered `Text` label,
 * hit-tested against a centered rectangle matching the drawn shape (a
 * Container's default hit area is top-left-anchored, which would mismatch
 * a centered visual — see Phaser's own input skill). Includes a quick
 * scale-down/up press tween, the one genuinely new "mobile feel" touch
 * this kit adds beyond restyled shapes.
 *
 * Field names avoid `w`/`h`/`width`/`height` — `GameObjects.Container`
 * already declares those, and TypeScript rejects a subclass re-declaring
 * them with a different visibility.
 */
export class Button extends GameObjects.Container {
  private readonly gfx: GameObjects.Graphics;
  private readonly labelText: GameObjects.Text;
  private readonly btnW: number;
  private readonly btnH: number;
  private enabled = true;
  private onTap: (() => void) | null;

  constructor(scene: Scene, x: number, y: number, width: number, height: number, text: string, onTap: (() => void) | null, fontSize = '14px') {
    super(scene, x, y);
    this.btnW = width;
    this.btnH = height;
    this.onTap = onTap;

    this.gfx = scene.add.graphics();
    this.labelText = scene.add
      .text(0, 0, text, {
        fontFamily: 'monospace',
        fontSize,
        fontStyle: 'bold',
        color: COLORS.textPrimary,
        align: 'center',
        wordWrap: { width: width - 10 },
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([this.gfx, this.labelText]);
    this.setHitArea();
    this.on('pointerdown', () => this.onPress());
    this.on('pointerup', () => this.onRelease(true));
    this.on('pointerout', () => this.onRelease(false));

    this.redraw();
    scene.add.existing(this);
  }

  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) this.setHitArea();
    else this.disableInteractive();
    this.redraw();
  }

  setLabel(text: string): void {
    this.labelText.setText(text);
  }

  /** Swaps the tap handler without rebuilding the button — used where the same dock button's action changes with game state (e.g. a Danger Zone toggle). */
  setOnTap(onTap: (() => void) | null): void {
    this.onTap = onTap;
  }

  private setHitArea(): void {
    this.setInteractive({
      hitArea: new Geom.Rectangle(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH),
      hitAreaCallback: Geom.Rectangle.Contains,
      useHandCursor: true,
    });
  }

  private onPress(): void {
    if (!this.enabled) return;
    this.scene.tweens.add({ targets: this, scaleX: 0.92, scaleY: 0.92, duration: 60, ease: 'Quad.easeOut' });
  }

  private onRelease(fireTap: boolean): void {
    if (!this.enabled) return;
    this.scene.tweens.add({ targets: this, scaleX: 1, scaleY: 1, duration: 90, ease: 'Quad.easeOut' });
    if (fireTap) this.onTap?.();
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(this.enabled ? COLORS.buttonFill : COLORS.buttonFillDisabled, 1);
    g.fillRoundedRect(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH, RADIUS);
    g.lineStyle(1, COLORS.buttonStroke, 1);
    g.strokeRoundedRect(-this.btnW / 2, -this.btnH / 2, this.btnW, this.btnH, RADIUS);
    this.labelText.setColor(this.enabled ? COLORS.textPrimary : COLORS.textDisabled);
  }
}

/**
 * A rounded-rect card background with a drop shadow, resizable in place
 * (`resize()`) for panels whose height depends on their content (the
 * option-count-driven cards in `ActionMenu`/`SystemMenu`). Chrome only —
 * callers add their own content on top, same as the plain-rectangle cards
 * it replaces. See `Button`'s field-naming note above re: `w`/`h`.
 */
export class Card extends GameObjects.Container {
  private readonly gfx: GameObjects.Graphics;
  private cardW: number;
  private cardH: number;
  private readonly strokeColor: number;

  constructor(scene: Scene, x: number, y: number, width: number, height: number, strokeColor: number = COLORS.cardStroke) {
    super(scene, x, y);
    this.cardW = width;
    this.cardH = height;
    this.strokeColor = strokeColor;

    this.gfx = scene.add.graphics();
    this.add(this.gfx);
    this.redraw();
    scene.add.existing(this);
  }

  resize(width: number, height: number): void {
    this.cardW = width;
    this.cardH = height;
    this.redraw();
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(COLORS.cardShadow, 0.35);
    g.fillRoundedRect(-this.cardW / 2 + 3, -this.cardH / 2 + 5, this.cardW, this.cardH, RADIUS);
    g.fillStyle(COLORS.cardBg, 0.97);
    g.fillRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, RADIUS);
    g.lineStyle(2, this.strokeColor, 1);
    g.strokeRoundedRect(-this.cardW / 2, -this.cardH / 2, this.cardW, this.cardH, RADIUS);
  }
}
