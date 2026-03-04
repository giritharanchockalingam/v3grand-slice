// ─── Vercel Build Script ───────────────────────────────────────────
// Bundles the serverless entry point with ALL dependencies inlined.
// This resolves pnpm workspace symlinks at build time, so the
// deployed function has zero external module resolution to do.
import { build } from 'esbuild';
import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
console.log(`[build-vercel] Bundling ${pkg.name} for Vercel serverless...`);

// Remove the old TypeScript entry point if it exists, so Vercel only
// detects the bundled .mjs output as a serverless function.
if (existsSync('api/index.ts')) {
  unlinkSync('api/index.ts');
  console.log('[build-vercel] Removed api/index.ts (replaced by bundled api/index.mjs)');
}

// ─── Workspace Deep-Import Resolve Plugin ──────────────────────────
// The workspace packages only export "." in their package.json exports
// field, but the API code uses deep subpath imports like:
//   @v3grand/engines/stress/stress-test.js
//   @v3grand/engines/integrity/hash-chain.js
//   @v3grand/engines/validation/model-inventory.js
//   @v3grand/mcp/data-quality.js
// This plugin resolves those to the actual .ts source files.
const WORKSPACE_PACKAGES = ['core', 'db', 'engines', 'mcp'];
const monorepoRoot = resolve(__dirname, '../../..');

const workspaceResolvePlugin = {
  name: 'workspace-deep-imports',
  setup(build) {
    // Match @v3grand/<pkg>/<anything> (deep subpath imports)
    const filter = new RegExp(`^@v3grand/(${WORKSPACE_PACKAGES.join('|')})/(.+)$`);

    build.onResolve({ filter }, (args) => {
      const match = args.path.match(filter);
      if (!match) return null;

      const [, pkg, subpath] = match;
      // Convert .js extension to .ts (TypeScript source)
      const tsSubpath = subpath.replace(/\.js$/, '.ts');
      const resolved = resolve(monorepoRoot, 'packages', pkg, 'src', tsSubpath);

      console.log(`[workspace-resolve] ${args.path} → ${resolved}`);
      return { path: resolved };
    });

    // Also handle bare @v3grand/<pkg> imports to ensure they resolve
    // to the actual source even if node_modules symlinks are broken
    const bareFilter = new RegExp(`^@v3grand/(${WORKSPACE_PACKAGES.join('|')})$`);
    build.onResolve({ filter: bareFilter }, (args) => {
      const match = args.path.match(bareFilter);
      if (!match) return null;

      const [, pkg] = match;
      const resolved = resolve(monorepoRoot, 'packages', pkg, 'src', 'index.ts');

      console.log(`[workspace-resolve] ${args.path} → ${resolved}`);
      return { path: resolved };
    });
  },
};

await build({
  entryPoints: ['src/vercel-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/index.mjs',
  sourcemap: false,
  minify: false,
  metafile: true,
  plugins: [workspaceResolvePlugin],
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
  external: [
    'node:*', 'crypto', 'fs', 'path', 'os', 'stream', 'events', 'util',
    'http', 'https', 'net', 'tls', 'dns', 'url', 'querystring', 'buffer',
    'string_decoder', 'assert', 'zlib', 'child_process', 'worker_threads',
    'perf_hooks', 'async_hooks', 'diagnostics_channel', 'tty', 'v8', 'vm',
    'module', 'constants',
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
