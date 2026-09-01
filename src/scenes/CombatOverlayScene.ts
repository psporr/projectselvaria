import { GameObjects, Scene, TintModes } from 'phaser';

import type { CombatBeat, CombatResult, Unit } from '../game/types';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from '../ui/classIcons';
import { artFlipX, heroIdleRunAtlasKey, isAnimatedHero, resolveBattlePortraitTexture, STATIC_ART_FACES_RIGHT } from '../ui/heroArt';
import { luffyFlipX, LUFFY_ANIM_ATTACK, LUFFY_ANIM_IDLE, LUFFY_ATTACK_IMPACT_FRAME } from '../ui/heroAnimations';
import { COLORS, FONT_FAMILY } from '../ui/kit';

/** Everything the overlay needs to play an exchange back. Assembled by `TacticalScene.syncUnits()` at the moment it detects a new `G.lastCombat`, since that's the only place that still has both the pre-combat HP (its own `lastUnits` snapshot) and the post-combat units. */
export interface CombatOverlayData {
  attacker: Unit;
  defender: Unit;
  /** HP both units had *before* this exchange — the bars animate down from here, since `attacker`/`defender` above already carry their final post-combat HP. */
  attackerHpBefore: number;
  defenderHpBefore: number;
  result: CombatResult;
  onComplete: () => void;
}

const GROUND_Y = 430;
const LEFT_X = 132;
const RIGHT_X = LOGICAL_WIDTH - 132;
/** How tall a combatant is drawn, whatever its source art's own pixel size. */
const FIGHTER_HEIGHT = 168;
/** Matches UnitSprite's own reference — the idle sheet's ~45px average frame height, so an animated hero scales to FIGHTER_HEIGHT the same way a static portrait does. */
const ANIM_REFERENCE_FRAME_HEIGHT = 45;

const SLIDE_MS = 320;
const HOLD_BEFORE_FIRST_BEAT_MS = 280;
const BEAT_GAP_MS = 420;
const HOLD_AFTER_LAST_BEAT_MS = 460;
const LUNGE_MS = 150;
const HP_DRAIN_MS = 280;
const HIT_FLASH_MS = 150;
/** Skip taps are ignored this long after the cut-in opens, so the same finger that confirmed the attack can't instantly dismiss what it just triggered. */
const SKIP_GRACE_MS = 400;

/** Text-safe team tints — kit's own playerAccent/enemyAccent are numeric fills for Graphics, not CSS color strings. */
const TEAM_NAME_COLOR = { player: '#8fc0f0', enemy: '#f08a86' };

const PANEL_TOP_Y = 548;
const HP_BAR_WIDTH = 168;
const HP_BAR_HEIGHT = 16;

/** One side of the exchange. `root` is what slides/lunges; the three visual fields are mutually exclusive (animated sprite, static art, or the class-letter placeholder), mirroring UnitSprite's own three render modes. */
interface Fighter {
  unit: Unit;
  root: GameObjects.Container;
  sprite: GameObjects.Sprite | null;
  image: GameObjects.Image | null;
  circle: GameObjects.Arc | null;
  homeX: number;
  offscreenX: number;
  /** +1 lunges right, -1 lunges left — always toward the other side. */
  lungeSign: 1 | -1;
  /** True for the left-hand fighter: it should face right, toward its opponent. Which way that means flipping depends on how the fighter's own art is drawn (heroArt.ts's artFlipX / heroAnimations.ts's luffyFlipX) — Luffy's animated sheets face right by default, every static art source faces left. */
  faceRight: boolean;
  hp: number;
  hpFill: GameObjects.Rectangle;
  hpText: GameObjects.Text;
}

/**
 * The full-screen combat cut-in (2026-08-31) — `HANDOFF.md` §7's long-
 * deferred "Phase 2" `CombatOverlayScene`, in the GBA Fire Emblem style.
 *
 * It slots into the presentation contract §7 already established and proved
 * with the on-grid version, unchanged: combat is fully resolved before
 * anything animates (`G.lastCombat`), presentation only ever *consumes* that
 * finished `CombatResult` (nothing here touches combat math), and completion
 * is signalled back by callback so the tactical layer can keep input
 * suspended until the whole presentation is done.
 *
 * Per the repo owner, this does NOT replace the on-grid effects — both play,
 * in order: confirm an attack, the overlay takes over the screen, and once it
 * closes `TacticalScene.playCombatSequence()` re-states the same result on
 * the board itself (lunge, damage numbers, particles). The overlay is the
 * dramatic beat; the on-grid pass is what leaves the player looking at the
 * board again with the consequence visible in context.
 *
 * Layout is portrait-first like everything else here (480x854): the player's
 * unit always holds the left side and the enemy the right, regardless of
 * which of them is swinging this beat — the GBA convention, and it keeps
 * "which one is mine" readable when a counter reverses who's attacking.
 * Whichever side is attacking plays its attack; a unit with real frame
 * animation (`heroArt.ts`'s `ANIMATED_HERO_NAMES`) plays that, and every
 * other unit — the whole roster today — falls back to a static portrait
 * doing the same lunge the on-grid version uses, so this works for the
 * entire cast now rather than waiting on 20-odd commissioned animation sets.
 *
 * Tapping anywhere skips straight to the end (GBA FE's own battle-animation
 * skip) — worth having when you're testing the same fight repeatedly, and it
 * jumps both HP bars to the units' real post-combat values rather than
 * leaving them mid-drain.
 */
