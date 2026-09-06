import { GameObjects, Scene } from 'phaser';

import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 280;
const CARD_HEIGHT = 220;
const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 46;
const BUTTON_GAP = 10;

/**
 * A Rest node's choice (src/game/game.ts's chooseRest) — Slay the Spire's
 * rest site: heal to full, or a smaller *permanent* upgrade, never both.
 * No backdrop-cancel, same "must pick one" convention as BlessingPicker —
 * this is the node the player already committed to by picking it on the
 * path-choice screen.
 */
export class RestPanel extends GameObjects.Container {
  private onChoose: ((choice: 'heal' | 'upgrade') => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;

    const backdrop = scene.add.rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.75);
    const card = new Card(scene, centerX, centerY, CARD_WIDTH, CARD_HEIGHT, COLORS.successStroke);

    const heading = scene.add
      .text(centerX, centerY - CARD_HEIGHT / 2 + 30, 'A Moment to Rest', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: COLORS.textPrimary,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    const body = scene.add
      .text(centerX, centerY - 40, 'Heal the squad to full, or train for a smaller but permanent gain. Not both.', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        align: 'center',
        wordWrap: { width: CARD_WIDTH - 40 },
        lineSpacing: 4,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const healY = centerY + 30;
    const healButton = new Button(scene, centerX, healY, BUTTON_WIDTH, BUTTON_HEIGHT, 'Heal to Full', () => this.choose('heal'));
    healButton.setAccent(COLORS.successFill, COLORS.successStroke);

    const upgradeY = healY + BUTTON_HEIGHT + BUTTON_GAP;
    const upgradeButton = new Button(scene, centerX, upgradeY, BUTTON_WIDTH, BUTTON_HEIGHT, 'Train (+HP, permanent)', () => this.choose('upgrade'));

    this.add([backdrop, card, heading, body, healButton, upgradeButton]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(onChoose: (choice: 'heal' | 'upgrade') => void): void {
    this.onChoose = onChoose;
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onChoose = null;
  }

  private choose(choice: 'heal' | 'upgrade'): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(choice);
  }
}
