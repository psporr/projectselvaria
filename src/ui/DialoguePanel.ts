import { GameObjects, Scene } from 'phaser';

import type { DialogueLine, DialogueScript } from '../game/story';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { enemyClassTextureKey, heroTextureKey } from './heroArt';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

const BOX_WIDTH = LOGICAL_WIDTH - 40;
const BOX_HEIGHT = 224;
const BOX_CENTER_Y = LOGICAL_HEIGHT / 2;
const BOX_TOP = BOX_CENTER_Y - BOX_HEIGHT / 2;
const BOX_LEFT = LOGICAL_WIDTH / 2 - BOX_WIDTH / 2;
const BOX_RIGHT = LOGICAL_WIDTH / 2 + BOX_WIDTH / 2;

const SKIP_BUTTON_W = 52;
const SKIP_BUTTON_H = 22;
const SKIP_BUTTON_Y = BOX_TOP + 16 + SKIP_BUTTON_H / 2;

/** Everything below the skip-button row — portrait + name + body all measure down from here. */
const CONTENT_TOP = SKIP_BUTTON_Y + SKIP_BUTTON_H / 2 + 14;
const PORTRAIT_SIZE = 84;
const PORTRAIT_MARGIN = 16;
const PORTRAIT_Y = CONTENT_TOP + PORTRAIT_SIZE / 2;

const TEXT_PADDING = 20;
const NAME_Y = CONTENT_TOP + 6;
const BODY_TOP = NAME_Y + 24;
const HINT_Y = BOX_TOP + BOX_HEIGHT - 18;

/** Same texture-resolution order as `UnitSprite`'s on-board rendering (not `UnitStatusBar`'s, which prefers a bust portrait first) — "use the unit sprite" means the map sprite a player already recognizes from the board, not the separate higher-detail portrait art category. Falls back to the enemy-class sprite for an unnamed enemy speaker (Gate Chief/Vale Captain -> Barbarian), then to the caller's own class-letter placeholder when neither exists. */
function resolvePortraitTexture(scene: Scene, line: DialogueLine): string | undefined {
  const heroKey = heroTextureKey(line.speaker);
  if (scene.textures.exists(heroKey)) return heroKey;
  if (line.portraitClass) {
    const enemyKey = enemyClassTextureKey(line.portraitClass);
    if (scene.textures.exists(enemyKey)) return enemyKey;
  }
  return undefined;
}

/**
 * Campaign chapter dialogue — intro/outro framing and mid-battle story beats
 * (`ChapterDef.intro`/`.outro`/`events`, `src/game/story.ts`'s `MapEvent`).
 *
 * Centered modal with a dimmed backdrop (2026-08-28, per the repo owner) —
 * originally shipped bottom-anchored so the board stayed visible during a
 * mid-battle event, but a full read of the same portrait/name/body layout
 * `UnitStatusBar` uses reads better with the board dimmed out behind it and
 * more room for real character art, matching every other panel in this game
 * (`BlessingPicker`/`PromotionPicker`) rather than being the one exception.
 * Input is already suspended for the full duration a script is showing
 * (`TacticalScene.inputSuspended`), so nothing under it needs to stay
 * visible or interactive either way.
 *
 * The portrait shows the speaking unit's actual map sprite (`heroArt.ts`,
 * same texture `UnitSprite` renders on the board) when one resolves,
 * falling back to the class-letter placeholder otherwise — same three-tier
 * "real art, then a themed fallback" convention `UnitStatusBar`'s portrait
 * slot already established, just keyed off `DialogueLine.speaker`/
 * `.portraitClass` instead of a live `Unit`.
 *
 * A **Skip** button dismisses the entire remaining script in one tap,
 * distinct from tapping the backdrop to advance one line at a time — for a
 * player who's already read this chapter's dialogue on a previous run.
 *
 * One `DialogueLine` on screen at a time; a full-screen dimmed tap catcher
 * advances to the next line, or hides and fires `onComplete` after the last
 * one — the same "show a script, callback when the player's done with it"
 * shape `PhaseBanner.show()` established, just player-paced instead of
 * timed.
 */