export class CombatOverlayScene extends Scene {
  private overlayData!: CombatOverlayData;
  private left!: Fighter;
  private right!: Fighter;
  /** Guards finish() against running twice — a skip tap racing the natural end would otherwise stop the scene mid-teardown and fire onComplete twice. */
  private finishing = false;
  private skippableAt = 0;

  constructor() {
    super('CombatOverlay');
  }

  init(data: CombatOverlayData): void {
    this.overlayData = data;
    this.finishing = false;
  }

  create(): void {
    applyDprZoom(this);

    // The scenes underneath keep running (and rendering, behind this
    // backdrop) — but their input has to go quiet, or a skip tap also lands
    // on whatever UIScene button happens to sit under the finger.
    this.setUnderlyingInputEnabled(false);

    this.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x0a0c14, 0.97).setInteractive();
    this.drawStage();

    const { attacker, defender, attackerHpBefore, defenderHpBefore } = this.overlayData;
    // Player always takes the left side, enemy the right — not attacker-left,
    // so a counter doesn't visually swap the two units mid-exchange.
    const attackerOnLeft = attacker.team !== 'enemy';
    this.left = this.buildFighter(
      attackerOnLeft ? attacker : defender,
      attackerOnLeft ? attackerHpBefore : defenderHpBefore,
      LEFT_X,
      -160,
      1,
    );
    this.right = this.buildFighter(
      attackerOnLeft ? defender : attacker,
      attackerOnLeft ? defenderHpBefore : attackerHpBefore,
      RIGHT_X,
      LOGICAL_WIDTH + 160,
      -1,
    );

    this.skippableAt = this.time.now + SKIP_GRACE_MS;
    this.input.on('pointerdown', () => {
      if (this.time.now >= this.skippableAt) this.finish();
    });

