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
 * Usage:
 *   npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...]
 *
 * <input.png> is resolved relative to the repo's `public/` directory (or
 * pass an absolute/relative filesystem path). <output.json> is written
 * relative to the current working directory. --names assigns frame names
 * left-to-right, count must match the number of frames detected; omit it
 * to get sequential `frame-0`, `frame-1`, ... names.
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

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const namesArg = args.find((a) => a.startsWith('--names='));

  if (positional.length < 2) {
    console.error('Usage: npm run scan-atlas -- <input.png> <output.json> [--names=a,b,c,...]');
    process.exit(1);
  }

  const [inputArg, outputArg] = positional;
  const inputPath = resolveInputPath(inputArg);
  if (!existsSync(inputPath)) {
    console.error(`Input PNG not found: ${inputArg} (looked at ${resolve(inputPath)})`);
    process.exit(1);
  }

  const png = PNG.sync.read(readFileSync(inputPath));
  const frames = detectFrames(png);

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
  console.log(`Wrote ${outputArg}`);
}

main();
