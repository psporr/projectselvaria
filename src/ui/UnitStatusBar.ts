import { GameObjects, Scene } from 'phaser';

import { effectiveStats, ITEMS } from '../game/equipment';
import { SKILLS } from '../game/skills';
import type { ItemSlot, Unit } from '../game/types';
import { DPR, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { Card, COLORS, FONT_FAMILY } from './kit';

// Sits right below the board, at a fixed position — TacticalScene now
// computes its tile size per-chapter (see its BOARD_AREA_HEIGHT) precisely
// so any chapter's board bottom stays at or above 568, clearing this bar's
// top edge (664 - 90) regardless of how many rows the chapter has. Getting
// this wrong once already cost a dead-tap bug (the bar's hit zone silently
// ate clicks meant for the board's last row); if BAR_Y/BAR_HEIGHT ever
// change, TacticalScene's BOARD_AREA_HEIGHT must move with them.
//
// Sized to fill the space between the board and the dock now that the
// battle log moved into its own on-demand panel (UIScene's Menu → Battle
// Log) — this used to be a compact strip with a tap-to-expand detail
// overlay; that two-tier split existed only because there wasn't room to
// show everything at once. There is now, so it doesn't.
const BAR_Y = 664;
const BAR_HEIGHT = 180;
const BAR_WIDTH = LOGICAL_WIDTH - 32;
const BAR_TOP = BAR_Y - BAR_HEIGHT / 2;
const LEFT_MARGIN = 16 + 16;
const BADGE_X = 16 + 24;
const HEADER_Y = BAR_TOP + 22;
const BODY_TOP = BAR_TOP + 42;

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
 * Always-on status panel for whichever unit was last tapped (either team —
 * read-only for enemies). Purely a view: TacticalScene hands it a `Unit`
 * snapshot on tap; it never reads G/ctx itself (HANDOFF.md §5/§7 — same
 * rule `UnitSprite` follows).
 *
 * Depth 15 — below the other modals (ActionMenu/SystemMenu/etc, depth 20),
 * so an opened modal's own full-screen backdrop naturally covers the panel
 * without this needing to track every other panel's open/close calls.
 */
export class UnitStatusBar extends GameObjects.Container {
  private readonly hint: GameObjects.Text;
  private readonly badge: GameObjects.Arc;
  private readonly badgeLabel: GameObjects.Text;
  private readonly nameText: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly hpText: GameObjects.Text;
  private readonly hpBarBg: GameObjects.Rectangle;
  private readonly hpBarFill: GameObjects.Rectangle;
  private readonly hpBarWidth: number;

  private current: Unit | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    new Card(scene, LOGICAL_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    this.hint = scene.add
      .text(LOGICAL_WIDTH / 2, BAR_Y, 'Tap a unit to see its status', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.badge = scene.add.circle(BADGE_X, HEADER_Y, 16, TEAM_COLOR.player).setStrokeStyle(2, 0x000000, 0.4);
    this.badgeLabel = scene.add
      .text(BADGE_X, HEADER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '15px', color: '#ffffff', resolution: DPR })
      .setOrigin(0.5);

    this.nameText = scene.add
      .text(LEFT_MARGIN + 36, HEADER_Y, '', { fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0, 0.5);

    this.hpBarWidth = 70;
    const hpBarX = LOGICAL_WIDTH - 16 - 16 - this.hpBarWidth / 2;
    this.hpText = scene.add
      .text(hpBarX, HEADER_Y - 12, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0.5);
    this.hpBarBg = scene.add.rectangle(hpBarX, HEADER_Y + 6, this.hpBarWidth, 7, 0x000000, 0.6);
    this.hpBarFill = scene.add.rectangle(hpBarX - this.hpBarWidth / 2, HEADER_Y + 6, this.hpBarWidth, 7, 0x5cb85c).setOrigin(0, 0.5);

    this.bodyText = scene.add
      .text(LEFT_MARGIN, BODY_TOP, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        lineSpacing: 5,
        wordWrap: { width: BAR_WIDTH - LEFT_MARGIN * 2 + 16 },
        resolution: DPR,
      })
      .setOrigin(0, 0);

    this.add([this.hint, this.badge, this.badgeLabel, this.nameText, this.hpText, this.hpBarBg, this.hpBarFill, this.bodyText]);
    this.setDepth(15);
    scene.add.existing(this);
    this.setContentVisible(false);
  }

  /** Shows (or refreshes, if already showing this same unit) the panel for `unit`. */
  show(unit: Unit): void {
    this.current = unit;
    this.hint.setVisible(false);
    this.setContentVisible(true);

    const letter = CLASS_LETTER[unit.className] ?? '?';
    this.badge.setFillStyle(TEAM_COLOR[unit.team] ?? TEAM_COLOR.player);
    this.badgeLabel.setText(letter);
    this.nameText.setText(`${unit.name}  (${unit.className} Lv.${unit.level})${unit.hasActed ? '  — acted' : ''}`);

    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpText.setText(`HP ${unit.hp}/${unit.maxHp}`);
    this.hpBarFill.width = this.hpBarWidth * ratio;
    this.hpBarFill.setFillStyle(hpColor(ratio));

    const stats = effectiveStats(unit);
    const skill = SKILLS[unit.className];
    const cooldownLine = unit.skillCooldown > 0 ? `on cooldown — ${unit.skillCooldown} turn${unit.skillCooldown === 1 ? '' : 's'} left` : 'ready';

    const lines = [
      `Atk ${stats.atk}   Def ${stats.def}   Mov ${stats.move}   Rng ${stats.range}`,
      `Hit ${stats.hit}%   Crit ${stats.crit}%`,
      `Skill: ${skill.name} (${cooldownLine})`,
    ];

    if (unit.team === 'player') {
      for (const slot of SLOTS) {
        const item = unit.equipment[slot];
        lines.push(`${SLOT_LABEL[slot]}: ${item ? ITEMS[item.defId].name : 'Empty'}`);
      }
    }

    this.bodyText.setText(lines.join('\n'));
  }

  hide(): void {
    this.current = null;
    this.setContentVisible(false);
    this.hint.setVisible(true);
  }

  /** Id of the unit currently shown, if any — UIScene uses this to re-fetch and re-show fresh data on every state change (this component never reads G itself). */
  getCurrentUnitId(): string | null {
    return this.current?.id ?? null;
  }

  private setContentVisible(visible: boolean): void {
    this.badge.setVisible(visible);
    this.badgeLabel.setVisible(visible);
    this.nameText.setVisible(visible);
    this.hpText.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.bodyText.setVisible(visible);
  }
}
