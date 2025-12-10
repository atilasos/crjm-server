// ============================================================================
// Dominório Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellOwner = null | 'player1' | 'player2';

interface Cell {
  value: number;
  owner: CellOwner;
}

interface DominorioState {
  board: Cell[][];
  currentPlayer: PlayerRole;
  player1Score: number;
  player2Score: number;
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

const BOARD_SIZE = 5;

// ============================================================================
// Engine Implementation
// ============================================================================

export class DominorioEngine implements GameEngine<DominorioState, DominorioMove> {
  readonly gameId: GameId = 'dominorio';

  createInitialState(startingPlayer: PlayerRole): DominorioState {
    // Create 5x5 board with random values 1-6
    const board: Cell[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() =>
        Array(BOARD_SIZE)
          .fill(null)
          .map(() => ({
            value: Math.floor(Math.random() * 6) + 1,
            owner: null,
          }))
      );

    return {
      board,
      currentPlayer: startingPlayer,
      player1Score: 0,
      player2Score: 0,
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

    // Check cells are adjacent (horizontally or vertically)
    const isAdjacent =
      (Math.abs(row1 - row2) === 1 && col1 === col2) ||
      (Math.abs(col1 - col2) === 1 && row1 === row2);

    if (!isAdjacent) {
      return false;
    }

    // Check both cells are unoccupied
    if (state.board[row1][col1].owner !== null || state.board[row2][col2].owner !== null) {
      return false;
    }

    return true;
  }

  applyMove(state: DominorioState, move: DominorioMove, player: PlayerRole): DominorioState {
    const newState = deepClone(state);
    const { row1, col1, row2, col2 } = move;

    // Claim both cells
    newState.board[row1][col1].owner = player;
    newState.board[row2][col2].owner = player;

    // Calculate points (sum of cell values)
    const points =
      newState.board[row1][col1].value + newState.board[row2][col2].value;

    if (player === 'player1') {
      newState.player1Score += points;
    } else {
      newState.player2Score += points;
    }

    newState.lastMove = move;
    newState.movesCount++;

    // Check if game is over (no more valid moves)
    if (this.countValidMoves(newState) === 0) {
      if (newState.player1Score > newState.player2Score) {
        newState.winner = 'player1';
      } else if (newState.player2Score > newState.player1Score) {
        newState.winner = 'player2';
      } else {
        newState.winner = 'draw';
      }
    }

    // Switch turns if game not over
    if (newState.winner === null) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
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
      player1Score: state.player1Score,
      player2Score: state.player2Score,
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
      player1Score: data.player1Score,
      player2Score: data.player2Score,
      lastMove: data.lastMove,
      winner: data.winner,
      movesCount: data.movesCount,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private countValidMoves(state: DominorioState): number {
    let count = 0;

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (state.board[row][col].owner !== null) continue;

        // Check right
        if (col + 1 < BOARD_SIZE && state.board[row][col + 1].owner === null) {
          count++;
        }
        // Check down
        if (row + 1 < BOARD_SIZE && state.board[row + 1][col].owner === null) {
          count++;
        }
      }
    }

    return count;
  }
}

