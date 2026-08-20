import { AUTO, Game, Types } from 'phaser';
import { BootScene } from './scenes/BootScene';
import { TacticalScene } from './scenes/TacticalScene';

// Phaser config + Vite entry point. Scenes render from boardgame.io's G/ctx and
// dispatch moves back — they never own authoritative state. See HANDOFF.md §7.
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 920,
    height: 740,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scene: [BootScene, TacticalScene]
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
