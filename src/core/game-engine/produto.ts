// ============================================================================
// Produto Game Engine
// Hexagonal board (5 cells per side = 61 cells total)
// Players place 2 pieces of ANY color per turn
// When full, calculate product of 2 largest groups per color
// Higher product wins
// ============================================================================

import { GameEngine, GameId, PlayerRole, GameResult } from '../types';
import { deepClone } from '../utils';

// ============================================================================
// Game State Types
// ============================================================================

type CellState = 'empty' | 'black' | 'white';

// Using axial coordinates for hexagonal grid
interface HexCoord {
  q: number;
  r: number;
}

interface ProdutoState {
  // Map from "q,r" string to cell state
  board: Map<string, CellState>;
  currentPlayer: PlayerRole; // player1 = black, player2 = white
  lastMove: ProdutoMove | null;
  winner: GameResult;
  moveCount: number;
  blackPiecesPlaced: number;
  whitePiecesPlaced: number;
}

interface ProdutoMove {
  // Place 1 or 2 pieces (first move is 1 piece)
  placements: Array<{
    coord: HexCoord;
    color: 'black' | 'white';
  }>;
}

// ============================================================================
// Constants
// ============================================================================

const HEX_RADIUS = 4; // 5 cells per side means radius 4 (0 to 4)
const TOTAL_CELLS = 61; // 3*5^2 - 3*5 + 1 = 61

// ============================================================================
// Helper: Generate all valid hex coordinates
// ============================================================================

function generateHexCoords(): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q++) {
    for (let r = -HEX_RADIUS; r <= HEX_RADIUS; r++) {
      if (Math.abs(q + r) <= HEX_RADIUS) {
        coords.push({ q, r });
      }
    }
  }
  return coords;
}

const ALL_HEX_COORDS = generateHexCoords();

function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

