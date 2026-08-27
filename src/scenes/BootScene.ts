import { Scene } from 'phaser';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { FONT_FAMILY } from '../ui/kit';

const LOGO_KEY = 'boot-logo';

// A brief title beat before handing off to ChapterSelectScene (2026-08-27;
// used to hand off straight to TacticalScene, back when Roguelike/
// TEST_MAP_2 was the only reachable mode). Shows the real game logo (same
// asset ChapterSelectScene uses) rather than plain text — since it's on
// screen so briefly, it's preloaded here and just re-requested (cached, a
// no-op fetch) by ChapterSelectScene's own preload().
export class BootScene extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        this.load.image(LOGO_KEY, encodeURI('project selvaria icon.png'));
    }

    create() {
        this.cameras.main.setBackgroundColor('#0d0f1a');
        applyDprZoom(this);

        this.add.image(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 - 24, LOGO_KEY).setDisplaySize(160, 160);

        this.add.text(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2 + 86, `v${GAME_VERSION}`, {
            fontFamily: FONT_FAMILY,
            fontSize: '14px',
            color: '#70798c',
            resolution: DPR
        }).setOrigin(0.5);

        this.time.delayedCall(500, () => this.scene.start('ChapterSelect'));
    }
}
