import { GameObjects, Scene } from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button } from './kit';

export type ActionMenuChoice = 'attack' | 'skill' | 'wait' | 'cancel';

export interface ActionMenuOption {
  id: ActionMenuChoice;
  label: string;
  enabled: boolean;
}

const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 40;
const GAP = 8;
const ANCHOR_MARGIN = 18;
const SCREEN_MARGIN = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The post-move action list (Attack / Skill / Wait / Cancel) — a small pill
 * cluster anchored next to the acting unit (mobile-SRPG convention) instead
 * of a centered modal, so the board stays visible while choosing. Rebuilds
 * its button rows on every show() rather than pooling them — the menu opens
 * at most once per unit action, so the churn is cheap and it keeps enabled/
 * disabled state and per-class skill labels trivial to get right.
 */
export class ActionMenu extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly rows: Button[] = [];
  private onChoose: ((id: ActionMenuChoice) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.35).setInteractive();
    this.backdrop.on('pointerdown', () => this.choose('cancel'));

    this.add([this.backdrop]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  /** `anchorX`/`anchorY` — the acting unit's tile center; the button stack appears beside it, clamped to stay on-screen. */
  show(options: ActionMenuOption[], onChoose: (id: ActionMenuChoice) => void, anchorX: number, anchorY: number): void {
    this.onChoose = onChoose;
    for (const row of this.rows.splice(0)) row.destroy();

    const stackHeight = options.length * BUTTON_HEIGHT + (options.length - 1) * GAP;
    const onRightHalf = anchorX > LOGICAL_WIDTH / 2;
    const rawX = onRightHalf ? anchorX - ANCHOR_MARGIN - BUTTON_WIDTH / 2 : anchorX + ANCHOR_MARGIN + BUTTON_WIDTH / 2;
    const stackX = clamp(rawX, BUTTON_WIDTH / 2 + SCREEN_MARGIN, LOGICAL_WIDTH - BUTTON_WIDTH / 2 - SCREEN_MARGIN);
    const stackCenterY = clamp(anchorY, stackHeight / 2 + SCREEN_MARGIN, LOGICAL_HEIGHT - stackHeight / 2 - SCREEN_MARGIN);
    const startY = stackCenterY - stackHeight / 2 + BUTTON_HEIGHT / 2;

    options.forEach((option, index) => {
      const y = startY + index * (BUTTON_HEIGHT + GAP);
      const button = new Button(this.scene, stackX, y, BUTTON_WIDTH, BUTTON_HEIGHT, option.label, () => this.choose(option.id), '15px');
      button.setEnabled(option.enabled);
      this.add(button);
      this.rows.push(button);
    });

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onChoose = null;
  }

  private choose(id: ActionMenuChoice): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(id);
  }
}
