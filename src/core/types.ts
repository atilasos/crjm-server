// ============================================================================
// Core Types for Tournament Server
// ============================================================================

export type GameId = 
  | 'gatos-caes' 
  | 'dominorio' 
  | 'quelhas' 
  | 'produto' 
  | 'atari-go' 
  | 'nex';

export type BracketType = 'winners' | 'losers';

export type TournamentPhase = 'registration' | 'running' | 'finished';

export type MatchPhase = 'waiting' | 'playing' | 'finished';

export type PlayerRole = 'player1' | 'player2';

// ============================================================================
// Player
// ============================================================================

export interface Player {
  id: string;
  name: string;
  classId?: string;
  isOnline: boolean;
  connectionId?: string;
}

// ============================================================================
// Match
// ============================================================================

export interface MatchScore {
  player1Wins: number;
  player2Wins: number;
}

export interface Match {
  id: string;
  round: number;
  bracket: BracketType;
  player1Id: string | null;
  player2Id: string | null;
  score: MatchScore;
  bestOf: number;
  currentGame: number;
  whoStartsCurrentGame: PlayerRole | null;
  phase: MatchPhase;
  winnerId: string | null;
  loserId: string | null;
  // Links to next matches in the bracket
  winnerGoesToMatchId?: string;
  loserGoesToMatchId?: string;
  // Source matches (for bracket generation)
  sourceMatch1Id?: string;
  sourceMatch2Id?: string;
}

// ============================================================================
// Tournament
// ============================================================================

export interface Tournament {
  id: string;
  gameId: GameId;
  label?: string;
  phase: TournamentPhase;
  players: Map<string, Player>;
  winnersMatches: Match[];
  losersMatches: Match[];
  grandFinal: Match | null;
  grandFinalReset: Match | null;
  championId: string | null;
  createdAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
}

// ============================================================================
// Game Session (active game within a match)
// ============================================================================

export interface GameSession<TState = unknown> {
  id: string;
  tournamentId: string;
  matchId: string;
  gameNumber: number;
  gameId: GameId;
  state: TState;
  currentTurn: PlayerRole;
  isFinished: boolean;
  winnerId: string | null;
  moves: GameMove[];
  startedAt: Date;
  finishedAt?: Date;
}

export interface GameMove {
  playerId: string;
  move: unknown;
  timestamp: Date;
}

// ============================================================================
// Game Engine Interface
// ============================================================================

export type GameResult = PlayerRole | 'draw' | null;

export interface GameEngine<TState = unknown, TMove = unknown> {
  gameId: GameId;
  createInitialState(startingPlayer: PlayerRole): TState;
  validateMove(state: TState, move: TMove, player: PlayerRole): boolean;
  applyMove(state: TState, move: TMove, player: PlayerRole): TState;
  isGameOver(state: TState): boolean;
  getWinner(state: TState): GameResult;
  getCurrentTurn(state: TState): PlayerRole;
  serializeState(state: TState): unknown;
  deserializeState(payload: unknown): TState;
}

// ============================================================================
// WebSocket Protocol - Client Messages
// ============================================================================

export interface JoinTournamentMessage {
  type: 'join_tournament';
  gameId: GameId;
  playerName: string;
  classId?: string;
  playerId?: string; // For reconnection
}

export interface ReadyForMatchMessage {
  type: 'ready_for_match';
  matchId: string;
}

export interface SubmitMoveMessage {
  type: 'submit_move';
  matchId: string;
  gameNumber: number;
  move: unknown;
}

export interface LeaveTournamentMessage {
  type: 'leave_tournament';
}

export type ClientMessage = 
  | JoinTournamentMessage 
  | ReadyForMatchMessage 
  | SubmitMoveMessage 
  | LeaveTournamentMessage;

// ============================================================================
// WebSocket Protocol - Server Messages
// ============================================================================

export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  playerName: string;
  tournamentId: string;
  tournamentState: TournamentStateUpdate;
}

export interface TournamentStateUpdate {
  type: 'tournament_state_update';
  tournamentId: string;
  gameId: GameId;
  phase: TournamentPhase;
  players: Array<{ id: string; name: string; classId?: string; isOnline: boolean }>;
  winnersMatches: MatchSummary[];
  losersMatches: MatchSummary[];
  grandFinal: MatchSummary | null;
  grandFinalReset: MatchSummary | null;
  championId: string | null;
  championName: string | null;
}

export interface MatchSummary {
  id: string;
  round: number;
  bracket: BracketType;
  player1: { id: string; name: string } | null;
  player2: { id: string; name: string } | null;
  score: MatchScore;
  phase: MatchPhase;
  winnerId: string | null;
}

export interface MatchAssignedMessage {
  type: 'match_assigned';
  match: MatchSummary;
  yourRole: PlayerRole;
  opponentName: string;
}

export interface GameStartMessage {
  type: 'game_start';
  matchId: string;
  gameNumber: number;
  youStart: boolean;
  initialState: unknown;
  yourRole: PlayerRole;
}

export interface GameStateUpdateMessage {
  type: 'game_state_update';
  matchId: string;
  gameNumber: number;
  gameState: unknown;
  yourTurn: boolean;
  lastMove?: unknown;
  lastMoveBy?: PlayerRole;
}

export interface GameEndMessage {
  type: 'game_end';
  matchId: string;
  gameNumber: number;
  winnerId: string | null;
  winnerRole: PlayerRole | null;
  isDraw: boolean;
  finalState: unknown;
  matchScore: MatchScore;
}

export interface MatchEndMessage {
  type: 'match_end';
  matchId: string;
  winnerId: string;
  winnerName: string;
  finalScore: MatchScore;
  youWon: boolean;
  nextMatchId?: string;
  eliminatedFromTournament: boolean;
}

export interface TournamentEndMessage {
  type: 'tournament_end';
  tournamentId: string;
  championId: string;
  championName: string;
  finalStandings: Array<{ rank: number; playerId: string; playerName: string }>;
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface InfoMessage {
  type: 'info';
  message: string;
}

export type ServerMessage = 
  | WelcomeMessage
  | TournamentStateUpdate
  | MatchAssignedMessage
  | GameStartMessage
  | GameStateUpdateMessage
  | GameEndMessage
  | MatchEndMessage
  | TournamentEndMessage
  | ErrorMessage
  | InfoMessage;

// ============================================================================
// Connection State
// ============================================================================

export interface ConnectionState {
  connectionId: string;
  playerId?: string;
  tournamentId?: string;
  matchId?: string;
}

