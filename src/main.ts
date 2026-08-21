import { AUTO, Game, Scale, Types } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TacticalScene } from './scenes/TacticalScene';
import { UIScene } from './scenes/UIScene';

// Phaser config + Vite entry point. Scenes render from boardgame.io's G/ctx and
// dispatch moves back — they never own authoritative state. See HANDOFF.md §7.
//
// Portrait-first (HANDOFF.md §10): every map is portrait-oriented, so the
// design resolution is too. Scale.FIT + CENTER_BOTH scales that to whatever
// viewport it actually lands on — phone, tablet, or desktop browser — via
// CSS, letterboxing rather than stretching. TacticalScene's own layout
// constants are sized against this same 480x854 base.
const config: Types.Core.GameConfig = {
    type: AUTO,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
        width: 480,
        height: 854
    },
    scene: [BootScene, TacticalScene, UIScene]
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
