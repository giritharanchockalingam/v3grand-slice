// ─── SSE Route: Real-Time Dashboard Events ─────────────────────────
// GET /deals/:id/events — streams Server-Sent Events for a specific deal.
// Clients receive events when recompute completes, recommendations change, etc.
// Supports token via query param (EventSource can't send Authorization headers).

import type { FastifyInstance } from 'fastify';
import { sseHub, type SSEEvent } from '../sse-hub.js';
import { verifyToken, extractTokenFromHeader } from '../middleware/auth.js';

export async function sseRoutes(app: FastifyInstance) {

  // GET /deals/:id/events — SSE stream for a deal
  app.get<{ Params: { id: string }; Querystring: { token?: string } }>('/deals/:id/events', async (req, reply) => {
    const { id: dealId } = req.params;

    // Auth: check header first, then query param (for EventSource clients)
    const headerToken = extractTokenFromHeader(req.headers.authorization);
    const queryToken = req.query.token;
    const token = headerToken ?? queryToken ?? null;

    if (!token) {
      return reply.code(401).send({ error: 'Missing authentication token' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });

    // Send initial connection event
    reply.raw.write(`event: connected\ndata: ${JSON.stringify({ dealId, userId: decoded.userId, timestamp: new Date().toISOString() })}\n\n`);

    // Heartbeat to keep connection alive (every 30s)
    const heartbeat = setInterval(() => {
      reply.raw.write(`:heartbeat ${new Date().toISOString()}\n\n`);
    }, 30_000);

    // Listen for SSE events scoped to this deal
    const listener = (event: SSEEvent) => {
      if (event.dealId === dealId) {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }
    };

    sseHub.on('sse', listener);

    // Clean up on disconnect
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      sseHub.off('sse', listener);
    });

    // Don't let Fastify auto-close the response
    await reply.hijack();
  });
}