function parseCoordKey(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

// ============================================================================
// Engine Implementation
// ============================================================================

export class ProdutoEngine implements GameEngine<ProdutoState, ProdutoMove> {
  readonly gameId: GameId = 'produto';

  createInitialState(startingPlayer: PlayerRole): ProdutoState {
    const board = new Map<string, CellState>();
    for (const coord of ALL_HEX_COORDS) {
      board.set(coordKey(coord), 'empty');
    }

    return {
      board,
      currentPlayer: startingPlayer,
      lastMove: null,
      winner: null,
      moveCount: 0,
      blackPiecesPlaced: 0,
      whitePiecesPlaced: 0,
    };
  }

  validateMove(state: ProdutoState, move: ProdutoMove, player: PlayerRole): boolean {
    if (state.winner !== null) return false;
    if (state.currentPlayer !== player) return false;

    const { placements } = move;

    // First move: exactly 1 piece
    // Subsequent moves: exactly 2 pieces
    const expectedCount = state.moveCount === 0 ? 1 : 2;
    if (placements.length !== expectedCount) return false;

    // Check all placements are valid
    const usedCoords = new Set<string>();
    for (const { coord, color } of placements) {
      const key = coordKey(coord);

      // Must be a valid hex coordinate
      if (!state.board.has(key)) return false;

      // Must be empty
      if (state.board.get(key) !== 'empty') return false;

      // Cannot place on same cell twice
      if (usedCoords.has(key)) return false;
      usedCoords.add(key);

      // Color must be valid
      if (color !== 'black' && color !== 'white') return false;
    }

    return true;
  }

  applyMove(state: ProdutoState, move: ProdutoMove, player: PlayerRole): ProdutoState {
    const newState = this.cloneState(state);

    // Place pieces
    for (const { coord, color } of move.placements) {
      const key = coordKey(coord);
      newState.board.set(key, color);
      if (color === 'black') {
        newState.blackPiecesPlaced++;
      } else {
        newState.whitePiecesPlaced++;
      }
    }

    newState.lastMove = move;
    newState.moveCount++;

    // Check if board is full
    const emptyCells = this.countEmptyCells(newState);
    if (emptyCells === 0) {
      // Game over - calculate scores
      const blackScore = this.calculateScore(newState, 'black');
      const whiteScore = this.calculateScore(newState, 'white');

      if (blackScore > whiteScore) {
        newState.winner = 'player1'; // Black wins
      } else if (whiteScore > blackScore) {
        newState.winner = 'player2'; // White wins
      } else {
        // Tie-breaker: player with fewer pieces of their own color wins
        // player1 = black, player2 = white
        if (newState.blackPiecesPlaced < newState.whitePiecesPlaced) {
          newState.winner = 'player1';
        } else if (newState.whitePiecesPlaced < newState.blackPiecesPlaced) {
          newState.winner = 'player2';
        } else {
          newState.winner = 'draw';
        }
      }
    } else if (emptyCells === 1 && newState.moveCount > 0) {
      // Only 1 cell left but need 2 pieces - game ends
      // This shouldn't happen normally since 61 - 1 - 60 = 0 (60/2 = 30 moves)
      // But just in case, we handle it
      const blackScore = this.calculateScore(newState, 'black');
      const whiteScore = this.calculateScore(newState, 'white');
      if (blackScore > whiteScore) {
        newState.winner = 'player1';
      } else if (whiteScore > blackScore) {
        newState.winner = 'player2';
      } else {
        if (newState.blackPiecesPlaced < newState.whitePiecesPlaced) {
          newState.winner = 'player1';
        } else if (newState.whitePiecesPlaced < newState.blackPiecesPlaced) {
          newState.winner = 'player2';
        } else {
          newState.winner = 'draw';
        }
      }
    }

    // Switch turns if game not over
    if (newState.winner === null) {
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
    return {
      board: Object.fromEntries(state.board),
      currentPlayer: state.currentPlayer,
      lastMove: state.lastMove,
      winner: state.winner,
      moveCount: state.moveCount,
      blackPiecesPlaced: state.blackPiecesPlaced,
      whitePiecesPlaced: state.whitePiecesPlaced,
    };
  }

  deserializeState(payload: unknown): ProdutoState {
    const data = payload as {
      board: Record<string, CellState>;
      currentPlayer: PlayerRole;
      lastMove: ProdutoMove | null;
      winner: GameResult;
      moveCount: number;
      blackPiecesPlaced: number;
      whitePiecesPlaced: number;
    };
    return {
      board: new Map(Object.entries(data.board)),
      currentPlayer: data.currentPlayer,
      lastMove: data.lastMove,
      winner: data.winner,
      moveCount: data.moveCount,
      blackPiecesPlaced: data.blackPiecesPlaced,
      whitePiecesPlaced: data.whitePiecesPlaced,
    };
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private cloneState(state: ProdutoState): ProdutoState {
    return {
      board: new Map(state.board),
      currentPlayer: state.currentPlayer,
      lastMove: state.lastMove ? deepClone(state.lastMove) : null,
      winner: state.winner,
      moveCount: state.moveCount,
      blackPiecesPlaced: state.blackPiecesPlaced,
      whitePiecesPlaced: state.whitePiecesPlaced,
    };
  }

  private countEmptyCells(state: ProdutoState): number {
    let count = 0;
    for (const cellState of state.board.values()) {
      if (cellState === 'empty') count++;
    }
    return count;
  }

  private getHexNeighbors(coord: HexCoord): HexCoord[] {
    // 6 neighbors in axial coordinates
    const directions = [
      { q: 1, r: 0 },
      { q: 1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: 1 },
      { q: 0, r: 1 },
    ];
    return directions.map(d => ({ q: coord.q + d.q, r: coord.r + d.r }));
  }

  private findGroups(state: ProdutoState, color: 'black' | 'white'): number[] {
    const visited = new Set<string>();
    const groupSizes: number[] = [];

    for (const [key, cellState] of state.board.entries()) {
      if (cellState !== color || visited.has(key)) continue;

      // BFS to find group
      const queue = [parseCoordKey(key)];
      visited.add(key);
      let size = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;
        size++;

        for (const neighbor of this.getHexNeighbors(current)) {
          const nKey = coordKey(neighbor);
          if (visited.has(nKey)) continue;
          if (state.board.get(nKey) !== color) continue;

          visited.add(nKey);
          queue.push(neighbor);
        }
      }

      groupSizes.push(size);
    }

    return groupSizes;
  }

  private calculateScore(state: ProdutoState, color: 'black' | 'white'): number {
    const groups = this.findGroups(state, color);

    if (groups.length < 2) {
      // Less than 2 groups means product is 0
      return 0;
    }

    // Sort descending and take product of two largest
    groups.sort((a, b) => b - a);
    return groups[0] * groups[1];
  }

  // =========================================================================
  // Public Helper for Bot Strategies
  // =========================================================================

  getValidMoves(state: ProdutoState, player: PlayerRole): ProdutoMove[] {
    const moves: ProdutoMove[] = [];
    const emptyCells: HexCoord[] = [];

    for (const [key, cellState] of state.board.entries()) {
      if (cellState === 'empty') {
        emptyCells.push(parseCoordKey(key));
      }
    }

    if (state.moveCount === 0) {
      // First move: 1 piece of either color
      for (const coord of emptyCells) {
        moves.push({ placements: [{ coord, color: 'black' }] });
        moves.push({ placements: [{ coord, color: 'white' }] });
      }
    } else {
      // Subsequent moves: 2 pieces of any colors
      for (let i = 0; i < emptyCells.length; i++) {
        for (let j = i + 1; j < emptyCells.length; j++) {
          const c1 = emptyCells[i];
          const c2 = emptyCells[j];
          // 4 combinations: BB, BW, WB, WW
          moves.push({ placements: [{ coord: c1, color: 'black' }, { coord: c2, color: 'black' }] });
          moves.push({ placements: [{ coord: c1, color: 'black' }, { coord: c2, color: 'white' }] });
          moves.push({ placements: [{ coord: c1, color: 'white' }, { coord: c2, color: 'black' }] });
          moves.push({ placements: [{ coord: c1, color: 'white' }, { coord: c2, color: 'white' }] });
        }
      }
    }

    return moves;
  }

  // For bot strategy: calculate current score estimate
  getCurrentScores(state: ProdutoState): { black: number; white: number } {
    return {
      black: this.calculateScore(state, 'black'),
      white: this.calculateScore(state, 'white'),
    };
  }
}
