import type { FastifyInstance } from 'fastify';

interface WSClient {
  socket: any;
  dealId: string;
  userId: string;
}

const clients: Map<string, WSClient[]> = new Map();

export async function websocketRoutes(app: FastifyInstance) {
  // Register websocket plugin
  await app.register(import('@fastify/websocket'));

  app.get('/ws/deals/:dealId', { websocket: true }, (socket, req) => {
    const { dealId } = req.params as { dealId: string };
    const userId = (req as any).user?.id || 'anonymous';

    // Register client
    if (!clients.has(dealId)) {
      clients.set(dealId, []);
    }
    clients.get(dealId)!.push({ socket, dealId, userId });

    app.log.info({ dealId, userId }, 'WebSocket client connected');

    // Send initial connection ack
    socket.send(JSON.stringify({
      type: 'connected',
      dealId,
      timestamp: new Date().toISOString(),
    }));

    // Handle incoming messages
    socket.on('message', (rawMsg: Buffer) => {
      try {
        const msg = JSON.parse(rawMsg.toString());
        app.log.info({ dealId, type: msg.type }, 'WS message received');

        // Echo back with server timestamp
        socket.send(JSON.stringify({
          type: 'ack',
          originalType: msg.type,
          timestamp: new Date().toISOString(),
        }));
      } catch (err) {
        socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      }
    });

    // Handle disconnect
    socket.on('close', () => {
      const dealClients = clients.get(dealId) || [];
      clients.set(
        dealId,
        dealClients.filter(c => c.socket !== socket)
      );
      app.log.info({ dealId, userId }, 'WebSocket client disconnected');
    });
  });
}

/**
 * Broadcast an event to all clients watching a specific deal
 */
export function broadcastToDeal(dealId: string, event: { type: string; payload: unknown }) {
  const dealClients = clients.get(dealId) || [];
  const message = JSON.stringify({
    ...event,
    dealId,
    timestamp: new Date().toISOString(),
  });

  for (const client of dealClients) {
    try {
      client.socket.send(message);
    } catch (err) {
      // Client may have disconnected
    }
  }
}

/**
 * Get count of connected clients per deal
 */
export function getClientCount(dealId?: string): Record<string, number> {
  if (dealId) {
    return { [dealId]: (clients.get(dealId) || []).length };
  }
  const counts: Record<string, number> = {};
  for (const [id, clientList] of clients.entries()) {
    counts[id] = clientList.length;
  }
  return counts;
}
