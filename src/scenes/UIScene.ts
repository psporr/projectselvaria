import { GameObjects, Scene } from 'phaser';

import type { Blessing } from '../game/blessings';
import type { GameOver } from '../game/game';
import { teamOf } from '../game/types';
import type { GameClient } from '../systems/gameClient';
import { ActionMenu, type ActionMenuChoice, type ActionMenuOption } from '../ui/ActionMenu';
import { BlessingPicker } from '../ui/BlessingPicker';
import { EquipScreen } from '../ui/EquipScreen';
import { ForecastPanel } from '../ui/ForecastPanel';
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
 * (action menu, forecast) are shown/driven imperatively by TacticalScene,
 * which still owns the click-driven UI state machine.
 */
export class UIScene extends Scene {
  private client!: GameClient;
  private tactical!: TacticalScene;

  private phaseText!: GameObjects.Text;
  private logText!: GameObjects.Text;
  private gameOverText!: GameObjects.Text;

  actionMenu!: ActionMenu;
  forecastPanel!: ForecastPanel;
  blessingPicker!: BlessingPicker;
  equipScreen!: EquipScreen;

  constructor() {
    super('UI');
  }

  create(data: UISceneData) {
    this.client = data.client;
    this.tactical = data.tactical;

    this.phaseText = this.add.text(16, 16, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#e0e0e0',
    });

    this.add
      .rectangle(this.scale.width - 48, 20, 72, 26, 0x2d3348)
      .setStrokeStyle(1, 0x4a90d9)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openEquipScreen());
    this.add.text(this.scale.width - 48, 20, 'Squad', { fontFamily: 'monospace', fontSize: '12px', color: '#e0e0e0' }).setOrigin(0.5);

    this.logText = this.add.text(16, 584, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#9099a8',
      wordWrap: { width: this.scale.width - 32 },
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

    this.forecastPanel = new ForecastPanel(this);
    this.actionMenu = new ActionMenu(this);
    this.blessingPicker = new BlessingPicker(this);
    this.equipScreen = new EquipScreen(this, this.client);

    this.refreshHud();
    const unsubscribe = this.client.subscribe(() => {
      this.refreshHud();
      this.equipScreen.refresh();
    });
    this.events.once('shutdown', unsubscribe);
  }

  private openEquipScreen(): void {
    this.tactical.setInputSuspended(true);
    this.equipScreen.show(() => this.tactical.setInputSuspended(false));
  }

  private refreshHud(): void {
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;

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

  showActionMenu(options: ActionMenuOption[], onChoose: (id: ActionMenuChoice) => void): void {
    this.actionMenu.show(options, onChoose);
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
      .text(this.scale.width / 2, 120, text, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#f0ad4e',
        backgroundColor: '#1c2030',
        padding: { x: 10, y: 6 },
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
