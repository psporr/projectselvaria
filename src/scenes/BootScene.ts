import { Scene } from 'phaser';
import { ANIMATED_HERO_TEST_STAGE } from '../game/maps';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { GAME_VERSION } from '../version';
import { FONT_FAMILY } from '../ui/kit';
import type { TacticalSceneData } from './TacticalScene';

const LOGO_KEY = 'boot-logo';

// A brief title beat before handing off to MainMenuScene (2026-08-27;
// used to hand off straight to TacticalScene, back when Roguelike/
// TEST_MAP_2 was the only reachable mode). Shows the real game logo (same
// asset MainMenuScene uses) rather than plain text — since it's on
// screen so briefly, it's preloaded here and just re-requested (cached, a
// no-op fetch) by MainMenuScene's own preload().
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

        this.time.delayedCall(500, () => {
            // ?spriteTest=1 boots straight into SpriteTestScene — a deliberately
            // hidden dev entry point (2026-08-31), not on MainMenuScene's own
            // menu, since it's testing placeholder art with no commission yet.
            const params = new URLSearchParams(location.search);
            if (params.get('spriteTest')) {
                this.scene.start('SpriteTest');
                return;
            }
            // ?luffyTest=1 boots straight into ANIMATED_HERO_TEST_STAGE (2026-08-31) —
            // same hidden-dev-route convention, proving the animated-hero
            // pipeline inside a real battle instead of SpriteTestScene's
            // standalone viewer. See that chapter's own doc comment
            // (game/maps.ts) for why it's a TacticalSceneData.debugChapter
            // override rather than a real, menu-reachable chapter.
            if (params.get('luffyTest')) {
                const data: TacticalSceneData = { mode: 'campaign', debugChapter: ANIMATED_HERO_TEST_STAGE };
                this.scene.start('Tactical', data);
                return;
            }
            this.scene.start('MainMenu');
        });
    }
}
