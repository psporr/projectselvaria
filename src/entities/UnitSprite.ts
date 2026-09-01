import { Filters, GameObjects, Scene, TintModes } from 'phaser';
import type { Unit } from '../game/types';
import { DPR } from '../systems/viewport';
import { CLASS_LETTER } from '../ui/classIcons';
import { enemyClassTextureKeyFor, heroAnimAtlasKey, heroTextureKey, isAnimatedHero } from '../ui/heroArt';
import { HERO_ATTACK_FRAME, heroAnimScale, heroFlipX, heroIdleMapAnimKey } from '../ui/heroAnimations';
import { FONT_FAMILY } from '../ui/kit';

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };
/** Neutral gray a spent unit's color blends toward — classic FE "grayed out, already acted" convention. */
const ACTED_GRAY = 0x6b7280;
const ACTED_BLEND = 0.55;
/** How long flash()'s hit-tint holds before reverting. */
const HIT_FLASH_ALPHA_DURATION_MS = 160;
/** The on-board display height an animated hero's sprite is scaled to — matches everyone else's `tileSize*0.92` art footprint, not its own raw pixel size. `heroAnimScale()` reads the actual loaded frame height at construction time rather than a hand-tuned constant, since `extractAseprite.ts` now guarantees a stable frame size per hero but that size differs hero to hero. */
const ANIM_DISPLAY_HEIGHT_FACTOR = 0.92;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Blends `color` toward `target` by `amount` (0 = color, 1 = target). */
function blendToward(color: number, target: number, amount: number): number {
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;
  const r2 = (target >> 16) & 0xff;
  const g2 = (target >> 8) & 0xff;
  const b2 = target & 0xff;
  const r = Math.round(r1 + (r2 - r1) * amount);
  const g = Math.round(g1 + (g2 - g1) * amount);
  const b = Math.round(b1 + (b2 - b1) * amount);
  return (r << 16) | (g << 8) | b;
}

/**
 * A view of a Unit — owns no truth, just renders whatever the last sync()
 * gave it. TacticalScene is the only thing that reads game state; this only
 * ever gets told what to show (HANDOFF.md §5/§7).
 *
 * Three render modes, chosen once at construction (a unit's name/art doesn't
 * change mid-match): an animated hero (`heroArt.ts`'s `ANIMATED_HERO_NAMES`)
 * gets a `Sprite` playing its idle loop, swapped to a held attack pose for a
 * combat lunge (`playAttackPose()`/`resumeIdlePose()`) instead of a static
 * image; failing that, a named hero with real static art (`HERO_SPRITE_NAMES`)
 * gets that PNG; an enemy with no
 * name match falls back to anonymous class art (`ENEMY_ART_CLASSES`) if its
 * class has any (2026-08-26); everyone else — a player unit with no hero
 * art, or an enemy whose class has none — keeps the original
 * colored-circle-plus-class-letter placeholder. All three art-bearing modes
 * share the HP bar but render "acted" differently: the circle blends its
 * flat fill toward gray, while the two art modes toggle a live GPU
 * grayscale filter (`enableFilters()` + `filters.internal.addColorMatrix()`,
 * Phaser 4's renamed successor to Phaser 3's per-object FX — see
 * `Display.ColorMatrix.grayscale()`) on and off via the filter
 * controller's own `active` flag — no second baked texture per hero
 * (2026-08-26; an earlier version baked one via canvas pixel manipulation,
 * which worked but doubled every hero's texture memory for no reason once
 * this turned out to be a one-line built-in). Every mode stays at full
 * alpha either way — dimming used to fade alpha instead, which read as
 * "faded out" rather than "spent," and made an acted unit harder to spot
 * on a busy board.
 *
 * The animated mode deliberately centers on the tile (`setOrigin(0.5,
 * 0.5)`) rather than the bottom-anchored `setOrigin(0.5, 1)`
 * SpriteTestScene's standalone viewer uses — this board draws every unit
 * (circle, static portrait, or animated sprite) centered in its tile, and
 * matching that here keeps an animated hero visually level with its
 * teammates instead of looking like it's standing at the tile's bottom
 * edge. That's safe because `extractAseprite.ts` crops every frame (idle
 * and attack alike) to one shared union-bounds rect: with every frame the
 * same size, a center-anchored origin and the viewer's bottom-anchored one
 * differ by a constant offset and nothing else — no per-frame bob.
 *
 * It plays `heroIdleMapAnimKey()`, not the viewer's plain idle loop: same
 * frames, yoyo'd and slower, because a raw loop's snap back to frame 0 can
 * still read as a tiny bounce at this size. See that function's own doc
 * comment in heroAnimations.ts.
 */