export class DialoguePanel extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly skipButton: Button;
  private readonly portraitGfx: GameObjects.Graphics;
  private readonly portraitImage: GameObjects.Image;
  private readonly portraitLetter: GameObjects.Text;
  private readonly nameText: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly hint: GameObjects.Text;

  private script: DialogueScript = [];
  private index = 0;
  private onComplete: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    this.backdrop = scene.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0.7).setInteractive();
    this.backdrop.on('pointerup', () => this.advance());

    this.card = new Card(scene, LOGICAL_WIDTH / 2, BOX_CENTER_Y, BOX_WIDTH, BOX_HEIGHT);

    this.skipButton = new Button(scene, BOX_RIGHT - SKIP_BUTTON_W / 2 - 12, SKIP_BUTTON_Y, SKIP_BUTTON_W, SKIP_BUTTON_H, 'Skip', () => this.skip(), '11px');

    this.portraitGfx = scene.add.graphics();
    this.portraitImage = scene.add.image(0, PORTRAIT_Y, '__WHITE').setVisible(false);
    this.portraitLetter = scene.add
      .text(0, PORTRAIT_Y, '', { fontFamily: FONT_FAMILY, fontSize: '28px', fontStyle: 'bold', color: '#ffffff', resolution: DPR })
      .setOrigin(0.5);

    this.nameText = scene.add.text(0, NAME_Y, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      fontStyle: 'bold',
      color: COLORS.textAccent,
      resolution: DPR,
    });
    this.bodyText = scene.add.text(0, BODY_TOP, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color: COLORS.textPrimary,
      resolution: DPR,
      lineSpacing: 4,
    });
    this.hint = scene.add
      .text(BOX_RIGHT - TEXT_PADDING, HINT_Y, '', { fontFamily: FONT_FAMILY, fontSize: '10px', color: COLORS.textDisabled, resolution: DPR })
      .setOrigin(1, 0.5);

    this.add([
      this.backdrop,
      this.card,
      this.portraitGfx,
      this.portraitImage,
      this.portraitLetter,
      this.nameText,
      this.bodyText,
      this.hint,
      this.skipButton,
    ]);
    this.setDepth(22);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(script: DialogueScript, onComplete: () => void): void {
    if (script.length === 0) {
      onComplete();
      return;
    }
    this.script = script;
    this.index = 0;
    this.onComplete = onComplete;
    this.setVisible(true);
    this.renderLine();
  }

  private renderLine(): void {
    const line = this.script[this.index];
    const side = line.side ?? 'left';
    const hasPortrait = line.portraitClass !== undefined;
    const accent = side === 'right' ? COLORS.enemyAccent : COLORS.playerAccent;

    this.portraitGfx.setVisible(hasPortrait);
    this.portraitImage.setVisible(false);
    this.portraitLetter.setVisible(false);

    if (hasPortrait) {
      const portraitX = side === 'right' ? BOX_RIGHT - PORTRAIT_MARGIN - PORTRAIT_SIZE / 2 : BOX_LEFT + PORTRAIT_MARGIN + PORTRAIT_SIZE / 2;

      this.portraitGfx.clear();
      this.portraitGfx.fillStyle(accent, 0.5);
      this.portraitGfx.fillRoundedRect(portraitX - PORTRAIT_SIZE / 2, PORTRAIT_Y - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 10);
      this.portraitGfx.lineStyle(2, accent, 1);
      this.portraitGfx.strokeRoundedRect(portraitX - PORTRAIT_SIZE / 2, PORTRAIT_Y - PORTRAIT_SIZE / 2, PORTRAIT_SIZE, PORTRAIT_SIZE, 10);

      const textureKey = resolvePortraitTexture(this.scene, line);
      if (textureKey) {
        this.portraitImage.setTexture(textureKey).setPosition(portraitX, PORTRAIT_Y);
        const maxSize = PORTRAIT_SIZE - 12;
        const fitScale = Math.min(maxSize / this.portraitImage.width, maxSize / this.portraitImage.height);
        this.portraitImage.setDisplaySize(this.portraitImage.width * fitScale, this.portraitImage.height * fitScale).setVisible(true);
      } else {
        this.portraitLetter.setPosition(portraitX, PORTRAIT_Y).setText(CLASS_LETTER[line.portraitClass!] ?? '?').setVisible(true);
      }
    }

    // Text column sits opposite whichever edge the portrait occupies (or
    // spans the full width, minus padding, for a portrait-less narrator
    // line) — same "leave room for whichever side has art" idea
    // UnitStatusBar's own layout already uses.
    const textLeft = hasPortrait && side === 'left' ? BOX_LEFT + PORTRAIT_MARGIN * 2 + PORTRAIT_SIZE : BOX_LEFT + TEXT_PADDING;
    const textRight = hasPortrait && side === 'right' ? BOX_RIGHT - PORTRAIT_MARGIN * 2 - PORTRAIT_SIZE : BOX_RIGHT - TEXT_PADDING;
    const textWidth = textRight - textLeft;

    this.nameText.setPosition(textLeft, NAME_Y).setText(line.speaker);
    this.bodyText.setPosition(textLeft, BODY_TOP).setText(line.text).setWordWrapWidth(textWidth);
    this.hint.setText(this.index < this.script.length - 1 ? 'Tap to continue >' : 'Tap to close');
  }

  private advance(): void {
    if (!this.script.length) return;
    this.index++;
    if (this.index >= this.script.length) {
      this.hide();
      return;
    }
    this.renderLine();
  }

  /** Dismisses the whole remaining script in one tap, unlike `advance()` which only steps one line at a time. */
  private skip(): void {
    if (!this.script.length) return;
    this.hide();
  }

  private hide(): void {
    this.setVisible(false);
    this.script = [];
    const callback = this.onComplete;
    this.onComplete = null;
    callback?.();
  }
}
