import { GameObjects, Scene } from 'phaser';

import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 420;
const TOP_PADDING = 20;
const BUTTON_GAP = 56;
const MAX_CARD_HEIGHT = LOGICAL_HEIGHT - 64;
/** G.log is newest-first (UIScene's old always-visible strip showed `slice(0, 4)` as "most recent"); capped here since this has no real scroll, just a taller card. */
const MAX_ENTRIES = 20;

/**
 * On-demand battle log — reachable from SystemMenu's "Battle Log" option
 * (End Turn/Menu's sibling, TacticalScene.openSystemMenu()) now that the
 * log isn't an always-visible strip on the board screen anymore; that
 * space went to UnitStatusBar instead (see its own doc comment). Same
 * Card + backdrop + Close pattern as ForecastPanel/BlessingPicker.
 */
export class LogPanel extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly title: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly closeButton: Button;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const cardWidth = Math.min(CARD_WIDTH, LOGICAL_WIDTH - 32);

    this.backdrop = scene.add.rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.6).setInteractive();
    this.backdrop.on('pointerup', () => this.hide());

    this.card = new Card(scene, centerX, centerY, cardWidth, 200);

    this.title = scene.add
      .text(centerX, centerY, 'Battle Log', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.bodyText = scene.add
      .text(centerX - cardWidth / 2 + 20, centerY, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        lineSpacing: 8,
        wordWrap: { width: cardWidth - 40 },
        resolution: DPR,
      })
      .setOrigin(0, 0);

    this.closeButton = new Button(scene, centerX, centerY, 100, 32, 'Close', () => this.hide());

    this.add([this.backdrop, this.card, this.title, this.bodyText, this.closeButton]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(log: string[]): void {
    const entries = log.slice(0, MAX_ENTRIES);
    this.bodyText.setText(entries.length > 0 ? entries.join('\n') : 'Nothing has happened yet.');

    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const cardWidth = Math.min(CARD_WIDTH, LOGICAL_WIDTH - 32);
    const titleHeight = 32;
    const cardHeight = Math.min(MAX_CARD_HEIGHT, TOP_PADDING * 2 + titleHeight + this.bodyText.height + BUTTON_GAP);
    this.card.resize(cardWidth, cardHeight);

    const top = centerY - cardHeight / 2;
    this.title.setPosition(centerX, top + TOP_PADDING + titleHeight / 2);
    this.bodyText.setPosition(centerX - cardWidth / 2 + 20, top + TOP_PADDING + titleHeight);
    this.closeButton.setPosition(centerX, top + cardHeight - BUTTON_GAP / 2);

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }
}
