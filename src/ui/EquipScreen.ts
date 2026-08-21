import { GameObjects, Scene } from 'phaser';

import { effectiveStats, ITEMS } from '../game/equipment';
import { unitsOf } from '../game/grid';
import type { GameState, ItemSlot } from '../game/types';
import type { GameClient } from '../systems/gameClient';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';

type EquipView = { kind: 'roster' } | { kind: 'unit'; unitId: string } | { kind: 'slot'; unitId: string; slot: ItemSlot };

const CARD_WIDTH = 420;
const CARD_HEIGHT = 520;
const ROW_HEIGHT = 40;
const ROW_GAP = 6;
const ROW_START_Y = 56;

const SLOT_LABEL: Record<ItemSlot, string> = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
const SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory'];

/**
 * Squad roster → per-unit slots → per-slot inventory picker. Equip/unequip
 * dispatch immediately (equipItem/unequipItem aren't turn-gated — game.ts
 * only checks it's the player's phase), so this never needs a confirm step
 * the way an attack does; refresh() just re-renders off the latest G after
 * every dispatch.
 */
export class EquipScreen extends GameObjects.Container {
  private readonly client: GameClient;
  private readonly headerText: GameObjects.Text;
  private readonly backButton: GameObjects.Rectangle;
  private readonly backLabel: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];
  private view: EquipView = { kind: 'roster' };
  private isShown = false;
  private onClose: (() => void) | null = null;

  constructor(scene: Scene, client: GameClient) {
    super(scene, 0, 0);
    this.client = client;
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const centerX = width / 2;
    const centerY = height / 2;
    const cardWidth = Math.min(CARD_WIDTH, width - 32);
    const cardHeight = Math.min(CARD_HEIGHT, height - 32);

    const backdrop = scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.6).setInteractive();
    backdrop.on('pointerdown', () => this.hide());

    const card = scene.add.rectangle(centerX, centerY, cardWidth, cardHeight, 0x1c2030, 0.98).setStrokeStyle(2, 0x4a90d9);

    this.headerText = scene.add
      .text(centerX, centerY - cardHeight / 2 + 14, '', { fontFamily: 'monospace', fontSize: '15px', color: '#e0e0e0', resolution: DPR })
      .setOrigin(0.5, 0);

    this.backButton = scene.add
      .rectangle(centerX - cardWidth / 2 + 46, centerY - cardHeight / 2 + 16, 68, 24, 0x2d3348)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goBack());
    this.backLabel = scene.add
      .text(centerX - cardWidth / 2 + 46, centerY - cardHeight / 2 + 16, '< Back', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0e0e0',
        resolution: DPR,
      })
      .setOrigin(0.5);

    const closeButton = scene.add
      .rectangle(centerX + cardWidth / 2 - 38, centerY - cardHeight / 2 + 16, 60, 24, 0x8a3a3a)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide());
    const closeLabel = scene.add
      .text(centerX + cardWidth / 2 - 38, centerY - cardHeight / 2 + 16, 'Close', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#e0e0e0',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([backdrop, card, this.headerText, this.backButton, this.backLabel, closeButton, closeLabel]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(onClose?: () => void): void {
    this.isShown = true;
    this.onClose = onClose ?? null;
    this.view = { kind: 'roster' };
    this.render();
    this.setVisible(true);
  }

  hide(): void {
    this.isShown = false;
    this.setVisible(false);
    const callback = this.onClose;
    this.onClose = null;
    callback?.();
  }

  /** Re-renders the current view off the latest G — called on every client state change while shown, so an equip/unequip is reflected immediately. */
  refresh(): void {
    if (this.isShown) this.render();
  }

  private goBack(): void {
    if (this.view.kind === 'slot') this.view = { kind: 'unit', unitId: this.view.unitId };
    else if (this.view.kind === 'unit') this.view = { kind: 'roster' };
    this.render();
  }

  private render(): void {
    for (const row of this.rows.splice(0)) row.destroy();
    const state = this.client.getState();
    if (!state) return;
    const { G } = state;

    this.backButton.setVisible(this.view.kind !== 'roster');
    this.backLabel.setVisible(this.view.kind !== 'roster');

    if (this.view.kind === 'roster') {
      this.renderRoster(G);
    } else if (this.view.kind === 'unit') {
      const unit = G.units[this.view.unitId];
      if (!unit) {
        this.view = { kind: 'roster' };
        this.renderRoster(G);
        return;
      }
      this.renderUnit(G, unit.id);
    } else {
      const unit = G.units[this.view.unitId];
      if (!unit) {
        this.view = { kind: 'roster' };
        this.renderRoster(G);
        return;
      }
      this.renderSlot(G, unit.id, this.view.slot);
    }
  }

  private renderRoster(G: GameState): void {
    this.headerText.setText('Squad');
    unitsOf(G, 'player').forEach((unit, index) => {
      const equippedCount = Object.values(unit.equipment).filter(Boolean).length;
      this.addRow(index, `${unit.name} (${unit.className}) — ${equippedCount}/3 equipped`, () => {
        this.view = { kind: 'unit', unitId: unit.id };
        this.render();
      });
    });
  }

  private renderUnit(G: GameState, unitId: string): void {
    const unit = G.units[unitId];
    const stats = effectiveStats(unit);
    this.headerText.setText(`${unit.name} — Atk ${stats.atk}  Def ${stats.def}  Mov ${stats.move}  Rng ${stats.range}`);

    SLOTS.forEach((slot, index) => {
      const equipped = unit.equipment[slot];
      const label = equipped ? `${SLOT_LABEL[slot]}: ${ITEMS[equipped.defId].name}` : `${SLOT_LABEL[slot]}: Empty`;
      this.addRow(index, label, () => {
        this.view = { kind: 'slot', unitId, slot };
        this.render();
      });
    });
  }

  private renderSlot(G: GameState, unitId: string, slot: ItemSlot): void {
    const unit = G.units[unitId];
    this.headerText.setText(`${unit.name} — ${SLOT_LABEL[slot]}`);

    let index = 0;
    const equipped = unit.equipment[slot];
    if (equipped) {
      const def = ITEMS[equipped.defId];
      this.addRow(index++, `Unequip ${def.name} (${def.description})`, () => {
        this.client.moves.unequipItem(unitId, slot);
        this.render();
      });
    }

    const candidates = G.inventory.filter((item) => ITEMS[item.defId].slot === slot);
    for (const item of candidates) {
      const def = ITEMS[item.defId];
      this.addRow(index++, `Equip ${def.name} (${def.description})`, () => {
        this.client.moves.equipItem(unitId, item.instanceId);
        this.render();
      });
    }

    if (!equipped && candidates.length === 0) {
      this.addRow(index++, 'No items for this slot yet.', undefined);
    }
  }

  private addRow(index: number, label: string, onTap: (() => void) | undefined): void {
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const cardHeight = Math.min(CARD_HEIGHT, height - 32);
    const cardWidth = Math.min(CARD_WIDTH, width - 32);
    const centerX = width / 2;
    const top = height / 2 - cardHeight / 2 + ROW_START_Y;
    const y = top + index * (ROW_HEIGHT + ROW_GAP);

    const fill = onTap ? 0x2d3348 : 0x22262f;
    const button = this.scene.add.rectangle(centerX, y, cardWidth - 32, ROW_HEIGHT, fill).setStrokeStyle(1, 0x3a4258);
    const text = this.scene.add
      .text(centerX - cardWidth / 2 + 24, y, label, { fontFamily: 'monospace', fontSize: '12px', color: onTap ? '#e0e0e0' : '#5a6070', resolution: DPR })
      .setOrigin(0, 0.5);

    if (onTap) button.setInteractive({ useHandCursor: true }).on('pointerdown', onTap);

    this.add([button, text]);
    this.rows.push(button, text);
  }
}
