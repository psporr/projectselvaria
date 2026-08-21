import { Scene } from 'phaser';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';

// Still a placeholder — no real assets to preload yet (HANDOFF.md §12).
// Replaced with real asset preloading once art exists; for now it's just a
// title beat before handing off to TacticalScene.
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        applyDprZoom(this);

        this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, 'Project Selvaria', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#e0e0e0',
            resolution: DPR
        }).setOrigin(0.5);

        this.time.delayedCall(400, () => this.scene.start('Tactical'));
    }
}
