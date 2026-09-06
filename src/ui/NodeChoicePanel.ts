import { GameObjects, Scene } from 'phaser';

import { SEGMENT_LENGTH } from '../game/runMap';
import type { MapNodeOption, MapNodeType } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 132;
const CARD_HEIGHT = 220;
const CARD_GAP = 12;

const NODE_COLOR: Record<MapNodeType, number> = {
  battle: COLORS.cardStroke,
  elite: COLORS.enemyAccent,
  rest: COLORS.successStroke,
  shop: 0xf0ad4e,
  boss: 0xb15be0,
};

const NODE_LABEL: Record<MapNodeType, string> = {
  battle: 'Battle',
  elite: 'Elite',
  rest: 'Rest',
  shop: 'Shop',
  boss: 'Boss',
};

const NODE_HINT: Record<MapNodeType, string> = {
  battle: 'A standard fight.',
  elite: 'A harder fight. Guarantees a better blessing reward.',
  rest: 'Heal the squad, or train for permanent HP.',
  shop: 'Spend Gold on blessings.',
  boss: "The segment's guardian. Clearing it opens Bank or Descend.",
};

/**
 * The run's branching-path choice (src/game/runMap.ts) — Slay the Spire's
 * map, shown one junction at a time as "pick your next stop" cards rather
 * than a full node graph (see runMap.ts's own doc comment for why). Same
 * dynamic card-width-by-count fix BlessingPicker uses, since a Boss
 * junction offers just 1 card instead of the usual 3.
 */
export class NodeChoicePanel extends GameObjects.Container {
  private readonly headingText: GameObjects.Text;
  private readonly cardNodes: GameObjects.GameObject[] = [];
  private onChoose: ((id: string) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    const backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.headingText = scene.add
      .text(width / 2, height / 2 - CARD_HEIGHT / 2 - 32, 'Choose Your Path', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: '#e0e0e0',
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([backdrop, this.headingText]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(options: MapNodeOption[], segmentDepth: number, onChoose: (id: string) => void): void {
    this.onChoose = onChoose;
    for (const node of this.cardNodes.splice(0)) node.destroy();

    this.headingText.setText(options.length === 1 ? 'The Path Ends Here' : `Choose Your Path (${segmentDepth}/${SEGMENT_LENGTH})`);

    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const maxTotalWidth = width - 32;
    const cardWidth = Math.min(CARD_WIDTH, (maxTotalWidth - (options.length - 1) * CARD_GAP) / options.length);
    const totalWidth = options.length * cardWidth + (options.length - 1) * CARD_GAP;
    const startX = width / 2 - totalWidth / 2 + cardWidth / 2;
    const centerY = height / 2;

    options.forEach((option, index) => {
      const x = startX + index * (cardWidth + CARD_GAP);
      const color = NODE_COLOR[option.type];

      const card = new Card(this.scene, x, centerY, cardWidth, CARD_HEIGHT, color);
      const hitZone = this.scene.add
        .rectangle(x, centerY, cardWidth, CARD_HEIGHT, 0x000000, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.pick(option.id));

      const label = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 32, NODE_LABEL[option.type], {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          fontStyle: 'bold',
          color: `#${color.toString(16).padStart(6, '0')}`,
          align: 'center',
          resolution: DPR,
        })
        .setOrigin(0.5);

      const hint = this.scene.add
        .text(x, centerY - CARD_HEIGHT / 2 + 68, NODE_HINT[option.type], {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: '#9099a8',
          align: 'center',
          wordWrap: { width: cardWidth - 16 },
          lineSpacing: 4,
          resolution: DPR,
        })
        .setOrigin(0.5, 0);

      this.add([card, hitZone, label, hint]);
      this.cardNodes.push(card, hitZone, label, hint);
    });

    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onChoose = null;
  }

  private pick(id: string): void {
    const callback = this.onChoose;
    this.hide();
    callback?.(id);
  }
}
