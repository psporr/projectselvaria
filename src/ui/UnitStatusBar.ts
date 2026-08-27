import { Filters, GameObjects, Scene } from 'phaser';

import { effectiveStats } from '../game/equipment';
import { SKILLS } from '../game/skills';
import type { Terrain, Unit } from '../game/types';
import { DPR, LOGICAL_WIDTH } from '../systems/viewport';
import { CLASS_LETTER } from './classIcons';
import { enemyClassTextureKey, heroPortraitTextureKey, heroTextureKey } from './heroArt';
import { Card, COLORS, FONT_FAMILY } from './kit';

// Sits right below the board, at a fixed position — TacticalScene now
// computes its tile size per-chapter (see its BOARD_AREA_HEIGHT) precisely
// so any chapter's board bottom stays at or above 568, clearing this bar's
// top edge (664 - 90) regardless of how many rows the chapter has. Getting
// this wrong once already cost a dead-tap bug (the bar's hit zone silently
// ate clicks meant for the board's last row); if BAR_Y/BAR_HEIGHT ever
// change, TacticalScene's BOARD_AREA_HEIGHT must move with them.
const BAR_Y = 664;
const BAR_HEIGHT = 180;
const BAR_WIDTH = LOGICAL_WIDTH - 32;
const BAR_TOP = BAR_Y - BAR_HEIGHT / 2;
const CARD_LEFT = LOGICAL_WIDTH / 2 - BAR_WIDTH / 2;
const CARD_RIGHT = LOGICAL_WIDTH / 2 + BAR_WIDTH / 2;

// Portrait-slot box on the left — shows real hero art (heroArt.ts) when the
// shown unit has any, falling back to a team-colored panel + big class
// letter otherwise (every enemy, and any hero not yet drawn). Sized so a
// newly-drawn hero's art just drops in at PORTRAIT_W x PORTRAIT_H with no
// layout change.
const PORTRAIT_X = CARD_LEFT + 8;
const PORTRAIT_Y = BAR_TOP + 8;
const PORTRAIT_W = 96;
const PORTRAIT_H = BAR_HEIGHT - 16;

const INFO_X = PORTRAIT_X + PORTRAIT_W + 12;
const INFO_RIGHT = CARD_RIGHT - 8;
const INFO_WIDTH = INFO_RIGHT - INFO_X;
const INFO_CENTER_X = INFO_X + INFO_WIDTH / 2;

const BANNER_Y = PORTRAIT_Y + 14;
const BANNER_HEIGHT = 26;
const HP_Y = BANNER_Y + 24;
const HP_BAR_HEIGHT = 18;
/** Terrain-under-foot row — what this tile's defBonus/avoid actually does for this unit while it's standing here, since neither shows up in the stat grid above (both apply at combat-resolution time, not to the unit's own listed stats). */
const TERRAIN_Y = HP_Y + 20;
const TERRAIN_ICON_X = INFO_X + 10;
const STAT_ROW_1_Y = TERRAIN_Y + 20;
const STAT_ROW_2_Y = STAT_ROW_1_Y + 20;
const STAT_ROW_3_Y = STAT_ROW_2_Y + 20;
const STAT_PANEL_TOP = STAT_ROW_1_Y - 12;
const STAT_PANEL_BOTTOM = STAT_ROW_3_Y + 12;
const STAT_COL_1_X = INFO_X + 10;
const STAT_COL_2_X = INFO_CENTER_X + 6;
const SKILL_Y = STAT_PANEL_BOTTOM + 12;
const SKILL_ICON_X = INFO_X + 10;

const TEAM_COLOR: Record<string, number> = { player: 0x4a90d9, enemy: 0xd9534f };
/** Neutral gray the portrait/banner blend toward once a unit's acted — mirrors UnitSprite's on-board dimming so the two read as the same convention. */
const ACTED_GRAY = 0x6b7280;
/** Same green as COLORS.successStroke (0x5ab56a) — Phaser Text color needs a hex string, not a number, so it can't just reference that constant directly. */
const DEF_BONUS_GREEN = '#5ab56a';
/** Shown before anything's ever been tapped — `hide()` restores this exact text/color, so it needs to be shared rather than a literal repeated in both places. */
const DEFAULT_HINT = 'Tap a tile to see its info';
/** Border color/width shared by both HP bar rectangles — dark enough to stay readable when the bar's green fill sits over a green plains tile behind the panel. */
const HP_BAR_STROKE = 0x0a0d14;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function hpColor(ratio: number): number {
  return ratio > 0.5 ? 0x5cb85c : ratio > 0.25 ? 0xf0ad4e : 0xd9534f;
}

