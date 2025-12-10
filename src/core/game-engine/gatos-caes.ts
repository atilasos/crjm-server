// ============================================================================
// Gatos & Cães Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'cat' | 'dog';
type BoardState = CellState[][];

interface GatosCaesState {
  board: BoardState;
  currentPlayer: PlayerRole; // player1 = cats, player2 = dogs
  catCount: number;
  dogCount: number;
  lastMove: GatosCaesMove | null;
  winner: GameResult;
}

interface GatosCaesMove {
  row: number;
  col: number;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 6;
const WIN_COUNT = 4; // 4 in a row to win

// ============================================================================
// Engine Implementation
// ============================================================================

export class GatosCaesEngine implements GameEngine<GatosCaesState, GatosCaesMove> {
  readonly gameId: GameId = 'gatos-caes';

  createInitialState(startingPlayer: PlayerRole): GatosCaesState {
    // Create empty 6x6 board
    const board: BoardState = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill('empty'));

    return {
      board,
      currentPlayer: startingPlayer,
      catCount: 0,
      dogCount: 0,
      lastMove: null,
      winner: null,
    };
  }

  validateMove(state: GatosCaesState, move: GatosCaesMove, player: PlayerRole): boolean {
    // Check if game is already over
    if (state.winner !== null) {
      return false;
    }

    // Check if it's this player's turn
    if (state.currentPlayer !== player) {
      return false;
    }

    // Check bounds
    if (move.row < 0 || move.row >= BOARD_SIZE || move.col < 0 || move.col >= BOARD_SIZE) {
      return false;
    }

    // Check if cell is empty
    if (state.board[move.row][move.col] !== 'empty') {
      return false;
    }

    return true;
  }

  applyMove(state: GatosCaesState, move: GatosCaesMove, player: PlayerRole): GatosCaesState {
    const newState = deepClone(state);
    const piece: CellState = player === 'player1' ? 'cat' : 'dog';

    // Place piece
    newState.board[move.row][move.col] = piece;

    // Update counts
    if (piece === 'cat') {
      newState.catCount++;
    } else {
      newState.dogCount++;
    }

    newState.lastMove = move;

    // Check for winner
    if (this.checkWin(newState.board, move.row, move.col, piece)) {
      newState.winner = player;
    } else if (this.isBoardFull(newState.board)) {
      newState.winner = 'draw';
    }

    // Switch turns if game not over
    if (newState.winner === null) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
    }

    return newState;
  }

  isGameOver(state: GatosCaesState): boolean {
    return state.winner !== null;
  }

  getWinner(state: GatosCaesState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: GatosCaesState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: GatosCaesState): unknown {
    return {
      board: state.board,
      currentPlayer: state.currentPlayer,
      catCount: state.catCount,
      dogCount: state.dogCount,
      lastMove: state.lastMove,
      winner: state.winner,
    };
  }

  deserializeState(payload: unknown): GatosCaesState {
    const data = payload as GatosCaesState;
    return {
      board: data.board,
      currentPlayer: data.currentPlayer,
      catCount: data.catCount,
      dogCount: data.dogCount,
      lastMove: data.lastMove,
      winner: data.winner,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private checkWin(board: BoardState, row: number, col: number, piece: CellState): boolean {
    const directions = [
      [0, 1],   // horizontal
      [1, 0],   // vertical
      [1, 1],   // diagonal down-right
      [1, -1],  // diagonal down-left
    ];

    for (const [dr, dc] of directions) {
      let count = 1;

      // Count in positive direction
      let r = row + dr;
      let c = col + dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === piece) {
        count++;
        r += dr;
        c += dc;
      }

      // Count in negative direction
      r = row - dr;
      c = col - dc;
      while (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === piece) {
        count++;
        r -= dr;
        c -= dc;
      }

      if (count >= WIN_COUNT) {
        return true;
      }
    }

    return false;
  }

  private isBoardFull(board: BoardState): boolean {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === 'empty') {
          return false;
        }
      }
    }
    return true;
  }
}

