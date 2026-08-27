import { GameObjects, Scene } from 'phaser';

import type { ClassName } from '../game/classes';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

export interface PromotionCandidate {
  unitId: string;
  name: string;
  fromClass: ClassName;
  toClass: ClassName;
}

const CARD_WIDTH = 320;
const ROW_HEIGHT = 44;
const ROW_GAP = 8;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 16;
const CONTINUE_HEIGHT = 40;
const CONTINUE_GAP = 14;

/**
 * Wave-clear promotion checklist (`game.ts`'s `resolvePromotions`) — shown
 * after `BlessingPicker` resolves, only when at least one player unit is
 * eligible (`classes.ts`'s `canPromote`). Unlike `BlessingPicker`'s
 * pick-exactly-one, this is a multi-select: each eligible unit gets its own
 * toggle, and Continue is always available, confirming whatever's currently
 * selected — including none, a valid "promote nobody, continue" skip.
 */
export class PromotionPicker extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly title: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];
  private selected = new Set<string>();
  private onConfirm: ((unitIds: string[]) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.card = new Card(scene, width / 2, height / 2, CARD_WIDTH, TOP_PADDING + BOTTOM_PADDING);
    this.title = scene.add
      .text(width / 2, height / 2, 'Promotions Available', {
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

  show(candidates: PromotionCandidate[], onConfirm: (unitIds: string[]) => void): void {
    this.onConfirm = onConfirm;
    this.selected = new Set();
    for (const row of this.rows.splice(0)) row.destroy();

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const titleHeight = 24;
    const rowsHeight = candidates.length * ROW_HEIGHT + Math.max(0, candidates.length - 1) * ROW_GAP;
    const cardHeight = TOP_PADDING + titleHeight + rowsHeight + CONTINUE_GAP + CONTINUE_HEIGHT + BOTTOM_PADDING;
    this.card.resize(CARD_WIDTH, cardHeight);

    const cardTop = height / 2 - cardHeight / 2;
    this.title.setPosition(width / 2, cardTop + TOP_PADDING / 2 + 10);

    const startY = cardTop + TOP_PADDING + titleHeight + ROW_HEIGHT / 2;
    candidates.forEach((candidate, index) => {
      const y = startY + index * (ROW_HEIGHT + ROW_GAP);
      const label = `${candidate.name}\n${candidate.fromClass} -> ${candidate.toClass}`;
      const button = new Button(this.scene, width / 2, y, CARD_WIDTH - 32, ROW_HEIGHT, label, () => {}, '11px');
      button.setOnTap(() => this.toggle(candidate.unitId, button));
      this.add(button);
      this.rows.push(button);
    });

    const continueY = startY + rowsHeight + CONTINUE_GAP;
    const continueButton = new Button(this.scene, width / 2, continueY, CARD_WIDTH - 32, CONTINUE_HEIGHT, 'Continue', () => this.confirm());
    this.add(continueButton);
    this.rows.push(continueButton);

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
  }

  private toggle(unitId: string, button: Button): void {
    if (this.selected.has(unitId)) {
      this.selected.delete(unitId);
      button.setAccent(null, null);
    } else {
      this.selected.add(unitId);
      button.setAccent(COLORS.successFill, COLORS.successStroke);
    }
  }

  private confirm(): void {
    const callback = this.onConfirm;
    const ids = [...this.selected];
    this.hide();
    callback?.(ids);
  }
}
