// ============================================================================
// Double Elimination Bracket Generation and Management
// ============================================================================

import { Match, Tournament, BracketType, MatchPhase } from '../types';
import { generateId, shuffleArray } from '../utils';

interface BracketResult {
  winnersMatches: Match[];
  losersMatches: Match[];
  grandFinal: Match;
  grandFinalReset: Match;
}

/**
 * Creates a double elimination bracket for the given players
 */
export function createDoubleEliminationBracket(playerIds: string[]): BracketResult {
  // Shuffle players randomly
  const shuffledPlayers = shuffleArray([...playerIds]);
  const n = shuffledPlayers.length;

  // Calculate bracket size (next power of 2)
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const numRoundsWinners = Math.ceil(Math.log2(bracketSize));

  // Create winners bracket matches
  const winnersMatches: Match[] = [];
  const losersMatches: Match[] = [];

  // Track matches by round for linking
  const winnersByRound: Match[][] = [];
  const losersByRound: Match[][] = [];

  // =========================================================================
  // Winners Bracket
  // =========================================================================

  // Round 1 - Initial matchups
  const round1Matches: Match[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const player1Id = shuffledPlayers[i * 2] || null;
    const player2Id = shuffledPlayers[i * 2 + 1] || null;

    const match = createMatch(1, 'winners', player1Id, player2Id);

    // Handle byes
    if (player1Id && !player2Id) {
      match.winnerId = player1Id;
      match.phase = 'finished';
    } else if (!player1Id && player2Id) {
      match.winnerId = player2Id;
      match.phase = 'finished';
    }

    round1Matches.push(match);
    winnersMatches.push(match);
  }
  winnersByRound.push(round1Matches);

  // Subsequent winners rounds
  for (let round = 2; round <= numRoundsWinners; round++) {
    const prevRound = winnersByRound[round - 2];
    const roundMatches: Match[] = [];

    for (let i = 0; i < prevRound.length / 2; i++) {
      const sourceMatch1 = prevRound[i * 2];
      const sourceMatch2 = prevRound[i * 2 + 1];

      const match = createMatch(round, 'winners', null, null);
      match.sourceMatch1Id = sourceMatch1.id;
      match.sourceMatch2Id = sourceMatch2.id;

      // Link previous matches
      sourceMatch1.winnerGoesToMatchId = match.id;
      sourceMatch2.winnerGoesToMatchId = match.id;

      // If both source matches are finished (byes), advance winners
      if (sourceMatch1.phase === 'finished' && sourceMatch1.winnerId) {
        match.player1Id = sourceMatch1.winnerId;
      }
      if (sourceMatch2.phase === 'finished' && sourceMatch2.winnerId) {
        match.player2Id = sourceMatch2.winnerId;
      }

      roundMatches.push(match);
      winnersMatches.push(match);
    }
    winnersByRound.push(roundMatches);
  }

  // =========================================================================
  // Losers Bracket
  // =========================================================================

  // Losers bracket rounds: approximately (2 * numRoundsWinners - 2)
  // Each "losers round" can be:
  // - A dropout round (players falling from winners)
  // - An elimination round (losers playing losers)

  const numLosersRounds = (numRoundsWinners - 1) * 2;
  let currentLosersMatchCount = bracketSize / 2; // Initial capacity

  for (let lRound = 1; lRound <= numLosersRounds; lRound++) {
    const roundMatches: Match[] = [];
    const isDropoutRound = lRound % 2 === 1;
    const winnersRoundDropping = Math.ceil(lRound / 2);

    if (isDropoutRound && winnersRoundDropping <= winnersByRound.length) {
      // Dropout round: losers from winners round fall into these matches
      const droppingMatches = winnersByRound[winnersRoundDropping - 1];
      const matchCount = Math.ceil(droppingMatches.length / 2);

      for (let i = 0; i < matchCount; i++) {
        const match = createMatch(lRound, 'losers', null, null);

        // Link losers from winners bracket
        if (lRound === 1) {
          // First losers round: direct from winners R1
          const loser1Source = droppingMatches[i * 2];
          const loser2Source = droppingMatches[i * 2 + 1];

          if (loser1Source) loser1Source.loserGoesToMatchId = match.id;
          if (loser2Source) loser2Source.loserGoesToMatchId = match.id;
        } else {
          // Later rounds: one player from previous losers round, one dropping from winners
          const prevLosersRound = losersByRound[lRound - 2];
          if (prevLosersRound && prevLosersRound[i]) {
            prevLosersRound[i].winnerGoesToMatchId = match.id;
          }

          const droppingMatch = droppingMatches[i];
          if (droppingMatch) {
            droppingMatch.loserGoesToMatchId = match.id;
          }
        }

        roundMatches.push(match);
        losersMatches.push(match);
      }
    } else {
      // Elimination round: losers bracket survivors play each other
      const prevLosersRound = losersByRound[lRound - 2];
      if (prevLosersRound) {
        const matchCount = Math.ceil(prevLosersRound.length / 2);

        for (let i = 0; i < matchCount; i++) {
          const match = createMatch(lRound, 'losers', null, null);
          const source1 = prevLosersRound[i * 2];
          const source2 = prevLosersRound[i * 2 + 1];

          if (source1) source1.winnerGoesToMatchId = match.id;
          if (source2) source2.winnerGoesToMatchId = match.id;

          roundMatches.push(match);
          losersMatches.push(match);
        }
      }
    }

    losersByRound.push(roundMatches);
  }

  // =========================================================================
  // Grand Finals
  // =========================================================================

  // Grand Final: Winner of winners bracket vs Winner of losers bracket
  const grandFinal = createMatch(numRoundsWinners + 1, 'winners', null, null);
  grandFinal.id = generateId('gf');

  // Link winners bracket final
  const winnersFinal = winnersByRound[winnersByRound.length - 1]?.[0];
  if (winnersFinal) {
    winnersFinal.winnerGoesToMatchId = grandFinal.id;
  }

  // Link losers bracket final
  const losersFinal = losersByRound[losersByRound.length - 1]?.[0];
  if (losersFinal) {
    losersFinal.winnerGoesToMatchId = grandFinal.id;
  }

  // Grand Final Reset (only played if losers bracket winner wins grand final)
  const grandFinalReset = createMatch(numRoundsWinners + 2, 'winners', null, null);
  grandFinalReset.id = generateId('gfr');

  return {
    winnersMatches,
    losersMatches,
    grandFinal,
    grandFinalReset,
  };
}

