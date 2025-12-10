// ============================================================================
// WebSocket Handler - Manages client connections and messages
// ============================================================================

import type { ServerWebSocket } from 'bun';
import {
  ConnectionState,
  ClientMessage,
  ServerMessage,
  JoinTournamentMessage,
  ReadyForMatchMessage,
  SubmitMoveMessage,
  WelcomeMessage,
  MatchAssignedMessage,
  GameStartMessage,
  GameStateUpdateMessage,
  GameEndMessage,
  MatchEndMessage,
  TournamentEndMessage,
  ErrorMessage,
  PlayerRole,
  Match,
} from '../core/types';
import { generateId } from '../core/utils';
import { tournamentManager } from '../core/tournament/tournament-manager';
import { gameSessionManager } from '../core/game-session/game-session-manager';
import {
  setBotCallbacks,
  maybePlayForBot,
  isBotVsBotMatch,
  scheduleBotMove,
  playBotGame,
} from './bot-manager';

// ============================================================================
// Connection Management
// ============================================================================

type WebSocketData = ConnectionState;

const connections: Map<string, ServerWebSocket<WebSocketData>> = new Map();
const playerConnections: Map<string, string> = new Map(); // playerId -> connectionId

// ============================================================================
// Bot Integration Setup
// ============================================================================

// Set up bot callbacks for game updates
setBotCallbacks(
  // On game update (after bot move)
  (tournamentId, match, sessionId) => {
    broadcastGameStateUpdate(tournamentId, match, sessionId);
    
    // Check if bot should continue playing (for bot vs bot)
    scheduleBotMove(tournamentId, match, sessionId, 200);
  },
  // On game end (after bot's winning move)
  (tournamentId, match, sessionId, winnerRole) => {
    handleGameEnd(tournamentId, match, sessionId, winnerRole);
  }
);

// ============================================================================
// WebSocket Handlers
// ============================================================================

export function handleOpen(ws: ServerWebSocket<WebSocketData>): void {
  const connectionId = generateId('conn');
  ws.data = { connectionId };
  connections.set(connectionId, ws);
  console.log(`[WS] Client connected: ${connectionId}`);
}

export function handleClose(ws: ServerWebSocket<WebSocketData>): void {
  const { connectionId, playerId, tournamentId } = ws.data;
  
  if (playerId && tournamentId) {
    tournamentManager.setPlayerOnlineStatus(tournamentId, playerId, false);
    playerConnections.delete(playerId);
    broadcastTournamentState(tournamentId);
  }

  connections.delete(connectionId);
  console.log(`[WS] Client disconnected: ${connectionId}`);
}

export function handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer): void {
  try {
    const data = JSON.parse(message.toString()) as ClientMessage;
    
    switch (data.type) {
      case 'join_tournament':
        handleJoinTournament(ws, data);
        break;
      case 'ready_for_match':
        handleReadyForMatch(ws, data);
        break;
      case 'submit_move':
        handleSubmitMove(ws, data);
        break;
      case 'leave_tournament':
        handleLeaveTournament(ws);
        break;
      default:
        sendError(ws, 'UNKNOWN_MESSAGE', 'Unknown message type');
    }
  } catch (error) {
    console.error('[WS] Error parsing message:', error);
    sendError(ws, 'PARSE_ERROR', 'Failed to parse message');
  }
}

// ============================================================================
// Message Handlers
// ============================================================================

function handleJoinTournament(ws: ServerWebSocket<WebSocketData>, msg: JoinTournamentMessage): void {
  const { gameId, playerName, classId, playerId: existingPlayerId } = msg;

  // Get or create tournament for this game
  const tournament = tournamentManager.getOrCreateTournamentForGame(gameId);

  // Add player
  const player = tournamentManager.addPlayer(
    tournament.id, 
    playerName, 
    classId, 
    existingPlayerId
  );

  if (!player) {
    sendError(ws, 'JOIN_FAILED', 'Failed to join tournament. Registration may be closed.');
    return;
  }

  // Update connection state
  ws.data.playerId = player.id;
  ws.data.tournamentId = tournament.id;
  playerConnections.set(player.id, ws.data.connectionId);

  // Set player online with connection ID
  tournamentManager.setPlayerOnlineStatus(tournament.id, player.id, true, ws.data.connectionId);

  // Send welcome message
  const tournamentState = tournamentManager.getTournamentState(tournament.id);
  const welcomeMsg: WelcomeMessage = {
    type: 'welcome',
    playerId: player.id,
    playerName: player.name,
    tournamentId: tournament.id,
    tournamentState: tournamentState!,
  };
  send(ws, welcomeMsg);

  // Broadcast updated state to all players in tournament
  broadcastTournamentState(tournament.id);

  console.log(`[WS] Player ${playerName} joined tournament ${tournament.id}`);
}

