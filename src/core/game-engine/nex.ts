// ============================================================================
// Nex (Hex variant) Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'player1' | 'player2';

interface NexState {
  board: CellState[][];
  currentPlayer: PlayerRole;
  lastMove: NexMove | null;
  winner: GameResult;
  moveCount: number;
  // Swap rule: after first move, player2 can swap
  canSwap: boolean;
}

interface NexMove {
  row: number;
  col: number;
  swap?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 11; // Standard Hex is 11x11

// ============================================================================
// Engine Implementation
// ============================================================================

export class NexEngine implements GameEngine<NexState, NexMove> {
  readonly gameId: GameId = 'nex';

  createInitialState(startingPlayer: PlayerRole): NexState {
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
    };
  }

  validateMove(state: NexState, move: NexMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;

    // Swap rule
    if (move.swap) {
      return state.canSwap && player === 'player2';
    }

    if (move.row < 0 || move.row >= BOARD_SIZE || move.col < 0 || move.col >= BOARD_SIZE) return false;
    if (state.board[move.row][move.col] !== 'empty') return false;

    return true;
  }

  applyMove(state: NexState, move: NexMove, player: PlayerRole): NexState {
    const newState = deepClone(state);

    if (move.swap && newState.canSwap) {
      // Swap: player2 takes player1's first move
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (newState.board[r][c] === 'player1') {
            newState.board[r][c] = 'player2';
          }
        }
      }
      newState.canSwap = false;
      newState.currentPlayer = 'player1';
      newState.moveCount++;
      return newState;
    }

    newState.board[move.row][move.col] = player;
    newState.lastMove = move;
    newState.moveCount++;

    // After first move, enable swap for next turn
    if (newState.moveCount === 1) {
      newState.canSwap = true;
    } else {
      newState.canSwap = false;
    }

    // Check for winner
    if (this.checkWin(newState.board, player)) {
      newState.winner = player;
    } else if (this.isBoardFull(newState.board)) {
      // Hex cannot end in a draw by nature, but keeping for safety
      newState.winner = 'draw';
    }

    if (!newState.winner) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
    }

    return newState;
  }

  isGameOver(state: NexState): boolean {
    return state.winner !== null;
  }

  getWinner(state: NexState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: NexState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: NexState): unknown {
    return state;
  }

  deserializeState(payload: unknown): NexState {
    return payload as NexState;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private checkWin(board: CellState[][], player: PlayerRole): boolean {
    // Player1 wins by connecting top to bottom
    // Player2 wins by connecting left to right

    if (player === 'player1') {
      // Check if there's a path from top row to bottom row
      const visited = new Set<string>();
      const stack: [number, number][] = [];

      // Start from top row
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[0][c] === 'player1') {
          stack.push([0, c]);
        }
      }

      while (stack.length > 0) {
        const [r, c] = stack.pop()!;
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (r === BOARD_SIZE - 1) return true; // Reached bottom

        for (const [nr, nc] of this.getHexNeighbors(r, c)) {
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            if (board[nr][nc] === 'player1' && !visited.has(`${nr},${nc}`)) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    } else {
      // Check if there's a path from left column to right column
      const visited = new Set<string>();
      const stack: [number, number][] = [];

      // Start from left column
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (board[r][0] === 'player2') {
          stack.push([r, 0]);
        }
      }

      while (stack.length > 0) {
        const [r, c] = stack.pop()!;
        const key = `${r},${c}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (c === BOARD_SIZE - 1) return true; // Reached right side

        for (const [nr, nc] of this.getHexNeighbors(r, c)) {
          if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
            if (board[nr][nc] === 'player2' && !visited.has(`${nr},${nc}`)) {
              stack.push([nr, nc]);
            }
          }
        }
      }
    }

    return false;
  }

  private getHexNeighbors(row: number, col: number): [number, number][] {
    // Hex grid neighbors (6 directions)
    return [
      [row - 1, col],     // top-left
      [row - 1, col + 1], // top-right
      [row, col - 1],     // left
      [row, col + 1],     // right
      [row + 1, col - 1], // bottom-left
      [row + 1, col],     // bottom-right
    ];
  }

  private isBoardFull(board: CellState[][]): boolean {
    return board.every(row => row.every(cell => cell !== 'empty'));
  }
}

