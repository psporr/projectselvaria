import { GameObjects, Scene } from 'phaser';

import { BLESSINGS } from '../game/blessings';
import type { GameState, SquadModifiers } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { RARITY_COLOR } from './BlessingPicker';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 340;
const CARD_HEIGHT = 480;
const MAX_ROWS = 10;

/** Friendly one-line descriptions for the SquadModifiers fields worth surfacing — skips the purely transient ones (dropChanceMultiplier, guaranteedLegendaryDraws, phoenixActive, guardianAngelCharges) since those describe the *next* draw/wave rather than a standing bonus. */
function describeModifiers(m: SquadModifiers): string[] {
  const lines: string[] = [];
  if (m.counterBonus > 0) lines.push(`Counterattacks deal +${m.counterBonus} damage`);
  if (m.cooldownReduction > 0) lines.push(`Skill cooldowns -${m.cooldownReduction} turn(s)`);
  if (m.healPerTurn > 0) lines.push(`+${m.healPerTurn} HP at the start of every player phase`);
  if (m.terrainDefMultiplier > 1) lines.push(`Terrain defence bonus x${m.terrainDefMultiplier}`);
  if (m.executionerBonus > 0) lines.push(`+${m.executionerBonus} damage vs. foes at or below half HP`);
  if (m.berserkerBonus > 0) lines.push(`+${m.berserkerBonus} damage while at or below half HP`);
  if (m.guardianAngelMax > 0) lines.push(`${m.guardianAngelMax} Guardian Angel charge(s) per fight`);
  if (m.meleeKillHeal > 0) lines.push(`Melee killing blows heal +${m.meleeKillHeal} HP`);
  if (m.counterAlwaysCrit) lines.push('Counterattacks are always critical hits');
  if (m.rangedAlwaysHit) lines.push('Ranged attacks always hit');
  return lines;
}

interface BlessingTally {
  name: string;
  rarity: 'common' | 'rare' | 'legendary';
  count: number;
}

function tallyBlessings(ids: string[]): BlessingTally[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const id of ids) {
    if (!counts.has(id)) order.push(id);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return order
    .map((id) => {
      const blessing = BLESSINGS.find((candidate) => candidate.id === id);
      if (!blessing) return null;
      return { name: blessing.name, rarity: blessing.rarity, count: counts.get(id) ?? 1 };
    })
    .filter((entry): entry is BlessingTally => entry !== null);
}

/**
 * Read-only review of the run so far (PathScene's "Blessings" button) —
 * Slay the Spire's Deck view, adapted: what permanent bonuses are actually
 * active right now (SquadModifiers, summarized into plain language) and
 * which blessings earned them (GameState.pickedBlessingIds, tallied by
 * name since a long Depths run can pick the same blessing many times).
 * Capped at MAX_ROWS distinct blessings with a "+N more" line rather than
 * scrolling — same accepted limitation EquipScreen's own roster list has
 * for an unusually long list, not attempted here either.
 */
export class BlessingLogPanel extends GameObjects.Container {
  private readonly bonusesHeading: GameObjects.Text;
  private readonly bonusesText: GameObjects.Text;
  private readonly listHeading: GameObjects.Text;
  private readonly rows: GameObjects.GameObject[] = [];

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const top = centerY - CARD_HEIGHT / 2;

    const backdrop = scene.add.rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.75).setInteractive();
    backdrop.on('pointerup', () => this.hide());
    const card = new Card(scene, centerX, centerY, CARD_WIDTH, CARD_HEIGHT);

    const heading = scene.add
      .text(centerX, top + 22, 'Blessings', {
        fontFamily: FONT_FAMILY,
        fontSize: '17px',
        color: COLORS.textPrimary,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.bonusesHeading = scene.add
      .text(centerX - CARD_WIDTH / 2 + 20, top + 50, 'Active Bonuses', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0, 0);

    this.bonusesText = scene.add
      .text(centerX - CARD_WIDTH / 2 + 20, top + 70, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: COLORS.textPrimary,
        wordWrap: { width: CARD_WIDTH - 40 },
        lineSpacing: 5,
        resolution: DPR,
      })
      .setOrigin(0, 0);

    this.listHeading = scene.add
      .text(centerX - CARD_WIDTH / 2 + 20, 0, 'Collected', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0, 0);

    const closeButton = new Button(scene, centerX, centerY + CARD_HEIGHT / 2 - 32, 140, 40, 'Close', () => this.hide());

    this.add([backdrop, card, heading, this.bonusesHeading, this.bonusesText, this.listHeading, closeButton]);
    this.setDepth(25);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(G: GameState): void {
    this.render(G);
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
  }

  private render(G: GameState): void {
    for (const row of this.rows.splice(0)) row.destroy();

    const bonusLines = describeModifiers(G.modifiers);
    this.bonusesText.setText(bonusLines.length > 0 ? bonusLines.join('\n') : 'None yet.');

    const centerX = LOGICAL_WIDTH / 2;
    const top = LOGICAL_HEIGHT / 2 - CARD_HEIGHT / 2;
    const listTop = top + 70 + this.bonusesText.height + 18;
    this.listHeading.setY(listTop);

    const tallies = tallyBlessings(G.pickedBlessingIds);
    const shown = tallies.slice(0, MAX_ROWS);
    const rowHeight = 20;
    let y = listTop + 22;

    if (tallies.length === 0) {
      const empty = this.scene.add
        .text(centerX - CARD_WIDTH / 2 + 20, y, 'None picked yet.', {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: COLORS.textDisabled,
          resolution: DPR,
        })
        .setOrigin(0, 0);
      this.add(empty);
      this.rows.push(empty);
      return;
    }

    for (const entry of shown) {
      const color = RARITY_COLOR[entry.rarity];
      const label = entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name;
      const row = this.scene.add
        .text(centerX - CARD_WIDTH / 2 + 20, y, label, {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: `#${color.toString(16).padStart(6, '0')}`,
          wordWrap: { width: CARD_WIDTH - 40 },
          resolution: DPR,
        })
        .setOrigin(0, 0);
      this.add(row);
      this.rows.push(row);
      y += rowHeight;
    }

    if (tallies.length > MAX_ROWS) {
      const more = this.scene.add
        .text(centerX - CARD_WIDTH / 2 + 20, y, `+${tallies.length - MAX_ROWS} more`, {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: COLORS.textDisabled,
          resolution: DPR,
        })
        .setOrigin(0, 0);
      this.add(more);
      this.rows.push(more);
    }
  }
}
