// ─── Local Dev Server Entry Point ──────────────────────────────────
import { buildApp } from './app.js';
import { config } from './config.js';

async function start() {
  const app = await buildApp();
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`V3 Grand API running on http://localhost:${config.port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
