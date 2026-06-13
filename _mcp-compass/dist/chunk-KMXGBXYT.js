import {
  tools
} from "./chunk-KNKSW23Y.js";

// src/server-factory.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// src/compass-cli.ts
import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
function compassBin() {
  return process.env.COMPASS_BIN || join(homedir(), ".local/bin/compass");
}
async function runCompass(args) {
  const fullArgs = [...args, "-o", "json", "--no-interactive"];
  try {
    const { stdout } = await execFileAsync(compassBin(), fullArgs, {
      env: process.env,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 6e4
    });
    return { ok: true, data: JSON.parse(stdout) };
  } catch (e) {
    const err = e;
    const raw = (err.stdout || err.stderr || err.message || "").trim();
    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
    }
    return { ok: false, error: raw.slice(0, 500), errorEnvelope: envelope };
  }
}

// src/policy-client.ts
async function evaluateIntent(config, intent) {
  const res = await fetch(`${config.apiUrl}/v1/policy/evaluate-intent`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(intent)
  });
  const raw = await res.json().catch(() => ({}));
  const body = raw && typeof raw === "object" && "data" in raw && raw.data ? raw.data : raw;
  return {
    decision: body.decision ?? "deny",
    evaluation_id: body.evaluation_id ?? null,
    reasons: Array.isArray(body.reasons) ? body.reasons : [],
    checks: Array.isArray(body.checks) ? body.checks : void 0,
    action_type: body.action_type,
    httpStatus: res.status
  };
}

// src/execute-client.ts
async function executeIntent(config, opts) {
  const res = await fetch(`${config.apiUrl}/v1/policy/execute-intent`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(opts)
  });
  const raw = await res.json().catch(() => ({}));
  const body = raw && typeof raw === "object" && "data" in raw && raw.data ? raw.data : raw;
  if (!res.ok) {
    return { executed: false, error: body.error || `execute-intent HTTP ${res.status}` };
  }
  return body;
}

// src/governed-actions.ts
var v = (type, vault_address) => JSON.stringify({ type, vault_address });
var GOVERNED_ACTIONS = {
  governed_earn_deposit: {
    subcommand: "earn:deposit",
    executable: true,
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: a.venue_type, venue_address: a.vault_address }),
    toCliArgs: (a) => ["earn", "manage", "--action", "DEPOSIT", "--venue", v("VAULT", a.vault_address), "--amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_earn_withdraw: {
    subcommand: "earn:withdraw",
    executable: true,
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: a.venue_type, venue_address: a.vault_address }),
    toCliArgs: (a) => ["earn", "manage", "--action", "WITHDRAW", "--venue", v("VAULT", a.vault_address), "--amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_earn_swap: {
    subcommand: "earn:swap",
    executable: true,
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: a.venue_type ?? `swap:${a.from_token}->${a.to_token}` }),
    toCliArgs: (a) => ["earn", "swap", "--from-token", a.from_token, "--to-token", a.to_token, "--amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_credit_borrow: {
    subcommand: "credit:borrow",
    executable: false,
    // Permit2/EIP-712 flow — returns signable payload
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: a.venue_type ?? `aave-credit:${a.borrow_token}` }),
    toCliArgs: (a) => ["credit", "borrow", "--borrow-token", a.borrow_token, "--borrow-amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_credit_repay: {
    subcommand: "credit:repay",
    executable: false,
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: a.venue_type ?? `aave-credit:${a.repay_token}` }),
    toCliArgs: (a) => ["credit", "repay", "--repay-token", a.repay_token, "--repay-amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_perps_order: {
    subcommand: "perps:order",
    executable: false,
    // Hyperliquid signature scheme — not CDP-broadcastable
    toIntentParams: (a) => ({ chain: "hyperevm", amount: String(a.size), venue_type: `perp:${a.asset}` }),
    toCliArgs: (a) => ["global-markets-perps", "market-order", "--asset", a.asset, "--side", a.side, "--size", String(a.size), "--owner", a.owner]
  },
  governed_perps_deposit: {
    subcommand: "perps:deposit",
    // Compass returns an Arbitrum USDC-permit tx (per the perps-execution
    // scoping doc). The wrapper's payload branch returns it; downstream CDP
    // broadcast on arbitrum is unlocked by the auto-detect routing fix.
    executable: false,
    toIntentParams: (a) => ({ chain: "arbitrum", amount: String(a.amount), venue_type: "perp:margin" }),
    toCliArgs: (a) => ["global-markets-perps", "deposit", "--amount", String(a.amount), "--owner", a.owner]
  },
  governed_perps_withdraw: {
    subcommand: "perps:withdraw",
    executable: false,
    toIntentParams: (a) => ({ chain: "arbitrum", amount: String(a.amount), venue_type: "perp:margin" }),
    toCliArgs: (a) => ["global-markets-perps", "withdraw", "--amount", String(a.amount), "--owner", a.owner]
  },
  governed_tokenized_buy: {
    subcommand: "tokenized:buy",
    executable: false,
    // EIP-712 order payload
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: `equity:${a.symbol}` }),
    toCliArgs: (a) => ["tokenized-equities", "order", "--from-token", "USDC", "--to-token", a.symbol, "--amount", String(a.amount), "--owner", a.owner]
  },
  governed_tokenized_sell: {
    subcommand: "tokenized:sell",
    executable: false,
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: `equity:${a.symbol}` }),
    toCliArgs: (a) => ["tokenized-equities", "order", "--from-token", a.symbol, "--to-token", "USDC", "--amount", String(a.amount), "--owner", a.owner]
  }
};

