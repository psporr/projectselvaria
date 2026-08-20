import { GameObjects, Scene } from 'phaser';

export type ActionMenuChoice = 'attack' | 'skill' | 'wait' | 'cancel';

export interface ActionMenuOption {
  id: ActionMenuChoice;
  label: string;
  enabled: boolean;
}

const CARD_WIDTH = 260;
const ROW_HEIGHT = 44;
const ROW_GAP = 8;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 16;

/**
 * The post-move action list (Attack / Skill / Wait / Cancel). Rebuilds its
 * button rows on every show() rather than pooling them — the menu opens at
 * most once per unit action, so the churn is cheap and it keeps enabled/
 * disabled state and per-class skill labels trivial to get right.
 */
export class ActionMenu extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: GameObjects.Rectangle;
  private readonly rows: GameObjects.GameObject[] = [];
  private onChoose: ((id: ActionMenuChoice) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const { width, height } = scene.scale;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4).setInteractive();
    this.backdrop.on('pointerdown', () => this.choose('cancel'));

    this.card = scene.add.rectangle(width / 2, height / 2, CARD_WIDTH, TOP_PADDING + BOTTOM_PADDING, 0x1c2030, 0.97).setStrokeStyle(2, 0x4a90d9);

    this.add([this.backdrop, this.card]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(options: ActionMenuOption[], onChoose: (id: ActionMenuChoice) => void): void {
    this.onChoose = onChoose;
    for (const row of this.rows.splice(0)) row.destroy();

    const { width, height } = this.scene.scale;
    const cardHeight = TOP_PADDING + BOTTOM_PADDING + options.length * ROW_HEIGHT + (options.length - 1) * ROW_GAP;
    this.card.setSize(CARD_WIDTH, cardHeight);

    const startY = height / 2 - cardHeight / 2 + TOP_PADDING + ROW_HEIGHT / 2;
    options.forEach((option, index) => {
      const y = startY + index * (ROW_HEIGHT + ROW_GAP);
      const fill = option.enabled ? 0x2d3348 : 0x22262f;
      const button = this.scene.add.rectangle(width / 2, y, CARD_WIDTH - 32, ROW_HEIGHT, fill).setStrokeStyle(1, 0x3a4258);
      const label = this.scene.add
        .text(width / 2, y, option.label, {
          fontFamily: 'monospace',
          fontSize: '15px',
          color: option.enabled ? '#e0e0e0' : '#5a6070',
        })
        .setOrigin(0.5);

      if (option.enabled) {
        button.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.choose(option.id));
      }

      this.add([button, label]);
      this.rows.push(button, label);
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
