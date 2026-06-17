#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for trim-subs.
#
# Reads TRIM_API_KEY from .env.local (or process env), provisions one
# parent account + one Trim agent via the standard Sly API, writes the
# resulting IDs + agent token back into .env.local.
#
# Pattern mirrors compass-live's onboard.sh, but talks to the regular
# Sly surface (POST /v1/accounts, POST /v1/agents) instead of a
# dedicated Compass-only endpoint. Idempotent: re-running checks for
# an existing "Trim Demo Account" + "Trim Subscription Agent" before
# provisioning, and writes the same IDs back.
#
# Usage:
#   ./scripts/onboard.sh                   # default sandbox
#   ./scripts/onboard.sh --api-url <url>   # override API URL
#
# Prerequisites: TRIM_API_KEY=pk_test_… in .env.local (any sandbox tenant key)

set -euo pipefail
cd "$(dirname "$0")/.."

API_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-url) API_URL="$2"; shift 2 ;;
    -h|--help) grep -E '^# ' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown flag: $1 (try --help)" >&2; exit 1 ;;
  esac
done

# ── Read .env.local ────────────────────────────────────────────────────
if [[ -f .env.local ]]; then
  set -a; source .env.local; set +a
fi

KEY="${TRIM_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ TRIM_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai and paste it into .env.local:"
  echo "    TRIM_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning trim-subs against $API_URL …"
echo

# ── Helpers ────────────────────────────────────────────────────────────
post_json() {
  local path="$1" body="$2"
  curl -sS -X POST "$API_URL$path" \
    -H "Authorization: Bearer $KEY" \
    -H "Content-Type: application/json" \
    -d "$body"
}

get_json() {
  local path="$1"
  curl -sS "$API_URL$path" -H "Authorization: Bearer $KEY"
}

# ── 1. Resolve or create the parent account ───────────────────────────
# Use a search query to find an existing "Trim Demo" account — keeps
# the script idempotent without needing deterministic IDs server-side.
ACCOUNT_ID=$(get_json "/v1/accounts?search=Trim%20Demo&limit=5" | \
  python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if not isinstance(d.get('data', []), list) else d['data']
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == 'Trim Demo':
        print(a.get('id', ''))
        break
")

if [[ -z "$ACCOUNT_ID" ]]; then
  echo "  • Creating Trim Demo account…"
  # Agents require a business-type parent account.
  ACCOUNT_RESP=$(post_json "/v1/accounts" '{
    "type": "business",
    "name": "Trim Demo",
    "metadata": { "onboarded_via": "trim-subs/scripts/onboard.sh" }
  }')
  ACCOUNT_ID=$(echo "$ACCOUNT_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('data',d).get('id',''))")
  if [[ -z "$ACCOUNT_ID" ]]; then
    echo "✗ Failed to create account. Response:"
    echo "$ACCOUNT_RESP" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNT_RESP"
    exit 1
  fi
  # Verify the account to KYC tier 2 so the agent can be provisioned —
  # un-verified parent accounts can't host agents. This is a sandbox
  # convenience; partners in production go through real KYC.
  # Two attempts on verify — absorbs brief eventual-consistency lag
  # between account-create and verify on the same row.
  VERIFIED=""
  for attempt in 1 2; do
    VERIFY_RESP=$(post_json "/v1/accounts/$ACCOUNT_ID/verify" '{
      "tier": 2,
      "verificationData": { "notes": "sandbox demo provisioning" }
    }')
    VERIFIED=$(echo "$VERIFY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); data=d.get('data',d); print(data.get('verificationTier', data.get('verification_tier', '')))" 2>/dev/null)
    [[ -n "$VERIFIED" ]] && break
    [[ $attempt -eq 1 ]] && sleep 2
  done
  if [[ -z "$VERIFIED" ]]; then
    echo "✗ Failed to verify account after 2 attempts. Response:"
    echo "$VERIFY_RESP" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESP"
    exit 1
  fi
fi
echo "  ✓ Account: $ACCOUNT_ID"

# ── 2. Resolve or create the agent ─────────────────────────────────────
AGENT_INFO=$(get_json "/v1/agents?search=Trim%20Subscription%20Agent&limit=5" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == 'Trim Subscription Agent':
        print(a.get('id', ''))
        break
")

AGENT_ID=""
AGENT_TOKEN=""
if [[ -n "$AGENT_INFO" ]]; then
  AGENT_ID="$AGENT_INFO"
  AGENT_TOKEN="${TRIM_AGENT_TOKEN:-}"  # reuse if .env.local already has one
  if [[ -z "$AGENT_TOKEN" || "$AGENT_TOKEN" == *"REPLACE_ME"* ]]; then
    echo "  ⚠ Agent $AGENT_ID exists but TRIM_AGENT_TOKEN is missing — Sly only returns the token at creation time."
    echo "    Either rotate the token via POST /v1/agents/$AGENT_ID/rotate-token, or delete the agent and re-run this script."
  fi
fi

if [[ -z "$AGENT_ID" ]]; then
  echo "  • Creating Trim Subscription Agent…"
  AGENT_RESP=$(post_json "/v1/agents" "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"name\": \"Trim Subscription Agent\",
    \"description\": \"Scans for duplicate and unused subscriptions; cancels on user approval\",
    \"auto_create_wallet\": true,
    \"permissions\": {
      \"transactions\": { \"initiate\": true, \"approve\": false, \"view\": true },
      \"streams\": { \"initiate\": false, \"modify\": false, \"pause\": true, \"terminate\": true, \"view\": true },
      \"accounts\": { \"view\": true, \"create\": false }
    }
  }")
  # The API wraps create-agent in {success, data: {data: agent, credentials: {token}}}.
  # Drill through both nesting levels.
  AGENT_ID=$(echo "$AGENT_RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)
inner = data.get('data', data)
print(inner.get('id', ''))
")
  AGENT_TOKEN=$(echo "$AGENT_RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)
data = d.get('data', d)
creds = data.get('credentials', d.get('credentials', {}))
print(creds.get('token', ''))
")
  if [[ -z "$AGENT_ID" || -z "$AGENT_TOKEN" ]]; then
    echo "✗ Failed to create agent. Response:"
    echo "$AGENT_RESP" | python3 -m json.tool 2>/dev/null || echo "$AGENT_RESP"
    exit 1
  fi
fi
echo "  ✓ Agent: $AGENT_ID"

# ── 3. Write the env block back to .env.local ─────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by trim-subs/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"TRIM_ACCOUNT_ID=$ACCOUNT_ID",
    f"TRIM_AGENT_ID=$AGENT_ID",
]
if "$AGENT_TOKEN":
    lines.append(f"TRIM_AGENT_TOKEN=$AGENT_TOKEN")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by trim-subs/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "",
    current,
    flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3261"
