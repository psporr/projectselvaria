import { GameObjects, Scene } from 'phaser';

import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 160;
const TEXT_PADDING = 24;
const BUTTON_WIDTH = 120;
const BUTTON_HEIGHT = 42;
const BUTTON_GAP = 12;

/**
 * Generic "are you sure" modal — a message plus Cancel/confirm, for a
 * destructive action that needs a second tap before it happens (2026-08-28,
 * first used by `TacticalScene.returnToMainMenu()`). Same centered-modal,
 * dimmed-backdrop shape `BlessingPicker`/`DialoguePanel` use; tapping the
 * backdrop cancels, matching `SystemMenu`'s own backdrop-cancels
 * convention, rather than doing nothing (a modal with no visible "back out"
 * gesture is a dead end on a phone).
 */
export class ConfirmDialog extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly messageText: GameObjects.Text;
  private readonly cancelButton: Button;
  private readonly confirmButton: Button;

  private onConfirm: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    this.backdrop = scene.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.7).setInteractive();
    this.backdrop.on('pointerup', () => this.cancel());

    this.card = new Card(scene, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);

    this.messageText = scene.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 26, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: COLORS.textPrimary,
        align: 'center',
        wordWrap: { width: CARD_WIDTH - TEXT_PADDING * 2 },
        resolution: DPR,
      })
      .setOrigin(0.5);

    const buttonY = LOGICAL_HEIGHT / 2 + 40;
    this.cancelButton = new Button(
      scene,
      LOGICAL_WIDTH / 2 - BUTTON_WIDTH / 2 - BUTTON_GAP / 2,
      buttonY,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      'Cancel',
      () => this.cancel(),
    );
    this.confirmButton = new Button(scene, LOGICAL_WIDTH / 2 + BUTTON_WIDTH / 2 + BUTTON_GAP / 2, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, '', () =>
      this.confirm(),
    );
    this.confirmButton.setAccent(COLORS.cancelFill, COLORS.buttonStroke);

    this.add([this.backdrop, this.card, this.messageText, this.cancelButton, this.confirmButton]);
    this.setDepth(25);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(message: string, confirmLabel: string, onConfirm: () => void): void {
    this.messageText.setText(message);
    this.confirmButton.setLabel(confirmLabel);
    this.onConfirm = onConfirm;
    this.setVisible(true);
  }

  private confirm(): void {
    const callback = this.onConfirm;
    this.hide();
    callback?.();
  }

  private cancel(): void {
    this.hide();
  }

  private hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
  }
}
