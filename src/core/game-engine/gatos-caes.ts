// ============================================================================
// Gatos & Cães Game Engine
// Based on official rules by Simon Norton, 1970s
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
  isFirstCatPlaced: boolean;
  isFirstDogPlaced: boolean;
}

interface GatosCaesMove {
  row: number;
  col: number;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 8;
const MAX_CATS = 28;
const MAX_DOGS = 28;

// Central zone: 2x2 in the middle (rows 3-4, cols 3-4 in 0-indexed)
const CENTRAL_ZONE = {
  minRow: 3,
  maxRow: 4,
  minCol: 3,
  maxCol: 4,
};

// ============================================================================
// Engine Implementation
// ============================================================================

export class GatosCaesEngine implements GameEngine<GatosCaesState, GatosCaesMove> {
  readonly gameId: GameId = 'gatos-caes';

  createInitialState(startingPlayer: PlayerRole): GatosCaesState {
    // Create empty 8x8 board
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
      isFirstCatPlaced: false,
      isFirstDogPlaced: false,
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

    const { row, col } = move;

    // Check bounds
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
      return false;
    }

    // Check if cell is empty
    if (state.board[row][col] !== 'empty') {
      return false;
    }

    const isCat = player === 'player1';
    const piece: CellState = isCat ? 'cat' : 'dog';

    // First cat must be in central zone
    if (isCat && !state.isFirstCatPlaced) {
      if (!this.isInCentralZone(row, col)) {
        return false;
      }
    }

    // First dog must be outside central zone
    if (!isCat && !state.isFirstDogPlaced) {
      if (this.isInCentralZone(row, col)) {
        return false;
      }
    }

    // Cannot place cat adjacent to dog (orthogonally) and vice versa
    if (this.hasAdjacentOpponent(state.board, row, col, piece)) {
      return false;
    }

    return true;
  }

  applyMove(state: GatosCaesState, move: GatosCaesMove, player: PlayerRole): GatosCaesState {
    const newState = deepClone(state);
    const isCat = player === 'player1';
    const piece: CellState = isCat ? 'cat' : 'dog';

    // Place piece
    newState.board[move.row][move.col] = piece;

    // Update counts and first placement flags
    if (isCat) {
      newState.catCount++;
      newState.isFirstCatPlaced = true;
    } else {
      newState.dogCount++;
      newState.isFirstDogPlaced = true;
    }

    newState.lastMove = move;

    // Switch turns
    const nextPlayer: PlayerRole = player === 'player1' ? 'player2' : 'player1';
    newState.currentPlayer = nextPlayer;

    // Check if next player has any valid moves
    if (!this.hasValidMoves(newState, nextPlayer)) {
      // Next player cannot move, current player wins (made the last move)
      newState.winner = player;
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
      isFirstCatPlaced: state.isFirstCatPlaced,
      isFirstDogPlaced: state.isFirstDogPlaced,
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
      isFirstCatPlaced: data.isFirstCatPlaced,
      isFirstDogPlaced: data.isFirstDogPlaced,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private isInCentralZone(row: number, col: number): boolean {
    return (
      row >= CENTRAL_ZONE.minRow &&
      row <= CENTRAL_ZONE.maxRow &&
      col >= CENTRAL_ZONE.minCol &&
      col <= CENTRAL_ZONE.maxCol
    );
  }

  private hasAdjacentOpponent(board: BoardState, row: number, col: number, piece: CellState): boolean {
    const opponent: CellState = piece === 'cat' ? 'dog' : 'cat';
    const neighbors = [
      [row - 1, col], // up
      [row + 1, col], // down
      [row, col - 1], // left
      [row, col + 1], // right
    ];

    for (const [r, c] of neighbors) {
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
        if (board[r][c] === opponent) {
          return true;
        }
      }
    }

    return false;
  }

  private hasValidMoves(state: GatosCaesState, player: PlayerRole): boolean {
    const isCat = player === 'player1';
    const piece: CellState = isCat ? 'cat' : 'dog';

    // Check piece limits
    if (isCat && state.catCount >= MAX_CATS) {
      return false;
    }
    if (!isCat && state.dogCount >= MAX_DOGS) {
      return false;
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (state.board[row][col] !== 'empty') continue;

        // Check first placement rules
        if (isCat && !state.isFirstCatPlaced) {
          if (!this.isInCentralZone(row, col)) continue;
        }
        if (!isCat && !state.isFirstDogPlaced) {
          if (this.isInCentralZone(row, col)) continue;
        }

        // Check adjacency rule
        if (!this.hasAdjacentOpponent(state.board, row, col, piece)) {
          return true; // Found at least one valid move
        }
      }
    }

    return false;
  }

  // =========================================================================
  // Public Helper for Bot Strategies
  // =========================================================================

  getValidMoves(state: GatosCaesState, player: PlayerRole): GatosCaesMove[] {
    const moves: GatosCaesMove[] = [];
    const isCat = player === 'player1';
    const piece: CellState = isCat ? 'cat' : 'dog';

    // Check piece limits
    if (isCat && state.catCount >= MAX_CATS) {
      return moves;
    }
    if (!isCat && state.dogCount >= MAX_DOGS) {
      return moves;
    }

    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (state.board[row][col] !== 'empty') continue;

        // Check first placement rules
        if (isCat && !state.isFirstCatPlaced) {
          if (!this.isInCentralZone(row, col)) continue;
        }
        if (!isCat && !state.isFirstDogPlaced) {
          if (this.isInCentralZone(row, col)) continue;
        }

        // Check adjacency rule
        if (!this.hasAdjacentOpponent(state.board, row, col, piece)) {
          moves.push({ row, col });
        }
      }
    }

    return moves;
  }
}