function handleReadyForMatch(ws: ServerWebSocket<WebSocketData>, msg: ReadyForMatchMessage): void {
  const { playerId, tournamentId } = ws.data;
  if (!playerId || !tournamentId) {
    sendError(ws, 'NOT_IN_TOURNAMENT', 'You are not in a tournament');
    return;
  }

  const match = tournamentManager.getMatch(tournamentId, msg.matchId);
  if (!match) {
    sendError(ws, 'MATCH_NOT_FOUND', 'Match not found');
    return;
  }

  // Check if player is part of this match
  if (match.player1Id !== playerId && match.player2Id !== playerId) {
    sendError(ws, 'NOT_IN_MATCH', 'You are not part of this match');
    return;
  }

  // Start match if both players are ready (simplified - in production would track ready state)
  const startedMatch = tournamentManager.startMatch(tournamentId, msg.matchId);
  if (startedMatch) {
    startGameInMatch(tournamentId, startedMatch);
  }
}

function handleSubmitMove(ws: ServerWebSocket<WebSocketData>, msg: SubmitMoveMessage): void {
  const { playerId, tournamentId } = ws.data;
  if (!playerId || !tournamentId) {
    sendError(ws, 'NOT_IN_TOURNAMENT', 'You are not in a tournament');
    return;
  }

  const match = tournamentManager.getMatch(tournamentId, msg.matchId);
  if (!match) {
    sendError(ws, 'MATCH_NOT_FOUND', 'Match not found');
    return;
  }

  // Determine player role
  let playerRole: PlayerRole;
  if (match.player1Id === playerId) {
    playerRole = 'player1';
  } else if (match.player2Id === playerId) {
    playerRole = 'player2';
  } else {
    sendError(ws, 'NOT_IN_MATCH', 'You are not part of this match');
    return;
  }

  // Get active session
  const session = gameSessionManager.getActiveSessionForMatch(msg.matchId);
  if (!session) {
    sendError(ws, 'NO_ACTIVE_GAME', 'No active game in this match');
    return;
  }

  // Submit move
  const result = gameSessionManager.submitMove(session.id, playerId, playerRole, msg.move);

  if (!result.success) {
    sendError(ws, 'INVALID_MOVE', result.error || 'Invalid move');
    return;
  }

  // Broadcast game state update
  broadcastGameStateUpdate(tournamentId, match, session.id);

  // Handle game over
  if (result.gameOver) {
    handleGameEnd(tournamentId, match, session.id, result.winner);
  } else {
    // Check if opponent is a bot and should move
    scheduleBotMove(tournamentId, match, session.id, 200);
  }
}

function handleLeaveTournament(ws: ServerWebSocket<WebSocketData>): void {
  const { playerId, tournamentId } = ws.data;
  if (!playerId || !tournamentId) {
    return;
  }

  tournamentManager.removePlayer(tournamentId, playerId);
  playerConnections.delete(playerId);
  
  ws.data.playerId = undefined;
  ws.data.tournamentId = undefined;

  broadcastTournamentState(tournamentId);
  console.log(`[WS] Player ${playerId} left tournament ${tournamentId}`);
}

// ============================================================================
// Game Flow
// ============================================================================

