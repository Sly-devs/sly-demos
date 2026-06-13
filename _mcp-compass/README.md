# @sly_ai/mcp-compass

MCP server that puts **Sly's policy engine in front of Compass Labs DeFi actions**. An AI agent (Claude Desktop, Cursor) calls these tools; every state-changing action is evaluated by Sly — KYA tier, venue allowlist, spending caps, operator kill-switch — before it can execute.

## Why

Compass ships embedded DeFi (yield, credit, trading) with an agent-friendly CLI, but no governance layer. Sly is that layer. This package is the agent-facing interface: governed tools route through `POST /v1/policy/evaluate-intent`; if Sly says deny, the action never reaches the chain.

## Install

```bash
npm install -g @sly_ai/mcp-compass
# Compass CLI must be installed and on PATH (or set COMPASS_BIN):
curl -fsSL https://compasslabs.ai/install.sh | bash
```

## Configure (Claude Desktop)

```json
{
  "mcpServers": {
    "sly-compass": {
      "command": "npx",
      "args": ["-y", "@sly_ai/mcp-compass"],
      "env": {
        "SLY_API_KEY": "pk_test_...",
        "COMPASS_API_KEY_AUTH": "your-compass-key",
        "SLY_API_URL": "https://api.getsly.ai",
        "COMPASS_CHAIN": "base"
      }
    }
  }
}
```

## Tools

| Tool | Gated? | What it does |
|---|---|---|
| `compass_earn_vaults` | no | List yield vaults (Aave, Morpho) with APY/TVL |
| `compass_earn_positions` | no | Show an owner's current Earn positions |
| `governed_earn_deposit` | **yes** | Deposit into a vault — Sly policy gate first; returns the bilateral receipt (PolicyDecision id) + unsigned tx on approve, machine-readable reasons on deny |

Anything not in this list is not invokable — the wrapper has no generic CLI passthrough (fail-closed classification).

## Governed flow

```
agent → governed_earn_deposit
          → Sly POST /v1/policy/evaluate-intent   (KYA tier · venue · caps · kill-switch)
          → approve? → compass earn manage --action DEPOSIT → unsigned tx
          → deny?    → { reasons: [...] }  (agent self-corrects)
```

Broadcasting the approved tx via the agent's CDP wallet is wired in a follow-up; v1 returns the unsigned transaction for the owner to sign + submit.

## Env

| Var | Required | Default |
|---|---|---|
| `SLY_API_KEY` | yes | — |
| `COMPASS_API_KEY_AUTH` | yes | — |
| `SLY_API_URL` | no | `https://api.getsly.ai` |
| `COMPASS_BIN` | no | `~/.local/bin/compass` |
| `COMPASS_CHAIN` | no | `base` |
