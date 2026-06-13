import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.trycloudflare.com'],
  // The /api/run handler spawns the vendored MCP client as a child process
  // (`node demo-agent-client.mjs`). It is invoked via spawn(), not imported,
  // so Next must NOT try to bundle it — leave the require/resolve at runtime.
  serverExternalPackages: ['@sly_ai/mcp-compass'],
};

export default nextConfig;
