// ============================================================================
// Game Engine Registry
// ============================================================================

import { GameEngine, GameId } from '../types';
import { GatosCaesEngine } from './gatos-caes';
import { DominorioEngine } from './dominorio';
import { QuelhasEngine } from './quelhas';
import { ProdutoEngine } from './produto';
import { AtariGoEngine } from './atari-go';
import { NexEngine } from './nex';

// Re-export bot strategies
export { getBotMove, type BotLevel } from './bot-strategies';

// Registry of all game engines
const gameEngines: Map<GameId, GameEngine<unknown, unknown>> = new Map();

// Register all engines
gameEngines.set('gatos-caes', new GatosCaesEngine());
gameEngines.set('dominorio', new DominorioEngine());
gameEngines.set('quelhas', new QuelhasEngine());
gameEngines.set('produto', new ProdutoEngine());
gameEngines.set('atari-go', new AtariGoEngine());
gameEngines.set('nex', new NexEngine());

/**
 * Gets the game engine for the specified game
 */
export function getGameEngine(gameId: GameId): GameEngine<unknown, unknown> | undefined {
  return gameEngines.get(gameId);
}

/**
 * Checks if a game engine exists for the given game
 */
export function hasGameEngine(gameId: GameId): boolean {
  return gameEngines.has(gameId);
}

/**
 * Gets all available game IDs
 */
export function getAvailableGames(): GameId[] {
  return Array.from(gameEngines.keys());
}

/**
 * Registers a new game engine
 */
export function registerGameEngine(engine: GameEngine<unknown, unknown>): void {
  gameEngines.set(engine.gameId, engine);
  console.log(`[GAME-ENGINE] Registered engine for ${engine.gameId}`);
}
