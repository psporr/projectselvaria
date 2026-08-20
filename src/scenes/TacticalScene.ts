import { GameObjects, Scene } from 'phaser';

import type { GameOver } from '../game/game';
import { BLESSINGS } from '../game/blessings';
import { decideAction } from '../game/ai';
import { computeReachable, targetsFrom, tileKey } from '../game/grid';
import { TERRAIN, teamOf, type Unit } from '../game/types';
import { UnitSprite } from '../entities/UnitSprite';
import { createGameClient, type GameClient } from '../systems/gameClient';

// Sized against main.ts's 480x854 portrait design resolution (HANDOFF.md
// §10) — the ScaleManager (Scale.FIT) handles fitting that to the real
// viewport, this only has to lay out inside the fixed base canvas. The board
// is 7 tiles wide, so 64px tiles with 16px side margins fill it exactly
// (7*64 + 2*16 = 480); the log panel stacks below the board rather than
// beside it, since portrait width has no room for a side panel.
const TILE_SIZE = 64;
const BOARD_ORIGIN_X = 16;
const BOARD_ORIGIN_Y = 56;
const LOG_ORIGIN_Y = BOARD_ORIGIN_Y + 8 * TILE_SIZE + 16;

const TERRAIN_COLOR: Record<string, number> = {
  plain: 0x3a3f4b,
  forest: 0x2d5a3d,
  wall: 0x4a4a4a,
  water: 0x2a5d8a,
};

const MOVE_HIGHLIGHT = 0x4a90d9;
const TARGET_HIGHLIGHT = 0xd9534f;
const ENEMY_STEP_DELAY_MS = 450;
const BLESSING_DELAY_MS = 700;

/**
 * UI interaction mode — the second, separate state machine (HANDOFF.md §7).
 * boardgame.io owns whose turn it is; this only owns what a click does next.
 * It never decides turn order, and every branch derives its legality from a
 * fresh read of G/ctx rather than trusting its own memory of "am I allowed
 * to click this" — so a state change from the AI mid-selection (it can't
 * happen today since only one side acts at a time, but the check is cheap
 * and keeps this scene honest about G being the only truth).
 */
type UiMode = 'idle' | 'unit-selected' | 'awaiting-target';

/**
 * The grid, unit sprites, movement/attack input, and the enemy auto-play
 * loop. Renders entirely from the boardgame.io client's G/ctx and dispatches
 * moves back — it never owns authoritative state (HANDOFF.md §6/§7).
 *
 * On-grid combat presentation only (HANDOFF.md §7 phase 1): floating damage
 * numbers and a hit flash, no CombatOverlayScene yet. Blessing picks and the
 * action menu (skills, equip) aren't built either — a wave clear auto-picks
 * the first offered blessing so the roguelike loop keeps running, and every
 * unit only ever does a plain move + attack. Both are the next layer on top
 * of these basics, not a rules gap — the moves already exist in src/game/.
 */
export class TacticalScene extends Scene {
  private client!: GameClient;
  private readonly unitSprites = new Map<string, UnitSprite>();
  private readonly highlightRects: GameObjects.Rectangle[] = [];
  private lastUnits: Record<string, Unit> = {};

  private mode: UiMode = 'idle';
  private selectedUnitId: string | null = null;

  private phaseText!: GameObjects.Text;
  private logText!: GameObjects.Text;
  private gameOverText!: GameObjects.Text;

  constructor() {
    super('Tactical');
  }

  create() {
    this.client = createGameClient();
    this.cameras.main.setBackgroundColor('#111318');

    this.phaseText = this.add.text(BOARD_ORIGIN_X, 16, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e0e0e0',
    });

