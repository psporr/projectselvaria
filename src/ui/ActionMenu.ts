import { GameObjects, Scene } from 'phaser';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card } from './kit';

export type ActionMenuChoice = 'attack' | 'skill' | 'wait' | 'cancel';

export interface ActionMenuOption {
  id: ActionMenuChoice;
  label: string;
  enabled: boolean;
}

const BUTTON_WIDTH = 150;
const BUTTON_HEIGHT = 40;
const GAP = 8;
const SCREEN_MARGIN = 10;
const CARD_PADDING_X = 16;
const CARD_PADDING_Y = 14;
// anchorX/Y is the acting unit's TILE CENTER (TacticalScene's tileCenter()),
// not its edge — TILE_HALF is half of TacticalScene's TILE_SIZE (64). The
// card's near edge needs to clear the tile itself (and the unit sprite on
// it), not just sit some fixed offset from the center — a fixed margin here
// previously didn't account for the card's own padding around the buttons,
// so the card's near edge ended up ~2px from the tile center, well inside
// the unit's own tile.
const TILE_HALF = 32;
const EDGE_GAP = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * The post-move action list (Attack / Skill / Wait / Cancel) — a small pill
 * cluster anchored next to the acting unit (mobile-SRPG convention) instead
 * of a centered modal, so the board stays visible while choosing (no
 * screen-dimming backdrop — only an invisible tap-away-to-cancel zone) with
 * a Card behind the buttons for legibility against the board. Rebuilds its
 * button rows on every show() rather than pooling them — the menu opens at
 * most once per unit action, so the churn is cheap and it keeps enabled/
 * disabled state and per-class skill labels trivial to get right.
 */
export class ActionMenu extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly rows: Button[] = [];
  private onChoose: ((id: ActionMenuChoice) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    // Invisible — tap-away-to-cancel without dimming the board underneath.
    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0).setInteractive();
    this.backdrop.on('pointerdown', () => this.choose('cancel'));

    this.card = new Card(scene, width / 2, height / 2, BUTTON_WIDTH, BUTTON_HEIGHT);

    this.add([this.backdrop, this.card]);
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
    // Card center placed so its near edge sits TILE_HALF + EDGE_GAP from
    // the anchor — i.e. just clear of the unit's own tile — regardless of
    // the card's padding around the buttons. Anchors outward (toward
    // whichever screen edge the unit is nearer to), not inward toward
    // center — clamp() below still keeps it fully on-screen for a unit
    // right at the edge.
    const cardHalfWidth = BUTTON_WIDTH / 2 + CARD_PADDING_X;
    const nearEdgeOffset = TILE_HALF + EDGE_GAP;
    const rawX = onRightHalf ? anchorX + nearEdgeOffset + cardHalfWidth : anchorX - nearEdgeOffset - cardHalfWidth;
    const stackX = clamp(rawX, BUTTON_WIDTH / 2 + SCREEN_MARGIN, LOGICAL_WIDTH - BUTTON_WIDTH / 2 - SCREEN_MARGIN);
    const stackCenterY = clamp(anchorY, stackHeight / 2 + SCREEN_MARGIN, LOGICAL_HEIGHT - stackHeight / 2 - SCREEN_MARGIN);
    const startY = stackCenterY - stackHeight / 2 + BUTTON_HEIGHT / 2;

    this.card.setPosition(stackX, stackCenterY);
    this.card.resize(BUTTON_WIDTH + CARD_PADDING_X * 2, stackHeight + CARD_PADDING_Y * 2);

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
