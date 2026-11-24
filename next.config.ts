import type { NextConfig } from 'next';
import { readFileSync } from 'node:fs';

// App version shown in Settings and on tutorial videos: package.json is the single source.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Next 16 builds with Turbopack by default.
  turbopack: {},
  // Do not auto-generate AGENTS.md when `next dev` detects a coding agent.
  agentRules: false,
  // Let phones on the same Wi-Fi load the dev server (Next blocks non-localhost dev requests by default).
  allowedDevOrigins: ['192.168.1.4', '192.168.1.*'],
  typescript: {
    ignoreBuildErrors: false,
  },
  output: 'standalone',
  transpilePackages: ['motion'],
};

export default nextConfig;