/** "Forest — +2 Def, -30 enemy Hit" style summary, or a plain "no bonus" line when the tile grants neither. */
function terrainLine(terrain: Terrain): string {
  const parts: string[] = [];
  if (terrain.defBonus > 0) parts.push(`+${terrain.defBonus} Def`);
  if (terrain.avoid > 0) parts.push(`-${terrain.avoid} enemy Hit`);
  return parts.length > 0 ? `${terrain.name} — ${parts.join(', ')}` : `${terrain.name} — no bonus`;
}

function blendToward(color: number, target: number, amount: number): number {
  const r1 = (color >> 16) & 0xff;
  const g1 = (color >> 8) & 0xff;
  const b1 = color & 0xff;
  const r2 = (target >> 16) & 0xff;
  const g2 = (target >> 8) & 0xff;
  const b2 = target & 0xff;
  return (Math.round(r1 + (r2 - r1) * amount) << 16) | (Math.round(g1 + (g2 - g1) * amount) << 8) | Math.round(b1 + (b2 - b1) * amount);
}

/**
 * Always-on status panel for whichever unit was last tapped (either team —
 * read-only for enemies), or — via `showTerrain` (2026-08-25) — the plain
 * terrain info for a tapped tile with no unit on it, using the same hint
 * slot the pre-first-tap instruction normally occupies. Purely a view:
 * TacticalScene/UIScene hand it a `Unit` snapshot plus the `Terrain` under
 * it on tap; it never reads G/ctx itself (HANDOFF.md §5/§7 — same rule
 * `UnitSprite` follows). Terrain has to be passed in rather than looked up
 * here specifically because its effect (defBonus/avoid) never shows up in
 * the unit's own listed stats — both are applied later, at combat-
 * resolution time (`computeDamage`/`computeHitChance`, combat.ts) — so
 * without a dedicated display a player has no way to tell "am I actually
 * getting the forest bonus right now."
 *
 * Graphical layout (2026-08-24) — a portrait-slot + banner + big HP bar +
 * a terrain-under-foot line + boxed stat grid, adapted from Fire Emblem
 * Heroes' unit-detail screen but condensed to fit this panel's fixed
 * persistent-HUD footprint rather than a dedicated full-screen view. The
 * portrait box shows real art (2026-08-25) for whichever named heroes have
 * it (`heroArt.ts`) and falls back to the shapes/color placeholder
 * (team-colored box + class letter) for everyone else — every enemy, and
 * any hero not yet drawn (skill icon art still doesn't exist — see
 * ART_BRIEF.md). Equipment isn't shown here (it was in the previous plain-text
 * version) — this panel's job is "what do I need to know before I act"
 * (stats/skill/HP/terrain), which equipment names aren't; Squad still has
 * the full gear list.
 *
 * Depth 15 — below the other modals (ActionMenu/SystemMenu/etc, depth 20),
 * so an opened modal's own full-screen backdrop naturally covers the panel
 * without this needing to track every other panel's open/close calls.
 */
export class UnitStatusBar extends GameObjects.Container {
  private readonly hint: GameObjects.Text;

  private readonly portraitGfx: GameObjects.Graphics;
  private readonly portraitLetter: GameObjects.Text;
  /** Real hero art, shown instead of `portraitLetter` when the shown unit's name matches one of `heroArt.ts`'s drawn characters — texture swapped per-unit in show() since this one Image is reused across every unit tapped. */
  private readonly portraitImage: GameObjects.Image;
  /** Live grayscale filter on `portraitImage`, toggled per-unit in show() — persists across its texture swaps (added once at construction; see UnitSprite.ts's own doc comment for why this replaced a baked-texture approach). */
  private readonly portraitGrayscale: Filters.ColorMatrix;
  private readonly levelBadge: GameObjects.Text;

  private readonly bannerGfx: GameObjects.Graphics;
  private readonly nameText: GameObjects.Text;

  private readonly hpBarBg: GameObjects.Rectangle;
  private readonly hpBarFill: GameObjects.Rectangle;
  private readonly hpText: GameObjects.Text;
  private readonly hpBarWidth: number;

  private readonly terrainIcon: GameObjects.Arc;
  private readonly terrainText: GameObjects.Text;

