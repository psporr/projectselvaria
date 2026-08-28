import { GameObjects, Scene } from 'phaser';

import { statsAtLevel, type ClassName, type ClassStats } from '../game/classes';
import { SKILLS } from '../game/skills';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { Button, Card, COLORS, FONT_FAMILY } from './kit';

export interface PromotionCandidate {
  unitId: string;
  name: string;
  fromClass: ClassName;
  /** The unit's current level — the "before" side of the detail screen's stat comparison reads its current-class stats at this level. */
  level: number;
  /** Every advanced class this unit's current class can branch into — usually 1, sometimes more (e.g. Lancer -> Lancemaster or General). */
  toClassOptions: ClassName[];
}

export interface PromotionSelection {
  unitId: string;
  toClass: ClassName;
}

const CARD_WIDTH = 320;
const INNER_WIDTH = CARD_WIDTH - 32;
const TOP_PADDING = 20;
const BOTTOM_PADDING = 18;
/** Green used for a stat/HP increase — same value as kit.ts's successStroke, just as a text-color string (Phaser Text needs a CSS string, kit's COLORS keeps it numeric for fills). */
const POSITIVE_COLOR = '#5ab56a';
const NEGATIVE_COLOR = COLORS.dangerOnText;
const NEUTRAL_COLOR = COLORS.textDisabled;

const STAT_LABELS: { key: keyof ClassStats; label: string }[] = [
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'hit', label: 'Hit' },
  { key: 'crit', label: 'Crit' },
  { key: 'move', label: 'Mov' },
  { key: 'range', label: 'Rng' },
];

type Screen = { kind: 'list' } | { kind: 'detail'; unitId: string; branchIndex: number };

/**
 * Wave-clear / chapter-clear promotion flow (`game.ts`'s `resolvePromotions`)
 * — shown after `BlessingPicker` resolves (roguelike) or on a campaign
 * chapter clear, only when at least one player unit is eligible
 * (`classes.ts`'s `canPromote`).
 *
 * Two screens (2026-08-27, per the repo owner — was a single screen with
 * inline branch buttons and no stat/skill detail):
 * - **List**: one row per eligible unit, showing its current pick if it's
 *   made one. Tapping a row opens that unit's detail screen; tapping an
 *   already-decided row lets them reconsider. Continue is always
 *   available and finishes with whatever's been picked so far — including
 *   nothing, a valid "promote nobody" skip, same as before this redesign.
 * - **Detail**: one unit at a time. A tab per branch option (skipped
 *   entirely for a single-option class — identical UX to before branching
 *   existed) switches which class's stats/skills are shown below: a
 *   before/after comparison (this class's stats vs. the new class's stats,
 *   both read at the unit's *current* level — promotion no longer resets
 *   level, HANDOFF.md's Promotion section, 2026-08-28) and that class's
 *   active skill(s) with their descriptions. "Promote to X" commits the
 *   pick and returns to the list; "Back" returns without deciding.
 *
 * Every element is positioned via a running vertical cursor during build,
 * then shifted into place once the total content height (and so the
 * card's centered top edge) is known — the only way to lay out the detail
 * screen's variable-length wrapped skill descriptions without either
 * guessing a fixed height per skill or measuring in a first pass.
 */
export class PromotionPicker extends GameObjects.Container {
  private readonly backdrop: GameObjects.Rectangle;
  private readonly card: Card;
  private readonly rows: GameObjects.GameObject[] = [];
  private candidates: PromotionCandidate[] = [];
  /** unitId -> the branch class currently picked for it (absent = not promoting this unit). */
  private selected = new Map<string, ClassName>();
  private screen: Screen = { kind: 'list' };
  private onConfirm: ((selections: PromotionSelection[]) => void) | null = null;

  constructor(scene: Scene) {
    super(scene, 0, 0);
    const width = LOGICAL_WIDTH;
    const height = LOGICAL_HEIGHT;

    this.backdrop = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    this.card = new Card(scene, width / 2, height / 2, CARD_WIDTH, TOP_PADDING + BOTTOM_PADDING);

    this.add([this.backdrop, this.card]);
    this.setDepth(20);
    scene.add.existing(this);
    this.setVisible(false);
  }

  show(candidates: PromotionCandidate[], onConfirm: (selections: PromotionSelection[]) => void): void {
    this.candidates = candidates;
    this.onConfirm = onConfirm;
    this.selected = new Map();
    this.screen = { kind: 'list' };
    this.setVisible(true);
    this.render();
  }

  hide(): void {
    this.setVisible(false);
    this.onConfirm = null;
  }

  // --- layout ---------------------------------------------------------

