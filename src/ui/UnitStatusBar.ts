import { GameObjects, Scene } from 'phaser';

import { effectiveStats, ITEMS } from '../game/equipment';
import { SKILLS } from '../game/skills';
import type { ItemSlot, Unit } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { Button, Card, COLORS } from './kit';

// Sits right below the board, at a fixed position — TacticalScene now
// computes its tile size per-chapter (see its BOARD_AREA_HEIGHT) precisely
// so any chapter's board bottom stays at or above 568, clearing this bar's
// top edge (600 - 28) regardless of how many rows the chapter has. Getting
// this wrong once already cost a dead-tap bug (the bar's hit zone silently
// ate clicks meant for the board's last row); if BAR_Y ever needs to move,
// TacticalScene's BOARD_AREA_HEIGHT must move with it.
const BAR_Y = 600;
const BAR_HEIGHT = 56;
const BAR_WIDTH = LOGICAL_WIDTH - 32;
const BADGE_X = 16 + 24;
const CONTENT_X = 16 + 52;

const DETAIL_WIDTH = Math.min(360, LOGICAL_WIDTH - 32);
const DETAIL_TOP_PADDING = 20;
const DETAIL_CLOSE_GAP = 56;
const DETAIL_MAX_HEIGHT = LOGICAL_HEIGHT - 64;

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };
const SLOT_LABEL: Record<ItemSlot, string> = { weapon: 'Weapon', armor: 'Armor', accessory: 'Accessory' };
const SLOTS: ItemSlot[] = ['weapon', 'armor', 'accessory'];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hpColor(ratio: number): number {
  return ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
}

/**
 * Compact always-on status strip for whichever unit was last tapped (either
 * team — read-only for enemies), plus a tap-to-expand detail overlay. Purely
 * a view: TacticalScene hands it a `Unit` snapshot on tap; it never reads
 * G/ctx itself (HANDOFF.md §5/§7 — same rule `UnitSprite` follows).
 *
 * Depth 15 — below the other modals (ActionMenu/SystemMenu/etc, depth 20),
 * so an opened modal's own full-screen backdrop naturally covers the strip
 * without this needing to track every other panel's open/close calls.
 */
export class UnitStatusBar extends GameObjects.Container {
  private readonly hint: GameObjects.Text;
  private readonly badge: GameObjects.Arc;
  private readonly badgeLabel: GameObjects.Text;
  private readonly nameText: GameObjects.Text;
  private readonly statsText: GameObjects.Text;
  private readonly hpBarBg: GameObjects.Rectangle;
  private readonly hpBarFill: GameObjects.Rectangle;
  private readonly hpBarWidth: number;
  private readonly hitZone: GameObjects.Rectangle;

  private readonly detailBackdrop: GameObjects.Rectangle;
  private readonly detailCard: Card;
  private readonly detailText: GameObjects.Text;
  private readonly detailClose: Button;

