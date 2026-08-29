import { GameObjects, Scene, Time, Tweens } from 'phaser';

import { BLESSINGS, type Blessing } from '../game/blessings';
import { decideAction } from '../game/ai';
import { canPromote, PROMOTES_TO } from '../game/classes';
import { forecastCombat } from '../game/combat';
import { computeReachable, computeThreatTiles, quickAttackPositions, targetsFrom, terrainAt, tileKey, unitsOf } from '../game/grid';
import { ITEMS } from '../game/equipment';
import { CAMPAIGN_CHAPTERS, TEST_MAP_2, type CampaignCarryOver, type ChapterDef } from '../game/maps';
import { saveCampaign, clearCampaignSave } from '../game/save';
import { canUseSkill, describeSkillEffect, novaBlastCoords, skillTargets, SKILLS, type SkillDef } from '../game/skills';
import { isTriggerMet, type MapEvent } from '../game/story';
import { TERRAIN, teamOf, type CombatBeat, type CombatResult, type GameMode, type GameState, type Team, type Unit } from '../game/types';
import { UnitSprite } from '../entities/UnitSprite';
import { createGameClient, type GameClient } from '../systems/gameClient';
import { browserStorage } from '../systems/storage';
import { applyDprZoom, DPR, LOGICAL_WIDTH } from '../systems/viewport';
import type { ActionMenuChoice, ActionMenuOption } from '../ui/ActionMenu';
import type { SystemMenuChoice, SystemMenuOption } from '../ui/SystemMenu';
import type { PromotionCandidate } from '../ui/PromotionPicker';
import {
  heroSpriteBasename,
  heroTextureKey,
  HERO_PORTRAIT_NAMES,
  heroPortraitTextureKey,
  HERO_SPRITE_NAMES,
  ENEMY_ART_CLASSES,
  enemyClassSpriteBasenames,
  enemyBasenameTextureKey,
} from '../ui/heroArt';
import { FONT_FAMILY } from '../ui/kit';
import type { UIScene } from './UIScene';

// Sized against main.ts's 480x854 portrait design resolution (HANDOFF.md
// §10) — the ScaleManager (Scale.FIT) handles fitting that to the real
// viewport, this only has to lay out inside the fixed base canvas. Tile size
// isn't a fixed constant: it's computed per-chapter in create() so any
// chapter's board fits the same reserved area, rather than assuming every
// map is CHAPTER_1's 7x8 (previously a hardcoded 64px tile broke down the
// moment a wider/taller chapter — see TEST_MAP_1 — was loaded). The board
// area is BOARD_AREA_WIDTH x BOARD_AREA_HEIGHT starting at (BOARD_ORIGIN_X
// computed to center it, BOARD_ORIGIN_Y). BOARD_AREA_HEIGHT's lower bound
// must stay <= UnitStatusBar's fixed BAR_Y (664) minus half its BAR_HEIGHT
// (180) minus a small gap — that bar sits at a constant position regardless
// of board height (src/ui/UnitStatusBar.ts's own note on this), so a board
// taller than CHAPTER_1's 8 rows must shrink its tiles to still clear it
// rather than running underneath it.
const BOARD_ORIGIN_Y = 56;
const BOARD_AREA_WIDTH = LOGICAL_WIDTH - 2 * 16;
const BOARD_AREA_HEIGHT = 568 - BOARD_ORIGIN_Y;

const TERRAIN_COLOR: Record<string, number> = {
  plain: 0x3a3f4b,
  forest: 0x2d5a3d,
  wall: 0x4a4a4a,
  water: 0x2a5d8a,
};

/**
 * Chapters with a painted background image (proving out the "read terrain
 * off a generated map image" concept — see TEST_MAP_1/TEST_MAP_1_DETAILED
 * in maps.ts) instead of flat terrain-color tiles. Maps chapter id to the
 * image's basename under `public/maps/<basename>.png` — not always the same
 * as the chapter id, since TEST_MAP_1 and TEST_MAP_1_DETAILED are two
 * different terrain readings of the same source image and share one file.
 * Loaded under the `<basename>-bg` texture key.
 */
const CHAPTERS_WITH_BACKGROUND_ART: Record<string, string> = {
  'test-map1': 'test-map1.png',
  'test-map1-detailed': 'test-map1.png',
  'test-map2': 'river1.jpg',
};

const MOVE_HIGHLIGHT = 0x4a90d9;
const TARGET_HIGHLIGHT = 0xd9534f;
const SKILL_HIGHLIGHT = 0xf0ad4e;
const ENEMY_STEP_DELAY_MS = 450;
const BLESSING_DELAY_MS = 700;
/** Gap between an attack beat and its counter beat in playCombatSequence() — long enough to read as two distinct hits, short enough not to drag out every exchange. */
const COMBAT_BEAT_DELAY_MS = 600;

/** Corner-bracket tile cursor — a classic tactics-RPG "you selected this square" reticle, distinct from the flat-color range/target overlays `highlightTiles` paints. See `showTileCursor`'s doc comment for exactly when it appears. */
const CURSOR_COLOR = 0xff5a5a;
const CURSOR_THICKNESS = 3;
/** Fraction of tileSize each bracket arm is inset from the tile's true edge. */
const CURSOR_INSET_RATIO = 0.1;
/** Fraction of tileSize each bracket arm extends along the edge. */
const CURSOR_ARM_RATIO = 0.26;
/** How long the cursor blinks before auto-clearing itself — see showTileCursor's doc comment. */
const CURSOR_LIFETIME_MS = 2000;
/** One blink cycle (dim then back to full) — CURSOR_LIFETIME_MS / this is roughly how many blinks play out. */
const CURSOR_BLINK_HALF_MS = 250;

/**
 * UI interaction mode — the second, separate state machine (HANDOFF.md §7).
 * boardgame.io owns whose turn it is; this only owns what a click does next.
 * Every branch derives its legality from a fresh read of G/ctx rather than
 * trusting its own memory of "am I allowed to click this."
 *
 * A move is held speculatively — 'unit-selected' → 'action-menu' does not
 * dispatch moveUnit yet, only after the player confirms an action, so Cancel
 * never has to undo anything already committed to G (moveUnit has no undo
 * primitive in game.ts). 'action-menu' and 'confirming' are driven by
 * UIScene's own panel buttons/backdrop, so onTileClicked doesn't branch on
 * them — a board tap underneath just does nothing while they're open.
 *
 * 'unit-selected' → 'confirming' is the other route in, skipping
 * 'action-menu'/'awaiting-target' entirely: tapping an enemy directly (the
 * quick-attack cue highlighted in selectUnit()) auto-picks the cheapest
 * reachable tile to strike it from and jumps straight to the attack
 * forecast, same destination-holding rule as above.
 */
type UiMode = 'idle' | 'unit-selected' | 'action-menu' | 'awaiting-target' | 'skill-targeting' | 'confirming';

/**
 * Scene-start data (`MainMenuScene.ts`/`ChapterSelectScene.ts`'s
 * `this.scene.start('Tactical', data)`).
 * Every field is optional and defaults to today's original behavior when
 * omitted entirely — booting with no data at all (BootScene's old direct
 * hand-off, and anything else that doesn't know about chapter selection)
 * still lands on the roguelike default, TEST_MAP_2, unchanged.
 */
export interface TacticalSceneData {
  mode?: GameMode;
  /** Looked up against CAMPAIGN_CHAPTERS when mode is 'campaign'; ignored otherwise. */
  chapterId?: string;
  carryOver?: CampaignCarryOver;
  baseLevel?: number;
}

