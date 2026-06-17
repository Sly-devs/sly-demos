import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sly/demo-kit'],
  // Allow Next dev-mode requests from Cloudflare quick-tunnel URLs (phone demo).
  allowedDevOrigins: ['*.trycloudflare.com'],
};

export default nextConfig;
