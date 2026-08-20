import { AUTO, Game, Types } from 'phaser';
import { BootScene } from './scenes/BootScene';

// Phaser config + Vite entry point. Scenes render from boardgame.io's G/ctx and
// dispatch moves back — they never own authoritative state. See HANDOFF.md §7.
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: '#1a1a2e',
    scene: [BootScene]
};

document.addEventListener('DOMContentLoaded', () => {
    new Game(config);
});
