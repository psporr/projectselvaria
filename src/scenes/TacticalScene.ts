import { GameObjects, Scene } from 'phaser';

import { BLESSINGS, type Blessing } from '../game/blessings';
import { decideAction } from '../game/ai';
import { forecastCombat } from '../game/combat';
import { computeReachable, computeThreatTiles, targetsFrom, tileKey, unitsOf } from '../game/grid';
import { ITEMS } from '../game/equipment';
import { canUseSkill, describeSkillEffect, novaBlastCoords, skillTargets, SKILLS } from '../game/skills';
import { TERRAIN, teamOf, type GameState, type Unit } from '../game/types';
import { UnitSprite } from '../entities/UnitSprite';
import { createGameClient, type GameClient } from '../systems/gameClient';
import { applyDprZoom, DPR, LOGICAL_WIDTH } from '../systems/viewport';
import type { ActionMenuChoice, ActionMenuOption } from '../ui/ActionMenu';
import { formatAttackForecast } from '../ui/ForecastPanel';
import type { SystemMenuChoice, SystemMenuOption } from '../ui/SystemMenu';
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
// must stay <= UnitStatusBar's fixed BAR_Y (600) minus half its BAR_HEIGHT
// (56) minus a small gap — that bar sits at a constant position regardless
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
  'test-map1': 'test-map1',
  'test-map1-detailed': 'test-map1',
};

const MOVE_HIGHLIGHT = 0x4a90d9;
const TARGET_HIGHLIGHT = 0xd9534f;
const SKILL_HIGHLIGHT = 0xf0ad4e;
const ENEMY_STEP_DELAY_MS = 450;
const BLESSING_DELAY_MS = 700;

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
 */
