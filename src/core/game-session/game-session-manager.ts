// ============================================================================
// Game Session Manager - Manages active game sessions
// ============================================================================

import { 
  GameSession, 
  GameId, 
  PlayerRole, 
  GameMove,
  GameResult 
} from '../types';
import { generateId } from '../utils';
import { getGameEngine } from '../game-engine';

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private sessionsByMatch: Map<string, string[]> = new Map();

  // =========================================================================
  // Session Creation
  // =========================================================================

  createSession(
    tournamentId: string,
    matchId: string,
    gameNumber: number,
    gameId: GameId,
    startingPlayer: PlayerRole
  ): GameSession | null {
    const engine = getGameEngine(gameId);
    if (!engine) {
      console.log(`[GAME-SESSION] No engine found for ${gameId}`);
      return null;
    }

    const session: GameSession = {
      id: generateId('session'),
      tournamentId,
      matchId,
      gameNumber,
      gameId,
      state: engine.createInitialState(startingPlayer),
      currentTurn: startingPlayer,
      isFinished: false,
      winnerId: null,
      moves: [],
      startedAt: new Date(),
    };

    this.sessions.set(session.id, session);

    // Track by match
    const matchSessions = this.sessionsByMatch.get(matchId) || [];
    matchSessions.push(session.id);
    this.sessionsByMatch.set(matchId, matchSessions);

    console.log(`[GAME-SESSION] Created session ${session.id} for match ${matchId}, game ${gameNumber}`);
    return session;
  }

  // =========================================================================
  // Session Retrieval
  // =========================================================================

  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessionForMatch(matchId: string): GameSession | undefined {
    const sessionIds = this.sessionsByMatch.get(matchId) || [];
    for (const id of sessionIds) {
      const session = this.sessions.get(id);
      if (session && !session.isFinished) {
        return session;
      }
    }
    return undefined;
  }

  getSessionsForMatch(matchId: string): GameSession[] {
    const sessionIds = this.sessionsByMatch.get(matchId) || [];
    return sessionIds
      .map(id => this.sessions.get(id))
      .filter(Boolean) as GameSession[];
  }

  // =========================================================================
  // Move Processing
  // =========================================================================

  submitMove(
    sessionId: string,
    playerId: string,
    playerRole: PlayerRole,
    move: unknown
  ): { success: boolean; error?: string; gameOver?: boolean; winner?: GameResult } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    if (session.isFinished) {
      return { success: false, error: 'Game is already finished' };
    }

    const engine = getGameEngine(session.gameId);
    if (!engine) {
      return { success: false, error: 'Game engine not found' };
    }

    // Check if it's the player's turn
    if (session.currentTurn !== playerRole) {
      return { success: false, error: 'Not your turn' };
    }

    // Validate move
    if (!engine.validateMove(session.state, move, playerRole)) {
      return { success: false, error: 'Invalid move' };
    }

    // Apply move
    session.state = engine.applyMove(session.state, move, playerRole);
    session.currentTurn = engine.getCurrentTurn(session.state);

    // Record move
    const gameMove: GameMove = {
      playerId,
      move,
      timestamp: new Date(),
    };
    session.moves.push(gameMove);

    // Check for game over
    if (engine.isGameOver(session.state)) {
      session.isFinished = true;
      session.finishedAt = new Date();
      const winner = engine.getWinner(session.state);
      
      console.log(`[GAME-SESSION] Game ${sessionId} finished. Winner: ${winner}`);
      
      return { 
        success: true, 
        gameOver: true, 
        winner 
      };
    }

    return { success: true, gameOver: false };
  }

  // =========================================================================
  // State Serialization
  // =========================================================================

  getSerializedState(sessionId: string): unknown {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const engine = getGameEngine(session.gameId);
    if (!engine) return null;

    return engine.serializeState(session.state);
  }

  // =========================================================================
  // Cleanup
  // =========================================================================

  cleanupMatchSessions(matchId: string): void {
    const sessionIds = this.sessionsByMatch.get(matchId) || [];
    for (const id of sessionIds) {
      this.sessions.delete(id);
    }
    this.sessionsByMatch.delete(matchId);
    console.log(`[GAME-SESSION] Cleaned up ${sessionIds.length} sessions for match ${matchId}`);
  }
}

// Singleton instance
export const gameSessionManager = new GameSessionManager();

