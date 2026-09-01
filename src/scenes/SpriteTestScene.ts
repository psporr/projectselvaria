import { GameObjects, Scene } from 'phaser';

import { ANIMATED_HERO_NAMES, heroAnimAtlasKey } from '../ui/heroArt';
import { ensureHeroAnimations, HERO_ATTACK_FRAME, heroIdleAnimKey } from '../ui/heroAnimations';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, COLORS, FONT_FAMILY } from '../ui/kit';

const SCALE = 5;
const GROUND_Y = 420;
const SPEED_PRESETS = [0.1, 0.25, 0.5, 1, 2] as const;

/**
 * Standalone sprite-sheet-animation viewer (2026-08-31; rebuilt 2026-09-01
 * for the Aseprite-source pipeline, `extractAseprite.ts`) — proving out
 * frame-based character animation and letting the repo owner eyeball a
 * newly-extracted hero's frames without a full battle running. Deliberately
 * isolated from the real game: not on `MainMenuScene`'s default flow,
 * reachable only via `?spriteTest=1` (`BootScene`'s existing debug-redirect
 * convention) — kept alongside, not replaced by, the real `UnitSprite`/
 * `CombatOverlayScene` wiring every name in `heroArt.ts`'s
 * `ANIMATED_HERO_NAMES` already has.
 *
 * Works for every animated hero, not just one — a character switcher picks
 * which atlas is loaded into the one `Sprite` (`setTexture()` to the new
 * atlas key, matching `heroAnimations.ts`'s "one Sprite, whichever atlas its
 * current animation belongs to" pattern the old two-atlas version already
 * relied on). No Run button — the current pipeline only ever produces idle
 * + one attack pose (`heroAnimations.ts`'s own doc comment on why there's no
 * played attack animation to loop here the way the old hand-cut punch sheet
 * needed); Attack just holds `HERO_ATTACK_FRAME` so the pose itself is what
 * gets inspected.
 *
 * The ground line here is a correctness check, same purpose it always had:
 * `extractAseprite.ts` crops every frame (idle and attack alike) to one
 * shared union-bounds rect, so with `setOrigin(0.5, 1)` the feet should sit
 * on this line and stay there across every frame and every pose — if a
 * future extraction ever regresses that, this is where it'd visibly show
 * as floating or sinking.
 */
export class SpriteTestScene extends Scene {
  private sprite!: GameObjects.Sprite;
  private currentHero: string = ANIMATED_HERO_NAMES[0];
  private currentPose: 'idle' | 'attack' = 'idle';
  private currentSpeed: number = 1;
  private frameLabel!: GameObjects.Text;
  private speedLabel!: GameObjects.Text;
  private heroButtons: Array<[Button, string]> = [];
  private poseButtons: Array<[Button, 'idle' | 'attack']> = [];

  constructor() {
    super('SpriteTest');
  }

