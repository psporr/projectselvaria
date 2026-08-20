import { GameObjects, Scene } from 'phaser';
import type { Unit } from '../game/types';

const CLASS_LETTER: Record<string, string> = {
  Swordsman: 'S',
  Archer: 'A',
  Lancer: 'L',
  Mage: 'M',
  Barbarian: 'B',
  Cleric: 'C',
  Dancer: 'D',
};

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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

  constructor(scene: Scene, x: number, y: number, tileSize: number, unit: Unit) {
    super(scene, x, y);
    this.hpBarWidth = tileSize * 0.7;
    this.baseColor = TEAM_COLOR[unit.team];

    const radius = tileSize * 0.32;
    this.circle = scene.add.circle(0, 0, radius, this.baseColor).setStrokeStyle(2, 0x000000, 0.4);
    const label = scene.add
      .text(0, 0, CLASS_LETTER[unit.className] ?? '?', {
        fontFamily: 'monospace',
        fontSize: `${Math.round(tileSize * 0.28)}px`,
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const hpBarBg = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x000000, 0.6);
    this.hpBar = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x5cb85c);

    this.add([this.circle, label, hpBarBg, this.hpBar]);
    scene.add.existing(this);

    this.sync(unit);
  }

  /** Reconciles this sprite's look to the given unit's current state. Never mutates it. */
  sync(unit: Unit): void {
    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpBar.width = this.hpBarWidth * ratio;
    this.hpBar.fillColor = ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
    // A spent unit dims, same convention as the reachable-tile highlight.
    this.circle.setAlpha(unit.hasActed ? 0.55 : 1);
  }

  /** Brief color flash to draw the eye to a unit that was just hit. */
  flash(color: number): void {
    this.circle.setFillStyle(color);
    this.scene.time.delayedCall(160, () => this.circle.setFillStyle(this.baseColor));
  }
}
