// ─── Vercel Serverless Entry Point ─────────────────────────────────
// This file is the source for the bundled serverless function.
// esbuild compiles this → api/index.mjs (with all deps inlined).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildApp } from './app.js';

// Vercel function configuration (applied to the deployed function)
export const config = {
    maxDuration: 30,
};

export default async function handler(req: IncomingMessage, res: ServerResponse) {
    const app = await buildApp();
    await app.ready();
    app.server.emit('request', req, res);
}
