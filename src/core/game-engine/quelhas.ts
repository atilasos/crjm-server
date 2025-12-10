// ============================================================================
// Quelhas Game Engine
// 10x10 board, players place 2+ orthogonally contiguous pieces
// Vertical player only places vertically, Horizontal only horizontally
// Player who makes the last move LOSES (misère game)
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'filled';

interface QuelhasState {
  board: CellState[][];
  currentPlayer: PlayerRole; // player1 = vertical, player2 = horizontal
  lastMove: QuelhasMove | null;
  winner: GameResult;
  moveCount: number;
  // Swap rule: after first move, player2 can swap orientations
  canSwap: boolean;
  swapped: boolean;
}

interface QuelhasMove {
  // A move is a contiguous segment of cells
  cells: Array<{ row: number; col: number }>;
  swap?: boolean; // If true, player2 is swapping (takes opponent's first move)
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 10;
const MIN_SEGMENT_LENGTH = 2;

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
      lastMove: null,
      winner: null,
      moveCount: 0,
      canSwap: false,
      swapped: false,
    };
  }

  validateMove(state: QuelhasState, move: QuelhasMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;

    // Handle swap move
    if (move.swap) {
      return state.canSwap && player === 'player2' && !state.swapped;
    }

    const { cells } = move;

    // Must have at least MIN_SEGMENT_LENGTH cells
    if (cells.length < MIN_SEGMENT_LENGTH) return false;

    // All cells must be in bounds and empty
    for (const { row, col } of cells) {
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) return false;
      if (state.board[row][col] !== 'empty') return false;
    }

    // Cells must be orthogonally contiguous
    if (!this.areCellsContiguous(cells)) return false;

    // Determine orientation of the segment
    const isVertical = this.isVerticalSegment(cells);
    const isHorizontal = this.isHorizontalSegment(cells);

    if (!isVertical && !isHorizontal) return false;

    // Check player orientation constraint
    // After swap, orientations are reversed
    const effectivePlayer = state.swapped
      ? (player === 'player1' ? 'player2' : 'player1')
      : player;

    if (effectivePlayer === 'player1' && !isVertical) return false; // player1 = vertical
    if (effectivePlayer === 'player2' && !isHorizontal) return false; // player2 = horizontal

    return true;
  }

  applyMove(state: QuelhasState, move: QuelhasMove, player: PlayerRole): QuelhasState {
    const newState = deepClone(state);

    // Handle swap
    if (move.swap && newState.canSwap) {
      newState.swapped = true;
      newState.canSwap = false;
      // After swap, player2 takes the first move as their own
      // Now it's player1's turn (who is now Horizontal due to swap)
      newState.currentPlayer = 'player1';
      newState.moveCount++;
      return newState;
    }

    // Place pieces
    for (const { row, col } of move.cells) {
      newState.board[row][col] = 'filled';
    }

    newState.lastMove = move;
    newState.moveCount++;

    // After first move, enable swap for player2's next turn
    if (newState.moveCount === 1) {
      newState.canSwap = true;
    } else {
      newState.canSwap = false;
    }

    // Switch turns
    const nextPlayer: PlayerRole = player === 'player1' ? 'player2' : 'player1';
    newState.currentPlayer = nextPlayer;

    // Check if next player has any valid moves
    if (!this.hasValidMoves(newState, nextPlayer)) {
      // Next player cannot move
      // In Quelhas, the player who makes the LAST move LOSES
      // So if next player can't move, current player (who just moved) loses
      newState.winner = nextPlayer;
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

  private areCellsContiguous(cells: Array<{ row: number; col: number }>): boolean {
    if (cells.length < 2) return true;

    // Sort cells by row, then by column
    const sorted = [...cells].sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    // Check if all cells are in a line (same row or same column)
    const allSameRow = sorted.every(c => c.row === sorted[0].row);
    const allSameCol = sorted.every(c => c.col === sorted[0].col);

    if (!allSameRow && !allSameCol) return false;

    // Check contiguity
    for (let i = 1; i < sorted.length; i++) {
      if (allSameRow) {
        if (sorted[i].col !== sorted[i - 1].col + 1) return false;
      } else {
        if (sorted[i].row !== sorted[i - 1].row + 1) return false;
      }
    }

    return true;
  }

  private isVerticalSegment(cells: Array<{ row: number; col: number }>): boolean {
    if (cells.length < 2) return false;
    return cells.every(c => c.col === cells[0].col);
  }

  private isHorizontalSegment(cells: Array<{ row: number; col: number }>): boolean {
    if (cells.length < 2) return false;
    return cells.every(c => c.row === cells[0].row);
  }

  private hasValidMoves(state: QuelhasState, player: PlayerRole): boolean {
    const moves = this.getValidMoves(state, player);
    return moves.length > 0;
  }

  // =========================================================================
  // Public Helper for Bot Strategies
  // =========================================================================

  getValidMoves(state: QuelhasState, player: PlayerRole): QuelhasMove[] {
    const moves: QuelhasMove[] = [];

    // Can swap?
    if (state.canSwap && player === 'player2' && !state.swapped) {
      moves.push({ cells: [], swap: true });
    }

    // Determine effective orientation after potential swap
    const effectivePlayer = state.swapped
      ? (player === 'player1' ? 'player2' : 'player1')
      : player;

    const isVertical = effectivePlayer === 'player1';

    if (isVertical) {
      // Generate all valid vertical segments
      for (let col = 0; col < BOARD_SIZE; col++) {
        for (let startRow = 0; startRow < BOARD_SIZE; startRow++) {
          // Find maximum contiguous empty cells starting from startRow
          let endRow = startRow;
          while (endRow < BOARD_SIZE && state.board[endRow][col] === 'empty') {
            endRow++;
          }
          const maxLen = endRow - startRow;

          // Generate segments of length MIN_SEGMENT_LENGTH to maxLen
          for (let len = MIN_SEGMENT_LENGTH; len <= maxLen; len++) {
            for (let r = startRow; r + len <= endRow; r++) {
              const cells: Array<{ row: number; col: number }> = [];
              for (let i = 0; i < len; i++) {
                cells.push({ row: r + i, col });
              }
              moves.push({ cells });
            }
          }

          // Skip to end of this segment to avoid duplicates
          if (endRow > startRow) {
            // We'll continue from where empty cells end
          }
        }
      }
    } else {
      // Generate all valid horizontal segments
      for (let row = 0; row < BOARD_SIZE; row++) {
        for (let startCol = 0; startCol < BOARD_SIZE; startCol++) {
          // Find maximum contiguous empty cells starting from startCol
          let endCol = startCol;
          while (endCol < BOARD_SIZE && state.board[row][endCol] === 'empty') {
            endCol++;
          }
          const maxLen = endCol - startCol;

          // Generate segments of length MIN_SEGMENT_LENGTH to maxLen
          for (let len = MIN_SEGMENT_LENGTH; len <= maxLen; len++) {
            for (let c = startCol; c + len <= endCol; c++) {
              const cells: Array<{ row: number; col: number }> = [];
              for (let i = 0; i < len; i++) {
                cells.push({ row, col: c + i });
              }
              moves.push({ cells });
            }
          }
        }
      }
    }

    // Remove duplicates (same set of cells)
    const uniqueMoves: QuelhasMove[] = [];
    const seen = new Set<string>();
    for (const m of moves) {
      const key = m.swap
        ? 'swap'
        : m.cells.map(c => `${c.row},${c.col}`).sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueMoves.push(m);
      }
    }

    return uniqueMoves;
  }
}