  preload(): void {
    for (const name of ANIMATED_HERO_NAMES) {
      this.load.atlas(heroAnimAtlasKey(name), `heroes/${name}-atlas.png`, `heroes/${name}-atlas.json`);
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#1a1a2e');
    applyDprZoom(this);

    this.add
      .text(LOGICAL_WIDTH / 2, 40, 'SPRITE SHEET TEST', {
        fontFamily: FONT_FAMILY,
        fontSize: '15px',
        fontStyle: 'bold',
        color: COLORS.textAccent,
        resolution: DPR,
      })
      .setOrigin(0.5);
    this.add
      .text(LOGICAL_WIDTH / 2, 62, 'Aseprite-sourced frames — extractAseprite.ts', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(0.5);

    const ground = this.add.graphics();
    ground.lineStyle(1, 0x3a4258, 1);
    ground.lineBetween(LOGICAL_WIDTH / 2 - 100, GROUND_Y, LOGICAL_WIDTH / 2 + 100, GROUND_Y);

    for (const name of ANIMATED_HERO_NAMES) ensureHeroAnimations(this, name);

    this.sprite = this.add.sprite(LOGICAL_WIDTH / 2, GROUND_Y, heroAnimAtlasKey(this.currentHero), 'idle-0').setOrigin(0.5, 1).setScale(SCALE);
    this.sprite.play(heroIdleAnimKey(this.currentHero));
    this.sprite.anims.timeScale = this.currentSpeed;
    this.sprite.on('animationupdate', () => {
      this.frameLabel.setText(`frame: ${this.sprite.frame.name}  (${this.sprite.frame.width}x${this.sprite.frame.height}px)`);
    });

    this.frameLabel = this.add
      .text(LOGICAL_WIDTH / 2, GROUND_Y + 40, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textDisabled, resolution: DPR })
      .setOrigin(0.5);

    const heroButtonY = LOGICAL_HEIGHT - 226;
    this.heroButtons = ANIMATED_HERO_NAMES.map((name, i) => {
      const x = LOGICAL_WIDTH / 2 + (i - (ANIMATED_HERO_NAMES.length - 1) / 2) * 130;
      const button = new Button(this, x, heroButtonY, 110, 36, name[0].toUpperCase() + name.slice(1), null, '13px');
      button.setOnTap(() => {
        this.currentHero = name;
        this.playPose();
        this.refreshHeroButtonAccents();
      });
      return [button, name];
    });
    this.refreshHeroButtonAccents();

    const poseButtonY = heroButtonY + 46;
    const idleButton = new Button(this, LOGICAL_WIDTH / 2 - 65, poseButtonY, 110, 42, 'Idle', null, '13px');
    const attackButton = new Button(this, LOGICAL_WIDTH / 2 + 65, poseButtonY, 110, 42, 'Attack', null, '13px');
    this.poseButtons = [
      [idleButton, 'idle'],
      [attackButton, 'attack'],
    ];
    this.poseButtons.forEach(([button, pose]) => {
      button.setOnTap(() => {
        this.currentPose = pose;
        this.playPose();
        this.refreshPoseButtonAccents();
      });
    });
    this.refreshPoseButtonAccents();

    // Playback-speed selector (2026-08-31, per the repo owner) — only ever
    // moves the idle loop (there's nothing to play back at a held attack
    // pose), kept because stepping through slowly is still the fastest way
    // to confirm a newly-extracted idle loop reads clean.
    const speedLabelY = poseButtonY + 46;
    this.speedLabel = this.add
      .text(LOGICAL_WIDTH / 2, speedLabelY, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textDisabled, resolution: DPR })
      .setOrigin(0.5);

    const speedButtonY = speedLabelY + 24;
    const speedButtonSpacing = 88;
    const speedButtons = SPEED_PRESETS.map((speed, i) => {
      const x = LOGICAL_WIDTH / 2 + (i - (SPEED_PRESETS.length - 1) / 2) * speedButtonSpacing;
      return new Button(this, x, speedButtonY, 80, 34, `${speed}x`, null, '12px');
    });
    speedButtons.forEach((button, i) => {
      button.setOnTap(() => {
        this.currentSpeed = SPEED_PRESETS[i];
        this.sprite.anims.timeScale = this.currentSpeed;
        this.refreshSpeedButtonAccents(speedButtons);
      });
    });
    this.refreshSpeedButtonAccents(speedButtons);

    const backButton = new Button(this, LOGICAL_WIDTH / 2, speedButtonY + 50, 130, 34, 'Back', () => this.scene.start('MainMenu'), '13px');
    backButton.setAccent(COLORS.cancelFill, COLORS.buttonStroke);
  }

  private playPose(): void {
    const atlas = heroAnimAtlasKey(this.currentHero);
    // Flat SCALE regardless of hero, deliberately not heroAnimScale()'s
    // normalized-to-a-common-height factor the real game uses — this
    // viewer's job is showing each hero's actual source pixels at a fixed
    // zoom, so a physically bigger frame (Zoro's, vs Luffy's) should render
    // bigger here, not get scaled down to match.
    this.sprite.setScale(SCALE);
    if (this.currentPose === 'attack') {
      this.sprite.anims.stop();
      this.sprite.setTexture(atlas, HERO_ATTACK_FRAME);
      this.frameLabel.setText(`frame: ${this.sprite.frame.name}  (${this.sprite.frame.width}x${this.sprite.frame.height}px)`);
    } else {
      this.sprite.play(heroIdleAnimKey(this.currentHero));
      this.sprite.anims.timeScale = this.currentSpeed;
    }
  }

  private refreshHeroButtonAccents(): void {
    this.heroButtons.forEach(([button, name]) => {
      const active = name === this.currentHero;
      button.setAccent(active ? COLORS.successFill : null, active ? COLORS.successStroke : null);
    });
  }

  private refreshPoseButtonAccents(): void {
    this.poseButtons.forEach(([button, pose]) => {
      const active = pose === this.currentPose;
      button.setAccent(active ? COLORS.successFill : null, active ? COLORS.successStroke : null);
    });
  }

  private refreshSpeedButtonAccents(speedButtons: Button[]): void {
    speedButtons.forEach((button, i) => {
      const active = SPEED_PRESETS[i] === this.currentSpeed;
      button.setAccent(active ? COLORS.successFill : null, active ? COLORS.successStroke : null);
    });
    this.speedLabel.setText(`Speed: ${this.currentSpeed}x`);
  }
}
