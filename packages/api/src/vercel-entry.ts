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
    // Handle CORS preflight directly — Vercel may not route OPTIONS to Fastify
    const origin = req.headers.origin || '*';
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        });
        res.end();
        return;
    }

    // Set CORS headers on all responses
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    const app = await buildApp();
    await app.ready();
    app.server.emit('request', req, res);
}