function startGameInMatch(tournamentId: string, match: Match): void {
  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament) return;

  const session = gameSessionManager.createSession(
    tournamentId,
    match.id,
    match.currentGame,
    tournament.gameId,
    match.whoStartsCurrentGame || 'player1'
  );

  if (!session) {
    console.error(`[WS] Failed to create game session for match ${match.id}`);
    return;
  }

  const state = gameSessionManager.getSerializedState(session.id);

  // Send game start to both players
  const player1 = tournament.players.get(match.player1Id!);
  const player2 = tournament.players.get(match.player2Id!);

  if (player1) {
    const ws1 = getPlayerConnection(match.player1Id!);
    if (ws1) {
      const msg: GameStartMessage = {
        type: 'game_start',
        matchId: match.id,
        gameNumber: match.currentGame,
        youStart: match.whoStartsCurrentGame === 'player1',
        initialState: state,
        yourRole: 'player1',
      };
      send(ws1, msg);
    }
  }

  if (player2) {
    const ws2 = getPlayerConnection(match.player2Id!);
    if (ws2) {
      const msg: GameStartMessage = {
        type: 'game_start',
        matchId: match.id,
        gameNumber: match.currentGame,
        youStart: match.whoStartsCurrentGame === 'player2',
        initialState: state,
        yourRole: 'player2',
      };
      send(ws2, msg);
    }
  }

  console.log(`[WS] Started game ${match.currentGame} in match ${match.id}`);

  // Check if first player is a bot and should move
  scheduleBotMove(tournamentId, match, session.id, 300);
}

function handleGameEnd(
  tournamentId: string, 
  match: Match, 
  sessionId: string, 
  winnerRole: PlayerRole | 'draw' | null
): void {
  const session = gameSessionManager.getSession(sessionId);
  if (!session) return;

  let winnerId: string | null = null;
  if (winnerRole === 'player1') {
    winnerId = match.player1Id;
  } else if (winnerRole === 'player2') {
    winnerId = match.player2Id;
  }

  // Record result in tournament
  const { matchFinished, tournamentFinished } = tournamentManager.recordGameResult(
    tournamentId,
    match.id,
    session.gameNumber,
    winnerId
  );

  const state = gameSessionManager.getSerializedState(sessionId);

  // Broadcast game end
  broadcastToMatchPlayers(match, (ws, playerRole) => {
    const msg: GameEndMessage = {
      type: 'game_end',
      matchId: match.id,
      gameNumber: session.gameNumber,
      winnerId,
      winnerRole: winnerRole === 'draw' ? null : winnerRole,
      isDraw: winnerRole === 'draw',
      finalState: state,
      matchScore: { ...match.score },
    };
    send(ws, msg);
  });

  if (matchFinished) {
    handleMatchEnd(tournamentId, match);
  } else {
    // Start next game after a short delay
    setTimeout(() => {
      const updatedMatch = tournamentManager.getMatch(tournamentId, match.id);
      if (updatedMatch && updatedMatch.phase === 'playing') {
        startGameInMatch(tournamentId, updatedMatch);
      }
    }, 2000);
  }

  if (tournamentFinished) {
    handleTournamentEnd(tournamentId);
  }
}

function handleMatchEnd(tournamentId: string, match: Match): void {
  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament || !match.winnerId) return;

  const winner = tournament.players.get(match.winnerId);
  const loser = tournament.players.get(match.loserId!);

  broadcastToMatchPlayers(match, (ws, playerRole) => {
    const isPlayer1 = playerRole === 'player1';
    const playerId = isPlayer1 ? match.player1Id : match.player2Id;
    
    const msg: MatchEndMessage = {
      type: 'match_end',
      matchId: match.id,
      winnerId: match.winnerId!,
      winnerName: winner?.name || 'Unknown',
      finalScore: { ...match.score },
      youWon: playerId === match.winnerId,
      eliminatedFromTournament: playerId === match.loserId && match.bracket === 'losers',
    };
    send(ws, msg);
  });

  // Broadcast updated tournament state
  broadcastTournamentState(tournamentId);

  // Check for matches ready to start
  const readyMatches = tournamentManager.getMatchesReadyToStart(tournamentId);
  for (const readyMatch of readyMatches) {
    // Check if both players are bots - auto-start the match
    if (isBotVsBotMatch(tournamentId, readyMatch)) {
      console.log(`[WS] Auto-starting bot vs bot match ${readyMatch.id}`);
      startMatchAndNotify(tournamentId, readyMatch.id);
    } else {
      notifyMatchAssignment(tournamentId, readyMatch);
    }
  }

  // Cleanup game sessions for this match
  gameSessionManager.cleanupMatchSessions(match.id);
}

function handleTournamentEnd(tournamentId: string): void {
  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament || !tournament.championId) return;

  const champion = tournament.players.get(tournament.championId);

  // Build final standings (simplified - just champion for now)
  const finalStandings = [
    { rank: 1, playerId: tournament.championId, playerName: champion?.name || 'Unknown' }
  ];

  // Broadcast to all tournament players
  tournament.players.forEach((player, playerId) => {
    const ws = getPlayerConnection(playerId);
    if (ws) {
      const msg: TournamentEndMessage = {
        type: 'tournament_end',
        tournamentId,
        championId: tournament.championId!,
        championName: champion?.name || 'Unknown',
        finalStandings,
      };
      send(ws, msg);
    }
  });

  tournamentManager.finishTournament(tournamentId);
}

