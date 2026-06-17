// src/tools.ts
var tools = [
  // ── Read-only ──────────────────────────────────────────────────────
  {
    name: "compass_earn_vaults",
    description: "List ERC-4626 yield vaults (Aave, Morpho, etc.) available via Compass. Read-only \u2014 no policy gate. Use this to discover deposit venues and their APY/TVL before forming a deposit intent.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: ["base", "ethereum", "arbitrum"], description: "Chain to query." },
        order_by: { type: "string", description: "Sort field, e.g. 'tvl_usd' or 'apy_7d'.", default: "tvl_usd" },
        limit: { type: "number", description: "Max vaults to return.", default: 5 },
        asset_symbol: { type: "string", description: "Filter by underlying asset, e.g. 'USDC'." }
      },
      required: ["chain"]
    }
  },
  {
    name: "compass_earn_positions",
    description: "List an owner's current Compass Earn positions (deposited balances, PnL, APY). Read-only \u2014 no policy gate.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string", description: "The owner EOA address whose positions to fetch." },
        chain: { type: "string", enum: ["base", "ethereum", "arbitrum"], description: "Chain to query." }
      },
      required: ["owner", "chain"]
    }
  },
  // ── Governed ───────────────────────────────────────────────────────
  {
    name: "governed_earn_deposit",
    description: "Deposit stablecoins into a Compass yield vault, GATED by Sly's policy engine. Sly evaluates the agent KYA tier, venue allowlist, spending caps and kill-switch FIRST. If approved, returns the bilateral receipt (PolicyDecision id) and the unsigned transaction Compass would execute. If denied, returns machine-readable reasons so you can self-correct (e.g. split the amount, pick an allowlisted venue). NOTE: this v1 returns the unsigned tx for signing; broadcasting via the agent CDP wallet is wired in a follow-up.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string", description: "The Sly agent UUID this deposit is on behalf of." },
        owner: { type: "string", description: "The owner EOA address (the agent CDP wallet) that owns the Earn Account." },
        chain: { type: "string", enum: ["base", "ethereum", "arbitrum"], default: "base" },
        amount: { type: "string", description: 'Human-readable USDC amount, e.g. "0.5".' },
        venue_type: { type: "string", description: "Venue identifier checked against the allowlist, e.g. 'morpho-base' or 'aave-v3-base'." },
        vault_address: { type: "string", description: "The ERC-4626 vault address to deposit into (from compass_earn_vaults)." }
      },
      required: ["agent_id", "owner", "amount", "venue_type", "vault_address"]
    }
  }
];

export {
  tools
};
