// ============================================================================
// Atari Go Game Engine
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'black' | 'white';

interface AtariGoState {
  board: CellState[][];
  currentPlayer: PlayerRole; // player1 = black, player2 = white
  blackCaptures: number;
  whiteCaptures: number;
  lastMove: AtariGoMove | null;
  winner: GameResult;
  passCount: number;
}

interface AtariGoMove {
  row: number;
  col: number;
  pass?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const BOARD_SIZE = 9;
const CAPTURE_TO_WIN = 1; // Atari Go: first capture wins

// ============================================================================
// Engine Implementation
// ============================================================================

export class AtariGoEngine implements GameEngine<AtariGoState, AtariGoMove> {
  readonly gameId: GameId = 'atari-go';

  createInitialState(startingPlayer: PlayerRole): AtariGoState {
    const board: CellState[][] = Array(BOARD_SIZE)
      .fill(null)
      .map(() => Array(BOARD_SIZE).fill('empty'));

    return {
      board,
      currentPlayer: startingPlayer,
      blackCaptures: 0,
      whiteCaptures: 0,
      lastMove: null,
      winner: null,
      passCount: 0,
    };
  }

  validateMove(state: AtariGoState, move: AtariGoMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;

    // Pass is always valid
    if (move.pass) return true;

    if (move.row < 0 || move.row >= BOARD_SIZE || move.col < 0 || move.col >= BOARD_SIZE) return false;
    if (state.board[move.row][move.col] !== 'empty') return false;

    // Check for suicide (would need to simulate move)
    const testState = deepClone(state);
    const color: CellState = player === 'player1' ? 'black' : 'white';
    testState.board[move.row][move.col] = color;

    // Check if this move would capture opponent stones
    const opponent: CellState = color === 'black' ? 'white' : 'black';
    const wouldCapture = this.getAdjacentGroups(testState.board, move.row, move.col, opponent)
      .some(group => this.countLiberties(testState.board, group) === 0);

    if (wouldCapture) return true;

    // If no capture, check if the placed stone would have liberties
    const ownGroup = this.getGroup(testState.board, move.row, move.col);
    return this.countLiberties(testState.board, ownGroup) > 0;
  }

  applyMove(state: AtariGoState, move: AtariGoMove, player: PlayerRole): AtariGoState {
    const newState = deepClone(state);

    if (move.pass) {
      newState.passCount++;
      newState.lastMove = move;
      if (newState.passCount >= 2) {
        // Both passed - game over, count territory (simplified: draw)
        newState.winner = 'draw';
      } else {
        newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
      }
      return newState;
    }

    newState.passCount = 0;
    const color: CellState = player === 'player1' ? 'black' : 'white';
    const opponent: CellState = color === 'black' ? 'white' : 'black';

    newState.board[move.row][move.col] = color;
    newState.lastMove = move;

    // Check for captures
    const adjacentOpponentGroups = this.getAdjacentGroups(newState.board, move.row, move.col, opponent);
    let captured = 0;

    for (const group of adjacentOpponentGroups) {
      if (this.countLiberties(newState.board, group) === 0) {
        captured += group.length;
        for (const [r, c] of group) {
          newState.board[r][c] = 'empty';
        }
      }
    }

    if (player === 'player1') {
      newState.blackCaptures += captured;
    } else {
      newState.whiteCaptures += captured;
    }

    // Check for win (first to capture)
    if (newState.blackCaptures >= CAPTURE_TO_WIN) {
      newState.winner = 'player1';
    } else if (newState.whiteCaptures >= CAPTURE_TO_WIN) {
      newState.winner = 'player2';
    }

    if (!newState.winner) {
      newState.currentPlayer = player === 'player1' ? 'player2' : 'player1';
    }

    return newState;
  }

  isGameOver(state: AtariGoState): boolean {
    return state.winner !== null;
  }

  getWinner(state: AtariGoState): GameResult {
    return state.winner;
  }

  getCurrentTurn(state: AtariGoState): PlayerRole {
    return state.currentPlayer;
  }

  serializeState(state: AtariGoState): unknown {
    return state;
  }

  deserializeState(payload: unknown): AtariGoState {
    return payload as AtariGoState;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private getGroup(board: CellState[][], row: number, col: number): [number, number][] {
    const color = board[row][col];
    if (color === 'empty') return [];

    const visited = new Set<string>();
    const group: [number, number][] = [];
    const stack: [number, number][] = [[row, col]];

    while (stack.length > 0) {
      const [r, c] = stack.pop()!;
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      if (board[r][c] !== color) continue;

      visited.add(key);
      group.push([r, c]);

      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }

    return group;
  }

  private getAdjacentGroups(board: CellState[][], row: number, col: number, color: CellState): [number, number][][] {
    const groups: [number, number][][] = [];
    const seen = new Set<string>();
    const neighbors: [number, number][] = [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]];

    for (const [r, c] of neighbors) {
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) continue;
      if (board[r][c] !== color) continue;
      
      const key = `${r},${c}`;
      if (seen.has(key)) continue;

      const group = this.getGroup(board, r, c);
      for (const [gr, gc] of group) {
        seen.add(`${gr},${gc}`);
      }
      groups.push(group);
    }

    return groups;
  }

  private countLiberties(board: CellState[][], group: [number, number][]): number {
    const liberties = new Set<string>();

    for (const [r, c] of group) {
      const neighbors: [number, number][] = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
        if (board[nr][nc] === 'empty') {
          liberties.add(`${nr},${nc}`);
        }
      }
    }

    return liberties.size;
  }
}

