import { AUTO, Game, Scale, Types } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TacticalScene } from './scenes/TacticalScene';
import { UIScene } from './scenes/UIScene';
import { DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from './systems/viewport';

// Phaser config + Vite entry point. Scenes render from boardgame.io's G/ctx and
// dispatch moves back — they never own authoritative state. See HANDOFF.md §7.
//
// Portrait-first (HANDOFF.md §10): every map is portrait-oriented, so the
// design resolution is too. Scale.FIT + CENTER_BOTH scales that to whatever
// viewport it actually lands on — phone, tablet, or desktop browser — via
// CSS, letterboxing rather than stretching.
//
// The canvas's actual pixel resolution is LOGICAL_WIDTH/HEIGHT multiplied by
// DPR (src/systems/viewport.ts) so it's crisp on high-density phone screens
// instead of a fixed size the browser has to stretch. Every scene calls
// applyDprZoom(this) to compensate, so TacticalScene/UIScene/every UI panel's
// own layout constants stay authored against the unscaled 480x854 base.
const config: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    fps: {
        target: 60,
        limit: 60,
        smoothStep: true
    },
    render: {
        powerPreference: 'high-performance',
        antialias: false,
        antialiasGL: false,
        roundPixels: true
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: LOGICAL_WIDTH * DPR,
        height: LOGICAL_HEIGHT * DPR
    },
    scene: [BootScene, TacticalScene, UIScene]
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
