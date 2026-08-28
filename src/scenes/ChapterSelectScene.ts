import { GameObjects, Scene } from 'phaser';

import { PLAYER_START_LEVEL } from '../game/classes';
import { CAMPAIGN_CHAPTERS } from '../game/maps';
import { loadCampaignSave } from '../game/save';
import { browserStorage } from '../systems/storage';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { Button, Card, COLORS, FONT_FAMILY } from '../ui/kit';
import type { TacticalSceneData } from './TacticalScene';

const ROW_WIDTH = 296;
const ROW_HEIGHT = 46;
const ROW_GAP = 10;
const CARD_WIDTH = ROW_WIDTH + 32;
const CARD_PADDING_TOP = 22;
const CARD_PADDING_BOTTOM = 20;
const HEADING_HEIGHT = 24;
const SECTION_GAP = 18;
const DIVIDER_COLOR = 0x3a4258;

const LOGO_KEY = 'menu-logo';
const LOGO_DISPLAY_SIZE = 132;
const BG_KEY = 'menu-bg';

/**
 * The main menu — mode selection between Roguelike and Campaign, and (new
 * 2026-08-27) the first live entry point into campaign mode at all.
 * `ProjectSelvariaCampaign`/`CAMPAIGN_CHAPTERS` existed as data since
 * campaign chapters were authored, but nothing constructed a
 * `CampaignCarryOver` or started a client against them until this scene —
 * see HANDOFF.md's Promotion section and README's "Recent changes" for the
 * fuller story. BootScene hands off here (a brief title beat) instead of
 * straight into TacticalScene.
 *
 * Redesigned (2026-08-27, per the repo owner: "look weird on mobile, make
 * it look like a good game main menu") from a flat navy screen with two
 * bare text headings floating over a mostly-empty canvas into a proper
 * title screen: a full-bleed atmospheric background (the same painted map
 * art `TEST_MAP_2` uses as its board, `public/maps/river1.jpg` — darkened
 * so text stays legible, not a fresh asset), the real game logo
 * (`public/project selvaria icon.png`) in place of plain "Project
 * Selvaria" text, and both mode sections consolidated into one `Card`
 * panel (matching every other panel in the game, `PromotionPicker`/
 * `BlessingPicker`/etc.) instead of buttons sitting directly on the
 * background. The whole logo+card block is vertically centered as one
 * group so the layout doesn't read as "a few rows stuck at the top of a
 * mostly empty screen" the way the original did on a tall phone viewport.
 */
export class ChapterSelectScene extends Scene {
  constructor() {
    super('ChapterSelect');
  }

