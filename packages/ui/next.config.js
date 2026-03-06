/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@v3grand/core', '@v3grand/db', '@v3grand/mcp-server', '@v3grand/mcp', '@v3grand/engines'],
  typescript: {
    // Allow production builds to complete even with type errors
    // (we validate types separately in CI)
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    // The mcp-server package uses NodeNext module resolution with .js extensions
    // in its imports (e.g. './tools/market.js' → './tools/market.ts').
    // Tell webpack to try .ts/.tsx before .js when resolving.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
