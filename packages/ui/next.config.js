/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@v3grand/core'],
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/icon.svg', permanent: false },
    ];
  },
};
module.exports = nextConfig;