// src/server-factory.ts
function textResult(obj) {
  return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
}
var READONLY = {
  compass_earn_vaults: (a, def) => {
    const args = ["earn", "vaults", "--chain", a.chain ?? def, "--order-by", a.order_by ?? "tvl_usd", "--direction", "desc"];
    if (a.limit) args.push("--limit", String(a.limit));
    if (a.asset_symbol) args.push("--asset-symbol", String(a.asset_symbol));
    return args;
  },
  compass_earn_positions: (a, def) => ["earn", "positions", "--owner", a.owner, "--chain", a.chain ?? def],
  compass_credit_positions: (a, def) => ["credit", "positions", "--owner", a.owner, "--chain", a.chain ?? def],
  compass_perps_markets: () => ["global-markets-perps", "markets"],
  compass_perps_positions: (a) => ["global-markets-perps", "positions", "--owner", a.owner],
  compass_tokenized_markets: () => ["tokenized-equities", "markets"],
  compass_tokenized_positions: (a, def) => ["tokenized-equities", "positions", "--owner", a.owner, "--chain", a.chain ?? def]
};
function createCompassMcpServer(ctx) {
  const server = new Server(
    { name: "@sly_ai/mcp-compass", version: "0.2.0" },
    {
      capabilities: { tools: {} },
      instructions: [
        "This MCP server lets an agent transact on DeFi via Compass Labs across all of Compass's surfaces \u2014 yield (earn), credit, perpetuals, and tokenized equities \u2014 governed by Sly.",
        "Tools prefixed `compass_` are read-only (discovery: vaults, markets, positions).",
        "Tools prefixed `governed_` are state-changing and ALWAYS pass through Sly's policy gate first: KYA tier, venue allowlist, spending caps and the operator kill-switch are evaluated before anything is signed.",
        "Earn actions execute end-to-end (Sly signs via the agent's CDP wallet and broadcasts). Credit, tokenized-equity and perps actions return the signable payload after approval, because they use Permit2/EIP-712 or Hyperliquid signing.",
        "When a governed action is denied, the response carries machine-readable reasons \u2014 read them and self-correct (smaller amount, allowlisted venue) rather than retrying the same intent."
      ].join(" ")
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = rawArgs ?? {};
    try {
      const ro = READONLY[name];
      if (ro) {
        const r = await runCompass(ro(args, ctx.defaultChain));
        return textResult(r.ok ? r.data : { error: `${name} failed`, detail: r.errorEnvelope ?? r.error });
      }
      const spec = GOVERNED_ACTIONS[name];
      if (spec) {
        const p = spec.toIntentParams(args);
        const intent = {
          version: "1",
          subcommand: spec.subcommand,
          agent_id: args.agent_id,
          requested_at: (/* @__PURE__ */ new Date()).toISOString(),
          params: { chain: p.chain, amount: p.amount, currency: "USDC", venue_type: p.venue_type, venue_address: p.venue_address }
        };
        const decision = await evaluateIntent(ctx, intent);
        if (decision.decision !== "approve") {
          return textResult({
            governed: true,
            executed: false,
            decision: decision.decision,
            evaluation_id: decision.evaluation_id,
            reasons: decision.reasons,
            checks: decision.checks,
            hint: decision.decision === "deny" ? "Sly denied this intent. Read `reasons` and adjust (smaller amount / allowlisted venue) before retrying." : "Sly escalated this intent \u2014 it needs human approval before it can execute."
          });
        }
        const compass = await runCompass(spec.toCliArgs(args));
        if (!compass.ok) {
          return textResult({ governed: true, executed: false, decision: "approve", evaluation_id: decision.evaluation_id, compass: { error: `${name} compass call failed`, detail: compass.errorEnvelope ?? compass.error } });
        }
        if (spec.executable && decision.evaluation_id && compass.data?.transaction) {
          const exec = await executeIntent(ctx, {
            agent_id: args.agent_id,
            evaluation_id: decision.evaluation_id,
            chain: p.chain,
            unsigned_transaction: compass.data.transaction
          });
          return textResult({ governed: true, decision: "approve", evaluation_id: decision.evaluation_id, ...exec });
        }
        return textResult({
          governed: true,
          executed: false,
          decision: "approve",
          evaluation_id: decision.evaluation_id,
          compass_payload: compass.data,
          note: spec.subcommand.startsWith("perps") ? "Approved by Sly. Perps use Hyperliquid signing \u2014 sign the returned payload with the owner key and submit via the Compass CLI." : "Approved by Sly. This action uses Permit2/EIP-712 \u2014 sign the returned payload with the owner key and submit via the Compass CLI. Bilateral receipt = evaluation_id + (post-submit) tx hash."
        });
      }
      return { ...textResult({ error: `Unknown tool: ${name}` }), isError: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ...textResult({ error: `Tool ${name} failed`, detail: msg }), isError: true };
    }
  });
  return server;
}

export {
  createCompassMcpServer
};
