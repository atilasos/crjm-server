// ============================================================================
// Tournament Manager - Manages all tournaments
// ============================================================================

import { 
  Tournament, 
  Player, 
  Match, 
  GameId, 
  TournamentPhase, 
  MatchPhase,
  PlayerRole,
  MatchSummary,
  TournamentStateUpdate
} from '../types';
import { generateId } from '../utils';
import { createDoubleEliminationBracket, advanceWinner, advanceLoser } from './double-elimination';

export class TournamentManager {
  private tournaments: Map<string, Tournament> = new Map();
  private tournamentsByGame: Map<GameId, string[]> = new Map();

  // =========================================================================
  // Tournament Creation & Management
  // =========================================================================

  createTournament(gameId: GameId, label?: string): Tournament {
    const id = generateId('tournament');
    const tournament: Tournament = {
      id,
      gameId,
      label: label || `${gameId} Tournament`,
      phase: 'registration',
      players: new Map(),
      winnersMatches: [],
      losersMatches: [],
      grandFinal: null,
      grandFinalReset: null,
      championId: null,
      createdAt: new Date(),
    };

    this.tournaments.set(id, tournament);

    // Track by game
    const gameList = this.tournamentsByGame.get(gameId) || [];
    gameList.push(id);
    this.tournamentsByGame.set(gameId, gameList);

    console.log(`[TOURNAMENT] Created tournament ${id} for ${gameId}`);
    return tournament;
  }

  getTournament(id: string): Tournament | undefined {
    return this.tournaments.get(id);
  }

  getTournamentForGame(gameId: GameId): Tournament | undefined {
    const tournamentIds = this.tournamentsByGame.get(gameId);
    if (!tournamentIds || tournamentIds.length === 0) return undefined;

    // Find an active (registration or running) tournament for this game
    for (const id of tournamentIds) {
      const tournament = this.tournaments.get(id);
      if (tournament && tournament.phase !== 'finished') {
        return tournament;
      }
    }

    return undefined;
  }

  getOrCreateTournamentForGame(gameId: GameId): Tournament {
    let tournament = this.getTournamentForGame(gameId);
    if (!tournament) {
      tournament = this.createTournament(gameId);
    }
    return tournament;
  }

  getAllTournaments(): Tournament[] {
    return Array.from(this.tournaments.values());
  }

  // =========================================================================
  // Player Management
  // =========================================================================

