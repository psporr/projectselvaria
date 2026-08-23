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
import { UnitStatusBar } from '../ui/UnitStatusBar';
import { Button, COLORS } from '../ui/kit';
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

  private dangerButton!: Button;
  private endTurnButton!: Button;

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
  unitStatusBar!: UnitStatusBar;

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

    // Battle log text — between UnitStatusBar (~572-628,
    // src/ui/UnitStatusBar.ts, itself right below the actual board bottom:
    // 56 + 8 rows * 64 = 568, not the 504 a 7-row assumption would give,
    // see that file's own note) and the bottom dock below. Shrunk from 10
    // lines to 4 — HP/damage already show as floating text over units
    // (TacticalScene.spawnFloatingText), so the log was always secondary
    // detail, not the primary readout, and the dock needs the room.
    this.logText = this.add.text(16, 644, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9099a8',
      wordWrap: { width: LOGICAL_WIDTH - 32 },
      resolution: DPR,
    });

    // Bottom dock — thumb-reachable, mobile-app convention. Replaces the
    // old top-right Menu/Squad buttons and the old End-Turn/Danger-Zone
    // pair below the board with one persistent row. "Menu" now only holds
    // Restart (the one rare, destructive action) since everything else
    // moved here — see TacticalScene.openSystemMenu()'s trimmed options.
    const dockY = LOGICAL_HEIGHT - 62; // clears the bottom-right version watermark below it
    const dockButtonWidth = 104;
    const dockButtonHeight = 52;
    const dockGap = 8;
    const dockStartX = LOGICAL_WIDTH / 2 - (dockButtonWidth * 1.5 + dockGap * 1.5);
    const dockX = (index: number) => dockStartX + index * (dockButtonWidth + dockGap);

    new Button(this, dockX(0), dockY, dockButtonWidth, dockButtonHeight, 'Squad', () => this.openEquipScreen());
    this.dangerButton = new Button(this, dockX(1), dockY, dockButtonWidth, dockButtonHeight, 'Danger: OFF', () => this.tactical.toggleThreatOverlay());
    this.endTurnButton = new Button(this, dockX(2), dockY, dockButtonWidth, dockButtonHeight, 'End Turn', () => this.tactical.endTurn());
    new Button(this, dockX(3), dockY, dockButtonWidth, dockButtonHeight, 'Menu', () => this.tactical.openSystemMenu());

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
    this.unitStatusBar = new UnitStatusBar(this);

    this.refreshHud();
    const unsubscribe = this.client.subscribe(() => {
      this.refreshHud();
      this.equipScreen.refresh();
      this.refreshUnitStatusBar();
    });
    this.events.once('shutdown', unsubscribe);
  }

  /** Re-fetches and re-shows whatever unit UnitStatusBar is currently displaying, off the latest G — it never reads G itself (HANDOFF.md §5/§7). No-op if nothing's shown; hides it if the shown unit died. */
  private refreshUnitStatusBar(): void {
    const id = this.unitStatusBar.getCurrentUnitId();
    if (!id) return;
    const unit = this.client.getState()?.G.units[id];
    if (unit) this.unitStatusBar.show(unit);
    else this.unitStatusBar.hide();
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
      const team = teamOf(ctx.currentPlayer);
      // TacticalScene's scheduleAutoAdvance() deliberately does nothing for
      // a fresh enemy phase's opening action until this fires — see its
      // onEnemyPhaseBannerDone().
      this.phaseBanner.show(team, team === 'enemy' ? () => this.tactical.onEnemyPhaseBannerDone() : undefined);
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
    const nextLogText = G.log.slice(0, 4).join('\n');
    if (this.logText.text !== nextLogText) {
      this.logText.setText(nextLogText);
    }

    this.endTurnButton.setEnabled(isPlayerTurn);

    const threatOn = this.tactical?.isThreatOverlayVisible?.() ?? false;
    this.dangerButton.setLabel(threatOn ? 'Danger: ON' : 'Danger: OFF');
    this.dangerButton.setAccent(threatOn ? COLORS.dangerOnFill : null, threatOn ? COLORS.enemyAccent : null, threatOn ? COLORS.dangerOnText : null);
  }

  showActionMenu(options: ActionMenuOption[], onChoose: (id: ActionMenuChoice) => void, anchorX: number, anchorY: number): void {
    this.actionMenu.show(options, onChoose, anchorX, anchorY);
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

