// ============================================================================
// Nex Game Engine
// Invented by João Pedro Neto, 2004
// Hexagonal board with white, black, and neutral (gray) pieces
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'black' | 'white' | 'neutral';

interface NexState {
  board: CellState[][];
  currentPlayer: PlayerRole; // player1 = black, player2 = white
  lastMove: NexMove | null;
  winner: GameResult;
  moveCount: number;
  // Swap rule: after first move, player2 can swap colors
  canSwap: boolean;
  swapped: boolean;
}

// Move types:
// 1. place: Place 1 own piece + 1 neutral piece on empty cells
// 2. convert: Replace 2 neutrals with own color + replace 1 own piece with neutral
// 3. swap: Take opponent's first move (only on move 2)
interface NexMove {
  type: 'place' | 'convert' | 'swap';
  // For 'place': where to put own piece and neutral
  ownPiece?: { row: number; col: number };
  neutralPiece?: { row: number; col: number };
  // For 'convert': which 2 neutrals become own, which own becomes neutral
  neutralsToConvert?: Array<{ row: number; col: number }>;
  ownToNeutral?: { row: number; col: number };
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 11; // Standard Hex/Nex is 11x11

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
      swapped: false,
    };
  }

  validateMove(state: NexState, move: NexMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;

    // Handle swap
    if (move.type === 'swap') {
      return state.canSwap && player === 'player2' && !state.swapped;
    }

    const playerColor: CellState = this.getPlayerColor(player, state.swapped);

    if (move.type === 'place') {
      // Must have both pieces defined
      if (!move.ownPiece || !move.neutralPiece) return false;

      const { ownPiece, neutralPiece } = move;

      // Check bounds
      if (!this.inBounds(ownPiece.row, ownPiece.col)) return false;
      if (!this.inBounds(neutralPiece.row, neutralPiece.col)) return false;

      // Both must be empty
      if (state.board[ownPiece.row][ownPiece.col] !== 'empty') return false;
      if (state.board[neutralPiece.row][neutralPiece.col] !== 'empty') return false;

      // Cannot be same cell
      if (ownPiece.row === neutralPiece.row && ownPiece.col === neutralPiece.col) return false;

      return true;
    }

    if (move.type === 'convert') {
      // Must have 2 neutrals to convert and 1 own to neutralize
      if (!move.neutralsToConvert || move.neutralsToConvert.length !== 2) return false;
      if (!move.ownToNeutral) return false;

      const { neutralsToConvert, ownToNeutral } = move;

      // Check all are in bounds
      for (const cell of neutralsToConvert) {
        if (!this.inBounds(cell.row, cell.col)) return false;
        if (state.board[cell.row][cell.col] !== 'neutral') return false;
      }

      if (!this.inBounds(ownToNeutral.row, ownToNeutral.col)) return false;
      if (state.board[ownToNeutral.row][ownToNeutral.col] !== playerColor) return false;

      // Ensure the two neutrals are distinct
      if (neutralsToConvert[0].row === neutralsToConvert[1].row &&
          neutralsToConvert[0].col === neutralsToConvert[1].col) return false;

      // The own piece cannot be in the neutrals list
      for (const cell of neutralsToConvert) {
        if (cell.row === ownToNeutral.row && cell.col === ownToNeutral.col) return false;
      }

      return true;
    }

    return false;
  }

  applyMove(state: NexState, move: NexMove, player: PlayerRole): NexState {
    const newState = deepClone(state);
    const playerColor = this.getPlayerColor(player, newState.swapped);

    if (move.type === 'swap') {
      newState.swapped = true;
      newState.canSwap = false;
      // After swap, it's player1's turn (but colors are now swapped)
      newState.currentPlayer = 'player1';
      newState.moveCount++;
      newState.lastMove = move;
      return newState;
    }

    if (move.type === 'place') {
      const { ownPiece, neutralPiece } = move;
      newState.board[ownPiece!.row][ownPiece!.col] = playerColor;
      newState.board[neutralPiece!.row][neutralPiece!.col] = 'neutral';
    }

    if (move.type === 'convert') {
      const { neutralsToConvert, ownToNeutral } = move;
      for (const cell of neutralsToConvert!) {
        newState.board[cell.row][cell.col] = playerColor;
      }
      newState.board[ownToNeutral!.row][ownToNeutral!.col] = 'neutral';
    }

    newState.lastMove = move;
    newState.moveCount++;

    // After first move, enable swap for player2's next turn
    if (newState.moveCount === 1) {
      newState.canSwap = true;
    } else {
      newState.canSwap = false;
    }

    // Check for winner
    if (this.checkWin(newState.board, 'black')) {
      newState.winner = newState.swapped ? 'player2' : 'player1';
    } else if (this.checkWin(newState.board, 'white')) {
      newState.winner = newState.swapped ? 'player1' : 'player2';
    }

    // Switch turns if game not over
    if (newState.winner === null) {
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

  private inBounds(row: number, col: number): boolean {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  private getPlayerColor(player: PlayerRole, swapped: boolean): CellState {
    if (swapped) {
      return player === 'player1' ? 'white' : 'black';
    }
    return player === 'player1' ? 'black' : 'white';
  }

  private getHexNeighbors(row: number, col: number): Array<{ row: number; col: number }> {
    // Hex grid neighbors (6 directions) using offset coordinates
    return [
      { row: row - 1, col: col },     // top-left
      { row: row - 1, col: col + 1 }, // top-right
      { row: row, col: col - 1 },     // left
      { row: row, col: col + 1 },     // right
      { row: row + 1, col: col - 1 }, // bottom-left
      { row: row + 1, col: col },     // bottom-right
    ];
  }

  private checkWin(board: CellState[][], color: CellState): boolean {
    // Black (player1 default) wins by connecting NW-SE (top to bottom in our representation)
    // White (player2 default) wins by connecting SW-NE (left to right in our representation)

    if (color === 'black') {
      // Check if there's a path from top row to bottom row
      const visited = new Set<string>();
      const stack: Array<{ row: number; col: number }> = [];

      // Start from top row
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (board[0][c] === 'black') {
          stack.push({ row: 0, col: c });
        }
      }

      while (stack.length > 0) {
        const { row, col } = stack.pop()!;
        const key = `${row},${col}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (row === BOARD_SIZE - 1) return true; // Reached bottom

        for (const n of this.getHexNeighbors(row, col)) {
          if (this.inBounds(n.row, n.col) && board[n.row][n.col] === 'black') {
            if (!visited.has(`${n.row},${n.col}`)) {
              stack.push(n);
            }
          }
        }
      }
    } else if (color === 'white') {
      // Check if there's a path from left column to right column
      const visited = new Set<string>();
      const stack: Array<{ row: number; col: number }> = [];

      // Start from left column
      for (let r = 0; r < BOARD_SIZE; r++) {
        if (board[r][0] === 'white') {
          stack.push({ row: r, col: 0 });
        }
      }

      while (stack.length > 0) {
        const { row, col } = stack.pop()!;
        const key = `${row},${col}`;
        if (visited.has(key)) continue;
        visited.add(key);

        if (col === BOARD_SIZE - 1) return true; // Reached right side

        for (const n of this.getHexNeighbors(row, col)) {
          if (this.inBounds(n.row, n.col) && board[n.row][n.col] === 'white') {
            if (!visited.has(`${n.row},${n.col}`)) {
              stack.push(n);
            }
          }
        }
      }
    }

    return false;
  }

  // =========================================================================
  // Public Helpers for Bot Strategies
  // =========================================================================

  getValidMoves(state: NexState, player: PlayerRole): NexMove[] {
    const moves: NexMove[] = [];
    const playerColor = this.getPlayerColor(player, state.swapped);

    // Swap move
    if (state.canSwap && player === 'player2' && !state.swapped) {
      moves.push({ type: 'swap' });
    }

    // Collect empty cells and cells by type
    const emptyCells: Array<{ row: number; col: number }> = [];
    const neutralCells: Array<{ row: number; col: number }> = [];
    const ownCells: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const cell = state.board[r][c];
        if (cell === 'empty') {
          emptyCells.push({ row: r, col: c });
        } else if (cell === 'neutral') {
          neutralCells.push({ row: r, col: c });
        } else if (cell === playerColor) {
          ownCells.push({ row: r, col: c });
        }
      }
    }

    // 'place' moves: pick 2 different empty cells
    for (let i = 0; i < emptyCells.length; i++) {
      for (let j = 0; j < emptyCells.length; j++) {
        if (i === j) continue;
        moves.push({
          type: 'place',
          ownPiece: emptyCells[i],
          neutralPiece: emptyCells[j],
        });
      }
    }

    // 'convert' moves: pick 2 neutrals and 1 own piece
    if (neutralCells.length >= 2 && ownCells.length >= 1) {
      for (let i = 0; i < neutralCells.length; i++) {
        for (let j = i + 1; j < neutralCells.length; j++) {
          for (const own of ownCells) {
            moves.push({
              type: 'convert',
              neutralsToConvert: [neutralCells[i], neutralCells[j]],
              ownToNeutral: own,
            });
          }
        }
      }
    }

    return moves;
  }
}
