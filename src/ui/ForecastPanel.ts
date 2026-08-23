import { GameObjects, Scene } from 'phaser';

import type { CombatForecast } from '../game/combat';
import { terrainAt } from '../game/grid';
import type { GameState, Unit } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS } from './kit';

const CARD_WIDTH = 420;
const CARD_HEIGHT = 220;
const BUTTON_WIDTH = 130;
const BUTTON_HEIGHT = 36;

/**
 * Display lines for a basic-attack confirm card. Kept next to the panel that
 * renders them so formatting and layout stay in one place. Reads straight off
 * forecastCombat's pure output (combat.ts) — nothing here recomputes chances.
 */
export function formatAttackForecast(G: GameState, attacker: Unit, defender: Unit, forecast: CombatForecast): string[] {
  const terrain = terrainAt(G, defender.x, defender.y);
  const lines = [
    `${attacker.name} (${attacker.hp}/${attacker.maxHp}) vs ${defender.name} (${defender.hp}/${defender.maxHp})`,
    `Attack — Hit ${forecast.attack.hitChance}%  Dmg ${forecast.attack.normalDamage}  Crit ${forecast.attack.critChance}%`,
  ];
  if (terrain.defBonus > 0 || terrain.avoid > 0) {
    lines.push(`${defender.name}'s terrain (${terrain.name}): +${terrain.defBonus} Def, +${terrain.avoid} Avoid`);
  }
  lines.push(
    forecast.counter
      ? `Counter — Hit ${forecast.counter.hitChance}%  Dmg ${forecast.counter.normalDamage}  Crit ${forecast.counter.critChance}%`
      : 'Cannot Counter',
  );
  return lines;
}

/**
 * A generic confirm/cancel card — used both for the basic-attack forecast
 * (formatAttackForecast above) and skill previews (describeSkillEffect,
 * skills.ts), which just hand it a different set of lines. Blocks board
 * input by putting TacticalScene into a mode its own click handler doesn't
 * branch on (see TacticalScene's UiMode) rather than trying to intercept
 * clicks across scenes.
 */
export class ForecastPanel extends GameObjects.Container {
  private readonly bodyText: GameObjects.Text;
  private onConfirm: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;
    const centerX = width / 2;
    const centerY = height / 2;

    const backdrop = scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0.55).setInteractive();
    backdrop.on('pointerup', () => this.cancel());

    const cardWidth = Math.min(CARD_WIDTH, width - 32);
    const card = new Card(scene, centerX, centerY, cardWidth, CARD_HEIGHT);

    this.bodyText = scene.add
      .text(centerX, centerY - CARD_HEIGHT / 2 + 18, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: COLORS.textPrimary,
        align: 'left',
        wordWrap: { width: cardWidth - 32 },
        lineSpacing: 8,
        resolution: DPR,
      })
      .setOrigin(0.5, 0);

    const buttonY = centerY + CARD_HEIGHT / 2 - 26;
    const confirmButton = new Button(scene, centerX + 80, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, 'Confirm', () => this.confirm());
    confirmButton.setAccent(COLORS.successFill, COLORS.successStroke);
    const cancelButton = new Button(scene, centerX - 80, buttonY, BUTTON_WIDTH, BUTTON_HEIGHT, 'Cancel', () => this.cancel());
    cancelButton.setAccent(COLORS.cancelFill, COLORS.buttonStroke);

    this.add([backdrop, card, this.bodyText, confirmButton, cancelButton]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(lines: string[], onConfirm: () => void, onCancel: () => void): void {
    this.bodyText.setText(lines.join('\n\n'));
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
    this.onCancel = null;
  }

  private confirm(): void {
    const callback = this.onConfirm;
    this.hide();
    callback?.();
  }

  private cancel(): void {
    const callback = this.onCancel;
    this.hide();
    callback?.();
  }
}
