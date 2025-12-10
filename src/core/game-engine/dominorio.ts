// ============================================================================
// Dominório Game Engine
// Players place domino pieces on an 8x8 board
// One player places vertically, other horizontally
// Player who cannot move loses
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellOwner = null | 'player1' | 'player2';

interface DominorioState {
  board: CellOwner[][];
  currentPlayer: PlayerRole; // player1 = vertical, player2 = horizontal
  lastMove: DominorioMove | null;
  winner: GameResult;
  movesCount: number;
}

interface DominorioMove {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 8;

// ============================================================================
// Engine Implementation
// ============================================================================

export class DominorioEngine implements GameEngine<DominorioState, DominorioMove> {
  readonly gameId: GameId = 'dominorio';

  createInitialState(startingPlayer: PlayerRole): DominorioState {
    // Create 8x8 empty board
    const board: CellOwner[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill(null));

    return {
      board,
      currentPlayer: startingPlayer,
      lastMove: null,
      winner: null,
      movesCount: 0,
    };
  }

  validateMove(state: DominorioState, move: DominorioMove, player: PlayerRole): boolean {
    // Check if game is already over
    if (state.winner !== null) {
      return false;
    }

    // Check if it's this player's turn
    if (state.currentPlayer !== player) {
      return false;
    }

    const { row1, col1, row2, col2 } = move;

    // Check bounds
    if (
      row1 < 0 || row1 >= BOARD_SIZE ||
      col1 < 0 || col1 >= BOARD_SIZE ||
      row2 < 0 || row2 >= BOARD_SIZE ||
      col2 < 0 || col2 >= BOARD_SIZE
    ) {
      return false;
    }

    // Check both cells are unoccupied
    if (state.board[row1][col1] !== null || state.board[row2][col2] !== null) {
      return false;
    }

    // player1 (Vertical) must place vertically (same column, adjacent rows)
    // player2 (Horizontal) must place horizontally (same row, adjacent columns)
    if (player === 'player1') {
      // Vertical: same column, rows differ by 1
      if (col1 !== col2) return false;
      if (Math.abs(row1 - row2) !== 1) return false;
    } else {
      // Horizontal: same row, columns differ by 1
      if (row1 !== row2) return false;
      if (Math.abs(col1 - col2) !== 1) return false;
    }

    return true;
  }

  applyMove(state: DominorioState, move: DominorioMove, player: PlayerRole): DominorioState {
    const newState = deepClone(state);
    const { row1, col1, row2, col2 } = move;

    // Claim both cells
    newState.board[row1][col1] = player;
    newState.board[row2][col2] = player;

    newState.lastMove = move;
    newState.movesCount++;

    // Switch turns
    const nextPlayer: PlayerRole = player === 'player1' ? 'player2' : 'player1';
    newState.currentPlayer = nextPlayer;

    // Check if next player can move
    if (!this.hasValidMoves(newState, nextPlayer)) {
      // Next player cannot move, they lose (current player wins)
      newState.winner = player;
    }

    return newState;
  }

  isGameOver(state: DominorioState): boolean {
    return state.winner !== null;
  }

  getWinner(state: DominorioState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: DominorioState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: DominorioState): unknown {
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      lastMove: state.lastMove,
      winner: state.winner,
      movesCount: state.movesCount,
    };
  }

  deserializeState(payload: unknown): DominorioState {
    const data = payload as DominorioState;
    return {
      board: data.board,
      currentPlayer: data.currentPlayer,
      lastMove: data.lastMove,
      winner: data.winner,
      movesCount: data.movesCount,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private hasValidMoves(state: DominorioState, player: PlayerRole): boolean {
    const moves = this.getValidMoves(state, player);
    return moves.length > 0;
  }

  // =========================================================================
  // Public Helper for Bot Strategies
  // =========================================================================

  getValidMoves(state: DominorioState, player: PlayerRole): DominorioMove[] {
    const moves: DominorioMove[] = [];

    if (player === 'player1') {
      // Vertical: check all vertical pairs
      for (let row = 0; row < BOARD_SIZE - 1; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
          if (state.board[row][col] === null && state.board[row + 1][col] === null) {
            moves.push({ row1: row, col1: col, row2: row + 1, col2: col });
          }
        }
      }
    } else {
      // Horizontal: check all horizontal pairs
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE - 1; col++) {
          if (state.board[row][col] === null && state.board[row][col + 1] === null) {
            moves.push({ row1: row, col1: col, row2: row, col2: col + 1 });
          }
        }
      }
    }

    return moves;
  }
}