  private current: Unit | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    new Card(scene, LOGICAL_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    this.hint = scene.add
      .text(LOGICAL_WIDTH / 2, BAR_Y, 'Tap a unit to see its status', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.badge = scene.add.circle(BADGE_X, BAR_Y, 16, TEAM_COLOR.player).setStrokeStyle(2, 0x000000, 0.4);
    this.badgeLabel = scene.add
      .text(BADGE_X, BAR_Y, '', { fontFamily: 'monospace', fontSize: '15px', color: '#ffffff', resolution: DPR })
      .setOrigin(0.5);

    this.nameText = scene.add
      .text(CONTENT_X, BAR_Y - 14, '', { fontFamily: 'monospace', fontSize: '13px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0, 0.5);
    this.statsText = scene.add
      .text(CONTENT_X, BAR_Y + 8, '', { fontFamily: 'monospace', fontSize: '11px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0, 0.5);

    this.hpBarWidth = 60;
    const hpBarX = LOGICAL_WIDTH - 16 - 16 - this.hpBarWidth / 2;
    this.hpBarBg = scene.add.rectangle(hpBarX, BAR_Y - 14, this.hpBarWidth, 6, 0x000000, 0.6);
    this.hpBarFill = scene.add.rectangle(hpBarX - this.hpBarWidth / 2, BAR_Y - 14, this.hpBarWidth, 6, 0x5cb85c).setOrigin(0, 0.5);

    this.hitZone = scene.add
      .rectangle(LOGICAL_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.current && this.showDetail());

    // --- detail overlay ---
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    this.detailBackdrop = scene.add.rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.6).setInteractive();
    this.detailBackdrop.on('pointerdown', () => this.hideDetail());
    this.detailCard = new Card(scene, centerX, centerY, DETAIL_WIDTH, 200);
    this.detailText = scene.add
      .text(centerX - DETAIL_WIDTH / 2 + 20, centerY, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: COLORS.textPrimary,
        lineSpacing: 8,
        wordWrap: { width: DETAIL_WIDTH - 40 },
        resolution: DPR,
      })
      .setOrigin(0, 0);
    this.detailClose = new Button(scene, centerX, centerY, 100, 32, 'Close', () => this.hideDetail());

    this.add([
      this.hint,
      this.badge,
      this.badgeLabel,
      this.nameText,
      this.statsText,
      this.hpBarBg,
      this.hpBarFill,
      this.hitZone,
      this.detailBackdrop,
      this.detailCard,
      this.detailText,
      this.detailClose,
    ]);
    this.setDepth(15);
    scene.add.existing(this);
    this.setContentVisible(false);
    this.hideDetail();
  }

  /** Shows (or refreshes, if already showing this same unit) the compact strip for `unit`. */
  show(unit: Unit): void {
    this.current = unit;
    this.hint.setVisible(false);
    this.setContentVisible(true);

    const letter = CLASS_LETTER[unit.className] ?? '?';
    this.badge.setFillStyle(TEAM_COLOR[unit.team] ?? TEAM_COLOR.player);
    this.badgeLabel.setText(letter);
    this.nameText.setText(`${unit.name}  (${unit.className} Lv.${unit.level})${unit.hasActed ? '  — acted' : ''}`);

    const stats = effectiveStats(unit);
    this.statsText.setText(`Atk ${stats.atk}  Def ${stats.def}  Mov ${stats.move}  Rng ${stats.range}   HP ${unit.hp}/${unit.maxHp}`);

    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpBarFill.width = this.hpBarWidth * ratio;
    this.hpBarFill.setFillStyle(hpColor(ratio));

    // Keep an open detail overlay in sync if it's showing this same unit (e.g. HP changing after a counter).
    if (this.detailCard.visible) this.renderDetail(unit);
  }

  hide(): void {
    this.current = null;
    this.setContentVisible(false);
    this.hint.setVisible(true);
    this.hideDetail();
  }

  /** Id of the unit currently shown, if any — UIScene uses this to re-fetch and re-show fresh data on every state change (this component never reads G itself). */
  getCurrentUnitId(): string | null {
    return this.current?.id ?? null;
  }

  private setContentVisible(visible: boolean): void {
    this.badge.setVisible(visible);
    this.badgeLabel.setVisible(visible);
    this.nameText.setVisible(visible);
    this.statsText.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
  }

  private showDetail(): void {
    if (!this.current) return;
    this.renderDetail(this.current);
    this.detailBackdrop.setVisible(true);
    this.detailCard.setVisible(true);
    this.detailText.setVisible(true);
    this.detailClose.setVisible(true);
  }

  private hideDetail(): void {
    this.detailBackdrop.setVisible(false);
    this.detailCard.setVisible(false);
    this.detailText.setVisible(false);
    this.detailClose.setVisible(false);
  }

  private renderDetail(unit: Unit): void {
    const stats = effectiveStats(unit);
    const skill = SKILLS[unit.className];
    const cooldownLine = unit.skillCooldown > 0 ? `On cooldown — ${unit.skillCooldown} turn${unit.skillCooldown === 1 ? '' : 's'} left` : 'Ready';

    const lines = [
      `${unit.name} — ${unit.className} Lv.${unit.level}`,
      unit.team === 'player' ? 'Ally' : 'Enemy',
      '',
      `HP    ${unit.hp}/${unit.maxHp}`,
      `Atk ${stats.atk}   Def ${stats.def}`,
      `Mov ${stats.move}   Rng ${stats.range}`,
      `Hit ${stats.hit}%   Crit ${stats.crit}%`,
      '',
      `Skill: ${skill.name}`,
      skill.description,
      cooldownLine,
    ];

    if (unit.team === 'player') {
      lines.push('', 'Equipment:');
      for (const slot of SLOTS) {
        const item = unit.equipment[slot];
        lines.push(`  ${SLOT_LABEL[slot]}: ${item ? ITEMS[item.defId].name : 'Empty'}`);
      }
    }

    this.detailText.setText(lines.join('\n'));

    // Resize the card to the actual rendered text height rather than a
    // fixed guess — skill description length (and whether the equipment
    // section applies) varies per unit, and a fixed height already
    // overflowed once (text spilling past the card into the compact bar
    // below it). Card/text/close stay vertically centered as a group by
    // recomputing each from the new top edge.
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const cardHeight = Math.min(DETAIL_MAX_HEIGHT, DETAIL_TOP_PADDING * 2 + this.detailText.height + DETAIL_CLOSE_GAP);
    this.detailCard.resize(DETAIL_WIDTH, cardHeight);
    const top = centerY - cardHeight / 2;
    this.detailText.setPosition(centerX - DETAIL_WIDTH / 2 + 20, top + DETAIL_TOP_PADDING);
    this.detailClose.setPosition(centerX, top + cardHeight - DETAIL_CLOSE_GAP / 2);
  }
}