  private render(): void {
    for (const row of this.rows.splice(0)) row.destroy();

    const cursor = { y: 0 };
    if (this.screen.kind === 'list') this.renderList(cursor);
    else this.renderDetail(cursor, this.screen.unitId, this.screen.branchIndex);

    const cardHeight = TOP_PADDING + cursor.y + BOTTOM_PADDING;
    this.card.resize(CARD_WIDTH, cardHeight);
    const cardTop = LOGICAL_HEIGHT / 2 - cardHeight / 2;
    const shift = cardTop + TOP_PADDING;
    for (const row of this.rows) (row as unknown as { y: number }).y += shift;
  }

  /** Adds `obj` to the tracked rows at the current cursor, without moving the cursor — for elements placed alongside another (e.g. a stat pair's second column). */
  private place(obj: GameObjects.GameObject): void {
    this.add(obj);
    this.rows.push(obj);
  }

  private addText(
    cursor: { y: number },
    text: string,
    style: { fontSize: string; color: string; fontStyle?: string; align?: string; wordWrapWidth?: number },
    height: number,
    x = LOGICAL_WIDTH / 2,
    originX = 0.5,
  ): GameObjects.Text {
    const t = this.scene.add
      .text(x, cursor.y + height / 2, text, {
        fontFamily: FONT_FAMILY,
        fontSize: style.fontSize,
        color: style.color,
        fontStyle: style.fontStyle,
        align: style.align ?? 'center',
        resolution: DPR,
        wordWrap: style.wordWrapWidth ? { width: style.wordWrapWidth } : undefined,
      })
      .setOrigin(originX, 0.5);
    this.place(t);
    cursor.y += height;
    return t;
  }

  // --- list screen ------------------------------------------------------

  private renderList(cursor: { y: number }): void {
    this.addText(cursor, 'Promotions Available', { fontSize: '15px', color: COLORS.textAccent, fontStyle: 'bold' }, 24);

    const rowHeight = 46;
    const rowGap = 10;
    this.candidates.forEach((candidate) => {
      const picked = this.selected.get(candidate.unitId);
      const label = picked ? `${candidate.name} — ${candidate.fromClass} → ${picked}` : `${candidate.name} — ${candidate.fromClass}`;
      const button = new Button(this.scene, LOGICAL_WIDTH / 2, cursor.y + rowHeight / 2, INNER_WIDTH, rowHeight, label, null, '12px');
      if (picked) button.setAccent(COLORS.successFill, COLORS.successStroke);
      button.setOnTap(() => {
        this.screen = { kind: 'detail', unitId: candidate.unitId, branchIndex: 0 };
        this.render();
      });
      this.place(button);
      cursor.y += rowHeight + rowGap;
    });

    cursor.y += 6;
    const continueButton = new Button(this.scene, LOGICAL_WIDTH / 2, cursor.y + 21, INNER_WIDTH, 42, 'Continue', () => this.confirm());
    this.place(continueButton);
    cursor.y += 42;
  }

  // --- detail screen ------------------------------------------------------

  private renderDetail(cursor: { y: number }, unitId: string, branchIndex: number): void {
    const candidate = this.candidates.find((c) => c.unitId === unitId);
    if (!candidate) {
      this.screen = { kind: 'list' };
      this.renderList(cursor);
      return;
    }
    const toClass = candidate.toClassOptions[branchIndex] ?? candidate.toClassOptions[0];

    this.addText(cursor, candidate.name, { fontSize: '16px', color: COLORS.textPrimary, fontStyle: 'bold' }, 22);
    this.addText(cursor, `Lv.${candidate.level} ${candidate.fromClass}`, { fontSize: '11px', color: COLORS.textDisabled }, 16);
    cursor.y += 10;

    if (candidate.toClassOptions.length > 1) {
      const tabHeight = 34;
      const gap = 8;
      const n = candidate.toClassOptions.length;
      const tabWidth = (INNER_WIDTH - gap * (n - 1)) / n;
      const leftEdge = LOGICAL_WIDTH / 2 - INNER_WIDTH / 2;
      candidate.toClassOptions.forEach((option, index) => {
        const tx = leftEdge + tabWidth / 2 + index * (tabWidth + gap);
        const tab = new Button(this.scene, tx, cursor.y + tabHeight / 2, tabWidth, tabHeight, option, null, '11px');
        if (index === branchIndex) tab.setAccent(COLORS.successFill, COLORS.successStroke);
        tab.setOnTap(() => {
          this.screen = { kind: 'detail', unitId, branchIndex: index };
          this.render();
        });
        this.place(tab);
      });
      cursor.y += tabHeight + 14;
    }

    this.addText(cursor, `-> ${toClass}`, { fontSize: '16px', color: COLORS.textAccent, fontStyle: 'bold' }, 24);
    cursor.y += 4;

    this.renderStatChanges(cursor, candidate, toClass);
    cursor.y += 8;
    this.renderSkills(cursor, toClass);
    cursor.y += 10;

    const promoteButton = new Button(this.scene, LOGICAL_WIDTH / 2, cursor.y + 21, INNER_WIDTH, 42, `Promote to ${toClass}`, () => {
      this.selected.set(unitId, toClass);
      this.screen = { kind: 'list' };
      this.render();
    });
    promoteButton.setAccent(COLORS.successFill, COLORS.successStroke);
    this.place(promoteButton);
    cursor.y += 42 + 8;

    const backButton = new Button(this.scene, LOGICAL_WIDTH / 2, cursor.y + 17, INNER_WIDTH, 34, 'Back', () => {
      this.screen = { kind: 'list' };
      this.render();
    });
    this.place(backButton);
    cursor.y += 34;

    if (this.selected.has(unitId)) {
      cursor.y += 10;
      const skipButton = new Button(this.scene, LOGICAL_WIDTH / 2, cursor.y + 9, INNER_WIDTH, 18, "Don't promote this unit", () => {
        this.selected.delete(unitId);
        this.screen = { kind: 'list' };
        this.render();
      }, '10px');
      skipButton.setAccent(null, null, COLORS.textDisabled);
      this.place(skipButton);
      cursor.y += 18;
    }
  }

