/**
 * Sprite-sheet frame-boundary scanner.
 *
 * NEW 2026-08-31, built to stop re-deriving this by hand each time — the
 * first pass (for `public/test/luffy-sheet.png`) was a one-off Python/PIL
 * script run in a shell and thrown away. This is the same technique made
 * permanent: hand-drawn sheets (like a friend's placeholder art, or
 * anything cut without a fixed grid) don't have uniform frame sizes, so
 * Phaser's grid-slicing `load.spritesheet()` can't cut them and frame
 * rects have to come from somewhere. Scanning for transparent-pixel gaps
 * finds real per-frame pixel rects with no manual measuring.
 *
 * Method: scan every column for any non-zero-alpha pixel; group contiguous
 * "has content" columns into runs (each run = one frame's x-range); for
 * each run, scan rows the same way to get a tight vertical bounding box.
 * Output is TexturePacker JSON-Hash format — what Phaser's `load.atlas()`
 * expects, and (per HANDOFF/README) deliberately `trimmed: false` with
 * `spriteSourceSize`/`sourceSize` just mirroring each frame's own tight
 * w/h. That works *because* frames are cropped ink-tight and the game
 * relies on Phaser's fractional `setOrigin()` (recomputed per-frame off
 * each frame's own width/height) to keep an anchor point — e.g. feet via
 * setOrigin(0.5, 1) — aligned across differently-sized frames, instead of
 * faking TexturePacker's untrimmed-canvas padding data.
 *
 * If you have the source in Aseprite instead of a flattened PNG: Aseprite's
 * own "Export Sprite Sheet" (Data format: JSON Hash) produces a compatible
 * file directly and is the better choice when available — it can preserve
 * real per-frame canvas alignment via `trimmed: true` + `spriteSourceSize`
 * offsets, which survives a frame whose ink genuinely sits at a different
 * height (e.g. a hop), a case this tight-crop scan can't distinguish from
 * misalignment. Reach for this scanner specifically when only a flattened,
 * non-uniform PNG exists and there's no source file to re-export from.
 *
 * --stabilize (2026-08-31, found on the Luffy idle loop): tight-cropping
 * each frame independently means `setOrigin(0.5, ...)` anchors to *that
 * frame's own* bounding-box center — if one side of the pose (an arm, hair,
 * a weapon) grows or shrinks frame to frame while the other side (e.g. feet
 * planted for an idle loop) stays put, the varying box width drags the
 * center-anchor sideways even though the "planted" side never moved. Reads
 * as the character sliding in place. Root-caused on the Luffy idle frames
 * (`idle-0..3`, widths 30/31/32/33px climbing 1px a frame purely from
 * content growing on the right) by checking raw pixel columns: the left
 * ink edge sat at exactly `frame.x` — zero offset — in all four frames,
 * so nothing on the left side was actually moving.
 *
 * --stabilize fixes this per consecutive same-prefix frame group (i.e. one
 * named animation, e.g. all the `idle-N` frames run together) by treating
 * the group's *narrowest* frame as the balanced reference and padding every
 * wider frame's LEFT edge outward — never cropping, never touching the
 * right edge — just enough that the frame's own horizontal center again
 * lines up with a fixed point relative to the narrowest frame. Padding only
 * ever extends into pixels verified fully transparent for that frame's own
 * row range; a frame where that's not possible (the growth is genuinely on
 * the left, or there's no room before the previous frame) is left
 * un-adjusted with a warning printed, rather than guessed at. This assumes
 * the group's narrowest frame is already well-centered and growth is
 * one-sided — true often enough to be worth defaulting on for a stationary
 * loop (idle, a held guard pose), but a real, intentional horizontal
 * translation (a dash, a lunge, an attack with real forward motion) would
 * get incorrectly flattened by this same logic — leave --stabilize off for
 * those and use the printed frame rects to sanity-check by eye instead
 * (SpriteTestScene's 0.1x-2x speed buttons help for exactly this).
 *
 * Multi-row sheets (2026-08-31, the Luffy attack sheet — a punch sequence
 * long enough that it was laid out as two rows instead of one very wide
 * strip): row bands are found the same way as frame columns, a gap of
 * fully-transparent rows separating them, so this needs no flag — frames
 * come out in top-to-bottom, then left-to-right order automatically.
 *
 * That same sheet also has a fist/speed-line motion trail drawn as a faint
 * streak that fades to fully-transparent for a column before resuming,
 * which the column scan reads as its own tiny "frame" otherwise (confirmed
 * by rendering the actual pixels, not guessed: a 1px-wide "frame" showed up
 * a couple pixels past a punch's fist — the tail of that punch's own speed
 * lines, not a separate pose). `--min-fragment-width` (default 8) merges
 * any run narrower than that into whichever real neighbor it sits closer
 * to, extending that neighbor's span to include it. 0 disables merging, for
 * a sheet where a real frame is legitimately that narrow.
 *
 * Usage:
 *   npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...] [--stabilize[=prefix,...]] [--min-fragment-width=N]
 *
 * <input.png> is resolved relative to the repo's `public/` directory (or
 * pass an absolute/relative filesystem path). <output.json> is written
 * relative to the current working directory. --names assigns frame names
 * left-to-right (top row first, then next row, ...), count must match the
 * number of frames detected; omit it to get sequential `frame-0`,
 * `frame-1`, ... names (in which case --stabilize treats the whole sheet
 * as one group). --stabilize applies the left-edge padding fix described
 * above; bare --stabilize applies it to every animation group,
 * --stabilize=idle restricts it to groups whose name prefix (e.g. "idle"
 * for "idle-0", "idle-1", ...) is in the list — use this for a sheet that
 * mixes a stationary loop with real motion (a run, dash, or attack lunge),
 * since applying it to real motion misreads that motion as drift. Confirm
 * by eye first (SpriteTestScene's speed buttons).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { PNG } from 'pngjs';

interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function resolveInputPath(input: string): string {
  if (isAbsolute(input) || existsSync(input)) return input;
  const underPublic = join('public', input);
  if (existsSync(underPublic)) return underPublic;
  return input;
}

/** Finds contiguous runs of `true` in a boolean array, as [start, end] index pairs (inclusive). */
function findRuns(hasContent: boolean[]): Array<{ start: number; end: number }> {
  const runs: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let i = 0; i <= hasContent.length; i++) {
    const has = i < hasContent.length && hasContent[i];
    if (has && runStart === -1) {
      runStart = i;
    } else if (!has && runStart !== -1) {
      runs.push({ start: runStart, end: i - 1 });
      runStart = -1;
    }
  }
  return runs;
}