function notifyMatchAssignment(tournamentId: string, match: Match): void {
  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament) return;

  const player1 = tournament.players.get(match.player1Id!);
  const player2 = tournament.players.get(match.player2Id!);

  const matchSummary = {
    id: match.id,
    round: match.round,
    bracket: match.bracket,
    player1: player1 ? { id: player1.id, name: player1.name } : null,
    player2: player2 ? { id: player2.id, name: player2.name } : null,
    score: { ...match.score },
    phase: match.phase,
    winnerId: match.winnerId,
  };

  // Notify player 1
  const ws1 = getPlayerConnection(match.player1Id!);
  if (ws1 && player2) {
    const msg: MatchAssignedMessage = {
      type: 'match_assigned',
      match: matchSummary,
      yourRole: 'player1',
      opponentName: player2.name,
    };
    send(ws1, msg);
  }

  // Notify player 2
  const ws2 = getPlayerConnection(match.player2Id!);
  if (ws2 && player1) {
    const msg: MatchAssignedMessage = {
      type: 'match_assigned',
      match: matchSummary,
      yourRole: 'player2',
      opponentName: player1.name,
    };
    send(ws2, msg);
  }
}

// ============================================================================
// Broadcasting
// ============================================================================

function broadcastTournamentState(tournamentId: string): void {
  const state = tournamentManager.getTournamentState(tournamentId);
  if (!state) return;

  const tournament = tournamentManager.getTournament(tournamentId);
  if (!tournament) return;

  tournament.players.forEach((player, playerId) => {
    const ws = getPlayerConnection(playerId);
    if (ws) {
      send(ws, state);
    }
  });
}

function broadcastGameStateUpdate(tournamentId: string, match: Match, sessionId: string): void {
  const session = gameSessionManager.getSession(sessionId);
  if (!session) return;

  const state = gameSessionManager.getSerializedState(sessionId);
  const lastMove = session.moves[session.moves.length - 1];

  broadcastToMatchPlayers(match, (ws, playerRole) => {
    const isMyTurn = session.currentTurn === playerRole;
    const msg: GameStateUpdateMessage = {
      type: 'game_state_update',
      matchId: match.id,
      gameNumber: session.gameNumber,
      gameState: state,
      yourTurn: isMyTurn,
      lastMove: lastMove?.move,
      lastMoveBy: lastMove ? (match.player1Id === lastMove.playerId ? 'player1' : 'player2') : undefined,
    };
    send(ws, msg);
  });
}

function broadcastToMatchPlayers(
  match: Match, 
  callback: (ws: ServerWebSocket<WebSocketData>, role: PlayerRole) => void
): void {
  if (match.player1Id) {
    const ws1 = getPlayerConnection(match.player1Id);
    if (ws1) callback(ws1, 'player1');
  }
  if (match.player2Id) {
    const ws2 = getPlayerConnection(match.player2Id);
    if (ws2) callback(ws2, 'player2');
  }
}

// ============================================================================
// Utilities
// ============================================================================

function getPlayerConnection(playerId: string): ServerWebSocket<WebSocketData> | undefined {
  const connectionId = playerConnections.get(playerId);
  if (!connectionId) return undefined;
  return connections.get(connectionId);
}

function send(ws: ServerWebSocket<WebSocketData>, msg: ServerMessage): void {
  ws.send(JSON.stringify(msg));
}

function sendError(ws: ServerWebSocket<WebSocketData>, code: string, message: string): void {
  const errorMsg: ErrorMessage = {
    type: 'error',
    code,
    message,
  };
  send(ws, errorMsg);
}

// ============================================================================
// Export for external use (admin API)
// ============================================================================

export function broadcastToTournament(tournamentId: string): void {
  broadcastTournamentState(tournamentId);
}

export function startMatchAndNotify(tournamentId: string, matchId: string): boolean {
  const match = tournamentManager.startMatch(tournamentId, matchId);
  if (match) {
    startGameInMatch(tournamentId, match);
    return true;
  }
  return false;
}

