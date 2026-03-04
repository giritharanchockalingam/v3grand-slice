// ─── In-Process Event Bus ────────────────────────────────────────────
// Write-ahead pattern: persist → emit → process → mark.
// Per-deal serialization mutex prevents concurrent cascades.
// Dead-letter retry for failed handlers (max 3 attempts).

import { EventEmitter } from 'node:events';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type { DomainEvent } from '@v3grand/core';
import {
  insertDomainEvent, markEventProcessed, markEventFailed,
  getPendingEvents,
} from '@v3grand/db';

// ─── Types ──

export type EventHandler = (event: DomainEvent, db: PostgresJsDatabase) => Promise<void>;

interface BusStats {
  totalEmitted: number;
  totalProcessed: number;
  totalFailed: number;
  totalDeadLettered: number;
}

// ─── Per-deal mutex ──

const dealLocks = new Map<string, Promise<void>>();

async function withDealLock<T>(dealId: string, fn: () => Promise<T>): Promise<T> {
  // Queue behind any existing work for this deal
  const existing = dealLocks.get(dealId) ?? Promise.resolve();
  let releaseFn: () => void;
  const next = new Promise<void>((resolve) => { releaseFn = resolve; });
  dealLocks.set(dealId, next);

  await existing;
  try {
    return await fn();
  } finally {
    releaseFn!();
    // Clean up if no more work queued
    if (dealLocks.get(dealId) === next) {
      dealLocks.delete(dealId);
    }
  }
}

// ─── Event Bus class ──

export class EventBus {
  private emitter = new EventEmitter();
  private handlers = new Map<string, EventHandler[]>();
  private db: PostgresJsDatabase;
  private stats: BusStats = {
    totalEmitted: 0,
    totalProcessed: 0,
    totalFailed: 0,
    totalDeadLettered: 0,
  };

  constructor(db: PostgresJsDatabase) {
    this.db = db;
    this.emitter.setMaxListeners(50);
  }

  /**
   * Register a handler for a specific event type.
   * Handlers execute sequentially within a deal (serialized by dealLock).
   */
  on(eventType: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventType) ?? [];
    existing.push(handler);
    this.handlers.set(eventType, existing);
  }

  /**
   * Emit a domain event with write-ahead persistence.
   * 1. Write event to domain_events table (PENDING)
   * 2. Queue async processing (per-deal serialized)
   */
  async emit(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    // Write-ahead: persist before processing
    const dealId = 'dealId' in event ? event.dealId : 'SYSTEM';
    const persisted = await insertDomainEvent(this.db, {
      dealId,
      type: event.type,
      payload: event as unknown as Record<string, unknown>,
      idempotencyKey,
    });
    this.stats.totalEmitted++;

    // Async process (don't await — fire and forget with per-deal serialization)
    this.processEvent(persisted.id, event).catch((err) => {
      console.error(`[EventBus] Unhandled error processing event ${persisted.id}:`, err);
    });
  }

  /**
   * Process a single event with per-deal serialization.
   */
  private async processEvent(eventId: string, event: DomainEvent): Promise<void> {
    const dealId = 'dealId' in event ? event.dealId : 'SYSTEM';
    await withDealLock(dealId, async () => {
      const handlers = this.handlers.get(event.type) ?? [];
      if (handlers.length === 0) {
        // No handlers — mark as processed immediately
        await markEventProcessed(this.db, eventId);
        this.stats.totalProcessed++;
        return;
      }

      try {
        for (const handler of handlers) {
          await handler(event, this.db);
        }
        await markEventProcessed(this.db, eventId);
        this.stats.totalProcessed++;
      } catch (err) {
        console.error(`[EventBus] Handler failed for event ${eventId} (${event.type}):`, err);
        const result = await markEventFailed(this.db, eventId);
        if (result?.status === 'DEAD_LETTER') {
          this.stats.totalDeadLettered++;
        } else {
          this.stats.totalFailed++;
        }
      }
    });
  }

  /**
   * Retry all PENDING/FAILED events (call on startup for crash recovery).
   */
  async replayPending(): Promise<number> {
    const pending = await getPendingEvents(this.db, 100);
    let processed = 0;

    for (const row of pending) {
      const event = row.payload as unknown as DomainEvent;
      try {
        await this.processEvent(row.id, event);
        processed++;
      } catch (err) {
        console.error(`[EventBus] Replay failed for event ${row.id}:`, err);
      }
    }

    return processed;
  }

  /**
   * Health / telemetry stats.
   */
  getStats(): Readonly<BusStats> {
    return { ...this.stats };
  }
}

// ─── Singleton factory ──

let busInstance: EventBus | null = null;

export function createEventBus(db: PostgresJsDatabase): EventBus {
  if (!busInstance) {
    busInstance = new EventBus(db);
  }
  return busInstance;
}

export function getEventBus(): EventBus {
  if (!busInstance) throw new Error('EventBus not initialized — call createEventBus(db) first');
  return busInstance;
}
