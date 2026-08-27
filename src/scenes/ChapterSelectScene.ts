import { GameObjects, Scene } from 'phaser';

import { PLAYER_START_LEVEL } from '../game/classes';
import { CAMPAIGN_CHAPTERS } from '../game/maps';
import { loadCampaignSave } from '../game/save';
import { browserStorage } from '../systems/storage';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { Button, COLORS, FONT_FAMILY } from '../ui/kit';
import type { TacticalSceneData } from './TacticalScene';

const ROW_WIDTH = 320;
const ROW_HEIGHT = 44;
const ROW_GAP = 10;

/**
 * The main menu — mode selection between Roguelike and Campaign, and (new
 * 2026-08-27) the first live entry point into campaign mode at all.
 * `ProjectSelvariaCampaign`/`CAMPAIGN_CHAPTERS` existed as data since
 * campaign chapters were authored, but nothing constructed a
 * `CampaignCarryOver` or started a client against them until this scene —
 * see HANDOFF.md's Promotion section and README's "Recent changes" for the
 * fuller story. BootScene hands off here (a brief title beat) instead of
 * straight into TacticalScene.
 */
export class ChapterSelectScene extends Scene {
  constructor() {
    super('ChapterSelect');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    applyDprZoom(this);

    this.add
      .text(LOGICAL_WIDTH / 2, 64, 'Project Selvaria', {
        fontFamily: FONT_FAMILY,
        fontSize: '28px',
        color: COLORS.textPrimary,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const rows: GameObjects.GameObject[] = [];
    let y = 140;
    const addRow = (label: string, onTap: () => void, fontSize = '14px') => {
      rows.push(new Button(this, LOGICAL_WIDTH / 2, y, ROW_WIDTH, ROW_HEIGHT, label, onTap, fontSize));
      y += ROW_HEIGHT + ROW_GAP;
    };
    const addHeading = (text: string) => {
      rows.push(
        this.add
          .text(LOGICAL_WIDTH / 2, y, text, {
            fontFamily: FONT_FAMILY,
            fontSize: '13px',
            color: COLORS.textAccent,
            fontStyle: 'bold',
            resolution: DPR,
          })
          .setOrigin(0.5),
      );
      y += 26;
    };

    addHeading('Roguelike');
    addRow('Start Run', () => this.startRoguelike());

    y += 12;
    addHeading('Campaign');

    const save = loadCampaignSave(browserStorage);
    if (save) {
      const chapter = CAMPAIGN_CHAPTERS.find((candidate) => candidate.id === save.chapterId);
      addRow(`Continue — ${chapter?.shortName ?? save.chapterId}`, () => this.continueCampaign());
    }
    CAMPAIGN_CHAPTERS.forEach((chapter, index) => {
      addRow(`New: ${chapter.name}`, () => this.startCampaignChapter(chapter.id, index), '12px');
    });

    this.add
      .text(LOGICAL_WIDTH - 12, LOGICAL_HEIGHT - 12, `v${GAME_VERSION}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(1, 1);
  }

  private startRoguelike(): void {
    this.scene.start('Tactical');
  }

  /** Starting a listed chapter fresh (no carry-over) begins the squad at PLAYER_START_LEVEL + its position in CAMPAIGN_CHAPTERS, so jumping straight to a later chapter isn't under-levelled (HANDOFF.md §3). */
  private startCampaignChapter(chapterId: string, index: number): void {
    const data: TacticalSceneData = { mode: 'campaign', chapterId, baseLevel: PLAYER_START_LEVEL + index };
    this.scene.start('Tactical', data);
  }

  private continueCampaign(): void {
    const save = loadCampaignSave(browserStorage);
    if (!save) return;
    const data: TacticalSceneData = { mode: 'campaign', chapterId: save.chapterId, carryOver: save.carryOver };
    this.scene.start('Tactical', data);
  }
}
