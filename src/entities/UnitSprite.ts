import { GameObjects, Scene } from 'phaser';
import type { Unit } from '../game/types';
import { DPR } from '../systems/viewport';
import { CLASS_LETTER } from '../ui/classIcons';

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };
/** Neutral gray a spent unit's color blends toward — classic FE "grayed out, already acted" convention. */
const ACTED_GRAY = 0x6b7280;
const ACTED_BLEND = 0.55;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Blends `color` toward `target` by `amount` (0 = color, 1 = target). */
function blendToward(color: number, target: number, amount: number): number {
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;
  const r2 = (target >> 16) & 0xff;
  const g2 = (target >> 8) & 0xff;
  const b2 = target & 0xff;
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return (r << 16) | (g << 8) | b;
}

/**
 * A view of a Unit — owns no truth, just renders whatever the last sync()
 * gave it. TacticalScene is the only thing that reads game state; this only
 * ever gets told what to show (HANDOFF.md §5/§7).
 */
export class UnitSprite extends GameObjects.Container {
  private readonly circle: GameObjects.Arc;
  private readonly hpBar: GameObjects.Rectangle;
  private readonly hpBarWidth: number;
  private readonly baseColor: number;
  private readonly actedColor: number;
  /** Whatever sync() last set the circle's fill to — flash() reverts here instead of always baseColor, so a hit on an already-acted (dimmed) unit doesn't briefly un-dim it. */
  private currentFill: number;

  constructor(scene: Scene, x: number, y: number, tileSize: number, unit: Unit, dimmed: boolean) {
    super(scene, x, y);
    this.hpBarWidth = tileSize * 0.7;
    this.baseColor = TEAM_COLOR[unit.team];
    this.actedColor = blendToward(this.baseColor, ACTED_GRAY, ACTED_BLEND);
    this.currentFill = this.baseColor;

    const radius = tileSize * 0.32;
    this.circle = scene.add.circle(0, 0, radius, this.baseColor).setStrokeStyle(2, 0x000000, 0.4);
    const label = scene.add
      .text(0, 0, CLASS_LETTER[unit.className] ?? '?', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(tileSize * 0.28)}px`,
        color: '#ffffff',
        resolution: DPR,
      })
      .setOrigin(0.5);

    const hpBarBg = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x000000, 0.6);
    this.hpBar = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x5cb85c);

    this.add([this.circle, label, hpBarBg, this.hpBar]);
    scene.add.existing(this);

    this.sync(unit, dimmed);
  }

  /**
   * Reconciles this sprite's look to the given unit's current state. Never
   * mutates it. `dimmed` is the caller's call, not derived from
   * `unit.hasActed` alone — that flag only resets at the start of *that
   * unit's own* team's turn (game.ts's turn.onBegin), so an enemy unit
   * stays `hasActed: true` for the player's *entire* turn (it doesn't reset
   * until the enemy's own next turn begins). Dimming off the raw flag made
   * every enemy look "already acted" throughout the player's whole phase.
   * TacticalScene decides `dimmed` by also checking whose turn it is.
   */
  sync(unit: Unit, dimmed: boolean): void {
    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpBar.width = this.hpBarWidth * ratio;
    this.hpBar.fillColor = ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
    // A spent unit dims and desaturates toward gray — alpha alone read as
    // "translucent"; the color blend makes "already acted" unambiguous at a
    // glance, the standard Fire Emblem convention.
    this.currentFill = dimmed ? this.actedColor : this.baseColor;
    this.circle.setFillStyle(this.currentFill);
    this.circle.setAlpha(dimmed ? 0.6 : 1);
  }

  /** Brief color flash to draw the eye to a unit that was just hit. */
  flash(color: number): void {
    this.circle.setFillStyle(color);
    this.scene.time.delayedCall(160, () => this.circle.setFillStyle(this.currentFill));
  }
}
