import { Scene, GameObjects } from 'phaser';

import { computeEmbersEarned } from '../game/meta';
import type { GameState } from '../game/types';
import type { GameClient } from '../systems/gameClient';
import { applyDprZoom, DPR, LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../systems/viewport';
import { BlessingLogPanel } from '../ui/BlessingLogPanel';
import { Button, COLORS, FONT_FAMILY } from '../ui/kit';
import { EquipScreen } from '../ui/EquipScreen';
import { NodeChoicePanel } from '../ui/NodeChoicePanel';
import { RestPanel } from '../ui/RestPanel';
import { RunChoicePanel } from '../ui/RunChoicePanel';
import { ShopPanel } from '../ui/ShopPanel';
import { drawMenuBackground, preloadMenuBackground } from './menuBackground';

export interface PathSceneData {
  client: GameClient;
}

type PauseKind = 'run-choice' | 'node-choice' | 'rest' | 'shop';

/**
 * The between-fights hub (2026-09-06, per the repo owner: "a separate
 * screen for choosing path, so we can have a menu to have player have a
 * break and view squad, adjust equipment, view blessing"). TacticalScene
 * hands off here (goToPathScene()) the instant a fight's blessing/
 * promotion resolves into any of Bank-or-Descend, the branching-path
 * choice, a Rest node, or a Shop node — all four are non-combat pauses,
 * so there's no reason to keep the live battle board (and its board-taps-
 * do-nothing overlay panels) around for them. Same live `client` the whole
 * time: this scene never builds a fresh one, it's the SAME run continuing.
 *
 * Owns nothing UIScene-shaped — no phase banner, no action menu, none of
 * that belongs to a screen where no combat is happening. Squad/Blessings
 * are reachable from here specifically because that's what "a break"
 * means: check on your roster and your run's build without a live board
 * demanding attention underneath.
 */
export class PathScene extends Scene {
  private client!: GameClient;
  private headerText!: GameObjects.Text;

  private runChoicePanel!: RunChoicePanel;
  private nodeChoicePanel!: NodeChoicePanel;
  private restPanel!: RestPanel;
  private shopPanel!: ShopPanel;
  private equipScreen!: EquipScreen;
  private blessingLogPanel!: BlessingLogPanel;

  /** Which pause this scene currently has a panel open for — re-render only (re)opens a panel when this changes, so e.g. a Shop purchase (which changes G without changing "we're still in the shop") refreshes in place instead of flashing shut and reopening. */
  private shownFor: PauseKind | null = null;
  /** Set the instant a hand-off to TacticalScene is triggered, guarding against client.subscribe() firing scene.start('Tactical', ...) more than once while this scene is already shutting down. */
  private handingOff = false;

  constructor() {
    super('Path');
  }

  init(data: PathSceneData): void {
    this.client = data.client;
  }

  preload(): void {
    preloadMenuBackground(this);
  }

  create(): void {
    this.shownFor = null;
    this.handingOff = false;

    applyDprZoom(this);
    drawMenuBackground(this);

    // Depth 26: above every panel this scene shows (RunChoicePanel/
    // NodeChoicePanel/RestPanel/ShopPanel/EquipScreen at 20, BlessingLogPanel
    // at 25) so this persistent chrome never sits under one of their
    // full-screen dimming backdrops — the whole point of an "always-
    // reachable" dock is that it stays legible no matter what's showing.
    const CHROME_DEPTH = 26;

    this.headerText = this.add
      .text(LOGICAL_WIDTH / 2, 44, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: COLORS.textPrimary,
        resolution: DPR,
      })
      .setOrigin(0.5)
      .setDepth(CHROME_DEPTH);

    this.runChoicePanel = new RunChoicePanel(this);
    this.nodeChoicePanel = new NodeChoicePanel(this);
    this.restPanel = new RestPanel(this);
    this.shopPanel = new ShopPanel(this);
    // Constructed last so their equal-or-higher depth wins ties against
    // the pause panels above at the same insertion-order-breaks-ties rule
    // TacticalScene/UIScene's own panels already rely on.
    this.equipScreen = new EquipScreen(this, this.client);
    this.blessingLogPanel = new BlessingLogPanel(this);

    const dockY = LOGICAL_HEIGHT - 56;
    new Button(this, LOGICAL_WIDTH / 2 - 80, dockY, 140, 48, 'Squad', () => this.equipScreen.show()).setDepth(CHROME_DEPTH);
    new Button(this, LOGICAL_WIDTH / 2 + 80, dockY, 140, 48, 'Blessings', () => {
      const state = this.client.getState();
      if (state) this.blessingLogPanel.show(state.G);
    }).setDepth(CHROME_DEPTH);

    this.renderCurrentState();
    const unsubscribe = this.client.subscribe(() => {
      this.equipScreen.refresh();
      this.renderCurrentState();
    });
    this.events.once('shutdown', unsubscribe);
  }

  private updateHeader(G: GameState): void {
    const trialsSuffix = G.activeTrials.length > 0 ? `   ${G.activeTrials.length} Trial${G.activeTrials.length > 1 ? 's' : ''}` : '';
    this.headerText.setText(`${G.chapterShortName}   Wave ${G.wave}   ${G.gold} Gold${trialsSuffix}`);
  }

  private renderCurrentState(): void {
    if (this.handingOff) return;
    const state = this.client.getState();
    if (!state) return;
    const { G, ctx } = state;

    // Either the run just ended (Bank, or a wipe reached mid-hub — e.g. an
    // already-lethal DoT-style effect isn't a thing here, but this stays
    // correct regardless) or a combat node was just chosen and its fight
    // is now live in G — either way, TacticalScene is where that shows.
    if (ctx.gameover || (!G.awaitingRunChoice && !G.awaitingNodeChoice && !G.awaitingRest && !G.awaitingShop)) {
      this.handingOff = true;
      this.scene.start('Tactical', { existingClient: this.client });
      return;
    }

    this.updateHeader(G);

    if (G.awaitingRunChoice) {
      if (this.shownFor !== 'run-choice') {
        this.shownFor = 'run-choice';
        this.runChoicePanel.show({ wave: G.wave, embersIfBanked: computeEmbersEarned(G, true) }, (path) => {
          this.shownFor = null;
          this.client.moves.chooseRunPath(path);
        });
      }
      return;
    }

    if (G.awaitingNodeChoice) {
      if (this.shownFor !== 'node-choice') {
        this.shownFor = 'node-choice';
        this.nodeChoicePanel.show(G.nodeChoices, G.segmentDepth, (nodeId) => {
          this.shownFor = null;
          this.client.moves.chooseMapNode(nodeId);
        });
      }
      return;
    }

    if (G.awaitingRest) {
      if (this.shownFor !== 'rest') {
        this.shownFor = 'rest';
        this.restPanel.show((choice) => {
          this.shownFor = null;
          this.client.moves.chooseRest(choice);
        });
      }
      return;
    }

    if (G.awaitingShop) {
      if (this.shownFor !== 'shop') {
        this.shownFor = 'shop';
        this.shopPanel.show(
          G.shopOfferIds,
          G.gold,
          (blessingId) => this.client.moves.buyShopOffer(blessingId),
          () => {
            this.shownFor = null;
            this.client.moves.leaveShop();
          },
        );
      } else {
        this.shopPanel.refresh(G.shopOfferIds, G.gold);
      }
      return;
    }
  }
}
