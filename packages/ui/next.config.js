/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@v3grand/core'],
  typescript: {
    // Allow production builds to complete even with type errors
    // (we validate types separately in CI)
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ];
  },
};
module.exports = nextConfig;
