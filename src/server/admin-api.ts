// ============================================================================
// Admin API - REST endpoints for tournament management
// ============================================================================

import { tournamentManager } from '../core/tournament/tournament-manager';
import { broadcastToTournament, startMatchAndNotify } from './websocket-handler';
import type { GameId } from '../core/types';

// ============================================================================
// Route Handlers
// ============================================================================

export const adminApiRoutes = {
  // =========================================================================
  // List all tournaments
  // =========================================================================
  'GET /admin/api/tournaments': async () => {
    const tournaments = tournamentManager.getAllTournaments();
    const summary = tournaments.map(t => ({
      id: t.id,
      gameId: t.gameId,
      label: t.label,
      phase: t.phase,
      playerCount: t.players.size,
      createdAt: t.createdAt,
      startedAt: t.startedAt,
      finishedAt: t.finishedAt,
    }));
    return Response.json(summary);
  },

  // =========================================================================
  // Create new tournament
  // =========================================================================
  'POST /admin/api/tournaments': async (req: Request) => {
    try {
      const body = await req.json() as { gameId: GameId; label?: string; botCount?: number };
      const tournament = tournamentManager.createTournament(body.gameId, body.label);

      // Add bot players if requested
      if (body.botCount && body.botCount > 0) {
        tournamentManager.addBotPlayers(tournament.id, body.botCount);
      }

      return Response.json({
        id: tournament.id,
        gameId: tournament.gameId,
        label: tournament.label,
        phase: tournament.phase,
        playerCount: tournament.players.size,
      });
    } catch (error) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
  },

  // =========================================================================
  // Get tournament details
  // =========================================================================
  'GET /admin/api/tournaments/:id': async (req: Request) => {
    const url = new URL(req.url);
    const id = url.pathname.split('/').pop()!;
    
    const state = tournamentManager.getTournamentState(id);
    if (!state) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }
    return Response.json(state);
  },

  // =========================================================================
  // Add bots to tournament
  // =========================================================================
  'POST /admin/api/tournaments/:id/bots': async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2];

    try {
      const body = await req.json() as { count?: number };
      const count = body.count || 1;

      const bots = tournamentManager.addBotPlayers(id, count);
      if (bots.length === 0) {
        return Response.json({ error: 'Failed to add bots. Tournament may not be in registration phase.' }, { status: 400 });
      }

      broadcastToTournament(id);

      return Response.json({
        success: true,
        botsAdded: bots.length,
        bots: bots.map(b => ({ id: b.id, name: b.name })),
      });
    } catch (error) {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
  },

  // =========================================================================
  // Start tournament
  // =========================================================================
  'POST /admin/api/tournaments/:id/start': async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2];
    
    const result = tournamentManager.startTournament(id);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    broadcastToTournament(id);

    // Auto-start ready matches
    const readyMatches = tournamentManager.getMatchesReadyToStart(id);
    for (const match of readyMatches) {
      startMatchAndNotify(id, match.id);
    }

    const state = tournamentManager.getTournamentState(id);
    return Response.json({ success: true, state });
  },

  // =========================================================================
  // Finish tournament
  // =========================================================================
  'POST /admin/api/tournaments/:id/finish': async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2];
    
    const success = tournamentManager.finishTournament(id);
    if (!success) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }

    broadcastToTournament(id);
    return Response.json({ success: true });
  },

  // =========================================================================
  // Export tournament
  // =========================================================================
  'POST /admin/api/tournaments/:id/export': async (req: Request) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const id = pathParts[pathParts.length - 2];
    
    const json = tournamentManager.exportTournament(id);
    if (!json) {
      return Response.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="tournament-${id}.json"`,
      },
    });
  },

  // =========================================================================
  // Import tournament
  // =========================================================================
  'POST /admin/api/tournaments/import': async (req: Request) => {
    try {
      const json = await req.text();
      const tournament = tournamentManager.importTournament(json);
      if (!tournament) {
        return Response.json({ error: 'Failed to import tournament' }, { status: 400 });
      }
      return Response.json({
        id: tournament.id,
        gameId: tournament.gameId,
        label: tournament.label,
        phase: tournament.phase,
      });
    } catch (error) {
      return Response.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  },
};

// ============================================================================
// Route Matcher
// ============================================================================

export function matchAdminRoute(method: string, pathname: string): ((req: Request) => Promise<Response>) | null {
  // Exact matches first
  const exactKey = `${method} ${pathname}`;
  if (exactKey in adminApiRoutes) {
    return adminApiRoutes[exactKey as keyof typeof adminApiRoutes];
  }

  // Pattern matches for :id routes
  const patterns = [
    { pattern: /^\/admin\/api\/tournaments\/([^/]+)$/, route: `${method} /admin/api/tournaments/:id` },
    { pattern: /^\/admin\/api\/tournaments\/([^/]+)\/start$/, route: `${method} /admin/api/tournaments/:id/start` },
    { pattern: /^\/admin\/api\/tournaments\/([^/]+)\/finish$/, route: `${method} /admin/api/tournaments/:id/finish` },
    { pattern: /^\/admin\/api\/tournaments\/([^/]+)\/export$/, route: `${method} /admin/api/tournaments/:id/export` },
    { pattern: /^\/admin\/api\/tournaments\/([^/]+)\/bots$/, route: `${method} /admin/api/tournaments/:id/bots` },
  ];

  for (const { pattern, route } of patterns) {
    if (pattern.test(pathname) && route in adminApiRoutes) {
      return adminApiRoutes[route as keyof typeof adminApiRoutes];
    }
  }

  return null;
}

