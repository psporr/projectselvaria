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
 * Usage:
 *   npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...] [--stabilize[=prefix,...]]
 *
 * <input.png> is resolved relative to the repo's `public/` directory (or
 * pass an absolute/relative filesystem path). <output.json> is written
 * relative to the current working directory. --names assigns frame names
 * left-to-right, count must match the number of frames detected; omit it
 * to get sequential `frame-0`, `frame-1`, ... names (in which case
 * --stabilize treats the whole sheet as one group). --stabilize applies
 * the left-edge padding fix described above; bare --stabilize applies it to
 * every animation group, --stabilize=idle restricts it to groups whose name
 * prefix (e.g. "idle" for "idle-0", "idle-1", ...) is in the list — use
 * this for a sheet that mixes a stationary loop with real motion (a run,
 * dash, or attack lunge), since applying it to real motion misreads that
 * motion as drift. Confirm by eye first (SpriteTestScene's speed buttons).
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

function detectFrames(png: PNG): FrameRect[] {
  const { width, height, data } = png;
  const alphaAt = (x: number, y: number): number => data[(width * y + x) * 4 + 3];

  const columnHasContent: boolean[] = [];
  for (let x = 0; x < width; x++) {
    let hasContent = false;
    for (let y = 0; y < height; y++) {
      if (alphaAt(x, y) > 0) {
        hasContent = true;
        break;
      }
    }
    columnHasContent.push(hasContent);
  }

  const columnRuns: Array<{ start: number; end: number }> = [];
  let runStart = -1;
  for (let x = 0; x <= width; x++) {
    const has = x < width && columnHasContent[x];
    if (has && runStart === -1) {
      runStart = x;
    } else if (!has && runStart !== -1) {
      columnRuns.push({ start: runStart, end: x - 1 });
      runStart = -1;
    }
  }

  return columnRuns.map(({ start, end }) => {
    let minY = height;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = start; x <= end; x++) {
        if (alphaAt(x, y) > 0) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
    }
    return { x: start, y: minY, w: end - start + 1, h: maxY - minY + 1 };
  });
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

  if (positional.length < 2) {
    console.error('Usage: npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...] [--stabilize[=prefix,...]]');
    process.exit(1);
  }

  const [inputArg, outputArg] = positional;
  const inputPath = resolveInputPath(inputArg);
  if (!existsSync(inputPath)) {
    console.error(`Input PNG not found: ${inputArg} (looked at ${resolve(inputPath)})`);
    process.exit(1);
  }

  const png = PNG.sync.read(readFileSync(inputPath));
  let frames = detectFrames(png);

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