/**
 * The grid, unit sprites, movement/attack/skill input, and the enemy
 * auto-play loop. Renders entirely from the boardgame.io client's G/ctx and
 * dispatches moves back — it never owns authoritative state (HANDOFF.md
 * §6/§7). HUD text and the interactive panels (action menu, forecast, system menu)
 * live in UIScene; this scene still owns the click-driven state machine and just
 * calls UIScene's show methods with data + callbacks.
 *
 * On-grid combat presentation only (HANDOFF.md §7 phase 1): floating damage
 * numbers and a hit flash, no CombatOverlayScene yet.
 */
export class TacticalScene extends Scene {
  private client!: GameClient;
  private ui!: UIScene;
  /** Computed per-chapter in create() — see BOARD_AREA_WIDTH/HEIGHT's doc comment. */
  private tileSize = 64;
  private boardOriginX = 16;
  private readonly unitSprites = new Map<string, UnitSprite>();
  private readonly highlightRects: GameObjects.Rectangle[] = [];
  private readonly threatRects: GameObjects.Rectangle[] = [];
  /** Corner-bracket reticle on whichever tile the player last tapped — see `showTileCursor`. Null once it's blinked out, been dismissed by a resolved action, or nothing's been tapped yet. */
  private tileCursorGfx: GameObjects.Graphics | null = null;
  private tileCursorBlinkTween: Tweens.Tween | null = null;
  private tileCursorHideTimer: Time.TimerEvent | null = null;
  private threatOverlayVisible = false;
  private lastUnits: Record<string, Unit> = {};

  private mode: UiMode = 'idle';
  private selectedUnitId: string | null = null;
  /** Which of the acting unit's (possibly several) skills is being targeted/confirmed — set in openActionMenu/onActionChosen, read by the skill-targeting flow instead of re-deriving "the" skill from SKILLS[unit.className]. */
  private selectedSkillId: string | null = null;
  /** The tile picked in 'unit-selected', held until an action is confirmed — see UiMode. */
  private pendingDestination: { x: number; y: number } | null = null;
  /** Guards against re-opening the blessing picker on every state change while it's already up. */
  private blessingPickerOpen = false;
  /** Same guard as blessingPickerOpen, for the promotion checklist that can follow it. */
  private promotionPickerOpen = false;
  /** Set by UIScene while a screen not driven by `mode` (the equip screen) is open, so a board tap underneath does nothing. */
  private inputSuspended = false;
  /**
   * Last-seen G.nextItemInstance, used to fire a loot toast exactly once per
   * drop (syncUnits diffs unit.hp the same way). Diffing this rather than
   * G.inventory.length matters: inventory.length also grows when a player
   * unequips gear back into the shared pool (equipItem/unequipItem,
   * game.ts), which would otherwise misfire the toast. nextItemInstance only
   * ever moves in rollDrop (equipment.ts) — a real drop.
   */
  private lastDropCount = 0;
  /** Last-seen G.lastCombat.seq, the same diffing pattern as lastDropCount above — syncUnits() plays a new exchange's attack/counter beats in sequence exactly once. */
  private lastCombatSeq = 0;
  /** ctx.turn of the enemy phase whose opening action we've already handed off to onEnemyPhaseBannerDone() — see scheduleAutoAdvance(). */
  private enemyPhaseIntroDone: number | null = null;
  /** Set in init(), read in create() and re-passed by restartBattle() so a campaign battle restarts the same chapter/carryOver instead of falling back to the roguelike default. */
  private sceneData: TacticalSceneData = {};
  /** How many times each team's phase has begun (1-indexed) — story.ts's `turnReached` trigger needs this and nothing else tracks it; derived from ctx.turn diffs the same way enemyPhaseIntroDone is. */
  private turnCounts: Record<Team, number> = { player: 0, enemy: 0 };
  /** ctx.turn already folded into turnCounts — dedupes the increment the same way enemyPhaseIntroDone dedupes against ctx.turn. */
  private lastCountedTurn: number | null = null;
  /** MapEvent ids whose dialogue has already been shown this battle — presentation-only bookkeeping, deliberately not in GameState (HANDOFF.md §9). */
  private firedStoryEventIds = new Set<string>();
  /** Guards against re-opening a story event's dialogue on every state change while it's already up — same pattern as blessingPickerOpen/promotionPickerOpen. */
  private storyDialogueOpen = false;

  constructor() {
    super('Tactical');
  }

  init(data: TacticalSceneData = {}): void {
    this.sceneData = data;
  }

  preload(): void {
    for (const name of HERO_SPRITE_NAMES) {
      const key = heroTextureKey(name);
      if (!this.textures.exists(key)) this.load.image(key, `units/${heroSpriteBasename(name)}.png`);
    }
    for (const name of HERO_PORTRAIT_NAMES) {
      const key = heroPortraitTextureKey(name);
      if (!this.textures.exists(key)) this.load.image(key, `portrait/${name}.png`);
    }
    for (const className of ENEMY_ART_CLASSES) {
      for (const basename of enemyClassSpriteBasenames(className)) {
        const key = enemyBasenameTextureKey(basename);
        if (!this.textures.exists(key)) this.load.image(key, `enemy/${basename}.png`);
      }
    }
    for (const filename of new Set(Object.values(CHAPTERS_WITH_BACKGROUND_ART))) {
      const key = `${filename}-bg`;
      const imgPath = filename.includes('.') ? `maps/${filename}` : `maps/${filename}.png`;
      if (!this.textures.exists(key)) this.load.image(key, imgPath);
    }
  }

  create() {
    // scene.restart() (restartBattle()) re-runs create() on this SAME Scene
    // instance rather than constructing a fresh one — Phaser only resets its
    // own systems (display list, input, tweens), not this class's own
    // fields. Every mutable field below must be reset here or it silently
    // carries over from the previous game. unitSprites/lastUnits are the
    // dangerous ones: left stale, syncUnits() below finds "existing" sprite
    // entries that Phaser already destroyed on shutdown, then calls
    // UnitSprite.flash() on a dead GameObject (this.scene === undefined),
    // throwing inside Phaser's own scene-boot step and freezing the game —
    // exactly what restartBattle() used to do.
    this.unitSprites.clear();
    this.highlightRects.length = 0;
    this.threatRects.length = 0;
    this.tileCursorGfx = null;
    this.tileCursorBlinkTween = null;
    this.tileCursorHideTimer = null;
    this.threatOverlayVisible = false;
    this.lastUnits = {};
    this.mode = 'idle';
    this.selectedUnitId = null;
    this.selectedSkillId = null;
    this.pendingDestination = null;
    this.blessingPickerOpen = false;
    this.promotionPickerOpen = false;
    this.inputSuspended = false;
    this.enemyPhaseIntroDone = null;
    this.turnCounts = { player: 0, enemy: 0 };
    this.lastCountedTurn = null;
    this.firedStoryEventIds = new Set();
    this.storyDialogueOpen = false;

    const mode: GameMode = this.sceneData.mode ?? 'roguelike';
    const chapter: ChapterDef =
      mode === 'campaign'
        ? (CAMPAIGN_CHAPTERS.find((candidate) => candidate.id === this.sceneData.chapterId) ?? CAMPAIGN_CHAPTERS[0])
        : TEST_MAP_2;
    this.client = createGameClient(mode, chapter, this.sceneData.carryOver, this.sceneData.baseLevel);
    this.cameras.main.setBackgroundColor('#111318');
    applyDprZoom(this);

    const { G } = this.client.getState()!;
    this.tileSize = Math.floor(Math.min(BOARD_AREA_WIDTH / G.width, BOARD_AREA_HEIGHT / G.height));
    this.boardOriginX = Math.round((LOGICAL_WIDTH - G.width * this.tileSize) / 2);

    this.scene.launch('UI', { client: this.client, tactical: this });
    this.ui = this.scene.get('UI') as UIScene;

    this.drawBoard();
    this.syncUnits();
    this.lastDropCount = this.client.getState()!.G.nextItemInstance;
    this.lastCombatSeq = this.client.getState()!.G.lastCombat?.seq ?? 0;

    const unsubscribe = this.client.subscribe(() => this.onStateChange());
    this.events.once('shutdown', unsubscribe);

    if (mode === 'campaign' && chapter.intro && chapter.intro.length > 0) {
      const intro = chapter.intro;
      this.inputSuspended = true;
      // scene.launch() above queues UIScene's own create() rather than running it inline, so
      // this.ui.dialoguePanel doesn't exist yet on this same call stack — wait for UIScene's
      // 'create' event (Phaser's own lifecycle signal) before touching it. Every other this.ui.*
      // use in this file is safe without this because it's driven by later input, by which point
      // both scenes have long since finished their first frame.
      this.ui.events.once('create', () => {
        this.ui.showDialogue(intro, () => {
          this.inputSuspended = false;
          this.scheduleAutoAdvance();
        });
      });
    } else {
      this.scheduleAutoAdvance();
    }
  }

