import { Server } from '@modelcontextprotocol/sdk/server/index.js';

interface PolicyClientConfig {
    /** Sly API base, e.g. https://api.getsly.ai or http://localhost:4000 */
    apiUrl: string;
    /** Tenant API key (pk_*) or agent token (agent_* or sess_* form). */
    apiKey: string;
}

/**
 * MCP Server Factory — Compass governance wrapper.
 *
 * Read-only tools (compass_*) shell straight to the Compass CLI. Governed
 * tools (governed_*) route through Sly's policy gate first; earn actions
 * (plain EVM txns) then execute via Sly's server-side CDP signing, while
 * credit / tokenized / perps return the signable payload (Permit2/EIP-712
 * or Hyperliquid signing — out of the CDP eth-tx path).
 *
 * Either way, EVERY governed movement is evaluated by Sly before anything
 * is signed: KYA tier, venue allowlist, spending caps, kill-switch.
 */

interface CompassMcpContext extends PolicyClientConfig {
    defaultChain: 'base' | 'ethereum' | 'arbitrum';
}
declare function createCompassMcpServer(ctx: CompassMcpContext): Server;

export { type CompassMcpContext, createCompassMcpServer };
