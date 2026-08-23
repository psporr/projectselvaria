import { GameObjects, Scene } from 'phaser';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';

export type SystemMenuChoice = 'restart' | 'cancel';

export interface SystemMenuOption {
  id: SystemMenuChoice;
  label: string;
  enabled: boolean;
}

const CARD_WIDTH = 260;
const ROW_HEIGHT = 42;
const ROW_GAP = 8;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 16;

/**
 * Tactical field / system menu (End Turn / Squad / Danger Zone / Restart / Cancel).
 * Opens when tapping an empty map tile during player idle mode or clicking the HUD Menu button.
 */
export class SystemMenu extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: GameObjects.Rectangle;
  private readonly title: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];
  private onChoose: ((id: SystemMenuChoice) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setInteractive();
    this.backdrop.on('pointerdown', () => this.choose('cancel'));

    this.card = scene.add.rectangle(width / 2, height / 2, CARD_WIDTH, TOP_PADDING + BOTTOM_PADDING, 0x1c2030, 0.97).setStrokeStyle(2, 0x4a90d9);

    this.title = scene.add
      .text(width / 2, height / 2, 'Menu', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#f0ad4e',
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([this.backdrop, this.card, this.title]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(options: SystemMenuOption[], onChoose: (id: SystemMenuChoice) => void): void {
    this.onChoose = onChoose;
    for (const row of this.rows.splice(0)) row.destroy();

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const titleHeight = 24;
    const cardHeight = TOP_PADDING + titleHeight + BOTTOM_PADDING + options.length * ROW_HEIGHT + (options.length - 1) * ROW_GAP;
    this.card.setSize(CARD_WIDTH, cardHeight);

    const cardTop = height / 2 - cardHeight / 2;
    this.title.setPosition(width / 2, cardTop + TOP_PADDING / 2 + 10);

    const startY = cardTop + TOP_PADDING + titleHeight + ROW_HEIGHT / 2;
    options.forEach((option, index) => {
      const y = startY + index * (ROW_HEIGHT + ROW_GAP);
      const fill = option.enabled ? 0x2d3348 : 0x22262f;
      const button = this.scene.add.rectangle(width / 2, y, CARD_WIDTH - 32, ROW_HEIGHT, fill).setStrokeStyle(1, 0x3a4258);
      const label = this.scene.add
        .text(width / 2, y, option.label, {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: option.enabled ? '#e0e0e0' : '#5a6070',
          resolution: DPR,
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

  private choose(id: SystemMenuChoice): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(id);
  }
}
