// ============================================================================
// Produto Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

interface ProdutoState {
  grid: number[][]; // Fixed multiplication table
  player1Marked: boolean[][];
  player2Marked: boolean[][];
  currentPlayer: PlayerRole;
  factor1Position: number; // Position on first factor row (1-9)
  factor2Position: number; // Position on second factor column (1-9)
  lastMove: ProdutoMove | null;
  winner: GameResult;
}

interface ProdutoMove {
  factor: 1 | 2; // Which factor to move
  position: number; // New position (1-9)
}

// ============================================================================
// Constants
// ============================================================================

const GRID_SIZE = 9;
const WIN_COUNT = 4; // 4 in a row to win

// ============================================================================
// Engine Implementation
// ============================================================================

export class ProdutoEngine implements GameEngine<ProdutoState, ProdutoMove> {
  readonly gameId: GameId = 'produto';

  createInitialState(startingPlayer: PlayerRole): ProdutoState {
    // Create multiplication table
    const grid: number[][] = [];
    for (let i = 1; i <= GRID_SIZE; i++) {
      const row: number[] = [];
      for (let j = 1; j <= GRID_SIZE; j++) {
        row.push(i * j);
      }
      grid.push(row);
    }

    const player1Marked = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));
    const player2Marked = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(false));

    return {
      grid,
      player1Marked,
      player2Marked,
      currentPlayer: startingPlayer,
      factor1Position: 1,
      factor2Position: 1,
      lastMove: null,
      winner: null,
    };
  }

  validateMove(state: ProdutoState, move: ProdutoMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;
    if (move.factor !== 1 && move.factor !== 2) return false;
    if (move.position < 1 || move.position > GRID_SIZE) return false;

    // Cannot move to same position
    if (move.factor === 1 && move.position === state.factor1Position) return false;
    if (move.factor === 2 && move.position === state.factor2Position) return false;

    return true;
  }

  applyMove(state: ProdutoState, move: ProdutoMove, player: PlayerRole): ProdutoState {
    const newState = deepClone(state);

    // Update factor position
    if (move.factor === 1) {
      newState.factor1Position = move.position;
    } else {
      newState.factor2Position = move.position;
    }

    // Mark the resulting cell
    const row = newState.factor1Position - 1;
    const col = newState.factor2Position - 1;

    if (player === 'player1') {
      newState.player1Marked[row][col] = true;
    } else {
      newState.player2Marked[row][col] = true;
    }

    newState.lastMove = move;

    // Check for winner
    const marked = player === 'player1' ? newState.player1Marked : newState.player2Marked;
    if (this.checkWin(marked, row, col)) {
      newState.winner = player;
    } else if (this.isBoardFull(newState.player1Marked, newState.player2Marked)) {
      newState.winner = 'draw';
    }

    if (!newState.winner) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
    }

    return newState;
  }

  isGameOver(state: ProdutoState): boolean {
    return state.winner !== null;
  }

  getWinner(state: ProdutoState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: ProdutoState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: ProdutoState): unknown {
    return state;
  }

  deserializeState(payload: unknown): ProdutoState {
    return payload as ProdutoState;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private checkWin(marked: boolean[][], row: number, col: number): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;

      let r = row + dr, c = col + dc;
      while (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && marked[r][c]) {
        count++;
        r += dr;
        c += dc;
      }

      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && marked[r][c]) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= WIN_COUNT) return true;
    }

    return false;
  }

  private isBoardFull(player1Marked: boolean[][], player2Marked: boolean[][]): boolean {
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        if (!player1Marked[i][j] && !player2Marked[i][j]) {
          return false;
        }
      }
    }
    return true;
  }
}

