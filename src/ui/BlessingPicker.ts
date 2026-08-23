import { GameObjects, Scene } from 'phaser';

import type { Blessing, BlessingRarity } from '../game/blessings';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Card } from './kit';

const CARD_WIDTH = 132;
const CARD_HEIGHT = 260;
const CARD_GAP = 12;

const RARITY_COLOR: Record<BlessingRarity, number> = {
  common: 0x9099a8,
  rare: 0x4a90d9,
  legendary: 0xf0ad4e,
};

const RARITY_STARS: Record<BlessingRarity, string> = {
  common: '★',
  rare: '★★',
  legendary: '★★★',
};

/**
 * The wave-clear pick — 3 cards, one per offered blessing. No unique art
 * (no asset pipeline yet, everything else is still programmer art too — see
 * UnitSprite), so rarity reads as a colored border + star count rather than
 * a per-blessing icon.
 */
export class BlessingPicker extends GameObjects.Container {
  private readonly cardNodes: GameObjects.GameObject[] = [];
  private onPick: ((id: string) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    const heading = scene.add
      .text(width / 2, height / 2 - CARD_HEIGHT / 2 - 32, 'Choose a Blessing', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#e0e0e0',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([backdrop, heading]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(blessings: Blessing[], onPick: (id: string) => void): void {
    this.onPick = onPick;
    for (const node of this.cardNodes.splice(0)) node.destroy();

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const totalWidth = blessings.length * CARD_WIDTH + (blessings.length - 1) * CARD_GAP;
    const startX = width / 2 - totalWidth / 2 + CARD_WIDTH / 2;
    const centerY = height / 2;

    blessings.forEach((blessing, index) => {
      const x = startX + index * (CARD_WIDTH + CARD_GAP);
      const color = RARITY_COLOR[blessing.rarity];

      const card = new Card(this.scene, x, centerY, CARD_WIDTH, CARD_HEIGHT, color);
      const hitZone = this.scene.add
        .rectangle(x, centerY, CARD_WIDTH, CARD_HEIGHT, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.pick(blessing.id));

      const stars = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 18, RARITY_STARS[blessing.rarity], {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: `#${color.toString(16).padStart(6, '0')}`,
          resolution: DPR,
        })
        .setOrigin(0.5);

      const name = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 44, blessing.name, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#e0e0e0',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 16 },
          resolution: DPR,
        })
        .setOrigin(0.5, 0);

      const description = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 100, blessing.description, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#9099a8',
          align: 'center',
          wordWrap: { width: CARD_WIDTH - 16 },
          lineSpacing: 4,
          resolution: DPR,
        })
        .setOrigin(0.5, 0);

      this.add([card, hitZone, stars, name, description]);
      this.cardNodes.push(card, hitZone, stars, name, description);
    });

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onPick = null;
  }

  private pick(id: string): void {
    const callback = this.onPick;
    this.hide();
    callback?.(id);
  }
}
