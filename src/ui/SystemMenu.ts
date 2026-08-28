import { GameObjects, Scene } from 'phaser';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

export type SystemMenuChoice = 'end-turn' | 'log' | 'restart' | 'main-menu' | 'cancel';

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
 * Overflow menu, reachable by tapping an empty map tile during player idle
 * mode or the dock's Menu button. Squad/Danger Zone stay dock-only (no
 * reason to duplicate them here); End Turn is duplicated here too since
 * tapping an empty tile to end the turn is a natural gesture on its own,
 * without needing the dock. Battle Log lives here only (not the dock) —
 * it moved off the always-visible board screen to make room for a bigger
 * UnitStatusBar (see that file's doc comment), so it's an on-demand look
 * now rather than a persistent readout.
 */
export class SystemMenu extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly title: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];
  private onChoose: ((id: SystemMenuChoice) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setInteractive();
    this.backdrop.on('pointerup', () => this.choose('cancel'));

    this.card = new Card(scene, width / 2, height / 2, CARD_WIDTH, TOP_PADDING + BOTTOM_PADDING);

    this.title = scene.add
      .text(width / 2, height / 2, 'Menu', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: COLORS.textAccent,
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
    this.card.resize(CARD_WIDTH, cardHeight);

    const cardTop = height / 2 - cardHeight / 2;
    this.title.setPosition(width / 2, cardTop + TOP_PADDING / 2 + 10);

    const startY = cardTop + TOP_PADDING + titleHeight + ROW_HEIGHT / 2;
    options.forEach((option, index) => {
      const y = startY + index * (ROW_HEIGHT + ROW_GAP);
      const button = new Button(this.scene, width / 2, y, CARD_WIDTH - 32, ROW_HEIGHT, option.label, () => this.choose(option.id), '14px');
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

  private choose(id: SystemMenuChoice): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(id);
  }
}
