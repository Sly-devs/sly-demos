import {
  tools
} from "./chunk-CSELGNUX.js";

// src/server-factory.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// src/compass-cli.ts
import { spawn } from "child_process";
import { homedir } from "os";
import { join } from "path";
function compassBin() {
  return process.env.COMPASS_BIN || join(homedir(), ".local/bin/compass");
}
async function runCompass(args) {
  const fullArgs = [...args, "-o", "json", "--no-interactive"];
  return new Promise((resolve) => {
    const child = spawn(compassBin(), fullArgs, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    const MAX = 8 * 1024 * 1024;
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
      }
    }, 6e4);
    child.stdout?.on("data", (d) => {
      bytes += d.length;
      if (bytes <= MAX) stdout += d.toString();
    });
    child.stderr?.on("data", (d) => {
      stderr += d.toString().slice(0, 4e3);
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `compass spawn failed: ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          resolve({ ok: true, data: JSON.parse(stdout) });
          return;
        } catch {
          resolve({ ok: false, error: stdout.slice(0, 500) || "unparseable compass stdout" });
          return;
        }
      }
      const raw = (stdout || stderr || "").trim();
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch {
      }
      resolve({ ok: false, error: raw.slice(0, 500), errorEnvelope: envelope });
    });
  });
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
  // Stages USDC EOA → Earn Account (the Compass-managed Safe at, e.g.,
  // 0x126b9E… on Base). Required because `compass earn manage` only moves
  // funds BETWEEN the Earn Account and a venue — it doesn't pull from the
  // EOA. Without this step, governed_earn_deposit returns "Insufficient
  // balance at <Earn Account>" on a fresh account. Returns a plain
  // USDC.transfer(EarnAccount, amount) tx that Sly broadcasts via CDP —
  // no Permit2/EIP-712 ceremony.
  //
  // The reverse direction (Earn Account → EOA) has different policy
  // concerns and lives in a separate spec when added.
  governed_earn_transfer: {
    subcommand: "earn:transfer_in",
    executable: true,
    toIntentParams: (a) => ({
      chain: a.chain ?? "base",
      amount: String(a.amount),
      // The Earn Account itself is the "venue" being acted on. Tenants
      // that want to allow Earn Account funding put `compass-earn-account`
      // in their venue allowlist.
      venue_type: a.venue_type ?? "compass-earn-account"
    }),
    toCliArgs: (a) => [
      "earn",
      "transfer",
      "--action",
      "DEPOSIT",
      "--token",
      a.token ?? "USDC",
      "--amount",
      String(a.amount),
      "--owner",
      a.owner,
      "--chain",
      a.chain ?? "base"
    ]
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
  governed_compass_withdraw: {
    subcommand: "credit:withdraw",
    executable: true,
    // Plain EVM tx (Safe execTransaction) — CDP sendTransaction broadcasts directly.
    toIntentParams: (a) => ({ chain: a.chain ?? "base", amount: String(a.amount), venue_type: "compass:withdraw" }),
    toCliArgs: (a) => ["credit", "transfer", "--action", "WITHDRAW", "--token", a.token, "--amount", String(a.amount), "--owner", a.owner, "--chain", a.chain ?? "base"]
  },
  governed_perps_order: {
    subcommand: "perps:order",
    executable: false,
    // Hyperliquid signature scheme — not CDP-broadcastable
    toIntentParams: (a) => ({ chain: "hyperevm", amount: String(a.size), venue_type: `perp:${a.asset}` }),
    toCliArgs: (a) => ["global-markets-perps", "market-order", "--asset", a.asset, "--side", a.side, "--size", String(a.size), "--owner", a.owner]
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
          const env = compass.errorEnvelope ?? {};
          const msg = String(env.message ?? "");
          const isEarnStagingGap = spec.subcommand === "earn:deposit" && /^Insufficient .* balance at 0x[0-9a-fA-F]{40}/.test(msg);
          if (isEarnStagingGap) {
            const m = msg.match(/balance at (0x[0-9a-fA-F]{40})/);
            const earnAccountAddress = m?.[1];
            return textResult({
              governed: true,
              executed: false,
              decision: "approve",
              evaluation_id: decision.evaluation_id,
              needs_transfer: true,
              earn_account_address: earnAccountAddress,
              hint: "Sly approved the deposit but Compass's Earn Account is empty. Call governed_earn_transfer (same agent, same chain, amount >= this one's amount) first to stage USDC EOA \u2192 Earn Account, then retry governed_earn_deposit.",
              compass: { error: `${name} compass call failed`, detail: env }
            });
          }
          return textResult({ governed: true, executed: false, decision: "approve", evaluation_id: decision.evaluation_id, compass: { error: `${name} compass call failed`, detail: env } });
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