/**
 * Merges any run narrower than `minWidth` into whichever neighbor (previous
 * or next) it sits closer to, extending that neighbor's span to cover it.
 * Exists for sheets with a fist/weapon motion trail drawn as a faint streak
 * that fades to fully-transparent for a column or two before resuming — the
 * column scan reads that as its own tiny "frame" otherwise. A real frame is
 * never a handful of pixels wide, so treating anything under `minWidth` as
 * a stray fragment of its nearest real neighbor is a safe default. A
 * fragment with no neighbor at all (the whole row is just fragments) is
 * left as-is rather than silently dropped.
 */
function mergeNarrowFragments(runs: Array<{ start: number; end: number }>, minWidth: number): Array<{ start: number; end: number }> {
  const result: Array<{ start: number; end: number }> = [];
  const pending = runs.map((r) => ({ ...r }));
  for (let i = 0; i < pending.length; i++) {
    const run = pending[i];
    const width = run.end - run.start + 1;
    if (width >= minWidth) {
      result.push(run);
      continue;
    }
    const prev = result[result.length - 1];
    const next = pending[i + 1];
    const gapToPrev = prev ? run.start - prev.end - 1 : Infinity;
    const gapToNext = next ? next.start - run.end - 1 : Infinity;
    if (prev && gapToPrev <= gapToNext) {
      prev.end = run.end;
    } else if (next) {
      next.start = run.start;
    } else if (prev) {
      prev.end = run.end;
    } else {
      result.push(run);
    }
  }
  return result;
}

