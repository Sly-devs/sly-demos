import {
  tools
} from "./chunk-Y4HWLJSS.js";

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

// src/server-factory.ts
function textResult(obj) {
  return { content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] };
}
function createCompassMcpServer(ctx) {
  const server = new Server(
    { name: "@sly_ai/mcp-compass", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions: [
        "This MCP server lets an agent transact on DeFi via Compass Labs, governed by Sly.",
        "Tools prefixed `compass_` are read-only (vault discovery, positions) \u2014 they hit Compass directly.",
        "Tools prefixed `governed_` are state-changing and ALWAYS pass through Sly's policy gate first:",
        "Sly evaluates KYA tier, venue allowlist, spending caps and the operator kill-switch before anything executes.",
        "When a governed action is denied, the response carries machine-readable reasons \u2014 read them and self-correct",
        "(split the amount under the cap, pick an allowlisted venue) rather than retrying the same intent."
      ].join(" ")
    }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    const args = rawArgs ?? {};
    try {
      switch (name) {
        // ── Read-only ────────────────────────────────────────────────
        case "compass_earn_vaults": {
          const cliArgs = ["earn", "vaults", "--chain", args.chain ?? ctx.defaultChain, "--order-by", args.order_by ?? "tvl_usd", "--direction", "desc"];
          if (args.limit) cliArgs.push("--limit", String(args.limit));
          if (args.asset_symbol) cliArgs.push("--asset-symbol", String(args.asset_symbol));
          const r = await runCompass(cliArgs);
          return textResult(r.ok ? r.data : { error: "compass earn vaults failed", detail: r.error });
        }
        case "compass_earn_positions": {
          const r = await runCompass(["earn", "positions", "--owner", args.owner, "--chain", args.chain ?? ctx.defaultChain]);
          return textResult(r.ok ? r.data : { error: "compass earn positions failed", detail: r.error });
        }
        // ── Governed ─────────────────────────────────────────────────
        case "governed_earn_deposit": {
          const intent = {
            version: "1",
            subcommand: "earn:deposit",
            agent_id: args.agent_id,
            requested_at: (/* @__PURE__ */ new Date()).toISOString(),
            params: {
              chain: args.chain ?? ctx.defaultChain,
              amount: String(args.amount),
              currency: "USDC",
              venue_type: args.venue_type,
              venue_address: args.vault_address
            }
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
          const compass = await runCompass([
            "earn",
            "manage",
            "--action",
            "DEPOSIT",
            "--venue",
            JSON.stringify({ type: "VAULT", vault_address: args.vault_address }),
            "--amount",
            String(args.amount),
            "--owner",
            args.owner,
            "--chain",
            args.chain ?? ctx.defaultChain
          ]);
          return textResult({
            governed: true,
            executed: false,
            decision: "approve",
            evaluation_id: decision.evaluation_id,
            compass: compass.ok ? { unsigned_transaction: compass.data?.transaction, earn_account: compass.data?.earn_account_address } : { error: "compass earn manage failed", detail: compass.errorEnvelope ?? compass.error },
            note: "Approved by Sly. The unsigned tx must be signed by the owner wallet and broadcast. Bilateral receipt = evaluation_id + (post-broadcast) tx hash."
          });
        }
        default:
          return { ...textResult({ error: `Unknown tool: ${name}` }), isError: true };
      }
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
