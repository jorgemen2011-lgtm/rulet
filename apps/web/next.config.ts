import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Los packages del monorepo se publican como TS fuente: Next debe transpilarlos.
  transpilePackages: ['@rulet/shared', '@rulet/api-client'],
};

export default nextConfig;
