import { Scene } from 'phaser';

// Placeholder boot scene, just to confirm the Phaser 4 + Vite scaffold boots.
// Replaced with real asset preloading once the pure game core (src/game/) is ported and simulated green — see HANDOFF.md §12.
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');

        this.add.text(this.scale.width / 2, this.scale.height / 2, 'Project Selvaria', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#e0e0e0'
        }).setOrigin(0.5);
    }
}