  /** `CAMPAIGN_CHAPTERS.find` by id, shared by every campaign-only lookup (story events, the outro hook) instead of each inlining it — finishCampaignContinue() already did this once before this existed; kept as its own local const there rather than churning an unrelated call site. */
  private lookupCampaignChapter(chapterId: string): ChapterDef | undefined {
    return CAMPAIGN_CHAPTERS.find((candidate) => candidate.id === chapterId);
  }

  private tileCenter(x: number, y: number): { px: number; py: number } {
    return {
      px: this.boardOriginX + x * this.tileSize + this.tileSize / 2,
      py: BOARD_ORIGIN_Y + y * this.tileSize + this.tileSize / 2,
    };
  }

  private drawBoard(): void {
    const { G } = this.client.getState()!;
    const bgFile = CHAPTERS_WITH_BACKGROUND_ART[G.chapterId];
    const hasBackgroundArt = bgFile !== undefined;
    const bgKey = `${bgFile}-bg`;

    if (hasBackgroundArt && this.textures.exists(bgKey)) {
      const boardWidth = G.width * this.tileSize;
      const boardHeight = G.height * this.tileSize;
      this.add
        .image(this.boardOriginX + boardWidth / 2, BOARD_ORIGIN_Y + boardHeight / 2, bgKey)
        .setDisplaySize(boardWidth, boardHeight)
        .setDepth(-1);
    }

    for (let y = 0; y < G.height; y++) {
      for (let x = 0; x < G.width; x++) {
        const terrain = TERRAIN[G.tiles[y][x]];
        const { px, py } = this.tileCenter(x, y);
        // With background art, tiles turn invisible (the painted image is
        // the visual) but keep a faint grid stroke and stay interactive —
        // clicking still needs one hit-testable shape per tile.
        const rect = this.add
          .rectangle(px, py, this.tileSize - 2, this.tileSize - 2, TERRAIN_COLOR[terrain.type], hasBackgroundArt ? 0 : 1)
          .setDepth(0);
        if (hasBackgroundArt) rect.setStrokeStyle(1, 0xffffff, 0.12);
        rect.setInteractive({ useHandCursor: true });
        // Fires on release, not press — matches kit.Button's own convention
        // (pointerdown there is press-feedback only, the actual tap fires on
        // pointerup) so a tile tap and a dock/menu button tap behave the
        // same way instead of one firing early.
        rect.on('pointerup', () => this.onTileClicked(x, y));
      }
    }
  }

  // --- state → view ---------------------------------------------------

  private onStateChange(): void {
    this.syncUnits();
    this.checkForLoot();
    this.refreshThreatOverlay();
    this.scheduleAutoAdvance();
  }

  /** Diffs G.nextItemInstance against the last-seen snapshot (same trick syncUnits uses for HP) rather than adding a "pending drop" field to synced G (HANDOFF.md §9) — see the field comment for why not G.inventory.length. */
  private checkForLoot(): void {
    const { G } = this.client.getState()!;
    for (let i = this.lastDropCount; i < G.nextItemInstance; i++) {
      const item = G.inventory.find((it) => it.instanceId === `item-${i}`);
      this.ui.showLootToast(item ? `Found ${ITEMS[item.defId].name}!` : 'Item found!');
    }
    this.lastDropCount = G.nextItemInstance;
  }

  setInputSuspended(suspended: boolean): void {
    this.inputSuspended = suspended;
  }

