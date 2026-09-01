/**
 * Aseprite-source frame extractor — the intended replacement for
 * `scanSpriteAtlas.ts` on any hero whose art actually starts life as a
 * `.aseprite` file (2026-09-01, per the repo owner: producing full
 * commissioned animation for the whole roster costs too much, so the plan
 * going forward is a cheap per-hero Aseprite file — a handful of poses on
 * one fixed canvas — rather than a hand-cut multi-frame PNG sheet).
 *
 * `scanSpriteAtlas.ts`'s own doc comment already flagged this as the
 * better path when a source file exists, and this confirms why: Aseprite
 * stores every frame's cel at real `xpos`/`ypos` offsets against one
 * shared canvas, not a tight per-frame crop. Checked directly against the
 * first two source files (`public/aseprite/luffy.aseprite`, `zoro.aseprite`)
 * by reading their raw cel offsets: every idle frame's own content bottom
 * lands on the exact same canvas row (96px for Luffy across all 5 frames;
 * 96-97px for Zoro), even though a tight per-frame crop would've measured
 * different heights — proof the artist drew every pose against one fixed
 * ground line, not evidence of anything drifting.
 *
 * That means the right crop for every frame isn't its own tight bounding
 * box (`scanSpriteAtlas.ts`'s approach, needed there only because a
 * flattened PNG has no per-frame position data to trust) — it's the union
 * of every frame's content bounds, applied identically to all of them.
 * Every output frame ends up the same pixel size by construction, with
 * real per-frame content differences (an attack's wider reach) preserved
 * and nothing invented. That's what `--stabilize` tried to reconstruct
 * after the fact from transparent-pixel scanning; here it falls out
 * directly from data Aseprite already recorded, so there's no heuristic
 * to get wrong and no `--stabilize`-equivalent flag needed.
 *
 * The union is taken **per animation group** (idle frames together, the
 * attack frame(s) separately), not across all frames at once — a bug found
 * 2026-09-01 in this script's first version (the repo owner: units were
 * rendering shifted toward the left edge of their tile). A single global
 * union let the attack pose's one-off rightward reach drag the shared crop
 * window wide on the right side; the idle frames' own content, which never
 * moves right that far, then sat in the left portion of that oversized box
 * instead of centered in it. `scanSpriteAtlas.ts`'s `--stabilize` already
 * scoped its correction per same-prefix group for exactly this reason (its
 * own doc comment: real intentional motion in one animation shouldn't
 * flatten into another's). Grouping the union the same way here keeps idle
 * tightly self-consistent — the case that actually needs pixel-stable
 * centering, since it's what plays continuously — while letting the attack
 * pose keep its own natural extent without either group distorting the
 * other.
 *
 * Frame naming follows the convention `heroAnimations.ts` already consumes
 * via `generateFrameNames({ prefix, start, end })`: the first
 * `--idle-frames` frames become `idle-0..idle-(N-1)`, the remaining
 * `--attack-frames` become `attack-0..attack-(M-1)`. Defaults (4 idle + 1
 * attack) match both current source files — a single static "attack" pose
 * per hero, not a played animation (see `heroAnimations.ts`'s doc comment
 * on why the multi-frame flurry timing the old `scanSpriteAtlas.ts`-sourced
 * Luffy attack sheet needed doesn't apply to this pipeline).
 *
 * Multi-layer files composite bottom-to-top in layer order, skipping any
 * layer whose `visible` flag is off — untested against a real multi-layer
 * file (both source files so far are single-layer) but the correct general
 * behavior per the format, cheap to support now rather than silently
 * flattening wrong later.
 *
 * Usage:
 *   npm run extract-aseprite -- <input.aseprite> <name> [--idle-frames=N] [--attack-frames=M]
 *
 * <input.aseprite> is resolved relative to the repo's `public/` directory
 * (or pass an absolute/relative filesystem path). Writes
 * `public/heroes/<name>-atlas.png` and `public/heroes/<name>-atlas.json`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import Aseprite from 'ase-parser';
import { PNG } from 'pngjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const PUBLIC_DIR = join(REPO_ROOT, 'public');
const OUTPUT_DIR = join(PUBLIC_DIR, 'heroes');

function resolveInputPath(input: string): string {
  if (existsSync(input)) return input;
  const underPublic = join(PUBLIC_DIR, input);
  if (existsSync(underPublic)) return underPublic;
  return input;
}

/** One fully-composited frame: RGBA pixels, canvas-sized, top-to-bottom row order (matches both ase-parser's decoded cel data and pngjs's expected input). */
function compositeFrame(doc: Aseprite, frameIndex: number): Buffer {
  const { width, height } = doc;
  const canvas = Buffer.alloc(width * height * 4, 0);
  const frame = doc.frames[frameIndex];

  // Cels are composited in layer order (index 0 = bottom), each frame
  // holding at most one cel per layer — later (higher) layers drawn last
  // so they paint over earlier ones, matching how Aseprite itself renders.
  const celsByLayer = new Map(frame.cels.map((cel) => [cel.layerIndex, cel]));
  doc.layers.forEach((layer, layerIndex) => {
    if (!layer.flags.visible) return;
    const cel = celsByLayer.get(layerIndex);
    if (!cel || cel.celType === 1) return; // celType 1 = linked cel with no pixel data of its own in this parse; none of today's source files use it.
    const { xpos, ypos, w, h, rawCelData } = cel;
    if (!rawCelData) return;
    for (let y = 0; y < h; y++) {
      const destY = ypos + y;
      if (destY < 0 || destY >= height) continue;
      for (let x = 0; x < w; x++) {
        const destX = xpos + x;
        if (destX < 0 || destX >= width) continue;
        const srcOffset = (y * w + x) * 4;
        const destOffset = (destY * width + destX) * 4;
        const srcAlpha = rawCelData[srcOffset + 3];
        if (srcAlpha === 0) continue; // Cheap opaque-over composite (no alpha blending) — correct for every source file so far, since none stack a semi-transparent layer over another.
        canvas[destOffset] = rawCelData[srcOffset];
        canvas[destOffset + 1] = rawCelData[srcOffset + 1];
        canvas[destOffset + 2] = rawCelData[srcOffset + 2];
        canvas[destOffset + 3] = srcAlpha;
      }
    }
  });

  return canvas;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The smallest rect (in canvas coordinates) that contains every listed frame's actual cel content — see the module doc comment on why this is scoped per animation group, not taken across every frame in the file at once. */
function groupContentBounds(doc: Aseprite, frameIndices: number[]): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const i of frameIndices) {
    for (const cel of doc.frames[i].cels) {
      if (cel.celType === 1 || !cel.rawCelData) continue;
      minX = Math.min(minX, cel.xpos);
      minY = Math.min(minY, cel.ypos);
      maxX = Math.max(maxX, cel.xpos + cel.w);
      maxY = Math.max(maxY, cel.ypos + cel.h);
    }
  }
  if (!Number.isFinite(minX)) {
    throw new Error('No visible pixel content found in this frame group — every cel was empty or linked.');
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

interface AtlasFrameEntry {
  frame: { x: number; y: number; w: number; h: number };
  rotated: false;
  trimmed: false;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}

function main(): void {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const idleFramesArg = args.find((a) => a.startsWith('--idle-frames='));
  const attackFramesArg = args.find((a) => a.startsWith('--attack-frames='));
  const idleFrameCount = idleFramesArg ? Number(idleFramesArg.slice('--idle-frames='.length)) : 4;
  const attackFrameCount = attackFramesArg ? Number(attackFramesArg.slice('--attack-frames='.length)) : 1;

  if (positional.length < 2) {
    console.error('Usage: npm run extract-aseprite -- <input.aseprite> <name> [--idle-frames=N] [--attack-frames=M]');
    process.exit(1);
  }

  const [inputArg, name] = positional;
  const inputPath = resolveInputPath(inputArg);
  if (!existsSync(inputPath)) {
    console.error(`Input .aseprite not found: ${inputArg} (looked at ${resolve(inputPath)})`);
    process.exit(1);
  }

  const doc = new Aseprite(readFileSync(inputPath), inputArg);
  doc.parse();

  const expectedFrames = idleFrameCount + attackFrameCount;
  if (doc.numFrames !== expectedFrames) {
    console.error(`${inputArg} has ${doc.numFrames} frames, but --idle-frames=${idleFrameCount} + --attack-frames=${attackFrameCount} expects ${expectedFrames}. Pass matching counts.`);
    process.exit(1);
  }

  // Each animation gets its own name, its own frame-index range, and (per
  // the module doc comment) its own independently-computed union crop —
  // groups never share or influence each other's window.
  const groups: Array<{ prefix: string; indices: number[] }> = [];
  if (idleFrameCount > 0) groups.push({ prefix: 'idle', indices: Array.from({ length: idleFrameCount }, (_, i) => i) });
  if (attackFrameCount > 0) groups.push({ prefix: 'attack', indices: Array.from({ length: attackFrameCount }, (_, i) => idleFrameCount + i) });

  const crops = groups.map((g) => groupContentBounds(doc, g.indices));
  const stripWidth = groups.reduce((sum, g, gi) => sum + g.indices.length * crops[gi].w, 0);
  const stripHeight = Math.max(...crops.map((c) => c.h));
  const strip = new PNG({ width: stripWidth, height: stripHeight });
  const atlasFrames: Record<string, AtlasFrameEntry> = {};
  const names: string[] = [];

  let destX = 0;
  groups.forEach((group, gi) => {
    const crop = crops[gi];
    group.indices.forEach((frameIndex, iInGroup) => {
      const frameName = `${group.prefix}-${iInGroup}`;
      names.push(frameName);
      const pixels = compositeFrame(doc, frameIndex);
      for (let y = 0; y < crop.h; y++) {
        const srcRowStart = ((crop.y + y) * doc.width + crop.x) * 4;
        const destRowStart = (y * strip.width + destX) * 4;
        pixels.copy(strip.data, destRowStart, srcRowStart, srcRowStart + crop.w * 4);
      }
      atlasFrames[frameName] = {
        frame: { x: destX, y: 0, w: crop.w, h: crop.h },
        rotated: false,
        trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: crop.w, h: crop.h },
        sourceSize: { w: crop.w, h: crop.h },
      };
      destX += crop.w;
    });
  });

  const atlas = {
    frames: atlasFrames,
    meta: {
      app: 'projectselvaria-tools',
      version: '1.0',
      image: `${name}-atlas.png`,
      format: 'RGBA8888',
      size: { w: strip.width, h: strip.height },
      scale: '1',
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const pngPath = join(OUTPUT_DIR, `${name}-atlas.png`);
  const jsonPath = join(OUTPUT_DIR, `${name}-atlas.json`);
  writeFileSync(pngPath, PNG.sync.write(strip));
  writeFileSync(jsonPath, JSON.stringify(atlas, null, 2));

  console.log(`Wrote ${names.length} frames to:`);
  console.log(`  ${pngPath}`);
  console.log(`  ${jsonPath}`);
  groups.forEach((g, gi) => console.log(`  ${g.prefix}-*: ${crops[gi].w}x${crops[gi].h} (${g.indices.length} frame${g.indices.length === 1 ? '' : 's'})`));
}

main();
