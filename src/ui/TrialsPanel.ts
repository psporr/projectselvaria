import { GameObjects, Scene } from 'phaser';

import { TRIALS } from '../game/trials';
import type { TrialId } from '../game/types';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const CARD_WIDTH = 320;
const ROW_WIDTH = 280;
const ROW_HEIGHT = 34;
const DESC_HEIGHT = 32;
const ROW_GAP = 10;
const HEADER_HEIGHT = 76;
const FOOTER_HEIGHT = 92;

/**
 * Pre-run difficulty modifiers (src/game/trials.ts) — opened from the main
 * menu's "Trials" row, alongside (not replacing) the zero-friction "Start
 * Run" button, so opting into a harder run is always a visible, separate
 * choice rather than the only way to play (risk-reward-and-difficulty-
 * pacing.md: risk must be seen and chosen *before* commit). Each toggle is
 * independent; the running Embers multiplier updates live so the trade is
 * legible before "Begin Run" locks it in.
 */
export class TrialsPanel extends GameObjects.Container {
  private readonly multiplierText: GameObjects.Text;
  private readonly rows: { id: TrialId; button: Button }[] = [];
  private readonly activeTrialIds = new Set<TrialId>();
  private onBegin: ((activeTrials: TrialId[]) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const centerX = LOGICAL_WIDTH / 2;
    const centerY = LOGICAL_HEIGHT / 2;
    const rowBlockHeight = TRIALS.length * (ROW_HEIGHT + DESC_HEIGHT + ROW_GAP);
    const cardHeight = HEADER_HEIGHT + rowBlockHeight + FOOTER_HEIGHT;
    const cardTop = centerY - cardHeight / 2;

    // Unlike BlessingPicker/RunChoicePanel (where every option is a real,
    // irreversible commitment), this is a pre-run configuration screen —
    // backing out without starting a run is a legitimate choice, so the
    // backdrop cancels, matching ConfirmDialog/SystemMenu's convention.
    const backdrop = scene.add
      .rectangle(centerX, centerY, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.75)
      .setInteractive()
      .on('pointerup', () => this.hide());
    const card = new Card(scene, centerX, centerY, CARD_WIDTH, cardHeight);

    const heading = scene.add
      .text(centerX, cardTop + 24, 'Trials', {
        fontFamily: FONT_FAMILY,
        fontSize: '18px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);

    const subtext = scene.add
      .text(centerX, cardTop + 48, 'Opt in for a harder run — each Trial adds to your Embers payout.', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: COLORS.textDisabled,
        align: 'center',
        wordWrap: { width: CARD_WIDTH - 32 },
        resolution: DPR,
      })
      .setOrigin(0.5);

    this.add([backdrop, card, heading, subtext]);

    let y = cardTop + HEADER_HEIGHT;
    for (const trial of TRIALS) {
      const button = new Button(scene, centerX, y + ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, '', () => this.toggle(trial.id), '13px');
      const desc = scene.add
        .text(centerX, y + ROW_HEIGHT + DESC_HEIGHT / 2, trial.description, {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: COLORS.textDisabled,
          align: 'center',
          wordWrap: { width: ROW_WIDTH - 10 },
          resolution: DPR,
        })
        .setOrigin(0.5);
      this.rows.push({ id: trial.id, button });
      this.add([button, desc]);
      y += ROW_HEIGHT + DESC_HEIGHT + ROW_GAP;
    }

    this.multiplierText = scene.add
      .text(centerX, y + 14, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textPrimary,
        fontStyle: 'bold',
        resolution: DPR,
      })
      .setOrigin(0.5);
    this.add(this.multiplierText);

    const beginButton = new Button(scene, centerX, y + 56, ROW_WIDTH, 44, 'Begin Run', () => this.begin());
    beginButton.setAccent(COLORS.successFill, COLORS.successStroke);
    this.add(beginButton);

    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(onBegin: (activeTrials: TrialId[]) => void): void {
    this.onBegin = onBegin;
    this.activeTrialIds.clear();
    this.refresh();
    this.setVisible(true);
  }

  hide(): void {
    this.setVisible(false);
    this.onBegin = null;
  }

  private toggle(id: TrialId): void {
    if (this.activeTrialIds.has(id)) this.activeTrialIds.delete(id);
    else this.activeTrialIds.add(id);
    this.refresh();
  }

  private refresh(): void {
    for (const { id, button } of this.rows) {
      const trial = TRIALS.find((candidate) => candidate.id === id)!;
      const isActive = this.activeTrialIds.has(id);
      button.setLabel(`${isActive ? '✓ ' : ''}${trial.name} (+${Math.round(trial.embersBonus * 100)}%)`);
      button.setAccent(isActive ? COLORS.successFill : null, isActive ? COLORS.successStroke : null);
    }
    const bonus = [...this.activeTrialIds].reduce((sum, id) => sum + TRIALS.find((trial) => trial.id === id)!.embersBonus, 0);
    this.multiplierText.setText(`Embers multiplier: x${(1 + bonus).toFixed(2)}`);
  }

  private begin(): void {
    const callback = this.onBegin;
    const activeTrials = [...this.activeTrialIds];
    this.hide();
    callback?.(activeTrials);
  }
}
