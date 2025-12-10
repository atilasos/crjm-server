// ============================================================================
// Bot Manager - Handles bot moves during games
// ============================================================================

import { tournamentManager } from '../core/tournament/tournament-manager';
import { gameSessionManager } from '../core/game-session/game-session-manager';
import { getBotMove } from '../core/game-engine';
import type { Match, PlayerRole, GameId } from '../core/types';

// ============================================================================
// Types
// ============================================================================

interface BotMoveContext {
  tournamentId: string;
  matchId: string;
  sessionId: string;
}

// Callback type for notifying about game state changes
type GameUpdateCallback = (
  tournamentId: string,
  match: Match,
  sessionId: string
) => void;

type GameEndCallback = (
  tournamentId: string,
  match: Match,
  sessionId: string,
  winnerRole: PlayerRole | 'draw' | null
) => void;

// ============================================================================
// Bot Manager
// ============================================================================

let onGameUpdate: GameUpdateCallback | null = null;
let onGameEnd: GameEndCallback | null = null;

/**
 * Set callbacks for game updates (called after bot moves)
 */
export function setBotCallbacks(
  updateCb: GameUpdateCallback,
  endCb: GameEndCallback
): void {
  onGameUpdate = updateCb;
  onGameEnd = endCb;
}

/**
 * Check if the current player in a match is a bot and play for them
 * Returns true if a bot move was made
 */
export function maybePlayForBot(
  tournamentId: string,
  match: Match,
  sessionId: string
): boolean {
  const session = gameSessionManager.getSession(sessionId);
  if (!session || session.isFinished) {
    return false;
  }

  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament) {
    return false;
  }

  // Determine whose turn it is
  const currentTurn = session.currentTurn;
  const currentPlayerId = currentTurn === 'player1' ? match.player1Id : match.player2Id;

  if (!currentPlayerId) {
    return false;
  }

  // Check if current player is a bot
  const isBot = tournamentManager.isPlayerBot(tournamentId, currentPlayerId);
  if (!isBot) {
    return false;
  }

  // Get bot move
  const gameId = session.gameId as GameId;
  const state = session.state;
  const botMove = getBotMove(gameId, state, currentTurn, 'advanced');

  if (botMove === null) {
    console.log(`[BOT] No valid move found for bot ${currentPlayerId} in match ${match.id}`);
    return false;
  }

  // Submit the move
  const result = gameSessionManager.submitMove(
    sessionId,
    currentPlayerId,
    currentTurn,
    botMove
  );

  if (!result.success) {
    console.error(`[BOT] Failed to submit move for bot ${currentPlayerId}: ${result.error}`);
    return false;
  }

  console.log(`[BOT] Bot ${currentPlayerId} played in match ${match.id}`);

  // Notify about game update
  if (onGameUpdate) {
    onGameUpdate(tournamentId, match, sessionId);
  }

  // Handle game over
  if (result.gameOver && onGameEnd) {
    onGameEnd(tournamentId, match, sessionId, result.winner || null);
  }

  return true;
}

/**
 * Play a full game between two bots
 * Returns when the game is over
 */
export async function playBotGame(
  tournamentId: string,
  match: Match,
  sessionId: string,
  delayMs: number = 500
): Promise<void> {
  const session = gameSessionManager.getSession(sessionId);
  if (!session) return;

  let moveCount = 0;
  const maxMoves = 1000; // Safety limit

  while (!session.isFinished && moveCount < maxMoves) {
    const moved = maybePlayForBot(tournamentId, match, sessionId);
    
    if (!moved) {
      // Not a bot's turn or no valid move
      break;
    }

    moveCount++;

    // Small delay to prevent blocking (allows other async operations)
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  console.log(`[BOT] Bot game in match ${match.id} completed after ${moveCount} moves`);
}

/**
 * Check if a match is between two bots
 */
export function isBotVsBotMatch(tournamentId: string, match: Match): boolean {
  if (!match.player1Id || !match.player2Id) return false;

  const isBot1 = tournamentManager.isPlayerBot(tournamentId, match.player1Id);
  const isBot2 = tournamentManager.isPlayerBot(tournamentId, match.player2Id);

  return isBot1 && isBot2;
}

/**
 * Check if at least one player in a match is a bot
 */
export function hasBot(tournamentId: string, match: Match): boolean {
  if (match.player1Id && tournamentManager.isPlayerBot(tournamentId, match.player1Id)) {
    return true;
  }
  if (match.player2Id && tournamentManager.isPlayerBot(tournamentId, match.player2Id)) {
    return true;
  }
  return false;
}

/**
 * Schedule bot moves after a short delay (to allow UI updates)
 */
export function scheduleBotMove(
  tournamentId: string,
  match: Match,
  sessionId: string,
  delayMs: number = 100
): void {
  setTimeout(() => {
    maybePlayForBot(tournamentId, match, sessionId);
  }, delayMs);
}
