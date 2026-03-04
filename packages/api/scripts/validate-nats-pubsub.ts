/**
 * Minimal integration check: publish a fake DomainEvent to NATS JetStream,
 * assert the subscribe handler is invoked (no errors). Run with:
 *   NATS_URL=nats://localhost:4222 pnpm exec tsx scripts/validate-nats-pubsub.ts
 */
import { createNatsEventBus } from '../src/nats-event-bus.js';
import type { DomainEvent } from '@v3grand/core';

const NATS_URL = process.env.NATS_URL;
if (!NATS_URL) {
  console.error('NATS_URL is required');
  process.exit(1);
}

const receivedEvents: DomainEvent[] = [];
const bus = await createNatsEventBus({ natsUrl: NATS_URL });

bus.subscribe(async (event) => {
  receivedEvents.push(event);
});

// Give the consume loop a moment to start
await new Promise((r) => setTimeout(r, 500));

const fakeEvent: DomainEvent = {
  type: 'assumption.updated',
  dealId: 'test-deal-validate',
  userId: 'script',
  field: 'test',
  oldValue: null,
  newValue: {},
};
await bus.publish(fakeEvent);

await new Promise((r) => setTimeout(r, 2000));

await bus.close();

if (receivedEvents.length === 0) {
  console.error('FAIL: handler was not called (no events received)');
  process.exit(1);
}
console.log('OK: handler was called, dealId=%s type=%s', receivedEvents[0].dealId, receivedEvents[0].type);
process.exit(0);