  preload(): void {
    if (!this.textures.exists(BG_KEY)) this.load.image(BG_KEY, 'maps/river1.jpg');
    if (!this.textures.exists(LOGO_KEY)) this.load.image(LOGO_KEY, encodeURI('project selvaria icon.png'));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0f1a');
    applyDprZoom(this);

    this.drawBackground();

    // --- compute total content height so the logo+card block can be centered as one group ---
    const save = loadCampaignSave(browserStorage);
    const campaignRowCount = CAMPAIGN_CHAPTERS.length + (save ? 1 : 0);
    const roguelikeSectionHeight = HEADING_HEIGHT + ROW_HEIGHT;
    const campaignSectionHeight = HEADING_HEIGHT + campaignRowCount * ROW_HEIGHT + Math.max(0, campaignRowCount - 1) * ROW_GAP;
    const cardHeight =
      CARD_PADDING_TOP + roguelikeSectionHeight + SECTION_GAP + campaignSectionHeight + CARD_PADDING_BOTTOM;

    const logoBlockHeight = LOGO_DISPLAY_SIZE + 12 + 20; // logo + gap + tagline
    const blockGap = 28;
    const totalHeight = logoBlockHeight + blockGap + cardHeight;
    const blockTop = Math.max(24, (LOGICAL_HEIGHT - totalHeight) / 2 - 20);

    // --- logo + tagline ---
    const logoY = blockTop + LOGO_DISPLAY_SIZE / 2;
    this.add.image(LOGICAL_WIDTH / 2, logoY, LOGO_KEY).setDisplaySize(LOGO_DISPLAY_SIZE, LOGO_DISPLAY_SIZE);
    this.add
      .text(LOGICAL_WIDTH / 2, blockTop + LOGO_DISPLAY_SIZE + 20, 'A TACTICAL RPG', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: COLORS.textDisabled,
        letterSpacing: 3,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- menu card ---
    const cardTop = blockTop + logoBlockHeight + blockGap;
    const cardCenterY = cardTop + cardHeight / 2;
    new Card(this, LOGICAL_WIDTH / 2, cardCenterY, CARD_WIDTH, cardHeight);

    let y = cardTop + CARD_PADDING_TOP;
    const addHeading = (text: string) => {
      this.add
        .text(LOGICAL_WIDTH / 2, y + HEADING_HEIGHT / 2 - 2, text, {
          fontFamily: FONT_FAMILY,
          fontSize: '13px',
          color: COLORS.textAccent,
          fontStyle: 'bold',
          letterSpacing: 1,
          resolution: DPR,
        })
        .setOrigin(0.5);
      y += HEADING_HEIGHT;
    };
    const addRow = (label: string, onTap: () => void, fontSize = '14px', primary = false) => {
      const button = new Button(this, LOGICAL_WIDTH / 2, y + ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, label, onTap, fontSize);
      if (primary) button.setAccent(COLORS.successFill, COLORS.successStroke);
      y += ROW_HEIGHT + ROW_GAP;
    };

    addHeading('ROGUELIKE');
    addRow('Start Run', () => this.startRoguelike(), '15px', true);
    y -= ROW_GAP;

    const divider = this.add.graphics();
    divider.lineStyle(1, DIVIDER_COLOR, 1);
    const dividerY = y + SECTION_GAP / 2;
    divider.lineBetween(LOGICAL_WIDTH / 2 - ROW_WIDTH / 2, dividerY, LOGICAL_WIDTH / 2 + ROW_WIDTH / 2, dividerY);
    y += SECTION_GAP;

    addHeading('CAMPAIGN');
    if (save) {
      const chapter = CAMPAIGN_CHAPTERS.find((candidate) => candidate.id === save.chapterId);
      addRow(`Continue — ${chapter?.shortName ?? save.chapterId}`, () => this.continueCampaign(), '14px', true);
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

  /** Full-bleed cover-fit background image with a dark scrim on top so the menu's own text/cards stay legible over a busy painted map — same darken-for-legibility idea as every other panel's Card backdrop, just applied to the whole screen instead of one widget. */
  private drawBackground(): void {
    const bg = this.add.image(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, BG_KEY);
    const coverScale = Math.max(LOGICAL_WIDTH / bg.width, LOGICAL_HEIGHT / bg.height);
    bg.setScale(coverScale);

    const scrim: GameObjects.Graphics = this.add.graphics();
    scrim.fillStyle(0x0d0f1a, 0.8);
    scrim.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  /**
   * Explicit `{ mode: 'roguelike' }` rather than an omitted data argument —
   * Phaser's `Systems.start(data)` only overwrites `settings.data` when
   * `data` is truthy, so `this.scene.start('Tactical')` alone leaves a
   * previous campaign run's `TacticalSceneData` (mode: 'campaign', a real
   * `chapterId`, etc.) sitting there, and `TacticalScene.create()` reads it
   * right back — Roguelike would silently boot back into whichever campaign
   * chapter was last played, right after returning from it via the System
   * Menu's Main Menu option (found 2026-08-28, real bug: the repo owner hit
   * this in the actual build).
   */
  private startRoguelike(): void {
    const data: TacticalSceneData = { mode: 'roguelike' };
    this.scene.start('Tactical', data);
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
