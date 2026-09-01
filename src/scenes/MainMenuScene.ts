import { Scene } from 'phaser';

import { PLAYER_START_LEVEL } from '../game/classes';
import { CAMPAIGN_CHAPTERS, ANIMATED_HERO_TEST_STAGE } from '../game/maps';
import { loadCampaignSave } from '../game/save';
import { browserStorage } from '../systems/storage';
import { battleStyleLabel, loadSettings, nextBattleStyle, saveSettings } from '../systems/settings';
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
const HEADING_HEIGHT = 24;
const SECTION_GAP = 18;
const DIVIDER_COLOR = 0x3a4258;

const LOGO_KEY = 'menu-logo';
const LOGO_DISPLAY_SIZE = 132;

/**
 * The main menu — mode selection between Roguelike and Campaign. Campaign
 * split into three rows (2026-08-28, per the repo owner) instead of one
 * "Continue" plus a flat list of every chapter: **New Game** (starts
 * Chapter 1 fresh), **Load Game** (only shown when a save exists — was
 * "Continue" before, unchanged behavior/save format, just renamed to match
 * the New/Load pairing), and **Chapter Select**, which now hands off to its
 * own scene (`ChapterSelectScene`) for jumping straight into any individual
 * chapter — that per-chapter list used to live inline on this screen. Keeps
 * this screen's own row count fixed at 2-3 regardless of how many chapters
 * the campaign ever grows to, rather than this card growing a row per
 * chapter forever.
 *
 * Redesigned (2026-08-27, per the repo owner: "look weird in mobile and not
 * beautiful") from a flat navy screen with two bare text headings floating
 * over a mostly-empty canvas into a proper title screen: a full-bleed
 * atmospheric background (`menuBackground.ts`, shared with
 * `ChapterSelectScene` so the two read as one visual space), the real game
 * logo (`public/project selvaria icon.png`) in place of plain "Project
 * Selvaria" text, and both mode sections consolidated into one `Card` panel
 * (matching every other panel in the game) instead of buttons sitting
 * directly on the background. The whole logo+card block is vertically
 * centered as one group so the layout doesn't read as "a few rows stuck at
 * the top of a mostly empty screen" the way the original did on a tall
 * phone viewport.
 *
 * SETTINGS (2026-08-31, per the repo owner) holds one row so far: a
 * two-state Battle Style toggle (on-grid effects vs. the full-screen
 * `CombatOverlayScene` cut-in), written straight to storage on tap and read
 * once per battle by `TacticalScene.create()`. A toggle row rather than its
 * own settings screen, matching the in-battle "Danger: OFF" dock button —
 * worth revisiting if a second or third setting ever lands here.
 *
 * A fourth section, DEV TESTS (2026-08-31, per the repo owner), surfaces
 * `SpriteTestScene` and `ANIMATED_HERO_TEST_STAGE` as real buttons instead of
 * `?spriteTest=1`/`?luffyTest=1`-only routes — both URL params still work
 * (BootScene), this is just a faster way in. Deliberately styled with no
 * primary accent, unlike Start Run/New Game, so it doesn't read as a third
 * real game mode.
 */
export class MainMenuScene extends Scene {
  constructor() {
    super('MainMenu');
  }

