import { Scene } from 'phaser';

import { PLAYER_START_LEVEL } from '../game/classes';
import { CAMPAIGN_CHAPTERS } from '../game/maps';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { Button, Card, COLORS, FONT_FAMILY } from '../ui/kit';
import { drawMenuBackground, preloadMenuBackground } from './menuBackground';
import type { TacticalSceneData } from './TacticalScene';

const ROW_WIDTH = 296;
const ROW_HEIGHT = 46;
const ROW_GAP = 10;
const CARD_WIDTH = ROW_WIDTH + 32;
const CARD_PADDING_TOP = 22;
const CARD_PADDING_BOTTOM = 20;
const HEADING_HEIGHT = 28;
const SECTION_GAP = 18;
const DIVIDER_COLOR = 0x3a4258;

/**
 * Chapter picker (2026-08-28) — every individual campaign chapter, each
 * starting it fresh with no carry-over, same as the per-chapter rows that
 * used to sit inline on the main menu before Campaign became New Game/Load
 * Game/Chapter Select there (`MainMenuScene`'s own doc comment). Split out
 * so the main menu's row count stays fixed regardless of how many chapters
 * the campaign grows to, and so "just let me jump to a specific chapter" is
 * its own dedicated screen instead of competing for space with New/Load on
 * the main menu.
 */
export class ChapterSelectScene extends Scene {
  constructor() {
    super('ChapterSelect');
  }

  preload(): void {
    preloadMenuBackground(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0f1a');
    applyDprZoom(this);

    drawMenuBackground(this);

    const rowCount = CAMPAIGN_CHAPTERS.length + 1; // + Back
    const cardHeight = CARD_PADDING_TOP + HEADING_HEIGHT + rowCount * ROW_HEIGHT + Math.max(0, rowCount - 1) * ROW_GAP + CARD_PADDING_BOTTOM;
    const cardCenterY = LOGICAL_HEIGHT / 2;
    new Card(this, LOGICAL_WIDTH / 2, cardCenterY, CARD_WIDTH, cardHeight);

    let y = cardCenterY - cardHeight / 2 + CARD_PADDING_TOP;
    this.add
      .text(LOGICAL_WIDTH / 2, y + HEADING_HEIGHT / 2 - 2, 'CHAPTER SELECT', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: COLORS.textAccent,
        fontStyle: 'bold',
        letterSpacing: 1,
        resolution: DPR,
      })
      .setOrigin(0.5);
    y += HEADING_HEIGHT;

    CAMPAIGN_CHAPTERS.forEach((chapter, index) => {
      new Button(this, LOGICAL_WIDTH / 2, y + ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, chapter.name, () => this.startChapter(chapter.id, index), '13px');
      y += ROW_HEIGHT + ROW_GAP;
    });
    y -= ROW_GAP;

    const divider = this.add.graphics();
    divider.lineStyle(1, DIVIDER_COLOR, 1);
    const dividerY = y + SECTION_GAP / 2;
    divider.lineBetween(LOGICAL_WIDTH / 2 - ROW_WIDTH / 2, dividerY, LOGICAL_WIDTH / 2 + ROW_WIDTH / 2, dividerY);
    y += SECTION_GAP;

    const backButton = new Button(this, LOGICAL_WIDTH / 2, y + ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, 'Back', () => this.scene.start('MainMenu'), '14px');
    backButton.setAccent(COLORS.cancelFill, COLORS.buttonStroke);

    this.add
      .text(LOGICAL_WIDTH - 12, LOGICAL_HEIGHT - 12, `v${GAME_VERSION}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(1, 1);
  }

  /** Starting a listed chapter fresh (no carry-over) begins the squad at PLAYER_START_LEVEL + its position in CAMPAIGN_CHAPTERS, so jumping straight to a later chapter isn't under-levelled (HANDOFF.md §3). */
  private startChapter(chapterId: string, index: number): void {
    const data: TacticalSceneData = { mode: 'campaign', chapterId, baseLevel: PLAYER_START_LEVEL + index };
    this.scene.start('Tactical', data);
  }
}
