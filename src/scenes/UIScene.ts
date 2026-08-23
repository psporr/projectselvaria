import { GameObjects, Scene } from 'phaser';

import type { Blessing } from '../game/blessings';
import type { GameOver } from '../game/game';
import { teamOf } from '../game/types';
import type { GameClient } from '../systems/gameClient';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { ActionMenu, type ActionMenuChoice, type ActionMenuOption } from '../ui/ActionMenu';
import { BlessingPicker } from '../ui/BlessingPicker';
import { EquipScreen } from '../ui/EquipScreen';
import { ForecastPanel } from '../ui/ForecastPanel';
import { PhaseBanner } from '../ui/PhaseBanner';
import { SystemMenu, type SystemMenuChoice, type SystemMenuOption } from '../ui/SystemMenu';
import type { TacticalScene } from './TacticalScene';

interface UISceneData {
  client: GameClient;
  tactical: TacticalScene;
}

/**
 * Persistent HUD + interactive panels, split off TacticalScene per
 * HANDOFF.md §7 so grid camera work never drags the UI around with it.
 * Owns no game truth: the phase/log text is a passive read of G/ctx via its
 * own subscription (mirroring TacticalScene's), and the interactive panels
 * (action menu, forecast, system menu) are shown/driven imperatively by
 * TacticalScene, which still owns the click-driven UI state machine.
 */
export class UIScene extends Scene {
  private client!: GameClient;
  private tactical!: TacticalScene;

  private phaseText!: GameObjects.Text;
  private logText!: GameObjects.Text;

  private endTurnButton!: GameObjects.Rectangle;
  private endTurnText!: GameObjects.Text;
  private dangerButton!: GameObjects.Rectangle;
  private dangerText!: GameObjects.Text;

  private gameOverBackdrop!: GameObjects.Rectangle;
  private gameOverCard!: GameObjects.Rectangle;
  private gameOverText!: GameObjects.Text;
  private gameOverRestartButton!: GameObjects.Rectangle;
  private gameOverRestartText!: GameObjects.Text;

  actionMenu!: ActionMenu;
  forecastPanel!: ForecastPanel;
  blessingPicker!: BlessingPicker;
  equipScreen!: EquipScreen;
  systemMenu!: SystemMenu;
  phaseBanner!: PhaseBanner;

  /**
   * Last ctx.turn seen, used to fire the phase banner exactly once per real
   * turn transition (diffed the same way TacticalScene diffs unit HP/
   * G.nextItemInstance). Reset in create(), not just at class-field-init
   * time — scene.restart() (restartBattle()) reuses this same UIScene
   * instance, and a stale value here would silently skip the banner on the
   * next game's first turn (see the restartBattle() fix's lesson in
   * TacticalScene.create()).
   */
  private lastTurnSeen: number | null = null;

  constructor() {
    super('UI');
  }

  create(data: UISceneData) {
    this.client = data.client;
    this.tactical = data.tactical;
    this.lastTurnSeen = null;
    applyDprZoom(this);

    // Top status banner
    this.phaseText = this.add.text(16, 20, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#e0e0e0',
      resolution: DPR,
    }).setOrigin(0, 0.5);