  private renderStatChanges(cursor: { y: number }, candidate: PromotionCandidate, toClass: ClassName): void {
    const before = statsAtLevel(candidate.fromClass, candidate.level);
    const after = statsAtLevel(toClass, candidate.level);
    this.addText(cursor, `STAT CHANGES (Lv.${candidate.level}, current class -> new class)`, { fontSize: '10px', color: COLORS.textDisabled, wordWrapWidth: INNER_WIDTH }, 14);

    const leftEdge = LOGICAL_WIDTH / 2 - INNER_WIDTH / 2;
    this.renderStatRow(cursor, 'HP', before.maxHp, after.maxHp, leftEdge, INNER_WIDTH);

    const colWidth = INNER_WIDTH / 2 - 4;
    for (let i = 0; i < STAT_LABELS.length; i += 2) {
      const rowY = cursor.y;
      const left = STAT_LABELS[i];
      this.renderStatRow({ y: rowY }, left.label, before[left.key], after[left.key], leftEdge, colWidth, false);
      const right = STAT_LABELS[i + 1];
      if (right) this.renderStatRow({ y: rowY }, right.label, before[right.key], after[right.key], leftEdge + colWidth + 8, colWidth, false);
      cursor.y += 17;
    }
  }

  private renderStatRow(cursor: { y: number }, label: string, before: number, after: number, x: number, width: number, advanceCursor = true): void {
    const delta = after - before;
    const color = delta > 0 ? POSITIVE_COLOR : delta < 0 ? NEGATIVE_COLOR : NEUTRAL_COLOR;
    const sign = delta > 0 ? '+' : '';
    const text = `${label} ${before} -> ${after} (${sign}${delta})`;
    const t = this.scene.add
      .text(x, cursor.y + 17 / 2, text, { fontFamily: FONT_FAMILY, fontSize: '11px', color, resolution: DPR, wordWrap: { width } })
      .setOrigin(0, 0.5);
    this.place(t);
    if (advanceCursor) cursor.y += 17;
  }

  private renderSkills(cursor: { y: number }, toClass: ClassName): void {
    const skills = SKILLS[toClass];
    this.addText(cursor, skills.length > 1 ? 'NEW SKILLS' : 'NEW SKILL', { fontSize: '10px', color: COLORS.textDisabled }, 14);

    const leftEdge = LOGICAL_WIDTH / 2 - INNER_WIDTH / 2;
    for (const skill of skills) {
      const name = this.scene.add
        .text(leftEdge, cursor.y + 7, `${skill.name} (CD ${skill.cooldown})`, {
          fontFamily: FONT_FAMILY,
          fontSize: '12px',
          fontStyle: 'bold',
          color: COLORS.textAccent,
          resolution: DPR,
        })
        .setOrigin(0, 0.5);
      this.place(name);
      cursor.y += 16;

      const desc = this.scene.add
        .text(leftEdge, cursor.y, skill.description, {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: COLORS.textPrimary,
          resolution: DPR,
          wordWrap: { width: INNER_WIDTH },
        })
        .setOrigin(0, 0);
      this.place(desc);
      cursor.y += desc.height + 8;
    }
  }

  private confirm(): void {
    const callback = this.onConfirm;
    const selections: PromotionSelection[] = [...this.selected.entries()].map(([unitId, toClass]) => ({ unitId, toClass }));
    this.hide();
    callback?.(selections);
  }
}
