// ============================================================================
// Quelhas Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'player1' | 'player2';

interface QuelhasState {
  board: CellState[][];
  currentPlayer: PlayerRole;
  player1Captures: number;
  player2Captures: number;
  lastMove: QuelhasMove | null;
  winner: GameResult;
}

interface QuelhasMove {
  row: number;
  col: number;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 9;
const WIN_CAPTURES = 5; // Win by capturing 5 pairs

// ============================================================================
// Engine Implementation
// ============================================================================

export class QuelhasEngine implements GameEngine<QuelhasState, QuelhasMove> {
  readonly gameId: GameId = 'quelhas';

  createInitialState(startingPlayer: PlayerRole): QuelhasState {
    const board: CellState[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill('empty'));

    return {
      board,
      currentPlayer: startingPlayer,
      player1Captures: 0,
      player2Captures: 0,
      lastMove: null,
      winner: null,
    };
  }

  validateMove(state: QuelhasState, move: QuelhasMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;
    if (move.row < 0 || move.row >= BOARD_SIZE || move.col < 0 || move.col >= BOARD_SIZE) return false;
    if (state.board[move.row][move.col] !== 'empty') return false;
    return true;
  }

  applyMove(state: QuelhasState, move: QuelhasMove, player: PlayerRole): QuelhasState {
    const newState = deepClone(state);
    const piece: CellState = player;

    newState.board[move.row][move.col] = piece;
    newState.lastMove = move;

    // Check for captures (custodian capture)
    const captures = this.checkCaptures(newState.board, move.row, move.col, player);
    if (player === 'player1') {
      newState.player1Captures += captures;
    } else {
      newState.player2Captures += captures;
    }

    // Check for win by captures
    if (newState.player1Captures >= WIN_CAPTURES) {
      newState.winner = 'player1';
    } else if (newState.player2Captures >= WIN_CAPTURES) {
      newState.winner = 'player2';
    }

    // Check for 5 in a row win
    if (!newState.winner && this.checkFiveInRow(newState.board, move.row, move.col, piece)) {
      newState.winner = player;
    }

    // Check for draw
    if (!newState.winner && this.isBoardFull(newState.board)) {
      newState.winner = 'draw';
    }

    if (!newState.winner) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
    }

    return newState;
  }

  isGameOver(state: QuelhasState): boolean {
    return state.winner !== null;
  }

  getWinner(state: QuelhasState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: QuelhasState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: QuelhasState): unknown {
    return state;
  }

  deserializeState(payload: unknown): QuelhasState {
    return payload as QuelhasState;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private checkCaptures(board: CellState[][], row: number, col: number, player: PlayerRole): number {
    const opponent: CellState = player === 'player1' ? 'player2' : 'player1';
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    let captures = 0;

    for (const [dr, dc] of directions) {
      // Check forward direction
      if (this.checkCaptureDirection(board, row, col, dr, dc, player, opponent)) {
        board[row + dr][col + dc] = 'empty';
        board[row + 2 * dr][col + 2 * dc] = 'empty';
        captures++;
      }
      // Check backward direction
      if (this.checkCaptureDirection(board, row, col, -dr, -dc, player, opponent)) {
        board[row - dr][col - dc] = 'empty';
        board[row - 2 * dr][col - 2 * dc] = 'empty';
        captures++;
      }
    }

    return captures;
  }

  private checkCaptureDirection(
    board: CellState[][], 
    row: number, 
    col: number, 
    dr: number, 
    dc: number, 
    player: PlayerRole, 
    opponent: CellState
  ): boolean {
    const r1 = row + dr, c1 = col + dc;
    const r2 = row + 2 * dr, c2 = col + 2 * dc;
    const r3 = row + 3 * dr, c3 = col + 3 * dc;

    if (r3 < 0 || r3 >= BOARD_SIZE || c3 < 0 || c3 >= BOARD_SIZE) return false;

    return board[r1][c1] === opponent && 
           board[r2][c2] === opponent && 
           board[r3][c3] === player;
  }

  private checkFiveInRow(board: CellState[][], row: number, col: number, piece: CellState): boolean {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

    for (const [dr, dc] of directions) {
      let count = 1;

      let r = row + dr, c = col + dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === piece) {
        count++;
        r += dr;
        c += dc;
      }

      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === piece) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= 5) return true;
    }

    return false;
  }

  private isBoardFull(board: CellState[][]): boolean {
    return board.every(row => row.every(cell => cell !== 'empty'));
  }
}