type UiMode = 'idle' | 'unit-selected' | 'action-menu' | 'awaiting-target' | 'skill-targeting' | 'confirming';

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
  private threatOverlayVisible = false;
  private lastUnits: Record<string, Unit> = {};

  private mode: UiMode = 'idle';
  private selectedUnitId: string | null = null;
  /** The tile picked in 'unit-selected', held until an action is confirmed — see UiMode. */
  private pendingDestination: { x: number; y: number } | null = null;
  /** Guards against re-opening the blessing picker on every state change while it's already up. */
  private blessingPickerOpen = false;
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
  /** ctx.turn of the enemy phase whose opening action we've already handed off to onEnemyPhaseBannerDone() — see scheduleAutoAdvance(). */
  private enemyPhaseIntroDone: number | null = null;

  constructor() {
    super('Tactical');
  }

  preload(): void {
    for (const basename of new Set(Object.values(CHAPTERS_WITH_BACKGROUND_ART))) {
      const key = `${basename}-bg`;
      if (!this.textures.exists(key)) this.load.image(key, `maps/${basename}.png`);
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
    this.threatOverlayVisible = false;
    this.lastUnits = {};
    this.mode = 'idle';
    this.selectedUnitId = null;
    this.pendingDestination = null;
    this.blessingPickerOpen = false;
    this.inputSuspended = false;
    this.enemyPhaseIntroDone = null;

    this.client = createGameClient();
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

    const unsubscribe = this.client.subscribe(() => this.onStateChange());
    this.events.once('shutdown', unsubscribe);

    this.scheduleAutoAdvance();
  }

  private tileCenter(x: number, y: number): { px: number; py: number } {
    return {
      px: this.boardOriginX + x * this.tileSize + this.tileSize / 2,
      py: BOARD_ORIGIN_Y + y * this.tileSize + this.tileSize / 2,
    };
  }

  private drawBoard(): void {
    const { G } = this.client.getState()!;
    const bgBasename = CHAPTERS_WITH_BACKGROUND_ART[G.chapterId];
    const hasBackgroundArt = bgBasename !== undefined;
    const bgKey = `${bgBasename}-bg`;

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

        if (previous && unit.hp < previous.hp) {
          this.spawnFloatingText(px, py, `-${previous.hp - unit.hp}`, '#ff6b6b');
          sprite.flash(0xffffff);
        } else if (previous && unit.hp > previous.hp) {
          this.spawnFloatingText(px, py, `+${unit.hp - previous.hp}`, '#7cd992');
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

    this.lastUnits = Object.fromEntries(Object.values(G.units).map((u) => [u.id, { ...u }]));
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

    if (this.mode === 'idle') {
      if (unitAtTile) {
        // Any tapped unit (either team, acted or not) populates the status
        // bar as a side effect — read-only for enemies/already-acted units,
        // which fall through without also entering the move-selection flow.
        this.ui.unitStatusBar.show(unitAtTile);
        if (unitAtTile.team === 'player' && !unitAtTile.hasActed) {
          this.selectUnit(unitAtTile.id);
        }
      } else {
        this.openSystemMenu();
      }
      return;
    }

    if (this.mode === 'unit-selected') {
      const unit = G.units[this.selectedUnitId!];
      if (!unit) {
        this.finishSelection();
        return;
      }

      if (computeReachable(G, unit).has(tileKey(x, y))) {
        this.pendingDestination = { x, y };
        this.previewMoveTo(unit.id, x, y);
        this.openActionMenu(G, unit);
        return;
      }

      if (unitAtTile && unitAtTile.team === 'player' && !unitAtTile.hasActed) {
        this.selectUnit(unitAtTile.id);
        return;
      }

      this.finishSelection();
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
        this.enterAttackConfirm(G, synthetic, unitAtTile);
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
      const validTarget = unitAtTile ? skillTargets(G, synthetic).some((t) => t.id === unitAtTile.id) : false;

      if (validTarget && unitAtTile) {
        this.enterSkillConfirm(G, unit, synthetic, unitAtTile);
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
    this.highlightTiles(computeReachable(G, G.units[unitId]).values(), MOVE_HIGHLIGHT);
  }

  private openActionMenu(G: GameState, unit: Unit): void {
    const dest = this.pendingDestination!;
    const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
    const skill = SKILLS[unit.className];

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
    if (skillTargets(G, synthetic).length > 0) {
      options.push({ id: 'skill', label: skill.name, enabled: canUseSkill(G, synthetic) });
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
      this.finishSelection();
      return;
    }

    if (choice === 'attack') {
      this.beginAttackTargeting(G, unit, dest);
      return;
    }

    // 'skill'
    this.beginSkillTargeting(G, unit, dest);
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

  private beginSkillTargeting(G: GameState, unit: Unit, dest: { x: number; y: number }): void {
    const synthetic: Unit = { ...unit, x: dest.x, y: dest.y };
    this.mode = 'skill-targeting';
    this.clearHighlights();
    this.highlightTiles(
      skillTargets(G, synthetic).map((t) => ({ x: t.x, y: t.y })),
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
    else this.beginSkillTargeting(state.G, unit, dest);
  }

  private enterAttackConfirm(G: GameState, attacker: Unit, defender: Unit): void {
    this.clearHighlights();
    const forecast = forecastCombat(G, attacker, defender);
    const lines = formatAttackForecast(G, attacker, defender, forecast);

    this.mode = 'confirming';
    this.ui.showForecast(
      lines,
      () => {
        const dest = this.pendingDestination!;
        this.client.moves.moveUnit(attacker.id, dest.x, dest.y);
        this.client.moves.attackUnit(attacker.id, defender.id);
        this.finishSelection();
      },
      () => this.resumeTargeting(attacker.id, 'attack'),
    );
  }

  private enterSkillConfirm(G: GameState, unit: Unit, synthetic: Unit, target: Unit): void {
    this.clearHighlights();
    const skill = SKILLS[unit.className];
    // Nova hits a plus-shaped blast, not just the tapped tile — show what it
    // will actually hit before the player commits (skills.ts).
    if (skill.id === 'nova') {
      this.highlightTiles(novaBlastCoords(target), TARGET_HIGHLIGHT);
    }
    const lines = [`${unit.name} uses ${skill.name} on ${target.name}.`, describeSkillEffect(G, synthetic, target)];

    this.mode = 'confirming';
    this.ui.showForecast(
      lines,
      () => {
        const dest = this.pendingDestination!;
        this.client.moves.moveUnit(unit.id, dest.x, dest.y);
        this.client.moves.useSkill(unit.id, target.id);
        this.finishSelection();
      },
      () => this.resumeTargeting(unit.id, 'skill'),
    );
  }

  /** Opens the field/system menu (End Turn / Squad / Danger Zone / Restart / Cancel). */
  /**
   * Squad/Danger Zone live on UIScene's bottom dock only — this is the
   * overflow menu for everything else reachable from an empty-tile tap:
   * End Turn (a natural gesture on its own, without needing the dock) and
   * Restart (the one rare, destructive action). Reachable via the dock's
   * own Menu button or by tapping an empty board tile.
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
      { id: 'restart', label: 'Restart Battle', enabled: true },
      { id: 'cancel', label: 'Cancel', enabled: true },
    ];
    this.ui.showSystemMenu(options, (choice) => this.onSystemMenuChosen(choice));
  }

  private onSystemMenuChosen(choice: SystemMenuChoice): void {
    if (choice === 'end-turn') {
      this.endTurn();
    } else if (choice === 'restart') {
      this.restartBattle();
    }
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

  /** Restarts the scene with a fresh game client and cleans up previous state. */
  restartBattle(): void {
    this.scene.stop('UI');
    this.scene.restart();
  }

  /**
   * Backs out to idle. If the selected unit's previewMoveTo() was never
   * followed by a confirmed action, its sprite is still sitting at the
   * previewed destination while G still has it at the real (unmoved) tile —
   * snap it back. If the action WAS confirmed, G's position already matches
   * the preview, so this is a no-op.
   */
  private finishSelection(): void {
    const unitId = this.selectedUnitId;
    this.mode = 'idle';
    this.selectedUnitId = null;
    this.pendingDestination = null;
    this.clearHighlights();

    const unit = unitId ? this.client.getState()?.G.units[unitId] : undefined;
    const sprite = unitId ? this.unitSprites.get(unitId) : undefined;
    if (unit && sprite) {
      const { px, py } = this.tileCenter(unit.x, unit.y);
      this.tweens.add({ targets: sprite, x: px, y: py, duration: 150, ease: 'Quad.easeOut' });
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