/**
 * Detects frames across one or more rows. Row bands are found the same way
 * as frame columns (a gap of fully-transparent rows separates them), so a
 * sheet laid out as a grid of poses (common once a single strip gets long)
 * works the same as a single-row strip — frames come out in top-to-bottom,
 * then left-to-right reading order. `minFragmentWidth` feeds
 * mergeNarrowFragments per row; 0 disables merging.
 */
function detectFrames(png: PNG, minFragmentWidth: number): FrameRect[] {
  const { width, height, data } = png;
  const alphaAt = (x: number, y: number): number => data[(width * y + x) * 4 + 3];

  const rowHasContent: boolean[] = [];
  for (let y = 0; y < height; y++) {
    let hasContent = false;
    for (let x = 0; x < width; x++) {
      if (alphaAt(x, y) > 0) {
        hasContent = true;
        break;
      }
    }
    rowHasContent.push(hasContent);
  }
  const rowBands = findRuns(rowHasContent);

  const frames: FrameRect[] = [];
  for (const band of rowBands) {
    const columnHasContent: boolean[] = [];
    for (let x = 0; x < width; x++) {
      let hasContent = false;
      for (let y = band.start; y <= band.end; y++) {
        if (alphaAt(x, y) > 0) {
          hasContent = true;
          break;
        }
      }
      columnHasContent.push(hasContent);
    }

    let columnRuns = findRuns(columnHasContent);
    if (minFragmentWidth > 0) columnRuns = mergeNarrowFragments(columnRuns, minFragmentWidth);

    for (const { start, end } of columnRuns) {
      let minY = band.end + 1;
      let maxY = band.start - 1;
      for (let y = band.start; y <= band.end; y++) {
        for (let x = start; x <= end; x++) {
          if (alphaAt(x, y) > 0) {
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            break;
          }
        }
      }
      frames.push({ x: start, y: minY, w: end - start + 1, h: maxY - minY + 1 });
    }
  }

  return frames;
}

function isRegionTransparent(png: PNG, x0: number, x1: number, y0: number, y1: number): boolean {
  const { width, data } = png;
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      if (data[(width * y + x) * 4 + 3] > 0) return false;
    }
  }
  return true;
}

/** Groups consecutive indices sharing the same name prefix (name with any trailing "-<digits>" stripped) — animations are contiguous runs left-to-right on the sheet, so this is enough without needing explicit group boundaries from the caller. */
function groupConsecutiveByPrefix(names: string[]): number[][] {
  const prefixOf = (name: string): string => name.replace(/-\d+$/, '');
  const groups: number[][] = [];
  let current: number[] = [];
  let currentPrefix = '';
  names.forEach((name, i) => {
    const prefix = prefixOf(name);
    if (current.length > 0 && prefix !== currentPrefix) {
      groups.push(current);
      current = [];
    }
    current.push(i);
    currentPrefix = prefix;
  });
  if (current.length > 0) groups.push(current);
  return groups;
}

/**
 * See the --stabilize doc comment above the file header for the technique
 * and its assumptions. Mutates nothing — returns adjusted copies, plus
 * console-ready notes about what changed or was skipped.
 *
 * `onlyPrefixes`, when non-empty, restricts stabilization to groups whose
 * name prefix is in the set — necessary in practice, not just cautious:
 * the technique assumes a stationary pose (idle, a held guard) and actively
 * misreads real intentional horizontal motion (a run cycle's leg reach, a
 * dash) as drift, inflating those frames instead of fixing anything. Pass
 * only the prefixes you've confirmed by eye should hold still.
 */