export class UnitSprite extends GameObjects.Container {
  private readonly circle: GameObjects.Arc | null;
  private readonly portrait: GameObjects.Image | null;
  /** The grayscale filter controller for `portrait` — null in circle/animated mode. Toggling `.active` is a live GPU effect, not a texture swap, so there's nothing to pre-generate or cache. */
  private readonly portraitGrayscale: Filters.ColorMatrix | null;
  /** Animated-hero mode (`isAnimatedHero`) — null for every other unit. */
  private readonly animSprite: GameObjects.Sprite | null;
  /** Same grayscale-filter approach as portraitGrayscale, for animSprite. */
  private readonly animGrayscale: Filters.ColorMatrix | null;
  /** `heroIdleMapAnimKey(unit.name)` — cached so `resumeIdlePose()` doesn't need the unit's name passed back in. Null outside animated mode. */
  private readonly idleAnimKey: string | null;
  private readonly hpBar: GameObjects.Rectangle;
  private readonly hpBarWidth: number;
  private readonly baseColor: number;
  private readonly actedColor: number;
  /** Whatever sync() last set the circle's fill to — flash() reverts here instead of always baseColor, so a hit on an already-acted (dimmed) unit doesn't briefly un-dim it. Unused in art mode (flash() there tints instead). */
  private currentFill: number;

  constructor(scene: Scene, x: number, y: number, tileSize: number, unit: Unit, dimmed: boolean) {
    super(scene, x, y);
    this.hpBarWidth = tileSize * 0.7;
    this.baseColor = TEAM_COLOR[unit.team];
    this.actedColor = blendToward(this.baseColor, ACTED_GRAY, ACTED_BLEND);
    this.currentFill = this.baseColor;

    const radius = tileSize * 0.32;
    const animated = isAnimatedHero(unit.name);
    const heroKey = heroTextureKey(unit.name);
    // Class-fallback art is enemy-only — a player unit with no hero art of
    // its own stays the circle+letter placeholder rather than borrowing the
    // anonymous enemy skin for its class.
    const enemyKey = unit.team === 'enemy' ? (enemyClassTextureKeyFor(unit.className, unit.id) ?? heroKey) : heroKey;
    const textureKey = scene.textures.exists(heroKey) ? heroKey : enemyKey;
    const hasArt = !animated && scene.textures.exists(textureKey);

    const visuals: GameObjects.GameObject[] = [];
    if (animated) {
      this.circle = null;
      this.portrait = null;
      this.portraitGrayscale = null;
      this.idleAnimKey = heroIdleMapAnimKey(unit.name);
      const animScale = heroAnimScale(scene, unit.name, tileSize * ANIM_DISPLAY_HEIGHT_FACTOR);
      this.animSprite = scene.add.sprite(0, 0, heroAnimAtlasKey(unit.name), 'idle-0').setOrigin(0.5, 0.5).setScale(animScale);
      this.animSprite.play(this.idleAnimKey);
      this.animSprite.enableFilters();
      this.animGrayscale = this.animSprite.filters!.internal.addColorMatrix();
      this.animGrayscale.colorMatrix.grayscale(1);
      this.animGrayscale.active = false;
      visuals.push(this.animSprite);
    } else if (hasArt) {
      this.circle = null;
      this.animSprite = null;
      this.animGrayscale = null;
      this.idleAnimKey = null;
      this.portrait = scene.add.image(0, 0, textureKey).setDisplaySize(tileSize * 0.92, tileSize * 0.92);
      this.portrait.enableFilters();
      this.portraitGrayscale = this.portrait.filters!.internal.addColorMatrix();
      this.portraitGrayscale.colorMatrix.grayscale(1);
      this.portraitGrayscale.active = false;
      visuals.push(this.portrait);
    } else {
      this.portrait = null;
      this.portraitGrayscale = null;
      this.animSprite = null;
      this.animGrayscale = null;
      this.idleAnimKey = null;
      this.circle = scene.add.circle(0, 0, radius, this.baseColor).setStrokeStyle(2, 0x000000, 0.4);
      const label = scene.add
        .text(0, 0, CLASS_LETTER[unit.className] ?? '?', {
          fontFamily: FONT_FAMILY,
          fontSize: `${Math.round(tileSize * 0.28)}px`,
          color: '#ffffff',
          resolution: DPR,
        })
        .setOrigin(0.5);
      visuals.push(this.circle, label);
    }

    // Stroked so the bar keeps a visible edge over image-backed maps whose
    // grass art can run close to the fill's own green (0x5cb85c) — without
    // an outline a near-full-HP bar could nearly vanish into a green tile.
    const hpBarBg = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x000000, 0.6).setStrokeStyle(1, 0x000000, 0.9);
    this.hpBar = scene.add.rectangle(0, -radius - 8, this.hpBarWidth, 5, 0x5cb85c);
    // Enemy HP bars get their own border, on top of hpBarBg's — a fixed red
    // fill (see sync()) reads as "this is an enemy" at a glance even before
    // the eye gets to HP amount, and the extra outline keeps that fill
    // visibly separated from hpBarBg's own dark backing at a full/near-full
    // bar, the same legibility reasoning as hpBarBg's own stroke above.
    if (unit.team === 'enemy') this.hpBar.setStrokeStyle(1, 0x5a0d0d, 1);

