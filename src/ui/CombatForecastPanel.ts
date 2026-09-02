import { GameObjects, Scene } from 'phaser';

import type { AttackChances, CombatForecast } from '../game/combat';
import { ITEMS } from '../game/equipment';
import { terrainAt } from '../game/grid';
import type { GameState, Unit } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { resolveUnitArtTexture } from './heroArt';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 420;
const CARD_HEIGHT = 400;
const CENTER_X = LOGICAL_WIDTH / 2;
const CENTER_Y = LOGICAL_HEIGHT / 2;
const TOP = CENTER_Y - CARD_HEIGHT / 2;

const COL_OFFSET = 108;
const LEFT_X = CENTER_X - COL_OFFSET;
const RIGHT_X = CENTER_X + COL_OFFSET;

const NAME_Y = TOP + 22;
const PORTRAIT_SIZE = 88;
const PORTRAIT_Y = TOP + 74;
const LABEL_Y = PORTRAIT_Y + PORTRAIT_SIZE / 2 + 16;
const HP_BAR_Y = LABEL_Y + 24;
const HP_BAR_WIDTH = 152;
const HP_BAR_HEIGHT = 18;

const DIVIDER_Y = HP_BAR_Y + 26;
const STAT_ROW_GAP = 22;
const STAT_START_Y = DIVIDER_Y + 24;
const TERRAIN_NOTE_Y = STAT_START_Y + STAT_ROW_GAP * 3 + 16;

const BUTTON_WIDTH = 130;
const BUTTON_HEIGHT = 36;
const BUTTON_Y = TOP + CARD_HEIGHT - 28;

const HP_BAR_STROKE = 0x0a0d14;

function hpColor(ratio: number): number {
  return ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
}

/** The equipped weapon's display name, or the unit's class when unarmed — every enemy falls into the latter (`Unit.equipment` is only ever populated for player units, types.ts), which reads fine here since a class name is exactly what a named weapon would otherwise convey ("what are they fighting with"). */
function weaponOrClassLabel(unit: Unit): string {
  const weaponId = unit.equipment.weapon?.defId;
  return weaponId ? ITEMS[weaponId].name : unit.className;
}

interface Side {
  readonly portraitGfx: GameObjects.Graphics;
  readonly portraitImage: GameObjects.Image;
  readonly portraitLetter: GameObjects.Text;
  readonly nameText: GameObjects.Text;
  readonly weaponText: GameObjects.Text;
  readonly hpBarBg: GameObjects.Rectangle;
  readonly hpBarFill: GameObjects.Rectangle;
  readonly hpText: GameObjects.Text;
  readonly dmgText: GameObjects.Text;
  readonly hitText: GameObjects.Text;
  readonly critText: GameObjects.Text;
  readonly noCounterText: GameObjects.Text;
}

function buildSide(scene: Scene, x: number): Side {
  const portraitGfx = scene.add.graphics();
  const portraitImage = scene.add.image(x, PORTRAIT_Y, '__WHITE').setVisible(false);
  const portraitLetter = scene.add
    .text(x, PORTRAIT_Y, '', { fontFamily: FONT_FAMILY, fontSize: '30px', fontStyle: 'bold', color: '#ffffff', resolution: DPR })
    .setOrigin(0.5);
  const nameText = scene.add
    .text(x, NAME_Y, '', { fontFamily: FONT_FAMILY, fontSize: '14px', fontStyle: 'bold', color: COLORS.textPrimary, resolution: DPR })
    .setOrigin(0.5);
  const weaponText = scene.add
    .text(x, LABEL_Y, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textDisabled, resolution: DPR })
    .setOrigin(0.5);

  const hpBarBg = scene.add.rectangle(x, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x000000, 0.55).setStrokeStyle(1, HP_BAR_STROKE, 0.9);
  const hpBarFill = scene.add.rectangle(x - HP_BAR_WIDTH / 2, HP_BAR_Y, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x5cb85c).setOrigin(0, 0.5);
  const hpText = scene.add
    .text(x, HP_BAR_Y, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
      resolution: DPR,
    })
    .setOrigin(0.5);

  const statStyle = { fontFamily: FONT_FAMILY, fontSize: '13px', color: COLORS.textPrimary, resolution: DPR };
  const dmgText = scene.add.text(x, STAT_START_Y, '', statStyle).setOrigin(0.5);
  const hitText = scene.add.text(x, STAT_START_Y + STAT_ROW_GAP, '', statStyle).setOrigin(0.5);
  const critText = scene.add.text(x, STAT_START_Y + STAT_ROW_GAP * 2, '', statStyle).setOrigin(0.5);
  const noCounterText = scene.add
    .text(x, STAT_START_Y + STAT_ROW_GAP, 'Cannot\nCounter', { ...statStyle, color: COLORS.textDisabled, align: 'center' })
    .setOrigin(0.5)
    .setVisible(false);

  return {
    portraitGfx,
    portraitImage,
    portraitLetter,
    nameText,
    weaponText,
    hpBarBg,
    hpBarFill,
    hpText,
    dmgText,
    hitText,
    critText,
    noCounterText,
  };
}