  addPlayer(tournamentId: string, name: string, classId?: string, existingPlayerId?: string): Player | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      console.log(`[TOURNAMENT] Tournament ${tournamentId} not found`);
      return null;
    }

    if (tournament.phase !== 'registration') {
      console.log(`[TOURNAMENT] Tournament ${tournamentId} is not accepting registrations`);
      return null;
    }

    // If reconnecting with existing player ID
    if (existingPlayerId) {
      const existingPlayer = tournament.players.get(existingPlayerId);
      if (existingPlayer) {
        existingPlayer.isOnline = true;
        console.log(`[TOURNAMENT] Player ${existingPlayer.name} reconnected to tournament ${tournamentId}`);
        return existingPlayer;
      }
    }

    // Create new player
    const player: Player = {
      id: generateId('player'),
      name,
      classId,
      isOnline: true,
    };

    tournament.players.set(player.id, player);
    console.log(`[TOURNAMENT] Player ${name} joined tournament ${tournamentId}`);
    return player;
  }

  removePlayer(tournamentId: string, playerId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return false;

    const player = tournament.players.get(playerId);
    if (!player) return false;

    if (tournament.phase === 'registration') {
      tournament.players.delete(playerId);
      console.log(`[TOURNAMENT] Player ${player.name} removed from tournament ${tournamentId}`);
      return true;
    }

    // If tournament is running, mark as offline (forfeit handled separately)
    player.isOnline = false;
    console.log(`[TOURNAMENT] Player ${player.name} went offline in tournament ${tournamentId}`);
    return true;
  }

  setPlayerOnlineStatus(tournamentId: string, playerId: string, isOnline: boolean, connectionId?: string): void {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return;

    const player = tournament.players.get(playerId);
    if (player) {
      player.isOnline = isOnline;
      player.connectionId = connectionId;
    }
  }

  getPlayer(tournamentId: string, playerId: string): Player | undefined {
    return this.tournaments.get(tournamentId)?.players.get(playerId);
  }

  // =========================================================================
  // Tournament Lifecycle
  // =========================================================================

  startTournament(tournamentId: string): { success: boolean; error?: string } {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) {
      return { success: false, error: 'Tournament not found' };
    }

    if (tournament.phase !== 'registration') {
      return { success: false, error: 'Tournament is not in registration phase' };
    }

    const playerCount = tournament.players.size;
    if (playerCount < 2) {
      return { success: false, error: 'Need at least 2 players to start' };
    }

    // Generate bracket
    const playerIds = Array.from(tournament.players.keys());
    const { winnersMatches, losersMatches, grandFinal, grandFinalReset } = 
      createDoubleEliminationBracket(playerIds);

    tournament.winnersMatches = winnersMatches;
    tournament.losersMatches = losersMatches;
    tournament.grandFinal = grandFinal;
    tournament.grandFinalReset = grandFinalReset;
    tournament.phase = 'running';
    tournament.startedAt = new Date();

    console.log(`[TOURNAMENT] Started tournament ${tournamentId} with ${playerCount} players`);
    return { success: true };
  }

  finishTournament(tournamentId: string): boolean {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return false;

    tournament.phase = 'finished';
    tournament.finishedAt = new Date();
    console.log(`[TOURNAMENT] Finished tournament ${tournamentId}`);
    return true;
  }

  // =========================================================================
  // Match Management
  // =========================================================================

  getMatch(tournamentId: string, matchId: string): Match | undefined {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return undefined;

    // Search in all match arrays
    const allMatches = [
      ...tournament.winnersMatches,
      ...tournament.losersMatches,
      tournament.grandFinal,
      tournament.grandFinalReset,
    ].filter(Boolean) as Match[];

    return allMatches.find(m => m.id === matchId);
  }

  getPlayerActiveMatch(tournamentId: string, playerId: string): Match | undefined {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return undefined;

    const allMatches = [
      ...tournament.winnersMatches,
      ...tournament.losersMatches,
      tournament.grandFinal,
      tournament.grandFinalReset,
    ].filter(Boolean) as Match[];

    return allMatches.find(m => 
      (m.player1Id === playerId || m.player2Id === playerId) && 
      m.phase !== 'finished'
    );
  }

  getMatchesReadyToStart(tournamentId: string): Match[] {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.phase !== 'running') return [];

    const allMatches = [
      ...tournament.winnersMatches,
      ...tournament.losersMatches,
      tournament.grandFinal,
      tournament.grandFinalReset,
    ].filter(Boolean) as Match[];

    return allMatches.filter(m => 
      m.phase === 'waiting' && 
      m.player1Id && 
      m.player2Id
    );
  }

  startMatch(tournamentId: string, matchId: string): Match | null {
    const match = this.getMatch(tournamentId, matchId);
    if (!match || match.phase !== 'waiting') return null;
    if (!match.player1Id || !match.player2Id) return null;

    match.phase = 'playing';
    match.currentGame = 1;
    match.whoStartsCurrentGame = 'player1';
    console.log(`[TOURNAMENT] Started match ${matchId}`);
    return match;
  }

  recordGameResult(
    tournamentId: string, 
    matchId: string, 
    gameNumber: number, 
    winnerId: string | null
  ): { matchFinished: boolean; tournamentFinished: boolean } {
    const tournament = this.tournaments.get(tournamentId);
    const match = this.getMatch(tournamentId, matchId);
    
    if (!tournament || !match) {
      return { matchFinished: false, tournamentFinished: false };
    }

    // Update score
    if (winnerId === match.player1Id) {
      match.score.player1Wins++;
    } else if (winnerId === match.player2Id) {
      match.score.player2Wins++;
    }
    // If winnerId is null, it's a draw (count as no one winning)

    const winsNeeded = Math.ceil(match.bestOf / 2);
    let matchFinished = false;
    let tournamentFinished = false;

    // Check if match is over
    if (match.score.player1Wins >= winsNeeded) {
      match.winnerId = match.player1Id;
      match.loserId = match.player2Id;
      matchFinished = true;
    } else if (match.score.player2Wins >= winsNeeded) {
      match.winnerId = match.player2Id;
      match.loserId = match.player1Id;
      matchFinished = true;
    }

    if (matchFinished) {
      match.phase = 'finished';
      console.log(`[TOURNAMENT] Match ${matchId} finished. Winner: ${match.winnerId}`);

      // Advance players in bracket
      if (match.winnerId && match.winnerGoesToMatchId) {
        advanceWinner(tournament, match.winnerId, match.winnerGoesToMatchId);
      }
      if (match.loserId && match.loserGoesToMatchId) {
        advanceLoser(tournament, match.loserId, match.loserGoesToMatchId);
      }

      // Check if this was grand final or grand final reset
      if (match === tournament.grandFinal) {
        if (match.winnerId === match.player1Id) {
          // Winners bracket player won, tournament is over
          tournament.championId = match.winnerId;
          tournamentFinished = true;
        } else if (tournament.grandFinalReset) {
          // Losers bracket player won, need reset match
          tournament.grandFinalReset.player1Id = match.player1Id;
          tournament.grandFinalReset.player2Id = match.player2Id;
        }
      } else if (match === tournament.grandFinalReset) {
        // Grand final reset completed
        tournament.championId = match.winnerId;
        tournamentFinished = true;
      }

      // Check if all matches are done
      if (tournament.championId) {
        tournament.phase = 'finished';
        tournament.finishedAt = new Date();
        console.log(`[TOURNAMENT] Tournament ${tournamentId} finished! Champion: ${tournament.championId}`);
      }
    } else {
      // Prepare next game
      match.currentGame++;
      // Alternate who starts
      match.whoStartsCurrentGame = match.whoStartsCurrentGame === 'player1' ? 'player2' : 'player1';
    }

    return { matchFinished, tournamentFinished };
  }

  // =========================================================================
  // State Serialization
  // =========================================================================

  getTournamentState(tournamentId: string): TournamentStateUpdate | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    const playersArray = Array.from(tournament.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      classId: p.classId,
      isOnline: p.isOnline,
    }));

    const serializeMatch = (match: Match): MatchSummary => ({
      id: match.id,
      round: match.round,
      bracket: match.bracket,
      player1: match.player1Id ? this.getPlayerSummary(tournament, match.player1Id) : null,
      player2: match.player2Id ? this.getPlayerSummary(tournament, match.player2Id) : null,
      score: { ...match.score },
      phase: match.phase,
      winnerId: match.winnerId,
    });

    return {
      type: 'tournament_state_update',
      tournamentId: tournament.id,
      gameId: tournament.gameId,
      phase: tournament.phase,
      players: playersArray,
      winnersMatches: tournament.winnersMatches.map(serializeMatch),
      losersMatches: tournament.losersMatches.map(serializeMatch),
      grandFinal: tournament.grandFinal ? serializeMatch(tournament.grandFinal) : null,
      grandFinalReset: tournament.grandFinalReset ? serializeMatch(tournament.grandFinalReset) : null,
      championId: tournament.championId,
      championName: tournament.championId 
        ? tournament.players.get(tournament.championId)?.name || null 
        : null,
    };
  }

  private getPlayerSummary(tournament: Tournament, playerId: string): { id: string; name: string } | null {
    const player = tournament.players.get(playerId);
    if (!player) return null;
    return { id: player.id, name: player.name };
  }

  // =========================================================================
  // Export/Import
  // =========================================================================

  exportTournament(tournamentId: string): string | null {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament) return null;

    const exportData = {
      ...tournament,
      players: Array.from(tournament.players.entries()),
    };

    return JSON.stringify(exportData, null, 2);
  }

  importTournament(jsonData: string): Tournament | null {
    try {
      const data = JSON.parse(jsonData);
      const tournament: Tournament = {
        ...data,
        players: new Map(data.players),
        createdAt: new Date(data.createdAt),
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        finishedAt: data.finishedAt ? new Date(data.finishedAt) : undefined,
      };

      this.tournaments.set(tournament.id, tournament);
      
      const gameList = this.tournamentsByGame.get(tournament.gameId) || [];
      if (!gameList.includes(tournament.id)) {
        gameList.push(tournament.id);
        this.tournamentsByGame.set(tournament.gameId, gameList);
      }

      console.log(`[TOURNAMENT] Imported tournament ${tournament.id}`);
      return tournament;
    } catch (error) {
      console.error('[TOURNAMENT] Failed to import tournament:', error);
      return null;
    }
  }
}

// Singleton instance
export const tournamentManager = new TournamentManager();

