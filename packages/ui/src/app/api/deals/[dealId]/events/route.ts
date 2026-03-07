/**
 * SSE (Server-Sent Events) endpoint for real-time deal updates.
 *
 * The browser connects via EventSource with a JWT token in the query string
 * (EventSource doesn't support custom headers). The server polls the
 * domain_events table for new events and streams them to the client.
 *
 * Events the client listens for:
 *   - recompute.complete  → invalidates dashboard + scenarios queries
 *   - recommendation.flipped → invalidates dashboard query
 *
 * Also streams: assumption.updated, phase.advanced, milestone.completed,
 *   budget.actual.updated, rfi.created, rfi.resolved, change-order.*,
 *   risk.escalated, covenant.breached
 */

import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Map of event types from the domain_events table to SSE event names
// that the client hook (use-dashboard.ts) listens for
const SSE_EVENT_MAP: Record<string, string> = {
  'recompute.complete': 'recompute.complete',
  'engine.completed': 'recompute.complete',          // alias
  'recommendation.changed': 'recommendation.flipped',
  'recommendation.flipped': 'recommendation.flipped',
  'assumption.updated': 'assumption.updated',
  'phase.advanced': 'phase.advanced',
  'milestone.completed': 'milestone.completed',
  'milestone.delayed': 'milestone.delayed',
  'budget.actual.updated': 'budget.actual.updated',
  'rfi.created': 'rfi.created',
  'rfi.resolved': 'rfi.resolved',
  'change-order.submitted': 'change-order.submitted',
  'change-order.approved': 'change-order.approved',
  'change-order.rejected': 'change-order.rejected',
  'risk.escalated': 'risk.escalated',
  'covenant.breached': 'covenant.breached',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dealId: string }> }
) {
  const { dealId } = await params;

  // Auth via query param (EventSource can't send Authorization header)
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await verifyToken(token);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set up SSE stream
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to send an SSE message
      const send = (event: string, data: Record<string, unknown>) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      const sendComment = (comment: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: ${comment}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Send initial connection message
      sendComment('connected');

      // Track the last sequence number we've seen
      let lastSeqNo = 0;

      // Get initial max seqNo so we don't replay old events
      try {
        const db = getDb();

        const [row] = await db.execute(
          sql`SELECT COALESCE(MAX(seq_no), 0) as max_seq FROM v3grand.domain_events WHERE deal_id = ${dealId}`
        );
        lastSeqNo = Number((row as Record<string, unknown>)?.max_seq ?? 0);
      } catch {
        // If DB query fails, start from 0 — we'll just see all events
      }

      // Poll for new events every 3 seconds
      const pollInterval = setInterval(async () => {
        if (closed) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const db = getDb();

          const rows = await db.execute(
            sql`SELECT id, type, payload, seq_no, created_at
                FROM v3grand.domain_events
                WHERE deal_id = ${dealId}
                  AND seq_no > ${lastSeqNo}
                ORDER BY seq_no ASC
                LIMIT 20`
          );

          for (const row of rows as Array<Record<string, unknown>>) {
            const eventType = row.type as string;
            const sseEvent = SSE_EVENT_MAP[eventType] ?? eventType;
            const seqNo = Number(row.seq_no);

            send(sseEvent, {
              id: row.id,
              type: eventType,
              seqNo,
              payload: row.payload,
              timestamp: row.created_at,
            });

            if (seqNo > lastSeqNo) {
              lastSeqNo = seqNo;
            }
          }
        } catch {
          // DB poll failed — skip this cycle, will retry next interval
        }
      }, 3000);

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (closed) {
          clearInterval(heartbeatInterval);
          return;
        }
        sendComment(`heartbeat ${Date.now()}`);
      }, 30_000);

      // Clean up when the client disconnects
      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