function allObjects(side: Side): GameObjects.GameObject[] {
  return [
    side.portraitGfx,
    side.portraitImage,
    side.portraitLetter,
    side.nameText,
    side.weaponText,
    side.hpBarBg,
    side.hpBarFill,
    side.hpText,
    side.dmgText,
    side.hitText,
    side.critText,
    side.noCounterText,
  ];
}

/**
 * Graphical attack-forecast screen (2026-08-28, per the repo owner — styled
 * after Fire Emblem Fates/Awakening's own combat prediction screen), the
 * `enterAttackConfirm` half of what `ForecastPanel`'s plain-text card used
 * to serve for both attacks and skills. Split off rather than reworked in
 * place: a basic attack always has this exact "two units, an exchange of
 * hit/dmg/crit, maybe a counter" shape (`CombatForecast`, combat.ts), but a
 * skill preview doesn't (`describeSkillEffect` covers heals/buffs/AoE too,
 * which don't map onto "attacker vs defender stat columns") — so
 * `ForecastPanel`'s original generic `string[]`-lines card stays exactly as
 * it was for `enterSkillConfirm` instead of being stretched to fit both.
 *
 * Each side's portrait resolves through `heroArt.ts`'s
 * `resolveUnitArtTexture` (on-board map sprite, then an animated hero's
 * first idle frame, then anonymous enemy-class art, then the class-letter
 * placeholder) — the same chain every other panel that shows a unit's
 * likeness uses, `UnitStatusBar` included. The
 * weapon-name row uses the unit's
 * equipped weapon (`ITEMS`, equipment.ts) when it has one, falling back to
 * its class name — every enemy takes that fallback today since
 * `Unit.equipment` is only ever populated for player units, which reads
 * fine here (a class name answers "what are they fighting with" just as
 * well as a named weapon would for an enemy that has neither).
 *
 * The two stat columns are each side's own `AttackChances` from the same
 * `forecastCombat()` output the old text card read — the attacker's
 * `forecast.attack` on the left, the defender's `forecast.counter` on the
 * right (or "Cannot Counter" in its place when `null`), never recomputed
 * here.
 */
