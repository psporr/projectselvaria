import { Filters, GameObjects, Scene, TintModes } from 'phaser';
import type { Unit } from '../game/types';
import { DPR } from '../systems/viewport';
import { CLASS_LETTER } from '../ui/classIcons';
import { enemyClassTextureKeyFor, heroIdleRunAtlasKey, heroTextureKey, isAnimatedHero } from '../ui/heroArt';
import { LUFFY_ANIM_ATTACK, LUFFY_ANIM_IDLE, LUFFY_ANIM_RUN } from '../ui/heroAnimations';
import { FONT_FAMILY } from '../ui/kit';

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };
/** Neutral gray a spent unit's color blends toward — classic FE "grayed out, already acted" convention. */
const ACTED_GRAY = 0x6b7280;
const ACTED_BLEND = 0.55;
/** How long flash()'s hit-tint holds before reverting. */
const HIT_FLASH_ALPHA_DURATION_MS = 160;
/** Roughly the idle sheet's average frame height (43-48px across idle-0..3) — animScale below is sized off this so an animated hero reads at about the same visual footprint as everyone else's tileSize*0.92 art, not its own raw pixel size. */
const ANIM_REFERENCE_FRAME_HEIGHT = 45;

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
 * change mid-match): an animated hero (`heroArt.ts`'s `ANIMATED_HERO_NAMES`,
 * 2026-08-31 — currently just Luffy) gets a `Sprite` playing idle/run/attack
 * frame animations instead of a static image; failing that, a named hero
 * with real static art (`HERO_SPRITE_NAMES`) gets that PNG; an enemy with no
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
 * matching that here keeps a Luffy visually level with its teammates
 * instead of looking like it's standing at the tile's bottom edge. The
 * tradeoff: unlike the viewer's ground-line-verified foot anchor, a frame
 * whose height differs a lot from `ANIM_REFERENCE_FRAME_HEIGHT` (the
 * attack sheet's frames go up to 84x54px, vs idle's ~30x45px) will wobble
 * vertically a little rather than keep its feet pinned — acceptable for a
 * small on-board sprite, not something SpriteTestScene's much larger,
 * feet-focused view could get away with.
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
      const animScale = (tileSize * 0.92) / ANIM_REFERENCE_FRAME_HEIGHT;
      this.animSprite = scene.add.sprite(0, 0, heroIdleRunAtlasKey(unit.name), 'idle-0').setOrigin(0.5, 0.5).setScale(animScale);
      this.animSprite.play(LUFFY_ANIM_IDLE);
      this.animSprite.enableFilters();
      this.animGrayscale = this.animSprite.filters!.internal.addColorMatrix();
      this.animGrayscale.colorMatrix.grayscale(1);
      this.animGrayscale.active = false;
      visuals.push(this.animSprite);
    } else if (hasArt) {
      this.circle = null;
      this.animSprite = null;
      this.animGrayscale = null;
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

  /** Switches to the run loop — TacticalScene calls this around a movement tween (see walkTo()) so a unit actually looks like it's walking instead of sliding in its idle pose. No-op for a non-animated unit. */
  playRun(): void {
    this.animSprite?.play(LUFFY_ANIM_RUN);
  }

  /** Back to the idle loop — the default look, and where a movement tween or an attack leaves off. No-op for a non-animated unit. */
  playIdle(): void {
    this.animSprite?.play(LUFFY_ANIM_IDLE);
  }

  /**
   * Plays the attack animation once (its own default `repeat: 0` —
   * `heroAnimations.ts`'s SpriteTestScene-only viewer is what asks for a
   * continuous loop, not this) and calls `onComplete` when it finishes. A
   * no-op that calls `onComplete` immediately for a non-animated unit, so a
   * caller can always await it the same way regardless of which unit
   * attacked.
   */
  playAttack(onComplete: () => void): void {
    if (!this.animSprite) {
      onComplete();
      return;
    }
    this.animSprite.once('animationcomplete', onComplete);
    this.animSprite.play(LUFFY_ANIM_ATTACK);
  }

  /**
   * Tweens this sprite to a new board position, playing the run loop for
   * the duration (idle again once it lands) — the one place TacticalScene
   * should move a unit's sprite, so every movement (a confirmed move, the
   * pre-confirm preview, a cancel snap-back, enemy AI stepping) gets the
   * same animation switch instead of each call site remembering to do it.
   * No-op animation switch for a non-animated unit (playRun/playIdle are
   * themselves no-ops there).
   */
  walkTo(px: number, py: number, duration: number, onComplete?: () => void): void {
    this.playRun();
    this.scene.tweens.add({
      targets: this,
      x: px,
      y: py,
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.playIdle();
        onComplete?.();
      },
    });
  }
}