    // Top bar: Menu button
    this.add
      .rectangle(LOGICAL_WIDTH - 110, 20, 56, 26, 0x2d3348)
      .setStrokeStyle(1, 0x4a90d9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tactical.openSystemMenu());
    this.add
      .text(LOGICAL_WIDTH - 110, 20, 'Menu', { fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0', resolution: DPR })
      .setOrigin(0.5);

    // Top bar: Squad button
    this.add
      .rectangle(LOGICAL_WIDTH - 44, 20, 64, 26, 0x2d3348)
      .setStrokeStyle(1, 0x4a90d9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openEquipScreen());
    this.add
      .text(LOGICAL_WIDTH - 44, 20, 'Squad', { fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0', resolution: DPR })
      .setOrigin(0.5);

    // Sub-board HUD Action Bar (y = 588)
    this.endTurnButton = this.add
      .rectangle(120, 588, 192, 30, 0x2d3348)
      .setStrokeStyle(1, 0x4a90d9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tactical.endTurn());
    this.endTurnText = this.add
      .text(120, 588, 'End Turn', { fontFamily: 'monospace', fontSize: '13px', color: '#e0e0e0', resolution: DPR })
      .setOrigin(0.5);

    this.dangerButton = this.add
      .rectangle(352, 588, 208, 30, 0x2d3348)
      .setStrokeStyle(1, 0x4a90d9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.tactical.toggleThreatOverlay());
    this.dangerText = this.add
      .text(352, 588, 'Danger: OFF', { fontFamily: 'monospace', fontSize: '13px', color: '#e0e0e0', resolution: DPR })
      .setOrigin(0.5);

    // Battle log text
    this.logText = this.add.text(16, 616, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9099a8',
      wordWrap: { width: LOGICAL_WIDTH - 32 },
      resolution: DPR,
    });

    // Version label (bottom right)
    this.add
      .text(LOGICAL_WIDTH - 12, LOGICAL_HEIGHT - 12, `v${GAME_VERSION}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#5a6070',
        resolution: DPR,
      })
      .setOrigin(1, 1)
      .setDepth(10);

    // Game Over modal dialog with interactive restart
    this.gameOverBackdrop = this.add
      .rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.65)
      .setInteractive()
      .setDepth(30)
      .setVisible(false);

    this.gameOverCard = this.add
      .rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 320, 180, 0x1c2030, 0.97)
      .setStrokeStyle(2, 0x4a90d9)
      .setDepth(31)
      .setVisible(false);

    this.gameOverText = this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 30, '', {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(32)
      .setVisible(false);

    this.gameOverRestartButton = this.add
      .rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 36, 180, 40, 0x3a8f4a)
      .setStrokeStyle(1, 0x5ab56a)
      .setInteractive({ useHandCursor: true })
      .setDepth(32)
      .setVisible(false)
      .on('pointerdown', () => this.tactical.restartBattle());

    this.gameOverRestartText = this.add
      .text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 36, 'Restart Battle', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(33)
      .setVisible(false);

    this.forecastPanel = new ForecastPanel(this);
    this.actionMenu = new ActionMenu(this);
    this.blessingPicker = new BlessingPicker(this);
    this.equipScreen = new EquipScreen(this, this.client);
    this.systemMenu = new SystemMenu(this);
    this.phaseBanner = new PhaseBanner(this);

    this.refreshHud();
    const unsubscribe = this.client.subscribe(() => {
      this.refreshHud();
      this.equipScreen.refresh();
    });
    this.events.once('shutdown', unsubscribe);
  }

  openEquipScreen(): void {
    this.tactical.setInputSuspended(true);
    this.equipScreen.show(() => this.tactical.setInputSuspended(false));
  }

  /**
   * Public because TacticalScene calls this directly after toggling the
   * threat overlay — that flips scene-local UI state, not G/ctx, so the
   * client.subscribe() callback below (the only other thing that calls this)
   * never fires from it, and the Danger button would otherwise only catch up
   * whenever some unrelated G change happened to refresh the HUD next.
   */
  refreshHud(): void {
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;

    if (ctx.gameover) {
      const gameover = ctx.gameover as GameOver;
      const isVictory = gameover.winner === 'player';
      this.gameOverText.setText(isVictory ? 'VICTORY' : 'DEFEAT');
      this.gameOverText.setColor(isVictory ? '#7cd992' : '#ff6b6b');
      this.gameOverBackdrop.setVisible(true);
      this.gameOverCard.setVisible(true);
      this.gameOverText.setVisible(true);
      this.gameOverRestartButton.setVisible(true);
      this.gameOverRestartText.setVisible(true);
    } else {
      this.gameOverBackdrop.setVisible(false);
      this.gameOverCard.setVisible(false);
      this.gameOverText.setVisible(false);
      this.gameOverRestartButton.setVisible(false);
      this.gameOverRestartText.setVisible(false);
    }

    // ctx.turn increments exactly once per real turn.onBegin (game.ts) —
    // the same signal simulate.ts's own turn-change logging diffs against —
    // so this fires the banner once per actual phase change, not on every
    // G/ctx update within a turn (unit moves, attacks, etc. don't touch it).
    if (!ctx.gameover && ctx.turn !== this.lastTurnSeen) {
      this.lastTurnSeen = ctx.turn;
      this.phaseBanner.show(teamOf(ctx.currentPlayer));
    }

    const isPlayerTurn = !ctx.gameover && !G.awaitingBlessing && teamOf(ctx.currentPlayer) === 'player';
    const phase = ctx.gameover
      ? ''
      : G.awaitingBlessing
        ? 'Choosing blessing…'
        : isPlayerTurn
          ? 'Player Phase'
          : 'Enemy Phase';
    const nextPhaseText = `${G.chapterShortName}   Wave ${G.wave}   ${phase}`;
    if (this.phaseText.text !== nextPhaseText) {
      this.phaseText.setText(nextPhaseText);
    }
    const nextLogText = G.log.slice(0, 10).join('\n');
    if (this.logText.text !== nextLogText) {
      this.logText.setText(nextLogText);
    }

    // Update End Turn button state
    this.endTurnButton.setFillStyle(isPlayerTurn ? 0x2d3348 : 0x1f232b);
    this.endTurnText.setColor(isPlayerTurn ? '#e0e0e0' : '#5a6070');

    // Update Danger Zone button state
    const threatOn = this.tactical?.isThreatOverlayVisible?.() ?? false;
    this.dangerButton.setFillStyle(threatOn ? 0x5a2d33 : 0x2d3348);
    this.dangerButton.setStrokeStyle(1, threatOn ? 0xd9534f : 0x4a90d9);
    this.dangerText.setText(threatOn ? 'Danger: ON' : 'Danger: OFF');
    this.dangerText.setColor(threatOn ? '#ff9999' : '#e0e0e0');
  }

  showActionMenu(options: ActionMenuOption[], onChoose: (id: ActionMenuChoice) => void): void {
    this.actionMenu.show(options, onChoose);
  }

  showSystemMenu(options: SystemMenuOption[], onChoose: (id: SystemMenuChoice) => void): void {
    this.systemMenu.show(options, onChoose);
  }

  showForecast(lines: string[], onConfirm: () => void, onCancel: () => void): void {
    this.forecastPanel.show(lines, onConfirm, onCancel);
  }

  showBlessingPicker(blessings: Blessing[], onPick: (id: string) => void): void {
    this.blessingPicker.show(blessings, onPick);
  }

  /** A brief toast for a fresh drop — TacticalScene diffs G.nextItemInstance client-side to call this, rather than a synced "pending drop" G field (HANDOFF.md §9). */
  showLootToast(text: string): void {
    const toast = this.add
      .text(LOGICAL_WIDTH / 2, 120, text, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f0ad4e',
        backgroundColor: '#1c2030',
        padding: { x: 10, y: 6 },
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(15);
    this.tweens.add({
      targets: toast,
      y: toast.y - 20,
      alpha: 0,
      delay: 900,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }
}

