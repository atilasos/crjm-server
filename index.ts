// ============================================================================
// Tournament Server - Main Entry Point
// ============================================================================

import { handleOpen, handleClose, handleMessage } from './src/server/websocket-handler';
import { matchAdminRoute } from './src/server/admin-api';
import type { ConnectionState } from './src/core/types';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

// ============================================================================
// Static File Paths
// ============================================================================

const STATIC_FILES: Record<string, { path: string; contentType: string }> = {
  '/admin': { path: './public/admin/index.html', contentType: 'text/html' },
  '/admin/': { path: './public/admin/index.html', contentType: 'text/html' },
  '/admin/index.html': { path: './public/admin/index.html', contentType: 'text/html' },
  '/admin/styles.css': { path: './public/admin/styles.css', contentType: 'text/css' },
  '/admin/app.js': { path: './public/admin/app.js', contentType: 'application/javascript' },
};

// ============================================================================
// Server Configuration
// ============================================================================

const server = Bun.serve<ConnectionState>({
  port: PORT,

  // ===========================================================================
  // HTTP Request Handler
  // ===========================================================================
  async fetch(req, server) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:34',message:'Request received',data:{pathname,fullUrl:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // WebSocket upgrade
    if (pathname === '/ws') {
      const upgraded = server.upgrade(req, {
        data: { connectionId: '' },
      });
      if (upgraded) return undefined;
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    // Admin API routes
    if (pathname.startsWith('/admin/api')) {
      const handler = matchAdminRoute(req.method, pathname);
      if (handler) {
        return handler(req);
      }
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Static files for admin UI
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:56',message:'Checking static file route',data:{pathname,hasRoute:!!STATIC_FILES[pathname],availableRoutes:Object.keys(STATIC_FILES)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    const staticFile = STATIC_FILES[pathname];
    if (staticFile) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:58',message:'Static file route matched',data:{pathname,filePath:staticFile.path,contentType:staticFile.contentType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const file = Bun.file(staticFile.path);
      const exists = await file.exists();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:60',message:'File existence check',data:{pathname,filePath:staticFile.path,exists},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (exists) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:62',message:'Serving static file',data:{pathname,filePath:staticFile.path,contentType:staticFile.contentType},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        return new Response(file, {
          headers: { 'Content-Type': staticFile.contentType },
        });
      }
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:68',message:'No static file route matched',data:{pathname,availableRoutes:Object.keys(STATIC_FILES)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    }

    // Health check
    if (pathname === '/health') {
      return Response.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        games: ['gatos-caes', 'dominorio', 'quelhas', 'produto', 'atari-go', 'nex']
      });
    }

    // Root - redirect to admin
    if (pathname === '/') {
      return new Response(null, {
        status: 302,
        headers: { Location: '/admin' },
      });
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/dbd6c223-8278-4a79-a099-16b06b058728',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'index.ts:83',message:'Returning 404',data:{pathname},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return new Response('Not Found', { status: 404 });
  },

  // ===========================================================================
  // WebSocket Handlers
  // ===========================================================================
  websocket: {
    open(ws) {
      handleOpen(ws);
    },

    message(ws, message) {
      handleMessage(ws, message);
    },

    close(ws) {
      handleClose(ws);
    },
  },

  // ===========================================================================
  // Development Options
  // ===========================================================================
  development: process.env.NODE_ENV !== 'production',
});

// ============================================================================
// Startup Message
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🏆 Servidor de Campeonatos de Jogos                         ║
║                                                               ║
║   HTTP:      http://localhost:${PORT}                            ║
║   WebSocket: ws://localhost:${PORT}/ws                           ║
║   Admin:     http://localhost:${PORT}/admin                      ║
║                                                               ║
║   Jogos suportados:                                           ║
║   • Gatos & Cães     • Quelhas                                ║
║   • Dominório        • Produto                                ║
║   • Atari Go         • Nex                                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
