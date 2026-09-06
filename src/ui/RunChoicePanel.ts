import { GameObjects, Scene } from 'phaser';

import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 300;
const CARD_HEIGHT = 260;
const BUTTON_WIDTH = 240;
const BUTTON_HEIGHT = 46;
const BUTTON_GAP = 10;

export interface RunChoiceInfo {
  /** The Boss wave just cleared. */
  wave: number;
  /** What banking right now would award — src/game/meta.ts's computeEmbersEarned(G, true). */
  embersIfBanked: number;
}

/**
 * The run structure's one real checkpoint (tactics-roguelike-design's
 * run-structure.md/risk-reward-and-difficulty-pacing.md): offered every
 * time a Boss wave falls (waves.ts's runPhaseForWave), never just once.
 * Two equally-weighted choices, no backdrop-cancel — same "the player must
 * pick one" convention BlessingPicker uses, since neither option here is a
 * neutral "nevermind" the way ConfirmDialog's Cancel is. The Embers number
 * is shown up front so the risk (push on with no guaranteed payoff yet) and
 * reward (a bigger, locked-in bank next checkpoint) are both visible before
 * the player commits, per that skill's "risk must be seen and chosen" rule.
 */
export class RunChoicePanel extends GameObjects.Container {
  private readonly headingText: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly bankButton: Button;
  private readonly descendButton: Button;
  private onChoose: ((path: 'bank' | 'descend') => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;

    const backdrop = scene.add.rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.75);
    // Gold stroke (matches BlessingPicker's legendary color) rather than the
    // usual blue Card default — this checkpoint reads as the run's biggest
    // decision, not just another panel.
    const card = new Card(scene, centerX, centerY, CARD_WIDTH, CARD_HEIGHT, 0xf0ad4e);

    this.headingText = scene.add
      .text(centerX, centerY - CARD_HEIGHT / 2 + 34, 'The Warlord Falls', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.bodyText = scene.add
      .text(centerX, centerY - 40, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        align: 'center',
        wordWrap: { width: CARD_WIDTH - 40 },
        lineSpacing: 4,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const bankY = centerY + 40;
    this.bankButton = new Button(scene, centerX, bankY, BUTTON_WIDTH, BUTTON_HEIGHT, '', () => this.choose('bank'));
    this.bankButton.setAccent(COLORS.successFill, COLORS.successStroke);

    const descendY = bankY + BUTTON_HEIGHT + BUTTON_GAP;
    this.descendButton = new Button(scene, centerX, descendY, BUTTON_WIDTH, BUTTON_HEIGHT, 'Descend into the Depths', () => this.choose('descend'));

    this.add([backdrop, card, this.headingText, this.bodyText, this.bankButton, this.descendButton]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(info: RunChoiceInfo, onChoose: (path: 'bank' | 'descend') => void): void {
    this.onChoose = onChoose;
    this.bodyText.setText(
      `Wave ${info.wave} cleared. Bank now and your Embers are safe — or push into the Depths for another shot at more, with everything still on the line.`,
    );
    this.bankButton.setLabel(`Bank the Run (${info.embersIfBanked} Embers)`);
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onChoose = null;
  }

  private choose(path: 'bank' | 'descend'): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(path);
  }
}
