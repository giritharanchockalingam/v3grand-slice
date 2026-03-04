// ─── Vercel Build Script ───────────────────────────────────────────
// Bundles the serverless entry point with ALL dependencies inlined.
// This resolves pnpm workspace symlinks at build time, so the
// deployed function has zero external module resolution to do.
import { build } from 'esbuild';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
console.log(`[build-vercel] Bundling ${pkg.name} for Vercel serverless...`);

// Remove the old TypeScript entry point if it exists, so Vercel only
// detects the bundled .mjs output as a serverless function.
if (existsSync('api/index.ts')) {
  unlinkSync('api/index.ts');
  console.log('[build-vercel] Removed api/index.ts (replaced by bundled api/index.mjs)');
}

await build({
  entryPoints: ['src/vercel-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.mjs',
  sourcemap: false,
  minify: false, // keep readable for debugging in Vercel logs
  metafile: true,

  // CJS compatibility shims for ESM output
  // Some dependencies use __dirname/require internally
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'module';",
      "import { fileURLToPath as __fileURLToPath } from 'url';",
      "import { dirname as __dirname_fn } from 'path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_fn(__filename);",
    ].join('\n'),
  },

  // Node.js built-in modules are always available in the runtime
  external: [
    'node:*',
    'crypto',
    'fs',
    'path',
    'os',
    'stream',
    'events',
    'util',
    'http',
    'https',
    'net',
    'tls',
    'dns',
    'url',
    'querystring',
    'buffer',
    'string_decoder',
    'assert',
    'zlib',
    'child_process',
    'worker_threads',
    'perf_hooks',
    'async_hooks',
    'diagnostics_channel',
    'tty',
    'v8',
    'vm',
    'module',
    'constants',
  ],
}).then((result) => {
  // Log bundle analysis
  const outputs = Object.entries(result.metafile?.outputs || {});
  for (const [file, info] of outputs) {
    const sizeKB = (info.bytes / 1024).toFixed(1);
    console.log(`[build-vercel] Output: ${file} (${sizeKB} KB)`);
  }
  console.log('[build-vercel] Bundle complete ✓');
});
