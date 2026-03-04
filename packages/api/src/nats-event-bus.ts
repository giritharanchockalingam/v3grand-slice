// ─── NATS JetStream Event Bus ────────────────────────────────────────
// Connects to NATS, publishes DomainEvent envelopes to JetStream, subscribes with handler.
// When NATS_URL is not set, use in-process fallback (event-bus.ts).

import { connect, AckPolicy, DeliverPolicy, ReplayPolicy, type NatsConnection, type JetStreamClient } from 'nats';
import type { DomainEvent, EventEnvelope } from '@v3grand/core';
import { randomUUID } from 'node:crypto';

const STREAM_NAME = 'V3GRAND';
const CONSUMER_NAME = 'recompute';
const SUBJECT = 'v3grand.domain.events';

export interface NatsEventBusConfig {
  natsUrl: string;
}

export interface NatsEventBus {
  publish(event: DomainEvent, idempotencyKey?: string): Promise<void>;
  subscribe(handler: (event: DomainEvent, envelope: EventEnvelope<DomainEvent>) => Promise<void>): Promise<void>;
  close(): Promise<void>;
  isReady(): boolean;
}

let nc: NatsConnection | null = null;
let js: JetStreamClient | null = null;

async function ensureStream(connection: NatsConnection): Promise<void> {
  const jsm = await connection.jetstreamManager();
  try {
    await jsm.streams.info(STREAM_NAME);
    return;
  } catch {
    // stream does not exist
  }
  await jsm.streams.add({ name: STREAM_NAME, subjects: [`${SUBJECT}.>`] });
}

async function ensureConsumer(connection: NatsConnection, jsClient: JetStreamClient): Promise<void> {
  const jsm = await connection.jetstreamManager();
  try {
    await jsm.consumers.info(STREAM_NAME, CONSUMER_NAME);
    return;
  } catch {
    // consumer does not exist
  }
  await jsm.consumers.add(STREAM_NAME, {
    durable_name: CONSUMER_NAME,
    ack_policy: AckPolicy.Explicit,
    deliver_policy: DeliverPolicy.All,
    replay_policy: ReplayPolicy.Instant,
  });
}

export async function createNatsEventBus(config: NatsEventBusConfig): Promise<NatsEventBus> {
  if (!config.natsUrl) throw new Error('NATS_URL is required to create NATS event bus');

  nc = await connect({ servers: config.natsUrl });
  js = nc.jetstream();
  await ensureStream(nc);
  await ensureConsumer(nc, js);

  async function publish(event: DomainEvent, idempotencyKey?: string): Promise<void> {
    if (!js) throw new Error('NATS JetStream not connected');
    const envelope: EventEnvelope<DomainEvent> = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      source: 'api',
      payload: event,
    };
    const data = Buffer.from(JSON.stringify(envelope), 'utf-8');
    const opts = idempotencyKey ? { msgID: idempotencyKey } : {};
    await js.publish(`${SUBJECT}.${event.type}`, data, opts);
  }

  async function subscribe(
    handler: (event: DomainEvent, envelope: EventEnvelope<DomainEvent>) => Promise<void>
  ): Promise<void> {
    if (!js) throw new Error('NATS JetStream not connected');
    const consumer = await js.consumers.get(STREAM_NAME, CONSUMER_NAME);
    const messages = await consumer.consume();
    (async () => {
      for await (const msg of messages) {
        try {
          const envelope = JSON.parse(msg.string()) as EventEnvelope<DomainEvent>;
          const event = envelope.payload;
          await handler(event, envelope);
          msg.ack();
          const dealId = 'dealId' in event ? event.dealId : 'SYSTEM';
          console.log('[NATS] processed', dealId, event.type);
        } catch {
          msg.nak();
        }
      }
    })().catch(() => {});
  }

  return {
    publish,
    subscribe,
    async close(): Promise<void> {
      if (nc) {
        await nc.close();
        nc = null;
        js = null;
      }
    },
    isReady(): boolean {
      return nc !== null && !nc.isClosed();
    },
  };
}

export function getNatsConnection(): NatsConnection | null {
  return nc;
}