  /** Reconciles every unit sprite to G.units, diffing against the last known snapshot for hit feedback. */
  private syncUnits(): void {
    const { G, ctx } = this.client.getState()!;
    const activeTeam = teamOf(ctx.currentPlayer);
    // hasActed only resets at the start of that unit's own team's turn
    // (game.ts's turn.onBegin) — the other team's units still carry
    // whatever hasActed they ended their own last turn with, so dimming
    // must also check it's currently that unit's team's turn (see
    // UnitSprite.sync's doc comment).
    const isDimmed = (unit: Unit) => unit.hasActed && unit.team === activeTeam;
    const seen = new Set<string>();

    // A new attackUnit exchange since the last sync — its attacker/defender
    // get their hit feedback played as a sequence (playCombatSequence,
    // below) instead of the generic instant diff every other HP change
    // (heals, regen, skills) still uses. Sprites for both ids are captured
    // now, before the cleanup pass below can remove a fatal beat's target
    // from this.unitSprites — its sprite is still valid (about to fade
    // out), just no longer in the map by the time playCombatSequence runs.
    const pendingCombat = G.lastCombat && G.lastCombat.seq > this.lastCombatSeq ? G.lastCombat : null;
    const combatUnitIds = pendingCombat ? new Set([pendingCombat.attack.attackerId, pendingCombat.attack.defenderId]) : null;
    const combatSprites = combatUnitIds
      ? new Map([...combatUnitIds].map((id) => [id, this.unitSprites.get(id)] as const))
      : null;

    for (const unit of Object.values(G.units)) {
      seen.add(unit.id);
      const previous = this.lastUnits[unit.id];
      const { px, py } = this.tileCenter(unit.x, unit.y);

      let sprite = this.unitSprites.get(unit.id);
      if (!sprite) {
        sprite = new UnitSprite(this, px, py, this.tileSize, unit, isDimmed(unit));
        sprite.setDepth(2);
        this.unitSprites.set(unit.id, sprite);
      } else {
        if (previous && (previous.x !== unit.x || previous.y !== unit.y)) {
          this.tweens.add({ targets: sprite, x: px, y: py, duration: 180, ease: 'Quad.easeOut' });
        } else {
          sprite.setPosition(px, py);
        }
        sprite.sync(unit, isDimmed(unit));

        if (previous && unit.hp !== previous.hp && !combatUnitIds?.has(unit.id)) {
          if (unit.hp < previous.hp) {
            this.spawnFloatingText(px, py, `-${previous.hp - unit.hp}`, '#ff6b6b');
            sprite.flash(0xffffff);
          } else {
            this.spawnFloatingText(px, py, `+${unit.hp - previous.hp}`, '#7cd992');
          }
        }
      }
    }

    for (const [id, sprite] of this.unitSprites) {
      if (seen.has(id)) continue;
      this.unitSprites.delete(id);
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: 0.4,
        duration: 300,
        onComplete: () => sprite.destroy(),
      });
    }

    if (pendingCombat) {
      this.playCombatSequence(pendingCombat, combatSprites!);
      this.lastCombatSeq = pendingCombat.seq;
    }

    this.lastUnits = Object.fromEntries(Object.values(G.units).map((u) => [u.id, { ...u }]));
  }

  /**
   * Plays a resolved attackUnit exchange's beats in order — the attack
   * first, then (after COMBAT_BEAT_DELAY_MS) the counter, if one happened —
   * instead of both landing as a single instant HP diff the way every other
   * HP change still does. `sprites` is what syncUnits() captured before its
   * own cleanup pass ran; a fatal beat's target is already gone from
   * G.units and this.unitSprites by the time this plays, so its sprite is
   * looked up here rather than in G, and `.scene` is checked before each
   * touch — the same "destroyed GameObject" hazard create()'s own reset
   * block exists to prevent for the *next* battle, just reachable here too
   * since this callback can fire after a mid-sequence restart.
   *
   * Each beat's attacker lunges toward its defender and back (a `yoyo`
   * tween — Phaser fires `onYoyo` exactly at the reversal point, so impact
   * effects land the instant the "swing" reaches its target instead of on a
   * separately-timed guess). A miss still swings — only the outcome at
   * impact differs: a hit flashes/shakes/bursts, a miss just sidesteps the
   * defender. No new art — camera shake/flash are Phaser's own built-in
   * Camera effects, and the impact burst is `__WHITE` (Phaser's built-in
   * 1x1 texture) tinted and scattered, not a sprite sheet.
   */
  private playCombatSequence(result: CombatResult, sprites: Map<string, UnitSprite | undefined>): void {
    const playBeat = (beat: CombatBeat) => {
      const attacker = sprites.get(beat.attackerId);
      const defender = sprites.get(beat.defenderId);
      if (!defender || defender.scene === undefined) return;

      const impact = () => {
        if (defender.scene === undefined) return;
        if (beat.hit) {
          this.spawnFloatingText(defender.x, defender.y, beat.crit ? `-${beat.damage}!` : `-${beat.damage}`, '#ff6b6b');
          defender.flash(0xffffff);
          this.spawnImpactBurst(defender.x, defender.y, beat.crit ? 0xf0ad4e : 0xff6b6b, beat.crit ? 14 : 7);
          if (beat.crit) {
            this.cameras.main.shake(180, 0.012);
            this.cameras.main.flash(120, 240, 90, 60);
          }
        } else {
          this.spawnFloatingText(defender.x, defender.y, 'Miss', '#a0a8c0');
          const stepAway = defender.x <= (attacker?.x ?? defender.x) ? -8 : 8;
          this.tweens.add({ targets: defender, x: defender.x + stepAway, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
        }
      };

      if (attacker && attacker.scene !== undefined && attacker !== defender) {
        const originX = attacker.x;
        const originY = attacker.y;
        this.tweens.add({
          targets: attacker,
          x: originX + (defender.x - originX) * 0.28,
          y: originY + (defender.y - originY) * 0.28,
          duration: 130,
          ease: 'Quad.easeOut',
          yoyo: true,
          onYoyo: impact,
        });
      } else {
        impact();
      }
    };

    playBeat(result.attack);
    if (result.counter) {
      const counter = result.counter;
      this.time.delayedCall(COMBAT_BEAT_DELAY_MS, () => playBeat(counter));
    }
  }

  /** A brief, tinted scatter of Phaser's built-in `__WHITE` texture at the point of impact — no sprite sheet needed, just the one 1x1 texture every Phaser game ships with, scaled/tinted per particle. Self-destroys once its own burst has fully faded. */
  private spawnImpactBurst(x: number, y: number, color: number, count: number): void {
    const emitter = this.add.particles(x, y, '__WHITE', {
      speed: { min: 60, max: 140 },
      scale: { start: 0.5, end: 0 },
      lifespan: 260,
      tint: color,
      emitting: false,
    });
    emitter.setDepth(4);
    emitter.explode(count);
    this.time.delayedCall(320, () => emitter.destroy());
  }

  private spawnFloatingText(x: number, y: number, text: string, colorHex: string): void {
    const floating = this.add
      .text(x, y - this.tileSize * 0.35, text, { fontFamily: FONT_FAMILY, fontSize: '15px', color: colorHex, fontStyle: 'bold', resolution: DPR })
      .setOrigin(0.5)
      .setDepth(3);
    this.tweens.add({
      targets: floating,
      y: floating.y - 24,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => floating.destroy(),
    });
  }

  /**
   * Tweens a unit's sprite to a picked destination as soon as it's picked —
   * before the action menu, before a target is chosen — so the player sees
   * their unit actually standing where they're about to act from, instead
   * of the action menu opening over a sprite that hasn't moved yet. G is
   * untouched here (moveUnit isn't dispatched until the action is confirmed,
   * see UiMode's doc comment); finishSelection() snaps the sprite back to
   * G's real position if the player backs out without confirming.
   */
  private previewMoveTo(unitId: string, x: number, y: number): void {
    const sprite = this.unitSprites.get(unitId);
    if (!sprite) return;
    const { px, py } = this.tileCenter(x, y);
    this.tweens.add({ targets: sprite, x: px, y: py, duration: 180, ease: 'Quad.easeOut' });
  }

  // --- highlights -------------------------------------------------------

  private clearHighlights(): void {
    for (const rect of this.highlightRects.splice(0)) rect.destroy();
  }

  private highlightTiles(coords: Iterable<{ x: number; y: number }>, color: number): void {
    for (const { x, y } of coords) {
      const { px, py } = this.tileCenter(x, y);
      const rect = this.add.rectangle(px, py, this.tileSize - 6, this.tileSize - 6, color, 0.38).setDepth(1);
      this.highlightRects.push(rect);
    }
  }

  /**
   * Draws the corner-bracket cursor on (x, y) — a single-tile reticle
   * marking exactly which square the player last tapped, on top of (not
   * instead of) the flat-color range/target overlays. Called once, in
   * `onTileClicked`, for every tap that reaches this scene (any mode) — it
   * always tracks the tile you're currently looking at (move destination,
   * attack/skill target, an inspected unit or empty tile, ...).
   *
   * Transient rather than persistent (2026-08-25): it blinks for
   * CURSOR_LIFETIME_MS and then clears itself via `hideTileCursor` — a
   * glance cue, not a lasting marker — and `enterAttackConfirm`/
   * `enterSkillConfirm`/`onActionChosen`'s 'wait' branch also clear it
   * early the moment their action actually resolves, since a completed
   * action makes "which tile did I select" moot.
   */
  private showTileCursor(x: number, y: number): void {
    this.hideTileCursor();
    const { px, py } = this.tileCenter(x, y);
    const half = this.tileSize / 2;
    const inset = this.tileSize * CURSOR_INSET_RATIO;
    const arm = this.tileSize * CURSOR_ARM_RATIO;
    const left = px - half + inset;
    const right = px + half - inset;
    const top = py - half + inset;
    const bottom = py + half - inset;

    const g = this.add.graphics().setDepth(1.5);
    g.lineStyle(CURSOR_THICKNESS, CURSOR_COLOR, 1);
    // Each corner: an anchor point plus the direction (dx, dy) its two arms
    // extend in, toward the tile's center.
    const corners: Array<{ cx: number; cy: number; dx: number; dy: number }> = [
      { cx: left, cy: top, dx: 1, dy: 1 },
      { cx: right, cy: top, dx: -1, dy: 1 },
      { cx: left, cy: bottom, dx: 1, dy: -1 },
      { cx: right, cy: bottom, dx: -1, dy: -1 },
    ];
    for (const { cx, cy, dx, dy } of corners) {
      g.lineBetween(cx, cy, cx + dx * arm, cy);
      g.lineBetween(cx, cy, cx, cy + dy * arm);
    }
    this.tileCursorGfx = g;
    this.tileCursorBlinkTween = this.tweens.add({
      targets: g,
      alpha: { from: 1, to: 0.15 },
      duration: CURSOR_BLINK_HALF_MS,
      yoyo: true,
      repeat: -1,
    });
    this.tileCursorHideTimer = this.time.delayedCall(CURSOR_LIFETIME_MS, () => this.hideTileCursor());
  }

  private hideTileCursor(): void {
    this.tileCursorBlinkTween?.stop();
    this.tileCursorBlinkTween = null;
    this.tileCursorHideTimer?.remove();
    this.tileCursorHideTimer = null;
    this.tileCursorGfx?.destroy();
    this.tileCursorGfx = null;
  }

  // --- player input -------------------------------------------------------

  private onTileClicked(x: number, y: number): void {
    if (this.inputSuspended) return;
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;
    // Every gate here reads live state rather than a cached "can I click"
    // flag — G/ctx is the only truth (HANDOFF.md §6).
    if (ctx.gameover || G.awaitingBlessing || teamOf(ctx.currentPlayer) !== 'player') return;

    const unitAtTile = Object.values(G.units).find((u) => u.x === x && u.y === y);
    // Every tap that reaches here moves the cursor — see showTileCursor's
    // doc comment on why this is the one call site for it.
    this.showTileCursor(x, y);

    if (this.mode === 'idle') {
      if (unitAtTile) {
        // Any tapped unit (either team, acted or not) populates the status
        // bar as a side effect — read-only for enemies/already-acted units,
        // which fall through without also entering the move-selection flow.
        this.ui.unitStatusBar.show(unitAtTile, terrainAt(G, unitAtTile.x, unitAtTile.y), unitAtTile.hasActed && unitAtTile.team === teamOf(ctx.currentPlayer));
        if (unitAtTile.team === 'player' && !unitAtTile.hasActed) {
          this.selectUnit(unitAtTile.id);
        }
      } else {
        // An empty tile just shows its terrain in the same panel (see
        // UnitStatusBar.showTerrain) — the system menu moved to being
        // dock-button-only (openSystemMenu's own doc comment).
        this.ui.unitStatusBar.showTerrain(terrainAt(G, x, y));
      }
      return;
    }

    if (this.mode === 'unit-selected') {
      const unit = G.units[this.selectedUnitId!];
      if (!unit) {
        this.finishSelection();
        return;
      }

      const reachable = computeReachable(G, unit);
      if (reachable.has(tileKey(x, y))) {
        this.pendingDestination = { x, y };
        this.previewMoveTo(unit.id, x, y);
        // Refresh against the destination's terrain, not wherever the unit
        // was standing when first selected — the panel's terrain row/+N Def
        // bonus otherwise stayed stuck on the origin tile the whole time
        // the action menu was open, showing a bonus that no longer applies
        // (or missing one that now does) once the unit's actually moving.
        this.ui.unitStatusBar.show(unit, terrainAt(G, x, y), unit.hasActed && unit.team === teamOf(ctx.currentPlayer));
        this.openActionMenu(G, unit);
        return;
      }

      // Any other tapped unit (ally or enemy) refreshes the status bar too —
      // the same "any tap updates it" rule the idle branch above follows.
      // Without this, re-selecting a different ally left the panel showing
      // whichever unit was tapped last instead of the new selection.
      if (unitAtTile) {
        this.ui.unitStatusBar.show(unitAtTile, terrainAt(G, unitAtTile.x, unitAtTile.y), unitAtTile.hasActed && unitAtTile.team === teamOf(ctx.currentPlayer));
      }

      if (unitAtTile && unitAtTile.team === 'enemy') {
        const attackFrom = quickAttackPositions(G, unit, reachable).get(unitAtTile.id);
        if (attackFrom) {
          this.pendingDestination = { x: attackFrom.x, y: attackFrom.y };
          this.previewMoveTo(unit.id, attackFrom.x, attackFrom.y);
          const synthetic: Unit = { ...unit, x: attackFrom.x, y: attackFrom.y };
          this.enterAttackConfirm(G, synthetic, unitAtTile, () => this.cancelQuickAttack(unit.id));
          return;
        }
      }

      if (unitAtTile && unitAtTile.team === 'player' && !unitAtTile.hasActed) {
        this.selectUnit(unitAtTile.id);
        return;
      }

      // If unitAtTile was set, the status bar already refreshed to it just
      // above — finishSelection()'s own default behavior would otherwise
      // clobber that back to the unit we're deselecting, which is exactly
      // backwards from what a tap on a different unit should do.
      this.finishSelection(unitAtTile !== undefined);
      return;
    }

    if (this.mode === 'awaiting-target') {
      const unit = G.units[this.selectedUnitId!];
      const dest = this.pendingDestination;
      if (!unit || !dest) {
        this.finishSelection();
        return;
      }

      const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
      const targetInRange =
        unitAtTile && unitAtTile.team === 'enemy'
          ? targetsFrom(G, synthetic, dest.x, dest.y).some((t) => t.id === unitAtTile.id)
          : false;

      if (targetInRange && unitAtTile) {
        this.enterAttackConfirm(G, synthetic, unitAtTile, () => this.resumeTargeting(unit.id, 'attack'));
      } else {
        this.finishSelection();
      }
      return;
    }

    if (this.mode === 'skill-targeting') {
      const unit = G.units[this.selectedUnitId!];
      const dest = this.pendingDestination;
      if (!unit || !dest) {
        this.finishSelection();
        return;
      }

      const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
      const skill = SKILLS[unit.className].find((candidate) => candidate.id === this.selectedSkillId);
      const validTarget = unitAtTile && skill ? skillTargets(G, synthetic, skill).some((t) => t.id === unitAtTile.id) : false;

      if (validTarget && unitAtTile && skill) {
        this.enterSkillConfirm(G, unit, synthetic, unitAtTile, skill);
      } else {
        this.finishSelection();
      }
      return;
    }

    // 'action-menu' and 'confirming': UIScene's own panel handles input.
  }

  private selectUnit(unitId: string): void {
    this.mode = 'unit-selected';
    this.selectedUnitId = unitId;
    this.pendingDestination = null;
    this.clearHighlights();
    const { G } = this.client.getState()!;
    const unit = G.units[unitId];
    const reachable = computeReachable(G, unit);
    this.highlightTiles(reachable.values(), MOVE_HIGHLIGHT);

    // Quick-attack cue: any enemy strikeable from some reachable tile lights
    // up on its own tile (not just the move-highlighted tiles it never
    // occupies), same red as the manual awaiting-target highlight — tapping
    // it directly skips straight to the attack confirm (see onTileClicked's
    // 'unit-selected' branch) instead of requiring destination-then-menu-
    // then-target, the "quick attack" flow recent Fire Emblem games use.
    const quickTargets = quickAttackPositions(G, unit, reachable);
    const attackableEnemies = Array.from(quickTargets.keys())
      .map((id) => G.units[id])
      .filter((u): u is Unit => u !== undefined);
    this.highlightTiles(attackableEnemies, TARGET_HIGHLIGHT);
  }

  private openActionMenu(G: GameState, unit: Unit): void {
    const dest = this.pendingDestination!;
    const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };

    this.clearHighlights();
    // Attack/Skill only appear at all when there's an actual target in
    // range from this destination — no point offering an action that can
    // never legally be taken from here. A skill with a target but still on
    // cooldown stays visible-but-disabled (canUseSkill), since that's
    // useful information ("could hit something, just not yet"), unlike "no
    // target" which never becomes true this turn regardless of cooldown.
    const options: ActionMenuOption[] = [];
    if (targetsFrom(G, synthetic, dest.x, dest.y).length > 0) {
      options.push({ id: 'attack', label: 'Attack', enabled: true });
    }
    for (const skill of SKILLS[unit.className]) {
      if (skillTargets(G, synthetic, skill).length > 0) {
        options.push({ id: `skill:${skill.id}`, label: skill.name, enabled: canUseSkill(G, synthetic, skill) });
      }
    }
    options.push({ id: 'wait', label: 'Wait', enabled: true }, { id: 'cancel', label: 'Cancel', enabled: true });

    this.mode = 'action-menu';
    const { px, py } = this.tileCenter(dest.x, dest.y);
    this.ui.showActionMenu(options, (choice) => this.onActionChosen(unit, choice), px, py);
  }

  private onActionChosen(unit: Unit, choice: ActionMenuChoice): void {
    const dest = this.pendingDestination;
    if (!dest) {
      this.finishSelection();
      return;
    }
    const { G } = this.client.getState()!;

    if (choice === 'cancel') {
      this.finishSelection();
      return;
    }

    if (choice === 'wait') {
      this.client.moves.moveUnit(unit.id, dest.x, dest.y);
      this.client.moves.waitUnit(unit.id);
      this.hideTileCursor();
      this.finishSelection();
      return;
    }

    if (choice === 'attack') {
      this.beginAttackTargeting(G, unit, dest);
      return;
    }

    // `skill:${skillId}`
    this.beginSkillTargeting(G, unit, dest, choice.slice('skill:'.length));
  }

  private beginAttackTargeting(G: GameState, unit: Unit, dest: { x: number; y: number }): void {
    const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
    this.mode = 'awaiting-target';
    this.clearHighlights();
    this.highlightTiles(
      targetsFrom(G, synthetic, dest.x, dest.y).map((t) => ({ x: t.x, y: t.y })),
      TARGET_HIGHLIGHT,
    );
  }

  private beginSkillTargeting(G: GameState, unit: Unit, dest: { x: number; y: number }, skillId: string): void {
    const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
    const skill = SKILLS[unit.className].find((candidate) => candidate.id === skillId);
    if (!skill) {
      this.finishSelection();
      return;
    }
    this.mode = 'skill-targeting';
    this.selectedSkillId = skillId;
    this.clearHighlights();
    this.highlightTiles(
      skillTargets(G, synthetic, skill).map((t) => ({ x: t.x, y: t.y })),
      SKILL_HIGHLIGHT,
    );
  }

  /** Re-enters targeting for `unitId` off the freshest G, or gives up back to idle if the unit's gone missing (shouldn't happen mid-selection, but G is the only truth). */
  private resumeTargeting(unitId: string, kind: 'attack' | 'skill'): void {
    const state = this.client.getState();
    const dest = this.pendingDestination;
    const unit = state?.G.units[unitId];
    if (!state || !dest || !unit) {
      this.finishSelection();
      return;
    }
    if (kind === 'attack') this.beginAttackTargeting(state.G, unit, dest);
    else if (this.selectedSkillId) this.beginSkillTargeting(state.G, unit, dest, this.selectedSkillId);
    else this.finishSelection();
  }

  /**
   * Cancel from a quick attack's forecast — unlike resumeTargeting (which
   * keeps a deliberately-chosen destination), the quick-attack destination
   * was auto-picked, so canceling should feel like nothing happened: snap
   * the sprite back to its real tile (same idea as finishSelection's own
   * snap-back) and re-enter 'unit-selected' so the move/quick-attack
   * highlights reappear, instead of leaving the unit stranded at a tile the
   * player never chose with only a leftover targeting highlight.
   */
  private cancelQuickAttack(unitId: string): void {
    const unit = this.client.getState()?.G.units[unitId];
    const sprite = this.unitSprites.get(unitId);
    if (unit && sprite) {
      const { px, py } = this.tileCenter(unit.x, unit.y);
      this.tweens.add({ targets: sprite, x: px, y: py, duration: 150, ease: 'Quad.easeOut' });
    }
    if (unit) this.selectUnit(unit.id);
    else this.finishSelection();
  }

  /**
   * `onCancel` differs by entry point: the manual flow (onTileClicked's
   * 'awaiting-target' branch) got here via a destination the player
   * deliberately walked to, so its Cancel re-enters targeting at that same
   * tile (`resumeTargeting`). Quick attack's destination was auto-picked —
   * the player never chose it — so its Cancel needs to undo that pick
   * entirely (`cancelQuickAttack`) rather than treat it as deliberate.
   */
  private enterAttackConfirm(G: GameState, attacker: Unit, defender: Unit, onCancel: () => void): void {
    this.clearHighlights();
    const forecast = forecastCombat(G, attacker, defender);

    this.mode = 'confirming';
    this.ui.showCombatForecast(
      G,
      attacker,
      defender,
      forecast,
      () => {
        const dest = this.pendingDestination!;
        this.client.moves.moveUnit(attacker.id, dest.x, dest.y);
        this.client.moves.attackUnit(attacker.id, defender.id);
        this.hideTileCursor();
        this.finishSelection();
      },
      onCancel,
    );
  }

  private enterSkillConfirm(G: GameState, unit: Unit, synthetic: Unit, target: Unit, skill: SkillDef): void {
    this.clearHighlights();
    // Nova hits a plus-shaped blast, not just the tapped tile — show what it
    // will actually hit before the player commits (skills.ts).
    if (skill.id === 'nova') {
      this.highlightTiles(novaBlastCoords(target), TARGET_HIGHLIGHT);
    }
    const lines = [`${unit.name} uses ${skill.name} on ${target.name}.`, describeSkillEffect(G, synthetic, target, skill)];

    this.mode = 'confirming';
    this.ui.showForecast(
      lines,
      () => {
        const dest = this.pendingDestination!;
        this.client.moves.moveUnit(unit.id, dest.x, dest.y);
        this.client.moves.useSkill(unit.id, skill.id, target.id);
        this.hideTileCursor();
        this.finishSelection();
      },
      () => this.resumeTargeting(unit.id, 'skill'),
    );
  }

  /** Opens the field/system menu (End Turn / Squad / Danger Zone / Restart / Cancel). */
  /**
   * Squad/Danger Zone live on UIScene's bottom dock only — this is the
   * overflow menu for everything else: End Turn (a natural gesture on its
   * own, without needing the dock), Battle Log (moved off the
   * always-visible board screen, see UnitStatusBar's doc comment), and
   * Restart (the one rare, destructive action). Reachable via the dock's
   * own Menu button only (2026-08-25) — an empty-tile tap used to open
   * this too, but now shows that tile's terrain instead
   * (UnitStatusBar.showTerrain, onTileClicked's 'idle' branch).
   */
  openSystemMenu(): void {
    if (this.inputSuspended) return;
    const state = this.client.getState();
    if (!state) return;
    if (this.mode !== 'idle') this.finishSelection();

    const { G, ctx } = state;
    const isPlayerTurn = !ctx.gameover && !G.awaitingBlessing && teamOf(ctx.currentPlayer) === 'player';

    const options: SystemMenuOption[] = [
      { id: 'end-turn', label: 'End Turn', enabled: isPlayerTurn },
      { id: 'log', label: 'Battle Log', enabled: true },
      { id: 'restart', label: 'Restart Battle', enabled: true },
      { id: 'main-menu', label: 'Main Menu', enabled: true },
      { id: 'cancel', label: 'Cancel', enabled: true },
    ];
    this.ui.showSystemMenu(options, (choice) => this.onSystemMenuChosen(choice, G.log));
  }

  private onSystemMenuChosen(choice: SystemMenuChoice, log: string[]): void {
    if (choice === 'end-turn') {
      this.endTurn();
    } else if (choice === 'log') {
      this.ui.showLogPanel(log);
    } else if (choice === 'restart') {
      this.restartBattle();
    } else if (choice === 'main-menu') {
      this.ui.showConfirm('Return to the main menu? This battle\'s progress will be lost.', 'Main Menu', () => this.returnToMainMenu());
    }
  }

  /** Abandons the current battle and returns to the mode-select screen — same scene-teardown pairing `finishCampaignContinue()` uses on a real chapter clear. Gated behind a confirm (`onSystemMenuChosen`'s 'main-menu' branch), unlike Restart Battle, since this one also throws away the in-progress battle with no way back to it at all (Restart at least gets you a fresh attempt at the same fight). */
  private returnToMainMenu(): void {
    this.scene.stop('UI');
    this.scene.start('MainMenu');
  }

  /**
   * Ends the player's phase immediately, passing the turn to the enemy army.
   * Cancels any speculative move and marks all remaining player units as waited.
   */
  endTurn(): void {
    if (this.inputSuspended) return;
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;
    if (ctx.gameover || G.awaitingBlessing || teamOf(ctx.currentPlayer) !== 'player') return;

    this.finishSelection();

    const unacted = unitsOf(G, 'player').filter((u) => !u.hasActed);
    if (unacted.length > 0) {
      for (const unit of unacted) {
        this.client.moves.waitUnit(unit.id);
      }
    } else {
      this.client.events.endTurn?.();
    }
  }

  /** Toggles the danger zone (enemy threat range overlay) on/off. */
  toggleThreatOverlay(): boolean {
    this.threatOverlayVisible = !this.threatOverlayVisible;
    this.refreshThreatOverlay();
    this.ui.refreshHud();
    return this.threatOverlayVisible;
  }

  isThreatOverlayVisible(): boolean {
    return this.threatOverlayVisible;
  }

  private refreshThreatOverlay(): void {
    for (const rect of this.threatRects.splice(0)) rect.destroy();
    if (!this.threatOverlayVisible) return;

    const state = this.client.getState();
    if (!state || state.ctx.gameover) return;
    const { G } = state;

    const threatened = new Set<string>();
    for (const enemy of unitsOf(G, 'enemy')) {
      const reachable = computeReachable(G, enemy);
      const threat = computeThreatTiles(G, enemy, reachable);
      for (const key of threat) threatened.add(key);
    }

    for (const key of threatened) {
      const [x, y] = key.split(',').map(Number);
      const { px, py } = this.tileCenter(x, y);
      const rect = this.add.rectangle(px, py, this.tileSize - 4, this.tileSize - 4, 0xd9534f, 0.28).setDepth(1);
      this.threatRects.push(rect);
    }
  }

  /**
   * Restarts the scene with a fresh game client and cleans up previous
   * state. Re-passes sceneData explicitly — Phaser's scene.restart() with
   * no argument does not automatically re-supply the data init() received
   * the first time, so without this a campaign battle's "Restart Battle"
   * would silently fall back to the roguelike default instead of restarting
   * the same chapter/carryOver.
   */
  restartBattle(): void {
    this.scene.stop('UI');
    this.scene.restart(this.sceneData);
  }

  /**
   * Campaign chapter cleared (UIScene's game-over "Continue"/"Chapter
   * Select" button, campaign-mode branch) — shows the cleared chapter's
   * outro dialogue first if it has one, then builds a CampaignCarryOver
   * from the surviving squad, offers promotion to anyone eligible (reusing
   * PromotionPicker, but applied to the carry-over record being built
   * rather than a live Unit — the match is already over, no more moves to
   * dispatch), then hands off to finishCampaignContinue().
   */
  continueCampaign(): void {
    const state = this.client.getState();
    if (!state) return;
    const { G } = state;

    const proceed = () => {
      const carryOver: CampaignCarryOver = {
        units: {},
        inventory: G.inventory,
        nextItemInstance: G.nextItemInstance,
      };
      for (const unit of unitsOf(G, 'player')) {
        carryOver.units[unit.id] = { level: unit.level, exp: unit.exp, equipment: unit.equipment };
      }

      const eligible = unitsOf(G, 'player').filter(canPromote);
      if (eligible.length === 0) {
        this.finishCampaignContinue(G.chapterId, carryOver);
        return;
      }

      const candidates: PromotionCandidate[] = eligible.map((unit) => ({
        unitId: unit.id,
        name: unit.name,
        fromClass: unit.className,
        level: unit.level,
        toClassOptions: PROMOTES_TO[unit.className] ?? [],
      }));
      this.ui.showPromotionPicker(candidates, (selections) => {
        for (const { unitId, toClass } of selections) {
          const unit = G.units[unitId];
          if (!unit || !PROMOTES_TO[unit.className]?.includes(toClass)) continue;
          carryOver.units[unitId] = { level: 1, exp: 0, equipment: unit.equipment, className: toClass };
        }
        this.finishCampaignContinue(G.chapterId, carryOver);
      });
    };

    const outro = this.lookupCampaignChapter(G.chapterId)?.outro;
    if (outro && outro.length > 0) {
      this.ui.showDialogue(outro, proceed);
    } else {
      proceed();
    }
  }

  /** Saves progress (or clears it, if that was the last chapter) and returns to the main menu — its own save-detection offers Load Game from there, so there's no separate "resume" path to build. */
  private finishCampaignContinue(clearedChapterId: string, carryOver: CampaignCarryOver): void {
    const clearedIndex = CAMPAIGN_CHAPTERS.findIndex((candidate) => candidate.id === clearedChapterId);
    const next = clearedIndex >= 0 ? CAMPAIGN_CHAPTERS[clearedIndex + 1] : undefined;
    if (next) {
      saveCampaign(browserStorage, { chapterId: next.id, carryOver, savedAt: new Date().toISOString() });
    } else {
      clearCampaignSave(browserStorage);
    }
    this.scene.stop('UI');
    this.scene.start('MainMenu');
  }

  /**
   * Backs out to idle. If the selected unit's previewMoveTo() was never
   * followed by a confirmed action, its sprite is still sitting at the
   * previewed destination while G still has it at the real (unmoved) tile —
   * snap it back. If the action WAS confirmed, G's position already matches
   * the preview, so this is a no-op.
   *
   * `skipStatusBarRefresh` — pass true when the caller already refreshed
   * the status bar to something more relevant than the unit being
   * deselected (e.g. onTileClicked's 'unit-selected' branch, tapping a
   * different unit that isn't itself selectable) — otherwise this would
   * unconditionally show the old (now-deselected) unit's info right after,
   * stomping that fresher update.
   */
  private finishSelection(skipStatusBarRefresh = false): void {
    const unitId = this.selectedUnitId;
    this.mode = 'idle';
    this.selectedUnitId = null;
    this.selectedSkillId = null;
    this.pendingDestination = null;
    this.clearHighlights();

    const state = this.client.getState();
    const unit = unitId && state ? state.G.units[unitId] : undefined;
    const sprite = unitId ? this.unitSprites.get(unitId) : undefined;
    if (unit && sprite) {
      const { px, py } = this.tileCenter(unit.x, unit.y);
      this.tweens.add({ targets: sprite, x: px, y: py, duration: 150, ease: 'Quad.easeOut' });
    }
    // Re-show the unit's real (unmoved-if-cancelled, or post-action if
    // confirmed) terrain — otherwise the panel keeps showing whatever
    // destination tile was last picked (e.g. a forest's +2 Def) even after
    // backing out of it, since picking a destination is the only other
    // place that refreshes the panel's terrain row.
    if (!skipStatusBarRefresh && unit && state) {
      this.ui.unitStatusBar.show(unit, terrainAt(state.G, unit.x, unit.y), unit.hasActed && unit.team === teamOf(state.ctx.currentPlayer));
    }
  }

  // --- CPU / blessing auto-play -------------------------------------------------------

  /**
   * Steps exactly one enemy action per call, then relies on the resulting
   * state change (via subscribe) to call this again — the same "one action
   * at a time, animate between" pattern HANDOFF.md §3 asks the AI to
   * support. A wave clear opens the blessing picker (guarded so it doesn't
   * reopen on every subsequent state change while the player is choosing).
   */
  private scheduleAutoAdvance(): void {
    const state = this.client.getState();
    if (!state || state.ctx.gameover) return;
    const { G, ctx } = state;

    // turnCounts bookkeeping (story.ts's turnReached trigger) — runs every
    // call, deduped against ctx.turn the same way enemyPhaseIntroDone is,
    // so it stays fresh regardless of which branch below returns early.
    if (this.lastCountedTurn !== ctx.turn) {
      this.lastCountedTurn = ctx.turn;
      this.turnCounts[teamOf(ctx.currentPlayer)] += 1;
    }

    if (G.awaitingBlessing) {
      if (this.blessingPickerOpen) return;
      this.blessingPickerOpen = true;
      this.time.delayedCall(BLESSING_DELAY_MS, () => {
        const fresh = this.client.getState();
        if (!fresh || !fresh.G.awaitingBlessing) {
          this.blessingPickerOpen = false;
          return;
        }
        const offered = fresh.G.offeredBlessingIds
          .map((id) => BLESSINGS.find((b) => b.id === id))
          .filter((b): b is Blessing => b !== undefined);
        this.ui.showBlessingPicker(offered, (id) => {
          this.blessingPickerOpen = false;
          this.client.moves.chooseBlessing(id);
        });
      });
      return;
    }

    if (G.awaitingPromotion) {
      if (this.promotionPickerOpen) return;
      this.promotionPickerOpen = true;
      this.time.delayedCall(BLESSING_DELAY_MS, () => {
        const fresh = this.client.getState();
        if (!fresh || !fresh.G.awaitingPromotion) {
          this.promotionPickerOpen = false;
          return;
        }
        const candidates: PromotionCandidate[] = fresh.G.promotionEligibleUnitIds
          .map((id) => fresh.G.units[id])
          .filter((unit): unit is Unit => unit !== undefined)
          .map((unit) => ({ unitId: unit.id, name: unit.name, fromClass: unit.className, level: unit.level, toClassOptions: PROMOTES_TO[unit.className] ?? [] }));
        this.ui.showPromotionPicker(candidates, (selections) => {
          this.promotionPickerOpen = false;
          this.client.moves.resolvePromotions(selections);
        });
      });
      return;
    }

    if (G.mode === 'campaign') {
      const pending = this.nextPendingStoryEvent(G);
      if (pending) {
        if (this.storyDialogueOpen) return;
        this.storyDialogueOpen = true;
        this.firedStoryEventIds.add(pending.id);
        this.inputSuspended = true;
        this.ui.showDialogue(pending.script, () => {
          this.storyDialogueOpen = false;
          this.inputSuspended = false;
          // Re-check immediately in case another event's trigger became
          // true at the same moment this one's did — without this, a
          // second simultaneously-true event would just sit unfired until
          // some later, unrelated state change happened to occur.
          this.scheduleAutoAdvance();
        });
        return;
      }
    }

    if (teamOf(ctx.currentPlayer) === 'enemy') {
      // The opening action of a fresh enemy phase is held until UIScene's
      // "Enemy Phase" banner actually finishes — not a guessed matching
      // delay here, which would mean two independently-run Phaser timers
      // (this scene's delayedCall and the banner's own tween chain) each
      // assuming the same duration and hoping they don't drift apart.
      // Instead this just marks the phase as seen and returns; UIScene
      // detects the same ctx.turn change on its own subscription and calls
      // onEnemyPhaseBannerDone() below once the banner's slide-out tween
      // actually completes. Every later action within the same phase
      // (ctx.turn unchanged) falls through to the normal pacing gap.
      if (this.enemyPhaseIntroDone !== ctx.turn) {
        this.enemyPhaseIntroDone = ctx.turn;
        return;
      }
      this.time.delayedCall(ENEMY_STEP_DELAY_MS, () => this.stepEnemyAi());
    }
  }

  /** The first not-yet-fired MapEvent (this.firedStoryEventIds) whose trigger is currently true, if any — story.ts's isTriggerMet is pure, so this is safe to call on every scheduleAutoAdvance() tick. */
  private nextPendingStoryEvent(G: GameState): MapEvent | undefined {
    const events = this.lookupCampaignChapter(G.chapterId)?.events;
    return events?.find(
      (event) => !this.firedStoryEventIds.has(event.id) && isTriggerMet(event.trigger, G, { turnCounts: this.turnCounts }),
    );
  }

  /** UIScene calls this once its "Enemy Phase" banner has fully slid out — see scheduleAutoAdvance()'s isFreshPhase branch above. */
  onEnemyPhaseBannerDone(): void {
    this.stepEnemyAi();
  }

  /** Dispatches exactly one enemy action, or ends the enemy turn if the AI has nothing left to do. */
  private stepEnemyAi(): void {
    const fresh = this.client.getState();
    if (!fresh || fresh.ctx.gameover || teamOf(fresh.ctx.currentPlayer) !== 'enemy') return;

    const action = decideAction(fresh.G, 'enemy');
    if (!action) {
      this.client.events.endTurn?.();
      return;
    }
    if (action.type === 'move') this.client.moves.moveUnit(action.unitId, action.x, action.y);
    else if (action.type === 'attack') this.client.moves.attackUnit(action.attackerId, action.targetId);
    else this.client.moves.waitUnit(action.unitId);
  }
}
