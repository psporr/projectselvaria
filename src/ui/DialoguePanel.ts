import { GameObjects, Scene } from 'phaser';

import type { DialogueScript } from '../game/story';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { Card, COLORS, FONT_FAMILY } from './kit';

const BOX_WIDTH = LOGICAL_WIDTH - 24;
const BOX_HEIGHT = 190;
const BOX_BOTTOM_MARGIN = 20;
const BOX_CENTER_Y = LOGICAL_HEIGHT - BOX_BOTTOM_MARGIN - BOX_HEIGHT / 2;
const BOX_TOP = BOX_CENTER_Y - BOX_HEIGHT / 2;
const BOX_LEFT = LOGICAL_WIDTH / 2 - BOX_WIDTH / 2;
const BOX_RIGHT = LOGICAL_WIDTH / 2 + BOX_WIDTH / 2;

const PORTRAIT_RADIUS = 32;
const PORTRAIT_MARGIN = 16;
const PORTRAIT_Y = BOX_TOP + PORTRAIT_MARGIN + PORTRAIT_RADIUS;

const TEXT_PADDING = 18;
const NAME_Y = BOX_TOP + 26;
const BODY_TOP = BOX_TOP + 50;
const HINT_Y = BOX_TOP + BOX_HEIGHT - 16;

/**
 * Campaign chapter dialogue — intro/outro framing and mid-battle story
 * beats (`ChapterDef.intro`/`.outro`/`events`, `src/game/story.ts`'s
 * `MapEvent`), rendered for the first time 2026-08-27 (the data and pure
 * trigger-evaluation logic existed since campaign chapters were authored,
 * but nothing ever read them — see README's "Recent changes").
 *
 * Bottom-anchored rather than a centered modal like `BlessingPicker`/
 * `PromotionPicker` — deliberately different, so the board stays visible
 * above it during a mid-battle event instead of the whole screen vanishing
 * behind a card for one line of dialogue. Renders on top of
 * `UnitStatusBar`'s dock (higher depth) rather than coordinating layout
 * with it — input is suspended while a script is showing (TacticalScene's
 * `inputSuspended`), so nothing under it needs to stay interactive or even
 * visible.
 *
 * One `DialogueLine` on screen at a time; a full-screen invisible tap
 * catcher (matching `ActionMenu`'s backdrop convention) advances to the
 * next line, or hides and fires `onComplete` after the last one — the same
 * "show a script, callback when the player's done with it" shape
 * `PhaseBanner.show()` established, just player-paced instead of timed.
 */
export class DialoguePanel extends GameObjects.Container {
  private readonly tapCatcher: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly portraitGfx: GameObjects.Arc;
  private readonly portraitLetter: GameObjects.Text;
  private readonly nameText: GameObjects.Text;
  private readonly bodyText: GameObjects.Text;
  private readonly hint: GameObjects.Text;

  private script: DialogueScript = [];
  private index = 0;
  private onComplete: (() => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    this.tapCatcher = scene.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x000000, 0).setInteractive();
    this.tapCatcher.on('pointerup', () => this.advance());

    this.card = new Card(scene, LOGICAL_WIDTH / 2, BOX_CENTER_Y, BOX_WIDTH, BOX_HEIGHT);

    this.portraitGfx = scene.add.circle(0, PORTRAIT_Y, PORTRAIT_RADIUS, COLORS.playerAccent).setStrokeStyle(2, 0x000000, 0.4);
    this.portraitLetter = scene.add
      .text(0, PORTRAIT_Y, '', { fontFamily: FONT_FAMILY, fontSize: '22px', fontStyle: 'bold', color: '#ffffff', resolution: DPR })
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

    this.add([this.tapCatcher, this.card, this.portraitGfx, this.portraitLetter, this.nameText, this.bodyText, this.hint]);
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

    this.portraitGfx.setVisible(hasPortrait);
    this.portraitLetter.setVisible(hasPortrait);
    if (hasPortrait) {
      const portraitX = side === 'right' ? BOX_RIGHT - PORTRAIT_MARGIN - PORTRAIT_RADIUS : BOX_LEFT + PORTRAIT_MARGIN + PORTRAIT_RADIUS;
      this.portraitGfx.setPosition(portraitX, PORTRAIT_Y).setFillStyle(side === 'right' ? COLORS.enemyAccent : COLORS.playerAccent);
      this.portraitLetter.setPosition(portraitX, PORTRAIT_Y).setText(CLASS_LETTER[line.portraitClass!] ?? '?');
    }

    // Text column sits opposite whichever edge the portrait occupies (or
    // spans the full width, minus padding, for a portrait-less narrator
    // line) — same "leave room for whichever side has art" idea
    // UnitStatusBar's own layout already uses.
    const textLeft = hasPortrait && side === 'left' ? BOX_LEFT + PORTRAIT_MARGIN * 2 + PORTRAIT_RADIUS * 2 : BOX_LEFT + TEXT_PADDING;
    const textRight = hasPortrait && side === 'right' ? BOX_RIGHT - PORTRAIT_MARGIN * 2 - PORTRAIT_RADIUS * 2 : BOX_RIGHT - TEXT_PADDING;
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

  private hide(): void {
    this.setVisible(false);
    this.script = [];
    const callback = this.onComplete;
    this.onComplete = null;
    callback?.();
  }
}
