// ─── SSE Hub: In-Process Event Emitter for Real-Time Dashboard ──────
// Lightweight pub/sub for Server-Sent Events. No external dependencies.
// The recompute service emits events here; SSE route streams them to clients.

import { EventEmitter } from 'node:events';

export interface SSEEvent {
  type: string;
  dealId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

class SSEHub extends EventEmitter {
  emit(event: 'sse', payload: SSEEvent): boolean;
  emit(event: string | symbol, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  on(event: 'sse', listener: (payload: SSEEvent) => void): this;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }

  off(event: 'sse', listener: (payload: SSEEvent) => void): this;
  off(event: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }
}

// Singleton hub instance
export const sseHub = new SSEHub();
sseHub.setMaxListeners(200); // support many concurrent dashboard connections

/** Convenience: emit a deal-scoped SSE event */
export function emitDealEvent(dealId: string, type: string, data: Record<string, unknown> = {}): void {
  sseHub.emit('sse', {
    type,
    dealId,
    data,
    timestamp: new Date().toISOString(),
  });
}
