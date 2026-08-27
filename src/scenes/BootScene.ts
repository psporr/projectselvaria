import { Scene } from 'phaser';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { FONT_FAMILY } from '../ui/kit';

// Still a placeholder — no real assets to preload yet (HANDOFF.md §12).
// Replaced with real asset preloading once art exists; for now it's just a
// title beat before handing off to ChapterSelectScene (2026-08-27; used to
// hand off straight to TacticalScene, back when Roguelike/TEST_MAP_2 was
// the only reachable mode).
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        applyDprZoom(this);

        this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 12, 'Project Selvaria', {
            fontFamily: FONT_FAMILY,
            fontSize: '32px',
            color: '#e0e0e0',
            resolution: DPR
        }).setOrigin(0.5);

        this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 28, `v${GAME_VERSION}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: '#70798c',
            resolution: DPR
        }).setOrigin(0.5);

        this.time.delayedCall(400, () => this.scene.start('ChapterSelect'));
    }
}