    this.add([...visuals, hpBarBg, this.hpBar]);
    scene.add.existing(this);

    this.sync(unit, dimmed);
  }

  /**
   * Reconciles this sprite's look to the given unit's current state. Never
   * mutates it. `dimmed` is the caller's call, not derived from
   * `unit.hasActed` alone — that flag only resets at the start of *that
   * unit's own* team's turn (game.ts's turn.onBegin), so an enemy unit
   * stays `hasActed: true` for the player's *entire* turn (it doesn't reset
   * until the enemy's own next turn begins). Dimming off the raw flag made
   * every enemy look "already acted" throughout the player's whole phase.
   * TacticalScene decides `dimmed` by also checking whose turn it is.
   */
  sync(unit: Unit, dimmed: boolean): void {
    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpBar.width = this.hpBarWidth * ratio;
    // Enemy HP bars are always red (team-colored, not HP-ratio-colored) —
    // a player unit's bar still traffic-lights green/orange/red by HP so a
    // wounded ally stands out, but an enemy's bar reads as "enemy" first.
    this.hpBar.fillColor = unit.team === 'enemy' ? 0xd9534f : ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;

    if (this.animSprite) {
      this.animGrayscale!.active = dimmed;
      return;
    }

    if (this.portrait) {
      // Toggles the live grayscale filter rather than fading alpha — see
      // the class doc comment on why.
      this.portraitGrayscale!.active = dimmed;
      return;
    }

    // A spent unit desaturates toward gray, at full opacity — the color
    // blend makes "already acted" unambiguous at a glance, the standard
    // Fire Emblem convention, without also fading the unit out.
    this.currentFill = dimmed ? this.actedColor : this.baseColor;
    this.circle!.setFillStyle(this.currentFill);
  }

  /** Brief flash to draw the eye to a unit that was just hit — `setFillStyle` for the placeholder circle, a FILL-mode tint for real art (Phaser 4 replaced `setTintFill(color)` with `setTint(color).setTintMode(FILL)`: repaints every opaque pixel solid `color` while keeping the sprite's own alpha/shape, so it reads the same way regardless of acted-dim state). */
  flash(color: number): void {
    if (this.animSprite) {
      this.animSprite.setTintMode(TintModes.FILL).setTint(color);
      this.scene.time.delayedCall(HIT_FLASH_ALPHA_DURATION_MS, () => this.animSprite!.clearTint());
      return;
    }
    if (this.portrait) {
      this.portrait.setTintMode(TintModes.FILL).setTint(color);
      this.scene.time.delayedCall(HIT_FLASH_ALPHA_DURATION_MS, () => this.portrait!.clearTint());
      return;
    }
    this.circle!.setFillStyle(color);
    this.scene.time.delayedCall(HIT_FLASH_ALPHA_DURATION_MS, () => this.circle!.setFillStyle(this.currentFill));
  }

  /**
   * Tweens this sprite to a new board position — the one place TacticalScene
   * should move a unit's sprite, so every movement (a confirmed move, the
   * pre-confirm preview, a cancel snap-back, enemy AI stepping) shares one
   * implementation instead of four copies of the same tween.
   *
   * Deliberately does NOT switch animation (2026-08-31, per the repo owner
   * after seeing it live): an animated hero briefly played a run loop for
   * the tween's duration, which read badly — at this sprite's on-board size
   * a 150-180ms tween is a fraction of one 600ms run cycle, so it registered
   * as a twitch rather than a stride. On-board sprites hold their idle loop
   * through a move; see `playAttackPose()` below for the one on-board
   * moment that does change what's showing.
   */
  walkTo(px: number, py: number, duration: number, onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this,
      x: px,
      y: py,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => onComplete?.(),
    });
  }

  /**
   * Swaps an animated hero to its held attack pose, facing `faceRight` —
   * meant to be called right as `TacticalScene.playCombatSequence()` starts
   * its lunge tween, so the pose reads as the moment of the swing rather
   * than an idle character being flung forward. A single-frame pose swap
   * (not a played animation, per `heroAnimations.ts`'s doc comment) is
   * cheap enough to show on-board where a full run/attack cycle wasn't —
   * there's no cycle to run out of sync with a 130ms tween. No-op outside
   * animated mode (a static portrait or the placeholder circle has no
   * separate attack pose).
   */
  playAttackPose(faceRight: boolean): void {
    if (!this.animSprite) return;
    this.animSprite.anims.stop();
    this.animSprite.setFrame(HERO_ATTACK_FRAME);
    this.animSprite.setFlipX(heroFlipX(faceRight));
  }

  /** Reverts `playAttackPose()` back to the idle loop, unflipped — pair the two calls around one lunge. No-op outside animated mode. */
  resumeIdlePose(): void {
    if (!this.animSprite || !this.idleAnimKey) return;
    this.animSprite.setFlipX(false);
    this.animSprite.play(this.idleAnimKey);
  }
}