export class CombatForecastPanel extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly vsText: GameObjects.Text;
  private readonly divider: GameObjects.Graphics;
  private readonly terrainNote: GameObjects.Text;
  private readonly attackerSide: Side;
  private readonly defenderSide: Side;
  private onConfirm: (() => void) | null = null;
  private onCancel: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    this.backdrop = scene.add.rectangle(CENTER_X, CENTER_Y, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.7).setInteractive();
    this.backdrop.on('pointerup', () => this.cancel());

    this.card = new Card(scene, CENTER_X, CENTER_Y, CARD_WIDTH, CARD_HEIGHT);

    this.vsText = scene.add
      .text(CENTER_X, PORTRAIT_Y, 'VS', { fontFamily: FONT_FAMILY, fontSize: '13px', fontStyle: 'bold', color: COLORS.textAccent, resolution: DPR })
      .setOrigin(0.5);

    this.divider = scene.add.graphics();
    this.divider.lineStyle(1, 0x3a4258, 1);
    this.divider.lineBetween(CENTER_X - CARD_WIDTH / 2 + 24, DIVIDER_Y, CENTER_X + CARD_WIDTH / 2 - 24, DIVIDER_Y);

    this.terrainNote = scene.add
      .text(CENTER_X, TERRAIN_NOTE_Y, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textAccent, align: 'center', resolution: DPR })
      .setOrigin(0.5);

    this.attackerSide = buildSide(scene, LEFT_X);
    this.defenderSide = buildSide(scene, RIGHT_X);

    const buttonX = 80;
    const confirmButton = new Button(scene, CENTER_X + buttonX, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, 'Confirm', () => this.confirm());
    confirmButton.setAccent(COLORS.successFill, COLORS.successStroke);
    const cancelButton = new Button(scene, CENTER_X - buttonX, BUTTON_Y, BUTTON_WIDTH, BUTTON_HEIGHT, 'Cancel', () => this.cancel());
    cancelButton.setAccent(COLORS.cancelFill, COLORS.buttonStroke);

    this.add([
      this.backdrop,
      this.card,
      this.vsText,
      this.divider,
      this.terrainNote,
      ...allObjects(this.attackerSide),
      ...allObjects(this.defenderSide),
      confirmButton,
      cancelButton,
    ]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(G: GameState, attacker: Unit, defender: Unit, forecast: CombatForecast, onConfirm: () => void, onCancel: () => void): void {
    this.renderSide(this.attackerSide, attacker, forecast.attack);
    this.renderSide(this.defenderSide, defender, forecast.counter);

    const terrain = terrainAt(G, defender.x, defender.y);
    if (terrain.defBonus > 0 || terrain.avoid > 0) {
      const parts: string[] = [];
      if (terrain.defBonus > 0) parts.push(`+${terrain.defBonus} Def`);
      if (terrain.avoid > 0) parts.push(`+${terrain.avoid} Avoid`);
      this.terrainNote.setText(`${defender.name}'s terrain (${terrain.name}): ${parts.join(', ')}`).setVisible(true);
    } else {
      this.terrainNote.setVisible(false);
    }

    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
    this.onCancel = null;
  }

  private renderSide(side: Side, unit: Unit, chances: AttackChances | null): void {
    const accent = unit.team === 'enemy' ? COLORS.enemyAccent : COLORS.playerAccent;

    const portraitX = side.portraitImage.x;
    side.portraitGfx.clear();
    side.portraitGfx.fillStyle(accent, 0.5);
    side.portraitGfx.fillRoundedRect(portraitX - PORTRAIT_SIZE / 2, PORTRAIT_Y - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 10);
    side.portraitGfx.lineStyle(2, accent, 1);
    side.portraitGfx.strokeRoundedRect(portraitX - PORTRAIT_SIZE / 2, PORTRAIT_Y - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 10);

    const art = resolveUnitArtTexture(this.scene, unit);
    if (art) {
      side.portraitImage.setTexture(art.key, art.frame);
      const maxSize = PORTRAIT_SIZE - 10;
      const fitScale = Math.min(maxSize / side.portraitImage.width, maxSize / side.portraitImage.height);
      side.portraitImage.setDisplaySize(side.portraitImage.width * fitScale, side.portraitImage.height * fitScale).setVisible(true);
      side.portraitLetter.setVisible(false);
    } else {
      side.portraitImage.setVisible(false);
      side.portraitLetter.setText(CLASS_LETTER[unit.className] ?? '?').setVisible(true);
    }

    side.nameText.setText(unit.name).setColor(COLORS.textPrimary);
    side.weaponText.setText(weaponOrClassLabel(unit));

    const ratio = Math.max(0, Math.min(1, unit.hp / unit.maxHp));
    side.hpText.setText(`${unit.hp} / ${unit.maxHp}`);
    side.hpBarFill.width = HP_BAR_WIDTH * ratio;
    if (unit.team === 'enemy') {
      side.hpBarFill.setFillStyle(0xd9534f).setStrokeStyle(1, 0x5a0d0d, 1);
    } else {
      side.hpBarFill.setFillStyle(hpColor(ratio)).setStrokeStyle(0);
    }

    if (chances) {
      side.dmgText.setText(`Dmg ${chances.normalDamage}`).setVisible(true);
      side.hitText.setText(`Hit ${chances.hitChance}%`).setVisible(true);
      side.critText.setText(`Crit ${chances.critChance}%`).setVisible(true);
      side.noCounterText.setVisible(false);
    } else {
      side.dmgText.setVisible(false);
      side.hitText.setVisible(false);
      side.critText.setVisible(false);
      side.noCounterText.setVisible(true);
    }
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
