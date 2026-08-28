import { Client } from 'boardgame.io/client';
import { createSelvariaGame } from '../game/game';
import type { CampaignCarryOver, ChapterDef } from '../game/maps';
import type { GameMode, GameState } from '../game/types';

/**
 * The vanilla (non-React) boardgame.io client, constructed once outside any
 * scene (HANDOFF.md §6/§7) — Phaser draws, boardgame.io owns truth. A scene
 * subscribes to it and reconciles sprites to `G`; player input dispatches
 * moves on it, never mutates state directly. This single local client drives
 * both sides: the player's clicks dispatch player-team moves, and the scene
 * dispatches enemy-team moves on the AI's behalf (src/game/ai.ts) — the same
 * shape src/scripts/simulate.ts uses to drive both sides headlessly.
 *
 * Typed via ReturnType rather than importing boardgame.io's internal
 * `_ClientImpl` — the package only exports the `Client` factory function
 * from its public `boardgame.io/client` entry point.
 */
export type GameClient = ReturnType<typeof Client<GameState>>;

/**
 * Builds the Game definition for `mode`/`chapter` (via `createSelvariaGame`,
 * game.ts) and constructs a client against it. `mode`/`chapter` are now
 * caller-supplied rather than hardcoded — `MainMenuScene`/
 * `ChapterSelectScene` pick them, `TacticalScene.init()` passes them
 * through — so the same client factory serves both a roguelike run and any
 * campaign chapter, fresh or resumed from a `CampaignCarryOver`.
 */
export function createGameClient(mode: GameMode, chapter: ChapterDef, carryOver?: CampaignCarryOver, baseLevel?: number): GameClient {
  const game = createSelvariaGame(mode, chapter, carryOver, baseLevel);
  // boardgame.io's built-in debug panel is a React/DOM overlay meant for
  // developing the Game definition itself — not part of the shipped game,
  // and it visually collides with TacticalScene's own HUD.
  const client = Client({ game, numPlayers: 2, debug: false });
  client.start();
  return client;
}
