#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for aster-tipping.
#
# Reads ASTER_API_KEY from .env.local, provisions a Aster Tipping Demo account +
# Aster Tipping Agent on your tenant, writes IDs + agent token back.
#
# Idempotent: re-running finds existing rows by name.
#
# Usage:
#   ./scripts/onboard.sh                   # default sandbox
#   ./scripts/onboard.sh --api-url <url>   # override API URL

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

if [[ -f .env.local ]]; then set -a; source .env.local; set +a; fi

KEY="${ASTER_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ ASTER_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai and paste it into .env.local:"
  echo "    ASTER_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning aster-tipping against $API_URL …"
echo

post_json() { curl -sS -X POST "$API_URL$1" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$2"; }
get_json()  { curl -sS "$API_URL$1" -H "Authorization: Bearer $KEY"; }

# ── 1. Aster Tipping Demo account ─────────────────────────────────────────────
ACCOUNT_ID=$(get_json "/v1/accounts?search=Coral%20Demo&limit=5" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == 'Aster Tipping Demo':
        print(a.get('id', '')); break
")
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "  • Creating Aster Tipping Demo account…"
  ACCOUNT_RESP=$(post_json "/v1/accounts" '{
    "type": "business",
    "name": "Aster Tipping Demo",
    "metadata": { "onboarded_via": "aster-tipping/scripts/onboard.sh" }
  }')
  ACCOUNT_ID=$(echo "$ACCOUNT_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$ACCOUNT_ID" ]]; then
    echo "✗ Failed to create account."; echo "$ACCOUNT_RESP" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNT_RESP"; exit 1
  fi
  VERIFIED=""
  for attempt in 1 2 3 4; do
    VERIFY_RESP=$(post_json "/v1/accounts/$ACCOUNT_ID/verify" '{"tier":2,"verificationData":{"notes":"sandbox demo provisioning"}}')
    VERIFIED=$(echo "$VERIFY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('y' if d.get('success', False) else '')" 2>/dev/null)
    [[ -n "$VERIFIED" ]] && break
    [[ $attempt -lt 4 ]] && sleep 3
  done
fi
echo "  ✓ Account: $ACCOUNT_ID"

# ── 2. Aster Tipping Agent ──────────────────────────────────────────────
EXISTING=$(get_json "/v1/agents?search=Coral%20Buyer%20Agent&limit=5" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == 'Aster Tipping Agent':
        print(a.get('id', '')); break
")

AGENT_ID="$EXISTING"
AGENT_TOKEN="${ASTER_AGENT_TOKEN:-}"

if [[ -z "$AGENT_ID" ]]; then
  echo "  • Creating Aster Tipping Agent…"
  AGENT_RESP=$(post_json "/v1/agents" "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"name\": \"Aster Tipping Agent\",
    \"description\": \"Creator tipping agent — x402 micropayments + reputation gate\",
    \"auto_create_wallet\": true,
    \"permissions\": {
      \"transactions\": { \"initiate\": true, \"approve\": false, \"view\": true },
      \"accounts\": { \"view\": true, \"create\": false }
    }
  }")
  AGENT_ID=$(echo "$AGENT_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); inner=data.get('data', data); print(inner.get('id',''))")
  AGENT_TOKEN=$(echo "$AGENT_RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); creds=data.get('credentials', d.get('credentials',{})); print(creds.get('token',''))")
  if [[ -z "$AGENT_ID" || -z "$AGENT_TOKEN" ]]; then
    echo "✗ Failed to create agent."; echo "$AGENT_RESP" | python3 -m json.tool 2>/dev/null || echo "$AGENT_RESP"; exit 1
  fi
elif [[ -z "$AGENT_TOKEN" || "$AGENT_TOKEN" == *"REPLACE_ME"* ]]; then
  echo "  ⚠ Agent $AGENT_ID exists but ASTER_AGENT_TOKEN is missing — Sly only returns the token at creation."
  echo "    Rotate via POST /v1/agents/$AGENT_ID/rotate-token, or delete + re-run this script."
fi
echo "  ✓ Agent: $AGENT_ID"

# ── 3. Write env block ────────────────────────────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by aster-tipping/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"ASTER_ACCOUNT_ID=$ACCOUNT_ID",
    f"ASTER_AGENT_ID=$AGENT_ID",
]
if "$AGENT_TOKEN":
    lines.append(f"ASTER_AGENT_TOKEN=$AGENT_TOKEN")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by aster-tipping/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3250"