    this.slideIn(() => {
      this.time.delayedCall(HOLD_BEFORE_FIRST_BEAT_MS, () => {
        this.playBeat(this.overlayData.result.attack, () => {
          const counter = this.overlayData.result.counter;
          if (!counter) {
            this.time.delayedCall(HOLD_AFTER_LAST_BEAT_MS, () => this.finish());
            return;
          }
          this.time.delayedCall(BEAT_GAP_MS, () => {
            this.playBeat(counter, () => this.time.delayedCall(HOLD_AFTER_LAST_BEAT_MS, () => this.finish()));
          });
        });
      });
    });
  }

  /** A horizon band and ground line, so the two fighters read as standing somewhere rather than floating on a flat backdrop. No real battle-background art exists yet (ART_BRIEF.md) — this is deliberately plain rather than a placeholder pretending to be scenery. */
  private drawStage(): void {
    const gfx = this.add.graphics();
    gfx.fillStyle(0x161a28, 1);
    gfx.fillRect(0, GROUND_Y - 250, LOGICAL_WIDTH, 250);
    gfx.fillStyle(0x10131e, 1);
    gfx.fillRect(0, GROUND_Y, LOGICAL_WIDTH, 130);
    gfx.lineStyle(2, 0x3a4258, 1);
    gfx.lineBetween(0, GROUND_Y, LOGICAL_WIDTH, GROUND_Y);
  }

  private buildFighter(unit: Unit, hpBefore: number, homeX: number, offscreenX: number, lungeSign: 1 | -1): Fighter {
    const root = this.add.container(offscreenX, GROUND_Y);

    let sprite: GameObjects.Sprite | null = null;
    let image: GameObjects.Image | null = null;
    let circle: GameObjects.Arc | null = null;

    if (isAnimatedHero(unit.name)) {
      sprite = this.add
        .sprite(0, 0, heroIdleRunAtlasKey(unit.name), 'idle-0')
        .setOrigin(0.5, 1)
        .setScale(FIGHTER_HEIGHT / ANIM_REFERENCE_FRAME_HEIGHT);
      sprite.play(LUFFY_ANIM_IDLE);
      sprite.setFlipX(luffyFlipX(lungeSign === 1));
      root.add(sprite);
    } else {
      const textureKey = resolveBattlePortraitTexture(this, unit);
      if (textureKey) {
        image = this.add.image(0, 0, textureKey).setOrigin(0.5, 1);
        const fit = FIGHTER_HEIGHT / image.height;
        image.setScale(fit);
        image.setFlipX(artFlipX(STATIC_ART_FACES_RIGHT, lungeSign === 1));
        root.add(image);
      } else {
        circle = this.add.circle(0, -FIGHTER_HEIGHT / 2, FIGHTER_HEIGHT * 0.32, unit.team === 'enemy' ? 0xd9534f : 0x4a90d9).setStrokeStyle(3, 0x000000, 0.4);
        const letter = this.add
          .text(0, -FIGHTER_HEIGHT / 2, CLASS_LETTER[unit.className] ?? '?', {
            fontFamily: FONT_FAMILY,
            fontSize: '34px',
            fontStyle: 'bold',
            color: '#ffffff',
            resolution: DPR,
          })
          .setOrigin(0.5);
        root.add([circle, letter]);
      }
    }

    const accent = unit.team === 'enemy' ? TEAM_NAME_COLOR.enemy : TEAM_NAME_COLOR.player;
    this.add
      .text(homeX, PANEL_TOP_Y, unit.name, { fontFamily: FONT_FAMILY, fontSize: '16px', fontStyle: 'bold', color: accent, resolution: DPR })
      .setOrigin(0.5);
    this.add
      .text(homeX, PANEL_TOP_Y + 22, unit.className, { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textDisabled, resolution: DPR })
      .setOrigin(0.5);

    const barY = PANEL_TOP_Y + 50;
    this.add.rectangle(homeX, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, 0x000000, 0.55).setStrokeStyle(1, 0x0a0d14, 0.9);
    const hpFill = this.add
      .rectangle(homeX - HP_BAR_WIDTH / 2, barY, HP_BAR_WIDTH * this.hpRatio(hpBefore, unit.maxHp), HP_BAR_HEIGHT, this.hpColor(hpBefore / unit.maxHp))
      .setOrigin(0, 0.5);
    const hpText = this.add
      .text(homeX, barY, `${hpBefore}/${unit.maxHp}`, {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: DPR,
      })
      .setOrigin(0.5);

    return { unit, root, sprite, image, circle, homeX, offscreenX, lungeSign, faceRight: lungeSign === 1, hp: hpBefore, hpFill, hpText };
  }

  private hpRatio(hp: number, maxHp: number): number {
    return Math.max(0, Math.min(1, hp / maxHp));
  }

  private hpColor(ratio: number): number {
    return ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
  }

  private slideIn(onDone: () => void): void {
    let landed = 0;
    const oneLanded = () => {
      landed += 1;
      if (landed === 2) onDone();
    };
    for (const fighter of [this.left, this.right]) {
      this.tweens.add({ targets: fighter.root, x: fighter.homeX, duration: SLIDE_MS, ease: 'Back.easeOut', onComplete: oneLanded });
    }
  }

  private fighterFor(unitId: string): Fighter {
    return this.left.unit.id === unitId ? this.left : this.right;
  }

  /**
   * One swing. The attacking side animates (its real attack animation, or a
   * lunge for a unit without one) and the defending side reacts at the moment
   * of impact — which for an animated attacker is pinned to the punch's own
   * landing frame (`LUFFY_ATTACK_IMPACT_FRAME`) rather than a guessed delay,
   * so retuning that animation's per-frame timing can't silently desync the
   * hit reaction from the visible hit.
   */
  private playBeat(beat: CombatBeat, onDone: () => void): void {
    const attacker = this.fighterFor(beat.attackerId);
    const defender = this.fighterFor(beat.defenderId);
    let landed = false;
    const impact = () => {
      if (landed) return;
      landed = true;
      this.applyImpact(beat, defender);
    };

    if (attacker.sprite) {
      const sprite = attacker.sprite;
      const onFrame = (_anim: unknown, frame: { textureFrame: string }) => {
        if (frame.textureFrame === LUFFY_ATTACK_IMPACT_FRAME) impact();
      };
      sprite.on('animationupdate', onFrame);
      sprite.once('animationcomplete', () => {
        sprite.off('animationupdate', onFrame);
        // Whatever happened to frame timing, the beat never resolves without
        // its hit reaction having played.
        impact();
        sprite.play(LUFFY_ANIM_IDLE);
        sprite.setFlipX(luffyFlipX(attacker.faceRight));
        onDone();
      });
      sprite.setFlipX(luffyFlipX(attacker.faceRight));
      sprite.play(LUFFY_ANIM_ATTACK);
      return;
    }

    this.tweens.add({
      targets: attacker.root,
      x: attacker.homeX + attacker.lungeSign * 62,
      duration: LUNGE_MS,
      ease: 'Quad.easeOut',
      yoyo: true,
      onYoyo: impact,
      onComplete: onDone,
    });
  }

  private applyImpact(beat: CombatBeat, defender: Fighter): void {
    if (!beat.hit) {
      this.floatText(defender.homeX, GROUND_Y - FIGHTER_HEIGHT - 10, 'Miss', '#a0a8c0');
      this.tweens.add({
        targets: defender.root,
        x: defender.homeX - defender.lungeSign * 26,
        duration: 110,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
      return;
    }

    if (beat.crit) this.floatText(defender.homeX, GROUND_Y - FIGHTER_HEIGHT - 34, 'CRIT!', '#f0ad4e');
    this.floatText(defender.homeX, GROUND_Y - FIGHTER_HEIGHT - 10, `-${beat.damage}`, '#ff6b6b');
    this.flashFighter(defender);
    this.burst(defender.homeX, GROUND_Y - FIGHTER_HEIGHT / 2, beat.crit ? 0xf0ad4e : 0xff6b6b, beat.crit ? 26 : 10);
    this.cameras.main.shake(beat.crit ? 220 : 120, beat.crit ? 0.016 : 0.007);
    this.setFighterHp(defender, defender.hp - beat.damage, true);
  }

  /** Drains (or, on a skip, snaps) a side's HP bar, keeping the number label and the bar's traffic-light color in step with the width. */
  private setFighterHp(fighter: Fighter, hp: number, animate: boolean): void {
    const next = Math.max(0, hp);
    const from = fighter.hp;
    fighter.hp = next;
    const maxHp = fighter.unit.maxHp;

    if (!animate) {
      fighter.hpFill.width = HP_BAR_WIDTH * this.hpRatio(next, maxHp);
      fighter.hpFill.fillColor = this.hpColor(next / maxHp);
      fighter.hpText.setText(`${next}/${maxHp}`);
      return;
    }

    const proxy = { hp: from };
    this.tweens.add({
      targets: proxy,
      hp: next,
      duration: HP_DRAIN_MS,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const shown = Math.round(proxy.hp);
        fighter.hpFill.width = HP_BAR_WIDTH * this.hpRatio(proxy.hp, maxHp);
        fighter.hpFill.fillColor = this.hpColor(proxy.hp / maxHp);
        fighter.hpText.setText(`${shown}/${maxHp}`);
      },
    });
  }

  /** Same FILL-mode tint UnitSprite uses for a hit, across whichever of the three visual modes this fighter is in. */
  private flashFighter(fighter: Fighter): void {
    const art = fighter.sprite ?? fighter.image;
    if (art) {
      art.setTintMode(TintModes.FILL).setTint(0xffffff);
      this.time.delayedCall(HIT_FLASH_MS, () => art.clearTint());
      return;
    }
    if (!fighter.circle) return;
    const circle = fighter.circle;
    const original = circle.fillColor;
    circle.setFillStyle(0xffffff);
    this.time.delayedCall(HIT_FLASH_MS, () => circle.setFillStyle(original));
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '26px',
        fontStyle: 'bold',
        color,
        stroke: '#000000',
        strokeThickness: 5,
        resolution: DPR,
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: label, y: y - 46, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
  }

  private burst(x: number, y: number, color: number, count: number): void {
    const emitter = this.add.particles(x, y, '__WHITE', {
      speed: { min: 90, max: 220 },
      scale: { start: 0.9, end: 0 },
      lifespan: 320,
      tint: color,
      emitting: false,
    });
    emitter.explode(count);
    this.time.delayedCall(400, () => emitter.destroy());
  }

  /**
   * Ends the cut-in — either naturally or from a skip tap. Everything
   * in-flight is cancelled and both bars jump to the units' real
   * post-combat HP, so a skip can never leave a bar showing a value the
   * board is about to contradict.
   */
  private finish(): void {
    if (this.finishing) return;
    this.finishing = true;

    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const fighter of [this.left, this.right]) this.setFighterHp(fighter, fighter.unit.hp, false);

    this.tweens.add({
      targets: [this.left.root, this.right.root],
      x: (target: GameObjects.Container) => (target === this.left.root ? this.left.offscreenX : this.right.offscreenX),
      duration: SLIDE_MS,
      ease: 'Back.easeIn',
      onComplete: () => {
        const done = this.overlayData.onComplete;
        this.setUnderlyingInputEnabled(true);
        this.scene.stop();
        done();
      },
    });
  }

  private setUnderlyingInputEnabled(enabled: boolean): void {
    for (const key of ['Tactical', 'UI']) {
      const scene = this.scene.get(key);
      if (scene?.input) scene.input.enabled = enabled;
    }
  }
}