    this.logText = this.add.text(BOARD_ORIGIN_X, LOG_ORIGIN_Y, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#9099a8',
      wordWrap: { width: 7 * TILE_SIZE },
    });

    this.gameOverText = this.add
      .text(this.scale.width / 2, this.scale.height / 2, '', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.drawBoard();
    this.syncUnits();
    this.refreshHud();

    const unsubscribe = this.client.subscribe(() => this.onStateChange());
    this.events.once('shutdown', unsubscribe);

    this.scheduleAutoAdvance();
  }

  private tileCenter(x: number, y: number): { px: number; py: number } {
    return { px: BOARD_ORIGIN_X + x * TILE_SIZE + TILE_SIZE / 2, py: BOARD_ORIGIN_Y + y * TILE_SIZE + TILE_SIZE / 2 };
  }

  private drawBoard(): void {
    const { G } = this.client.getState()!;
    for (let y = 0; y < G.height; y++) {
      for (let x = 0; x < G.width; x++) {
        const terrain = TERRAIN[G.tiles[y][x]];
        const { px, py } = this.tileCenter(x, y);
        const rect = this.add.rectangle(px, py, TILE_SIZE - 2, TILE_SIZE - 2, TERRAIN_COLOR[terrain.type]).setDepth(0);
        rect.setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => this.onTileClicked(x, y));
      }
    }
  }

  // --- state → view ---------------------------------------------------

  private onStateChange(): void {
    this.syncUnits();
    this.refreshHud();
    this.scheduleAutoAdvance();
  }

  /** Reconciles every unit sprite to G.units, diffing against the last known snapshot for hit feedback. */
  private syncUnits(): void {
    const { G } = this.client.getState()!;
    const seen = new Set<string>();

    for (const unit of Object.values(G.units)) {
      seen.add(unit.id);
      const previous = this.lastUnits[unit.id];
      const { px, py } = this.tileCenter(unit.x, unit.y);

      let sprite = this.unitSprites.get(unit.id);
      if (!sprite) {
        sprite = new UnitSprite(this, px, py, TILE_SIZE, unit);
        sprite.setDepth(2);
        this.unitSprites.set(unit.id, sprite);
      } else {
        if (previous && (previous.x !== unit.x || previous.y !== unit.y)) {
          this.tweens.add({ targets: sprite, x: px, y: py, duration: 180, ease: 'Quad.easeOut' });
        } else {
          sprite.setPosition(px, py);
        }
        sprite.sync(unit);

        if (previous && unit.hp < previous.hp) {
          this.spawnFloatingText(px, py, `-${previous.hp - unit.hp}`, '#ff6b6b');
          sprite.flash(0xffffff);
        } else if (previous && unit.hp > previous.hp) {
          this.spawnFloatingText(px, py, `+${unit.hp - previous.hp}`, '#7cd992');
        }
      }
    }

    for (const [id, sprite] of this.unitSprites) {
      if (seen.has(id)) continue;
      this.unitSprites.delete(id);
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: 0.4,
        duration: 300,
        onComplete: () => sprite.destroy(),
      });
    }

    this.lastUnits = Object.fromEntries(Object.values(G.units).map((u) => [u.id, { ...u }]));
  }

  private spawnFloatingText(x: number, y: number, text: string, colorHex: string): void {
    const floating = this.add
      .text(x, y - TILE_SIZE * 0.35, text, { fontFamily: 'monospace', fontSize: '15px', color: colorHex, fontStyle: 'bold' })
      .setOrigin(0.5)
      .setDepth(3);
    this.tweens.add({
      targets: floating,
      y: floating.y - 24,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => floating.destroy(),
    });
  }

  private refreshHud(): void {
    const { G, ctx } = this.client.getState()!;

    if (ctx.gameover) {
      const gameover = ctx.gameover as GameOver;
      this.gameOverText.setText(gameover.winner === 'player' ? 'VICTORY' : 'DEFEAT').setVisible(true);
    }

    const phase = ctx.gameover
      ? ''
      : G.awaitingBlessing
        ? 'Choosing blessing…'
        : teamOf(ctx.currentPlayer) === 'player'
          ? 'Player Phase'
          : 'Enemy Phase';
    this.phaseText.setText(`${G.chapterShortName}   Wave ${G.wave}   ${phase}`);
    this.logText.setText(G.log.slice(0, 12).join('\n'));
  }

  // --- highlights -------------------------------------------------------

  private clearHighlights(): void {
    for (const rect of this.highlightRects.splice(0)) rect.destroy();
  }

  private highlightTiles(coords: Iterable<{ x: number; y: number }>, color: number): void {
    for (const { x, y } of coords) {
      const { px, py } = this.tileCenter(x, y);
      const rect = this.add.rectangle(px, py, TILE_SIZE - 6, TILE_SIZE - 6, color, 0.38).setDepth(1);
      this.highlightRects.push(rect);
    }
  }

  // --- player input -------------------------------------------------------

  private onTileClicked(x: number, y: number): void {
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;
    // Every gate here reads live state rather than a cached "can I click"
    // flag — G/ctx is the only truth (HANDOFF.md §6).
    if (ctx.gameover || G.awaitingBlessing || teamOf(ctx.currentPlayer) !== 'player') return;

    const unitAtTile = Object.values(G.units).find((u) => u.x === x && u.y === y);

    if (this.mode === 'idle') {
      if (unitAtTile && unitAtTile.team === 'player' && !unitAtTile.hasActed) this.selectUnit(unitAtTile.id);
      return;
    }

    if (this.mode === 'unit-selected') {
      const unit = G.units[this.selectedUnitId!];
      if (!unit) {
        this.finishSelection();
        return;
      }

      if (computeReachable(G, unit).has(tileKey(x, y))) {
        this.client.moves.moveUnit(unit.id, x, y);
        this.afterMove(unit.id);
        return;
      }

      if (unitAtTile && unitAtTile.team === 'player' && !unitAtTile.hasActed) {
        this.selectUnit(unitAtTile.id);
        return;
      }

      this.finishSelection();
      return;
    }

    if (this.mode === 'awaiting-target') {
      const unitId = this.selectedUnitId!;
      const attacker = G.units[unitId];
      const targetInRange =
        attacker && unitAtTile && unitAtTile.team === 'enemy'
          ? targetsFrom(G, attacker, attacker.x, attacker.y).some((t) => t.id === unitAtTile.id)
          : false;

      if (attacker && targetInRange) {
        this.client.moves.attackUnit(unitId, unitAtTile!.id);
      } else if (attacker) {
        // Anything else — including clicking the unit's own tile — ends its
        // action. There's no action menu yet (HANDOFF.md §7 phase 1), so a
        // moved unit with nothing worth attacking just waits.
        this.client.moves.waitUnit(unitId);
      }
      this.finishSelection();
      return;
    }
  }

  private selectUnit(unitId: string): void {
    this.mode = 'unit-selected';
    this.selectedUnitId = unitId;
    this.clearHighlights();
    const { G } = this.client.getState()!;
    this.highlightTiles(computeReachable(G, G.units[unitId]).values(), MOVE_HIGHLIGHT);
  }

  private afterMove(unitId: string): void {
    this.clearHighlights();
    const { G } = this.client.getState()!;
    const unit = G.units[unitId];
    if (!unit) {
      this.finishSelection();
      return;
    }

    const targets = targetsFrom(G, unit, unit.x, unit.y);
    if (targets.length === 0) {
      this.client.moves.waitUnit(unitId);
      this.finishSelection();
      return;
    }

    this.mode = 'awaiting-target';
    this.highlightTiles(
      targets.map((t) => ({ x: t.x, y: t.y })),
      TARGET_HIGHLIGHT,
    );
  }

  private finishSelection(): void {
    this.mode = 'idle';
    this.selectedUnitId = null;
    this.clearHighlights();
  }

  // --- CPU / blessing auto-play -------------------------------------------------------

  /**
   * Steps exactly one enemy action or one blessing pick per call, then
   * relies on the resulting state change (via subscribe) to call this again
   * — the same "one action at a time, animate between" pattern HANDOFF.md §3
   * asks the AI to support. There's no blessing-picker UI yet, so a wave
   * clear auto-selects the first offered blessing after a beat.
   */
  private scheduleAutoAdvance(): void {
    const state = this.client.getState();
    if (!state || state.ctx.gameover) return;
    const { G, ctx } = state;

    if (G.awaitingBlessing) {
      this.time.delayedCall(BLESSING_DELAY_MS, () => {
        const fresh = this.client.getState();
        if (!fresh || !fresh.G.awaitingBlessing) return;
        const offeredId = fresh.G.offeredBlessingIds[0];
        const blessing = BLESSINGS.find((b) => b.id === offeredId) ?? BLESSINGS[0];
        this.client.moves.chooseBlessing(blessing.id);
      });
      return;
    }

    if (teamOf(ctx.currentPlayer) === 'enemy') {
      this.time.delayedCall(ENEMY_STEP_DELAY_MS, () => {
        const fresh = this.client.getState();
        if (!fresh || fresh.ctx.gameover || teamOf(fresh.ctx.currentPlayer) !== 'enemy') return;

        const action = decideAction(fresh.G, 'enemy');
        if (!action) {
          this.client.events.endTurn?.();
          return;
        }
        if (action.type === 'move') this.client.moves.moveUnit(action.unitId, action.x, action.y);
        else if (action.type === 'attack') this.client.moves.attackUnit(action.attackerId, action.targetId);
        else this.client.moves.waitUnit(action.unitId);
      });
    }
  }
}
