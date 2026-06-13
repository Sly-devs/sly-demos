// src/tools.ts
var CHAINS = ["base", "ethereum", "arbitrum"];
var tools = [
  // ── Read-only discovery ────────────────────────────────────────────
  {
    name: "compass_earn_vaults",
    description: "List ERC-4626 yield vaults (Aave, Morpho) with APY/TVL. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        chain: { type: "string", enum: CHAINS },
        order_by: { type: "string", default: "tvl_usd" },
        limit: { type: "number", default: 5 },
        asset_symbol: { type: "string", description: "e.g. 'USDC'" }
      },
      required: ["chain"]
    }
  },
  {
    name: "compass_earn_positions",
    description: "An owner's current Compass Earn (yield) positions. Read-only.",
    inputSchema: { type: "object", properties: { owner: { type: "string" }, chain: { type: "string", enum: CHAINS } }, required: ["owner", "chain"] }
  },
  {
    name: "compass_credit_positions",
    description: "An owner's Compass Credit positions (collateral, borrowed, health). Read-only.",
    inputSchema: { type: "object", properties: { owner: { type: "string" }, chain: { type: "string", enum: CHAINS } }, required: ["owner", "chain"] }
  },
  {
    name: "compass_perps_markets",
    description: "List available perpetuals markets (Hyperliquid global markets). Read-only.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "compass_perps_positions",
    description: "An owner's open perpetuals positions. Read-only.",
    inputSchema: { type: "object", properties: { owner: { type: "string" } }, required: ["owner"] }
  },
  {
    name: "compass_tokenized_markets",
    description: "List tokenized equity markets (Ondo ERC-20 shares: TSLAon, AAPLon, etc.). Read-only.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "compass_tokenized_positions",
    description: "An owner's tokenized-equity holdings. Read-only.",
    inputSchema: { type: "object", properties: { owner: { type: "string" }, chain: { type: "string", enum: CHAINS } }, required: ["owner", "chain"] }
  },
  // ── Governed: earn (execute end-to-end) ────────────────────────────
  {
    name: "governed_earn_deposit",
    description: "Deposit stablecoins into a Compass yield vault, GATED by Sly. Approve \u2192 Sly signs via the agent CDP wallet and broadcasts; returns the bilateral receipt (evaluation_id + tx_hash). Deny \u2192 machine-readable reasons.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        amount: { type: "string", description: 'Human-readable USDC amount, e.g. "0.5".' },
        venue_type: { type: "string", description: "Allowlist key, e.g. 'morpho-base' or 'aave-v3-base'." },
        vault_address: { type: "string", description: "ERC-4626 vault address (from compass_earn_vaults)." }
      },
      required: ["agent_id", "owner", "amount", "venue_type", "vault_address"]
    }
  },
  {
    name: "governed_earn_withdraw",
    description: "Withdraw from a Compass yield vault, GATED by Sly. Executes end-to-end via CDP signing on approve.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        amount: { type: "string" },
        venue_type: { type: "string" },
        vault_address: { type: "string" }
      },
      required: ["agent_id", "owner", "amount", "venue_type", "vault_address"]
    }
  },
  {
    name: "governed_earn_swap",
    description: "Swap tokens within the Earn Account, GATED by Sly. Executes end-to-end via CDP signing on approve.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        from_token: { type: "string" },
        to_token: { type: "string" },
        amount: { type: "string" },
        venue_type: { type: "string", description: "Optional allowlist key for the swap venue." }
      },
      required: ["agent_id", "owner", "from_token", "to_token", "amount"]
    }
  },
  // ── Governed: credit (gate + signable payload) ─────────────────────
  {
    name: "governed_credit_borrow",
    description: "Borrow USDC against on-chain collateral via Compass credit, GATED by Sly. STEP-UP: requires an active 'compass:credit' scope grant \u2014 without one the gate denies `scope_required:compass:credit` (call request_scope and have the tenant owner approve). On approve returns the Permit2/EIP-712 payload to sign (credit uses a different signing flow than earn \u2014 not auto-broadcast). Deny \u2192 reasons.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        borrow_token: { type: "string", description: "Asset to borrow, e.g. 'USDC'." },
        amount: { type: "string" },
        venue_type: { type: "string" }
      },
      required: ["agent_id", "owner", "borrow_token", "amount"]
    }
  },
  {
    name: "governed_credit_repay",
    description: "Repay a Compass credit position, GATED by Sly. Returns the signable payload on approve.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        repay_token: { type: "string" },
        amount: { type: "string" },
        venue_type: { type: "string" }
      },
      required: ["agent_id", "owner", "repay_token", "amount"]
    }
  },
  // ── Governed: perps (gate + signable payload, Hyperliquid) ─────────
  {
    name: "governed_perps_order",
    description: "Place a perpetuals market order (Hyperliquid global markets), GATED by Sly. STEP-UP: requires an active 'compass:perps' scope grant \u2014 without one the gate denies `scope_required:compass:perps`. On approve returns the Hyperliquid signable payload (perps use their own signature scheme \u2014 not CDP-broadcast). Size is gated as the at-risk amount. Deny \u2192 reasons.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        asset: { type: "string", description: "Ticker, e.g. 'BTC', 'AAPL', 'GOLD'." },
        side: { type: "string", enum: ["buy", "sell"] },
        size: { type: "string", description: "Number of contracts (human-readable)." }
      },
      required: ["agent_id", "owner", "asset", "side", "size"]
    }
  },
  // ── Governed: tokenized equities (gate + signable payload) ─────────
  {
    name: "governed_tokenized_buy",
    description: "Buy tokenized equity shares (Ondo ERC-20: TSLAon, AAPLon, \u2026) with USDC, GATED by Sly. STEP-UP: requires an active 'compass:tokenized' scope grant \u2014 without one the gate denies `scope_required:compass:tokenized`. On approve returns the EIP-712 order payload to sign. Deny \u2192 reasons.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        symbol: { type: "string", description: "On-chain equity symbol, e.g. 'TSLAon'." },
        amount: { type: "string", description: "USDC amount to spend." }
      },
      required: ["agent_id", "owner", "symbol", "amount"]
    }
  },
  {
    name: "governed_tokenized_sell",
    description: "Sell tokenized equity shares back to USDC, GATED by Sly. Returns the EIP-712 order payload on approve.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        owner: { type: "string" },
        chain: { type: "string", enum: CHAINS, default: "base" },
        symbol: { type: "string" },
        amount: { type: "string", description: "Quantity of shares to sell." }
      },
      required: ["agent_id", "owner", "symbol", "amount"]
    }
  }
];

export {
  tools
};