  private readonly statPanelGfx: GameObjects.Graphics;
  private readonly statTexts: [GameObjects.Text, GameObjects.Text][];
  /** "+2" suffix after the Def stat, shown only while standing on terrain that grants a defBonus — separate from statTexts since it needs its own color and its own show/hide condition. */
  private readonly defBonusText: GameObjects.Text;

  private readonly skillIcon: GameObjects.Arc;
  private readonly skillText: GameObjects.Text;

  private current: Unit | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);

    new Card(scene, LOGICAL_WIDTH / 2, BAR_Y, BAR_WIDTH, BAR_HEIGHT);

    this.hint = scene.add
      .text(LOGICAL_WIDTH / 2, BAR_Y, DEFAULT_HINT, {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        color: COLORS.textDisabled,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- portrait slot ---
    this.portraitGfx = scene.add.graphics();
    this.portraitLetter = scene.add
      .text(PORTRAIT_X + PORTRAIT_W / 2, PORTRAIT_Y + PORTRAIT_H / 2, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '40px',
        fontStyle: 'bold',
        color: '#ffffff',
        resolution: DPR,
      })
      .setOrigin(0.5);
    // '__WHITE' is just a safe placeholder texture at construction time —
    // show() always swaps it to a real hero texture before making this
    // visible, or leaves it hidden and shows portraitLetter instead.
    this.portraitImage = scene.add
      .image(PORTRAIT_X + PORTRAIT_W / 2, PORTRAIT_Y + PORTRAIT_H - 6, '__WHITE')
      .setOrigin(0.5, 1)
      .setVisible(false);
    this.portraitImage.enableFilters();
    this.portraitGrayscale = this.portraitImage.filters!.internal.addColorMatrix();
    this.portraitGrayscale.colorMatrix.grayscale(1);
    this.portraitGrayscale.active = false;
    this.levelBadge = scene.add
      .text(PORTRAIT_X + PORTRAIT_W - 8, PORTRAIT_Y + PORTRAIT_H - 8, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 5, y: 2 },
        resolution: DPR,
      })
      .setOrigin(1, 1);

    // --- name banner ---
    this.bannerGfx = scene.add.graphics();
    this.nameText = scene.add
      .text(INFO_CENTER_X, BANNER_Y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#ffffff',
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- HP bar ---
    this.hpBarWidth = INFO_WIDTH;
    // Bordered so the bar reads clearly over a light/green background — the
    // card behind it is dark, but stays consistent with UnitSprite's own
    // on-board bar, which needs the same border for its map-tile background.
    this.hpBarBg = scene.add.rectangle(INFO_CENTER_X, HP_Y, this.hpBarWidth, HP_BAR_HEIGHT, 0x000000, 0.55).setStrokeStyle(1, HP_BAR_STROKE, 0.9);
    this.hpBarFill = scene.add.rectangle(INFO_X, HP_Y, this.hpBarWidth, HP_BAR_HEIGHT, 0x5cb85c).setOrigin(0, 0.5);
    this.hpText = scene.add
      .text(INFO_CENTER_X, HP_Y, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
        resolution: DPR,
      })
      .setOrigin(0.5);

    // --- terrain-under-foot row ---
    this.terrainIcon = scene.add.circle(TERRAIN_ICON_X, TERRAIN_Y, 8, 0x2d5a3d).setStrokeStyle(1, 0x000000, 0.4);
    this.terrainText = scene.add
      .text(TERRAIN_ICON_X + 16, TERRAIN_Y, '', { fontFamily: FONT_FAMILY, fontSize: '11px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0, 0.5);

    // --- boxed stat grid (Atk/Def, Hit/Crit, Mov/Rng) ---
    this.statPanelGfx = scene.add.graphics();
    this.statPanelGfx.fillStyle(0x000000, 0.25);
    this.statPanelGfx.fillRoundedRect(INFO_X, STAT_PANEL_TOP, INFO_WIDTH, STAT_PANEL_BOTTOM - STAT_PANEL_TOP, 8);
    const statRowY = [STAT_ROW_1_Y, STAT_ROW_2_Y, STAT_ROW_3_Y];
    this.statTexts = statRowY.map((y) => [
      scene.add.text(STAT_COL_1_X, y, '', { fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary, resolution: DPR }).setOrigin(0, 0.5),
      scene.add.text(STAT_COL_2_X, y, '', { fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary, resolution: DPR }).setOrigin(0, 0.5),
    ]);
    // Positioned in show() each time, right after the Def text's own measured
    // width — its string length varies (single vs double-digit defBonus), so
    // a fixed offset would either leave a gap or overlap the Def value.
    this.defBonusText = scene.add
      .text(0, STAT_ROW_1_Y, '', { fontFamily: FONT_FAMILY, fontSize: '11px', fontStyle: 'bold', color: DEF_BONUS_GREEN, resolution: DPR })
      .setOrigin(0, 0.5)
      .setVisible(false);

    // --- skill row ---
    this.skillIcon = scene.add.circle(SKILL_ICON_X, SKILL_Y, 8, COLORS.playerAccent).setStrokeStyle(1, 0x000000, 0.4);
    this.skillText = scene.add
      .text(SKILL_ICON_X + 16, SKILL_Y, '', { fontFamily: FONT_FAMILY, fontSize: '12px', color: COLORS.textPrimary, resolution: DPR })
      .setOrigin(0, 0.5);

    this.add([
      this.hint,
      this.portraitGfx,
      this.portraitLetter,
      this.portraitImage,
      this.levelBadge,
      this.bannerGfx,
      this.nameText,
      this.hpBarBg,
      this.hpBarFill,
      this.hpText,
      this.terrainIcon,
      this.terrainText,
      this.statPanelGfx,
      ...this.statTexts.flat(),
      this.defBonusText,
      this.skillIcon,
      this.skillText,
    ]);
    this.setDepth(15);
    scene.add.existing(this);
    this.setContentVisible(false);
  }

  /** Shows (or refreshes, if already showing this same unit) the panel for `unit`, standing on `terrain` — the caller reads that off G (see class doc comment on why this component doesn't). */
  show(unit: Unit, terrain: Terrain): void {
    this.current = unit;
    this.hint.setVisible(false);
    this.setContentVisible(true);

    const teamColor = TEAM_COLOR[unit.team] ?? TEAM_COLOR.player;
    const panelColor = unit.hasActed ? blendToward(teamColor, ACTED_GRAY, 0.55) : teamColor;

    this.portraitGfx.clear();
    this.portraitGfx.fillStyle(panelColor, unit.hasActed ? 0.35 : 0.5);
    this.portraitGfx.fillRoundedRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_W, PORTRAIT_H, 10);
    this.portraitGfx.lineStyle(2, panelColor, 1);
    this.portraitGfx.strokeRoundedRect(PORTRAIT_X, PORTRAIT_Y, PORTRAIT_W, PORTRAIT_H, 10);
    // Prefer a dedicated bust portrait (heroArt.ts's HERO_PORTRAIT_NAMES) over the
    // map sprite here — UnitSprite always uses the map sprite regardless. Below
    // that, the same enemy-only class-art fallback as UnitSprite (heroArt.ts's
    // ENEMY_ART_CLASSES).
    const portraitKey = heroPortraitTextureKey(unit.name);
    const heroKey = heroTextureKey(unit.name);
    const enemyKey = unit.team === 'enemy' ? enemyClassTextureKey(unit.className) : heroKey;
    const textureKey = this.scene.textures.exists(portraitKey)
      ? portraitKey
      : this.scene.textures.exists(heroKey)
        ? heroKey
        : enemyKey;
    const hasArt = this.scene.textures.exists(textureKey);
    this.portraitLetter.setVisible(!hasArt).setText(CLASS_LETTER[unit.className] ?? '?').setAlpha(unit.hasActed ? 0.6 : 1);
    if (hasArt) {
      // Live grayscale filter toggle, not a faded alpha, for an acted unit
      // — matches the on-board sprite's own treatment (UnitSprite.ts).
      // Scaled to fit inside the box (6px margin per side) preserving the
      // source texture's own aspect ratio, rather than forcing a square —
      // the 128x128 map/enemy sprites still land square this way, but a
      // portrait (e.g. jill.png at 150x250) displays at its real shape
      // instead of being squished.
      this.portraitImage.setTexture(textureKey);
      const maxW = PORTRAIT_W - 12;
      const maxH = PORTRAIT_H - 12;
      const fitScale = Math.min(maxW / this.portraitImage.width, maxH / this.portraitImage.height);
      this.portraitImage.setDisplaySize(this.portraitImage.width * fitScale, this.portraitImage.height * fitScale).setAlpha(1).setVisible(true);
      this.portraitGrayscale.active = unit.hasActed;
    } else {
      this.portraitImage.setVisible(false);
    }
    this.levelBadge.setText(`Lv.${unit.level}`);

    this.bannerGfx.clear();
    this.bannerGfx.fillStyle(panelColor, 1);
    this.bannerGfx.fillRoundedRect(INFO_X, BANNER_Y - BANNER_HEIGHT / 2, INFO_WIDTH, BANNER_HEIGHT, 8);
    this.nameText.setText(`${unit.name}  •  ${unit.className}${unit.hasActed ? '  (acted)' : ''}`);

    const ratio = clamp01(unit.hp / unit.maxHp);
    this.hpText.setText(`${unit.hp} / ${unit.maxHp}`);
    this.hpBarFill.width = this.hpBarWidth * ratio;
    this.hpBarFill.setFillStyle(hpColor(ratio));

    const hasTerrainBonus = terrain.defBonus > 0 || terrain.avoid > 0;
    this.terrainIcon.setFillStyle(hasTerrainBonus ? 0x2d5a3d : 0x5a6070);
    this.terrainText.setText(terrainLine(terrain));

    const stats = effectiveStats(unit);
    const skill = SKILLS[unit.className];
    const cooldownLine = unit.skillCooldown > 0 ? `CD ${unit.skillCooldown}` : 'Ready';

    const pairs: [string, string][] = [
      [`Atk ${stats.atk}`, `Def ${stats.def}`],
      [`Hit ${stats.hit}%`, `Crit ${stats.crit}%`],
      [`Mov ${stats.move}`, `Rng ${stats.range}`],
    ];
    pairs.forEach(([left, right], i) => {
      this.statTexts[i][0].setText(left);
      this.statTexts[i][1].setText(right);
    });

    const defText = this.statTexts[0][1];
    if (terrain.defBonus > 0) {
      this.defBonusText.setText(`+${terrain.defBonus}`).setPosition(defText.x + defText.width + 4, STAT_ROW_1_Y).setVisible(true);
    } else {
      this.defBonusText.setVisible(false);
    }

    this.skillIcon.setFillStyle(unit.skillCooldown > 0 ? 0x5a6070 : teamColor);
    this.skillText.setText(`${skill.name} — ${cooldownLine}`);
  }

  /** Shows just a tapped empty tile's terrain — no unit there, so this repurposes the pre-first-tap hint text/slot rather than the unit-specific rows (portrait/HP/stats/skill), which have nothing to show without a unit. */
  showTerrain(terrain: Terrain): void {
    this.current = null;
    this.setContentVisible(false);
    this.hint.setText(terrainLine(terrain)).setColor(COLORS.textPrimary).setVisible(true);
  }

  hide(): void {
    this.current = null;
    this.setContentVisible(false);
    this.hint.setText(DEFAULT_HINT).setColor(COLORS.textDisabled).setVisible(true);
  }

  /** Id of the unit currently shown, if any — UIScene uses this to re-fetch and re-show fresh data on every state change (this component never reads G itself). */
  getCurrentUnitId(): string | null {
    return this.current?.id ?? null;
  }

  private setContentVisible(visible: boolean): void {
    this.portraitGfx.setVisible(visible);
    // portraitLetter/portraitImage are mutually exclusive per-unit (only one
    // of the two applies, decided in show() by whether that unit has real
    // art) — only force both off here when hiding the whole panel; showing
    // it is left to show()'s own hasArt branch instead of blindly turning
    // both on, which would show the letter fallback behind real art too.
    if (!visible) {
      this.portraitLetter.setVisible(false);
      this.portraitImage.setVisible(false);
      // Bug (2026-08-26): left out of this force-hide, the "+2"-style
      // suffix stayed visible — at its last position — after switching to
      // showTerrain()/hide(), floating with nothing else on the panel.
      this.defBonusText.setVisible(false);
    }
    this.levelBadge.setVisible(visible);
    this.bannerGfx.setVisible(visible);
    this.nameText.setVisible(visible);
    this.hpBarBg.setVisible(visible);
    this.hpBarFill.setVisible(visible);
    this.hpText.setVisible(visible);
    this.terrainIcon.setVisible(visible);
    this.terrainText.setVisible(visible);
    this.statPanelGfx.setVisible(visible);
    for (const [left, right] of this.statTexts) {
      left.setVisible(visible);
      right.setVisible(visible);
    }
    this.skillIcon.setVisible(visible);
    this.skillText.setVisible(visible);
  }
}