function stabilizeFrames(frames: FrameRect[], names: string[], png: PNG, onlyPrefixes: Set<string> | null): { frames: FrameRect[]; notes: string[] } {
  const result = frames.map((f) => ({ ...f }));
  const notes: string[] = [];
  const prefixOf = (name: string): string => name.replace(/-\d+$/, '');
  const groups = groupConsecutiveByPrefix(names);

  for (const group of groups) {
    if (group.length < 2) continue;
    const groupPrefix = prefixOf(names[group[0]]);
    if (onlyPrefixes && !onlyPrefixes.has(groupPrefix)) continue;
    const baseW = Math.min(...group.map((i) => frames[i].w));

    for (const i of group) {
      const f = frames[i];
      const shift = f.w - baseW;
      if (shift <= 0) continue;

      const newW = Math.max(baseW, 2 * f.w - baseW);
      const newX = f.x - shift;

      if (newX < 0 || !isRegionTransparent(png, newX, f.x - 1, f.y, f.y + f.h - 1)) {
        notes.push(`  ! ${names[i]}: needs ${shift}px left padding but that region isn't clear — left unchanged, check by hand`);
        continue;
      }

      result[i] = { x: newX, y: f.y, w: newW, h: f.h };
      notes.push(`  ~ ${names[i]}: x ${f.x} -> ${newX}, w ${f.w} -> ${newW}`);
    }
  }

  return { frames: result, notes };
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const namesArg = args.find((a) => a.startsWith('--names='));
  const stabilizeArg = args.find((a) => a === '--stabilize' || a.startsWith('--stabilize='));
  const stabilize = stabilizeArg !== undefined;
  const stabilizePrefixes = stabilizeArg?.includes('=') ? new Set(stabilizeArg.slice('--stabilize='.length).split(',').map((s) => s.trim())) : null;
  const minFragmentWidthArg = args.find((a) => a.startsWith('--min-fragment-width='));
  const minFragmentWidth = minFragmentWidthArg ? Number(minFragmentWidthArg.slice('--min-fragment-width='.length)) : 8;

  if (positional.length < 2) {
    console.error('Usage: npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...] [--stabilize[=prefix,...]] [--min-fragment-width=N]');
    process.exit(1);
  }

  const [inputArg, outputArg] = positional;
  const inputPath = resolveInputPath(inputArg);
  if (!existsSync(inputPath)) {
    console.error(`Input PNG not found: ${inputArg} (looked at ${resolve(inputPath)})`);
    process.exit(1);
  }

  const png = PNG.sync.read(readFileSync(inputPath));
  let frames = detectFrames(png, minFragmentWidth);

  if (frames.length === 0) {
    console.error('No frames detected — every pixel in the sheet appears fully transparent.');
    process.exit(1);
  }

  let names = frames.map((_, i) => `frame-${i}`);
  if (namesArg) {
    const provided = namesArg.slice('--names='.length).split(',').map((s) => s.trim());
    if (provided.length !== frames.length) {
      console.error(`--names has ${provided.length} names but ${frames.length} frames were detected. Detected frame rects:`);
      frames.forEach((f, i) => console.error(`  [${i}] x:${f.x} y:${f.y} w:${f.w} h:${f.h}`));
      process.exit(1);
    }
    names = provided;
  }

  let stabilizeNotes: string[] = [];
  if (stabilize) {
    const stabilized = stabilizeFrames(frames, names, png, stabilizePrefixes);
    frames = stabilized.frames;
    stabilizeNotes = stabilized.notes;
  }

  const atlasFrames: Record<string, unknown> = {};
  names.forEach((name, i) => {
    const f = frames[i];
    atlasFrames[name] = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
  });

  const atlas = {
    frames: atlasFrames,
    meta: {
      app: 'projectselvaria-tools',
      version: '1.0',
      image: inputArg.split('/').pop(),
      format: 'RGBA8888',
      size: { w: png.width, h: png.height },
      scale: '1',
    },
  };

  writeFileSync(outputArg, JSON.stringify(atlas, null, 2));

  console.log(`Detected ${frames.length} frame(s) in ${inputArg} (${png.width}x${png.height}px):`);
  names.forEach((name, i) => {
    const f = frames[i];
    console.log(`  ${name.padEnd(12)} x:${f.x} y:${f.y} w:${f.w} h:${f.h}`);
  });
  if (stabilize) {
    console.log(stabilizeNotes.length > 0 ? 'Stabilization adjustments:' : 'Stabilization: no adjustments needed.');
    stabilizeNotes.forEach((note) => console.log(note));
  }
  console.log(`Wrote ${outputArg}`);
}

main();