/**
 * Helper to create a new match
 */
function createMatch(
  round: number,
  bracket: BracketType,
  player1Id: string | null,
  player2Id: string | null
): Match {
  const phase: MatchPhase = (player1Id && player2Id) ? 'waiting' : 'waiting';

  return {
    id: generateId('match'),
    round,
    bracket,
    player1Id,
    player2Id,
    score: { player1Wins: 0, player2Wins: 0 },
    bestOf: 3,
    currentGame: 0,
    whoStartsCurrentGame: null,
    phase,
    winnerId: null,
    loserId: null,
  };
}

/**
 * Advances winner to their next match
 */
export function advanceWinner(tournament: Tournament, playerId: string, nextMatchId: string): void {
  const allMatches = getAllMatches(tournament);
  const nextMatch = allMatches.find(m => m.id === nextMatchId);

  if (!nextMatch) {
    console.log(`[BRACKET] Next match ${nextMatchId} not found`);
    return;
  }

  if (!nextMatch.player1Id) {
    nextMatch.player1Id = playerId;
  } else if (!nextMatch.player2Id) {
    nextMatch.player2Id = playerId;
  }

  console.log(`[BRACKET] Advanced winner ${playerId} to match ${nextMatchId}`);
}

/**
 * Advances loser to their next match (losers bracket)
 */
export function advanceLoser(tournament: Tournament, playerId: string, nextMatchId: string): void {
  const allMatches = getAllMatches(tournament);
  const nextMatch = allMatches.find(m => m.id === nextMatchId);

  if (!nextMatch) {
    console.log(`[BRACKET] Next match ${nextMatchId} not found for loser`);
    return;
  }

  if (!nextMatch.player1Id) {
    nextMatch.player1Id = playerId;
  } else if (!nextMatch.player2Id) {
    nextMatch.player2Id = playerId;
  }

  console.log(`[BRACKET] Advanced loser ${playerId} to losers match ${nextMatchId}`);
}

/**
 * Gets all matches in a tournament
 */
function getAllMatches(tournament: Tournament): Match[] {
  return [
    ...tournament.winnersMatches,
    ...tournament.losersMatches,
    tournament.grandFinal,
    tournament.grandFinalReset,
  ].filter(Boolean) as Match[];
}

