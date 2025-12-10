// ============================================================================
// Bot Strategies - AI players for each game
// ============================================================================

import { GameId, PlayerRole } from '../types';
import { getGameEngine } from './index';
import { GatosCaesEngine } from './gatos-caes';
import { DominorioEngine } from './dominorio';
import { QuelhasEngine } from './quelhas';
import { ProdutoEngine } from './produto';
import { AtariGoEngine } from './atari-go';
import { NexEngine } from './nex';

// ============================================================================
// Types
// ============================================================================

export type BotLevel = 'basic' | 'advanced';

export interface BotMoveResult {
  move: unknown;
  confidence: number; // 0-1, how confident the bot is in this move
}

// ============================================================================
// Main Bot API
// ============================================================================

/**
 * Get the best move for a bot player
 * @param gameId - The game being played
 * @param state - Current game state (already deserialized)
 * @param role - The player role (player1 or player2)
 * @param level - Bot difficulty level
 * @returns The move to make, or null if no valid moves
 */
export function getBotMove(
  gameId: GameId,
  state: unknown,
  role: PlayerRole,
  level: BotLevel = 'advanced'
): unknown | null {
  switch (gameId) {
    case 'gatos-caes':
      return getGatosCaesMove(state, role, level);
    case 'dominorio':
      return getDominorioMove(state, role, level);
    case 'quelhas':
      return getQuelhasMove(state, role, level);
    case 'produto':
      return getProdutoMove(state, role, level);
    case 'atari-go':
      return getAtariGoMove(state, role, level);
    case 'nex':
      return getNexMove(state, role, level);
    default:
      return null;
  }
}

// ============================================================================
// Gatos & Cães Bot
// Strategy: Maximize own valid moves, minimize opponent's moves
// Win condition: Make the last move (opponent can't move)
// ============================================================================

function getGatosCaesMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new GatosCaesEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  if (level === 'basic') {
    // Random move
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  // Advanced: Evaluate each move
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    const newState = engine.applyMove(gameState, move, role);
    const score = evaluateGatosCaesState(engine, newState, role);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function evaluateGatosCaesState(
  engine: GatosCaesEngine,
  state: ReturnType<typeof engine.createInitialState>,
  forPlayer: PlayerRole
): number {
  const opponent: PlayerRole = forPlayer === 'player1' ? 'player2' : 'player1';

  // If we won, great!
  if (state.winner === forPlayer) return 10000;
  if (state.winner === opponent) return -10000;

  // Count valid moves for each player
  const myMoves = engine.getValidMoves(state, forPlayer).length;
  const oppMoves = engine.getValidMoves(state, opponent).length;

  // We want more moves (more flexibility) and opponent fewer moves
  // Since last move wins, having more moves is good
  return myMoves * 10 - oppMoves * 8;
}

// ============================================================================
// Dominório Bot
// Strategy: Control space, limit opponent's options
// Win condition: Opponent can't move
// ============================================================================

function getDominorioMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new DominorioEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  if (level === 'basic') {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  // Advanced: Use minimax with depth 2
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    const newState = engine.applyMove(gameState, move, role);
    const score = minimaxDominorio(engine, newState, 2, false, role, -Infinity, Infinity);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function minimaxDominorio(
  engine: DominorioEngine,
  state: ReturnType<typeof engine.createInitialState>,
  depth: number,
  isMaximizing: boolean,
  forPlayer: PlayerRole,
  alpha: number,
  beta: number
): number {
  const opponent: PlayerRole = forPlayer === 'player1' ? 'player2' : 'player1';

  // Terminal conditions
  if (state.winner === forPlayer) return 10000 + depth;
  if (state.winner === opponent) return -10000 - depth;
  if (depth === 0) {
    return evaluateDominorioState(engine, state, forPlayer);
  }

  const currentPlayer = isMaximizing ? forPlayer : opponent;
  const moves = engine.getValidMoves(state, currentPlayer);

  if (moves.length === 0) {
    // Current player can't move - they lose
    return isMaximizing ? -10000 - depth : 10000 + depth;
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const newState = engine.applyMove(state, move, currentPlayer);
      const evalScore = minimaxDominorio(engine, newState, depth - 1, false, forPlayer, alpha, beta);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const newState = engine.applyMove(state, move, currentPlayer);
      const evalScore = minimaxDominorio(engine, newState, depth - 1, true, forPlayer, alpha, beta);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

function evaluateDominorioState(
  engine: DominorioEngine,
  state: ReturnType<typeof engine.createInitialState>,
  forPlayer: PlayerRole
): number {
  const opponent: PlayerRole = forPlayer === 'player1' ? 'player2' : 'player1';
  const myMoves = engine.getValidMoves(state, forPlayer).length;
  const oppMoves = engine.getValidMoves(state, opponent).length;

  // More moves is better (opponent with 0 moves loses)
  return myMoves * 5 - oppMoves * 4;
}

// ============================================================================
// Quelhas Bot
// Strategy: Control board, force opponent into bad positions
// Win condition: Opponent makes last move (they lose)
// ============================================================================

function getQuelhasMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new QuelhasEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  if (level === 'basic') {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  // Advanced: Evaluate moves
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    // Skip swap for now in evaluation (it's situational)
    if ('swap' in move && move.swap) continue;

    const newState = engine.applyMove(gameState, move, role);
    const score = evaluateQuelhasState(engine, newState, role);

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

function evaluateQuelhasState(
  engine: QuelhasEngine,
  state: ReturnType<typeof engine.createInitialState>,
  forPlayer: PlayerRole
): number {
  const opponent: PlayerRole = forPlayer === 'player1' ? 'player2' : 'player1';

  if (state.winner === forPlayer) return 10000;
  if (state.winner === opponent) return -10000;

  const myMoves = engine.getValidMoves(state, forPlayer).length;
  const oppMoves = engine.getValidMoves(state, opponent).length;

  // Misère game: we want opponent to have fewer good options
  // Prefer states where opponent has odd number of forced moves
  return -oppMoves * 3 + myMoves;
}

// ============================================================================
// Produto Bot
// Strategy: Build large connected groups, split opponent's groups
// Win condition: Higher product of two largest groups
// ============================================================================

function getProdutoMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new ProdutoEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  if (level === 'basic') {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  // Advanced: Evaluate based on score improvement
  const myColor = role === 'player1' ? 'black' : 'white';
  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  // Sample a subset of moves if too many (performance)
  const movesToEvaluate = validMoves.length > 100
    ? sampleArray(validMoves, 100)
    : validMoves;

  for (const move of movesToEvaluate) {
    const newState = engine.applyMove(gameState, move, role);
    const scores = engine.getCurrentScores(newState);
    
    const myScore = myColor === 'black' ? scores.black : scores.white;
    const oppScore = myColor === 'black' ? scores.white : scores.black;
    
    // Prefer moves that increase our score and decrease opponent's
    const score = myScore - oppScore * 0.9;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ============================================================================
// Atari Go Bot
// Strategy: Capture opponent stones, protect own groups
// Win condition: First capture
// ============================================================================

function getAtariGoMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new AtariGoEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  // Filter out pass unless it's the only option
  const nonPassMoves = validMoves.filter(m => !('pass' in m && m.pass));
  const moves = nonPassMoves.length > 0 ? nonPassMoves : validMoves;

  if (level === 'basic') {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  // Advanced: Prioritize captures
  const myColor = role === 'player1' ? 'black' : 'white';
  const oppColor = myColor === 'black' ? 'white' : 'black';

  // Priority 1: Immediate captures
  for (const move of moves) {
    if ('pass' in move && move.pass) continue;
    if (engine.wouldCapture(gameState, move, role)) {
      return move;
    }
  }

  // Priority 2: Put opponent in atari
  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    if ('pass' in move && move.pass) continue;

    const newState = engine.applyMove(gameState, move, role);
    const oppAtariGroups = engine.getGroupsInAtari(newState, oppColor as 'black' | 'white');
    const myAtariGroups = engine.getGroupsInAtari(newState, myColor as 'black' | 'white');

    // Score: more opponent groups in atari is good, fewer of ours in atari is good
    let score = oppAtariGroups.length * 100 - myAtariGroups.length * 80;

    // Prefer central moves
    if ('row' in move && 'col' in move) {
      const centerDist = Math.abs(move.row - 4) + Math.abs(move.col - 4);
      score -= centerDist * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ============================================================================
// Nex Bot
// Strategy: Connect own color, block opponent's connections
// Win condition: Connect opposite edges
// ============================================================================

function getNexMove(state: unknown, role: PlayerRole, level: BotLevel): unknown | null {
  const engine = new NexEngine();
  const gameState = state as ReturnType<typeof engine.createInitialState>;
  const validMoves = engine.getValidMoves(gameState, role);

  if (validMoves.length === 0) return null;

  if (level === 'basic') {
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  // Advanced: Prefer 'place' moves in strategic positions
  // Prioritize central and connecting moves
  const placeMoves = validMoves.filter(m => m.type === 'place');

  if (placeMoves.length === 0) {
    // Fall back to any move
    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  let bestMove = placeMoves[0];
  let bestScore = -Infinity;

  for (const move of placeMoves) {
    if (move.type !== 'place' || !move.ownPiece) continue;

    const { row, col } = move.ownPiece;

    // Score based on position
    let score = 0;

    // Prefer center
    const centerRow = 5;
    const centerCol = 5;
    const distToCenter = Math.abs(row - centerRow) + Math.abs(col - centerCol);
    score -= distToCenter * 2;

    // For black (player1): prefer moves that help connect top-bottom
    // For white (player2): prefer moves that help connect left-right
    const effectiveRole = gameState.swapped
      ? (role === 'player1' ? 'player2' : 'player1')
      : role;

    if (effectiveRole === 'player1') {
      // Black connects top-bottom, prefer middle columns
      score -= Math.abs(col - centerCol) * 3;
    } else {
      // White connects left-right, prefer middle rows
      score -= Math.abs(row - centerRow) * 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

// ============================================================================
// Utility Functions
// ============================================================================

function sampleArray<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;

  const result: T[] = [];
  const indices = new Set<number>();

  while (result.length < n) {
    const idx = Math.floor(Math.random() * arr.length);
    if (!indices.has(idx)) {
      indices.add(idx);
      result.push(arr[idx]);
    }
  }

  return result;
}
