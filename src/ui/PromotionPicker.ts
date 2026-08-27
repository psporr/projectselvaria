import { GameObjects, Scene } from 'phaser';

import type { ClassName } from '../game/classes';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

export interface PromotionCandidate {
  unitId: string;
  name: string;
  fromClass: ClassName;
  /** Every advanced class this unit's current class can branch into — usually 1, sometimes more (e.g. Lancer -> Lancemaster or General). */
  toClassOptions: ClassName[];
}

export interface PromotionSelection {
  unitId: string;
  toClass: ClassName;
}

const CARD_WIDTH = 320;
const NAME_HEIGHT = 18;
const NAME_GAP = 4;
const BRANCH_ROW_HEIGHT = 40;
const BRANCH_GAP = 8;
/** Height of one candidate's block: its name label plus its row of branch buttons. */
const BLOCK_HEIGHT = NAME_HEIGHT + NAME_GAP + BRANCH_ROW_HEIGHT;
const BLOCK_GAP = 14;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 16;
const CONTINUE_HEIGHT = 40;
const CONTINUE_GAP = 14;

/**
 * Wave-clear promotion checklist (`game.ts`'s `resolvePromotions`) — shown
 * after `BlessingPicker` resolves, only when at least one player unit is
 * eligible (`classes.ts`'s `canPromote`). Unlike `BlessingPicker`'s
 * pick-exactly-one, this is a multi-select across units: each eligible unit
 * gets its own row of branch buttons (one per advanced class it can promote
 * into — `PROMOTES_TO` is one-to-many, HANDOFF.md's Promotion section),
 * mutually exclusive within that row (tapping a branch again deselects it),
 * and Continue is always available, confirming whatever's currently
 * selected — including nothing, a valid "promote nobody, continue" skip.
 */
export class PromotionPicker extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly title: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];
  /** unitId -> the branch class currently selected for it (absent = not promoting this unit). */
  private selected = new Map<string, ClassName>();
  private onConfirm: ((selections: PromotionSelection[]) => void) | null = null;

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

  show(candidates: PromotionCandidate[], onConfirm: (selections: PromotionSelection[]) => void): void {
    this.onConfirm = onConfirm;
    this.selected = new Map();
    for (const row of this.rows.splice(0)) row.destroy();

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const titleHeight = 24;
    const blocksHeight = candidates.length * BLOCK_HEIGHT + Math.max(0, candidates.length - 1) * BLOCK_GAP;
    const cardHeight = TOP_PADDING + titleHeight + blocksHeight + CONTINUE_GAP + CONTINUE_HEIGHT + BOTTOM_PADDING;
    this.card.resize(CARD_WIDTH, cardHeight);

    const cardTop = height / 2 - cardHeight / 2;
    this.title.setPosition(width / 2, cardTop + TOP_PADDING / 2 + 10);

    const innerWidth = CARD_WIDTH - 32;
    const startY = cardTop + TOP_PADDING + titleHeight;
    candidates.forEach((candidate, index) => {
      const blockTop = startY + index * (BLOCK_HEIGHT + BLOCK_GAP);
      const nameLabel = this.scene.add
        .text(width / 2, blockTop + NAME_HEIGHT / 2, `${candidate.name} — ${candidate.fromClass}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: COLORS.textPrimary,
          resolution: DPR,
        })
        .setOrigin(0.5);
      this.add(nameLabel);
      this.rows.push(nameLabel);

      const branchY = blockTop + NAME_HEIGHT + NAME_GAP + BRANCH_ROW_HEIGHT / 2;
      const branchButtons: { button: Button; toClass: ClassName }[] = [];
      const n = candidate.toClassOptions.length;
      const branchWidth = (innerWidth - BRANCH_GAP * (n - 1)) / n;
      const leftEdge = width / 2 - innerWidth / 2;

      candidate.toClassOptions.forEach((toClass, branchIndex) => {
        const bx = leftEdge + branchWidth / 2 + branchIndex * (branchWidth + BRANCH_GAP);
        const button = new Button(this.scene, bx, branchY, branchWidth, BRANCH_ROW_HEIGHT, toClass, () => {}, '11px');
        button.setOnTap(() => this.toggle(candidate.unitId, toClass, branchButtons));
        this.add(button);
        this.rows.push(button);
        branchButtons.push({ button, toClass });
      });
    });

    const continueY = startY + blocksHeight + CONTINUE_GAP;
    const continueButton = new Button(this.scene, width / 2, continueY, CARD_WIDTH - 32, CONTINUE_HEIGHT, 'Continue', () => this.confirm());
    this.add(continueButton);
    this.rows.push(continueButton);

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
  }

  /** Selecting a branch for a unit deselects any other branch already picked for that same unit — mutually exclusive within one unit's row, tapping the active one again clears it. */
  private toggle(unitId: string, toClass: ClassName, rowButtons: { button: Button; toClass: ClassName }[]): void {
    const wasSelected = this.selected.get(unitId) === toClass;
    if (wasSelected) this.selected.delete(unitId);
    else this.selected.set(unitId, toClass);

    for (const { button, toClass: candidateClass } of rowButtons) {
      const active = !wasSelected && candidateClass === toClass;
      button.setAccent(active ? COLORS.successFill : null, active ? COLORS.successStroke : null);
    }
  }

  private confirm(): void {
    const callback = this.onConfirm;
    const selections: PromotionSelection[] = [...this.selected.entries()].map(([unitId, toClass]) => ({ unitId, toClass }));
    this.hide();
    callback?.(selections);
  }
}