  preload(): void {
    preloadMenuBackground(this);
    if (!this.textures.exists(LOGO_KEY)) this.load.image(LOGO_KEY, encodeURI('project selvaria icon.png'));
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0d0f1a');
    applyDprZoom(this);

    drawMenuBackground(this);

    // --- compute total content height so the logo+card block can be centered as one group ---
    const save = loadCampaignSave(browserStorage);
    const campaignRowCount = 2 + (save ? 1 : 0); // New Game + Chapter Select, plus Load Game when a save exists
    const devRowCount = 2; // Sprite Test + Hero Anim Test
    const roguelikeSectionHeight = HEADING_HEIGHT + ROW_HEIGHT;
    const campaignSectionHeight = HEADING_HEIGHT + campaignRowCount * ROW_HEIGHT + Math.max(0, campaignRowCount - 1) * ROW_GAP;
    const devSectionHeight = HEADING_HEIGHT + devRowCount * ROW_HEIGHT + Math.max(0, devRowCount - 1) * ROW_GAP;
    const settingsSectionHeight = HEADING_HEIGHT + ROW_HEIGHT;
    const cardHeight =
      CARD_PADDING_TOP +
      roguelikeSectionHeight +
      SECTION_GAP +
      campaignSectionHeight +
      SECTION_GAP +
      settingsSectionHeight +
      SECTION_GAP +
      devSectionHeight +
      CARD_PADDING_BOTTOM;

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
    const addRow = (label: string, onTap: (() => void) | null, fontSize = '14px', primary = false): Button => {
      const button = new Button(this, LOGICAL_WIDTH / 2, y + ROW_HEIGHT / 2, ROW_WIDTH, ROW_HEIGHT, label, onTap, fontSize);
      if (primary) button.setAccent(COLORS.successFill, COLORS.successStroke);
      y += ROW_HEIGHT + ROW_GAP;
      return button;
    };
    const addDivider = () => {
      y -= ROW_GAP;
      const gfx = this.add.graphics();
      gfx.lineStyle(1, DIVIDER_COLOR, 1);
      const dividerY = y + SECTION_GAP / 2;
      gfx.lineBetween(LOGICAL_WIDTH / 2 - ROW_WIDTH / 2, dividerY, LOGICAL_WIDTH / 2 + ROW_WIDTH / 2, dividerY);
      y += SECTION_GAP;
    };

    addHeading('ROGUELIKE');
    addRow('Start Run', () => this.startRoguelike(), '15px', true);
    addDivider();

    addHeading('CAMPAIGN');
    addRow('New Game', () => this.startNewCampaign(), '14px', true);
    if (save) {
      const chapter = CAMPAIGN_CHAPTERS.find((candidate) => candidate.id === save.chapterId);
      addRow(`Load Game — ${chapter?.shortName ?? save.chapterId}`, () => this.loadGame(), '13px');
    }
    addRow('Chapter Select', () => this.scene.start('ChapterSelect'), '13px');
    addDivider();

    // One row, two states, relabelling itself on tap — the same toggle
    // shape the in-battle "Danger: OFF" dock button already uses, rather
    // than a whole settings screen for a single choice. Written straight
    // to storage so it survives the scene change into a battle (and a
    // reload); TacticalScene reads it once per battle in create().
    addHeading('SETTINGS');
    const settings = loadSettings(browserStorage);
    const styleRow = addRow(`Battle Style: ${battleStyleLabel(settings.battleStyle)}`, null, '13px');
    styleRow.setOnTap(() => {
      settings.battleStyle = nextBattleStyle(settings.battleStyle);
      saveSettings(browserStorage, settings);
      styleRow.setLabel(`Battle Style: ${battleStyleLabel(settings.battleStyle)}`);
    });
    addDivider();

    // Animated-sprite dev tools (2026-08-31) — surfaced here per the repo
    // owner rather than staying `?spriteTest=1`/`?luffyTest=1`-only, now that
    // there are two of them and typing a URL param each time got old. Still
    // placeholder art with no commission (SpriteTestScene's own doc comment),
    // so this section stays visually distinct (muted heading, no primary
    // accent on either row) rather than reading as a third real game mode.
    addHeading('DEV TESTS');
    addRow('Sprite Test', () => this.scene.start('SpriteTest'), '13px');
    addRow('Hero Anim Test', () => this.startAnimatedHeroTestStage(), '13px');

    this.add
      .text(LOGICAL_WIDTH - 12, LOGICAL_HEIGHT - 12, `v${GAME_VERSION}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(1, 1);
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

  /** Always Chapter 1, fresh — the equivalent of picking the first row on `ChapterSelectScene`. Starting a listed chapter fresh (no carry-over) begins the squad at PLAYER_START_LEVEL + its position in CAMPAIGN_CHAPTERS (HANDOFF.md §3); Chapter 1 is index 0, so that's just PLAYER_START_LEVEL. */
  private startNewCampaign(): void {
    const first = CAMPAIGN_CHAPTERS[0];
    const data: TacticalSceneData = { mode: 'campaign', chapterId: first.id, baseLevel: PLAYER_START_LEVEL };
    this.scene.start('Tactical', data);
  }

  private loadGame(): void {
    const save = loadCampaignSave(browserStorage);
    if (!save) return;
    const data: TacticalSceneData = { mode: 'campaign', chapterId: save.chapterId, carryOver: save.carryOver };
    this.scene.start('Tactical', data);
  }

  /** Same route `?luffyTest=1` gives BootScene — see ANIMATED_HERO_TEST_STAGE's own doc comment (game/maps.ts) for why it's a debugChapter override rather than a real, CAMPAIGN_CHAPTERS-listed chapter. */
  private startAnimatedHeroTestStage(): void {
    const data: TacticalSceneData = { mode: 'campaign', debugChapter: ANIMATED_HERO_TEST_STAGE };
    this.scene.start('Tactical', data);
  }
}
