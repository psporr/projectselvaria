import { GameObjects, Scene } from 'phaser';

import { BLESSINGS, SHOP_PRICE_BY_RARITY, type Blessing } from '../game/blessings';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { RARITY_COLOR } from './BlessingPicker';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 132;
const CARD_HEIGHT = 250;
const CARD_GAP = 12;
const BUY_BUTTON_HEIGHT = 30;

/**
 * A Shop node (src/game/game.ts's buyShopOffer/leaveShop) — the same 3
 * blessing cards BlessingPicker draws (drawBlessings, reused as-is), each
 * with a Gold price by rarity instead of being free. Stays open across
 * multiple purchases (refresh() re-renders after each buy, since Gold and
 * which offers remain both change), closed only by the explicit Leave
 * button — unlike BlessingPicker/RunChoicePanel, browsing a shop without
 * buying anything is a legitimate choice.
 */
export class ShopPanel extends GameObjects.Container {
  private readonly headingText: GameObjects.Text;
  private readonly goldText: GameObjects.Text;
  private readonly leaveButton: Button;
  private readonly cardNodes: GameObjects.GameObject[] = [];
  private onBuy: ((id: string) => void) | null = null;
  private onLeave: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const centerY = height / 2 - 20;

    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    this.headingText = scene.add
      .text(width / 2, centerY - CARD_HEIGHT / 2 - 46, 'Shop', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#f0ad4e',
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);
    this.goldText = scene.add
      .text(width / 2, centerY - CARD_HEIGHT / 2 - 22, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.leaveButton = new Button(scene, width / 2, centerY + CARD_HEIGHT / 2 + 40, 200, 44, 'Leave', () => this.leave());

    this.add([backdrop, this.headingText, this.goldText, this.leaveButton]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(offeredIds: string[], gold: number, onBuy: (id: string) => void, onLeave: () => void): void {
    this.onBuy = onBuy;
    this.onLeave = onLeave;
    this.render(offeredIds, gold);
    this.setVisible(true);
  }

  /** Called after every purchase — the offer list shrinks and Gold changes, so the cards' bought/afford state needs to catch up without re-showing (which would re-trigger the fade-in and reset onBuy/onLeave unnecessarily). */
  refresh(offeredIds: string[], gold: number): void {
    if (!this.visible) return;
    this.render(offeredIds, gold);
  }

  hide(): void {
    this.setVisible(false);
    this.onBuy = null;
    this.onLeave = null;
  }

  private render(offeredIds: string[], gold: number): void {
    for (const node of this.cardNodes.splice(0)) node.destroy();

    this.goldText.setText(`${gold} Gold`);

    const width = LOGICAL_WIDTH;
    const centerY = LOGICAL_HEIGHT / 2 - 20;
    const totalWidth = offeredIds.length * CARD_WIDTH + (offeredIds.length - 1) * CARD_GAP;
    const startX = width / 2 - totalWidth / 2 + CARD_WIDTH / 2;

    offeredIds.forEach((blessingId, index) => {
      const blessing = BLESSINGS.find((candidate) => candidate.id === blessingId);
      if (!blessing) return;
      const x = startX + index * (CARD_WIDTH + CARD_GAP);
      const color = RARITY_COLOR[blessing.rarity];
      const price = SHOP_PRICE_BY_RARITY[blessing.rarity];
      const canAfford = gold >= price;

      const card = new Card(this.scene, x, centerY, CARD_WIDTH, CARD_HEIGHT, color);

      const name = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 20, blessing.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          color: '#e0e0e0',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 16 },
          resolution: DPR,
        })
        .setOrigin(0.5, 0);

      const description = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 76, blessing.description, {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: '#9099a8',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 16 },
          lineSpacing: 4,
          resolution: DPR,
        })
        .setOrigin(0.5, 0);

      const buyY = centerY + CARD_HEIGHT / 2 - BUY_BUTTON_HEIGHT / 2 - 12;
      const buyButton = new Button(this.scene, x, buyY, CARD_WIDTH - 16, BUY_BUTTON_HEIGHT, `${price} Gold`, () => this.buy(blessing, canAfford), '12px');
      buyButton.setEnabled(canAfford);

      this.add([card, name, description, buyButton]);
      this.cardNodes.push(card, name, description, buyButton);
    });
  }

  private buy(blessing: Blessing, canAfford: boolean): void {
    if (!canAfford) return;
    this.onBuy?.(blessing.id);
  }

  private leave(): void {
    const callback = this.onLeave;
    this.hide();
    callback?.();
  }
}
