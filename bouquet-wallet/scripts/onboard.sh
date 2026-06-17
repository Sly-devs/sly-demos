#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for bouquet-wallet.
#
# Bouquet shows a 3-agent cross-tenant gifting flow: the user (BOUQUET),
# a Coral merchant (CORAL) who fulfills, and a Maya advisor (MAYA) who
# vets the recipient. This script provisions all three agents under a
# shared treasury and writes the IDs back to .env.local.
#
# Idempotent: re-running finds existing "Bouquet Demo Treasury" +
# "Bouquet Buyer / Coral Merchant / Maya Advisor" before provisioning.
#
# Usage:
#   ./scripts/onboard.sh                   # default sandbox
#   ./scripts/onboard.sh --api-url <url>   # override API URL
#
# Prerequisites: BOUQUET_API_KEY=pk_test_… in .env.local

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

KEY="${BOUQUET_API_KEY:-${SLY_DEMO_TENANT_API_KEY:-${MAYA_TENANT_KEY:-}}}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ BOUQUET_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai, then paste it into .env.local:"
  echo "    BOUQUET_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning bouquet-wallet against $API_URL …"
echo

post_json() { curl -sS -X POST "$API_URL$1" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$2"; }
get_json()  { curl -sS "$API_URL$1" -H "Authorization: Bearer $KEY"; }

# ── 1. Shared treasury account ────────────────────────────────────────
ACCOUNT_ID=$(get_json "/v1/accounts?search=Bouquet%20Demo%20Treasury&limit=5" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == 'Bouquet Demo Treasury':
        print(a.get('id', '')); break
")
if [[ -z "$ACCOUNT_ID" ]]; then
  echo "  • Creating Bouquet Demo Treasury…"
  ACCOUNT_RESP=$(post_json "/v1/accounts" '{
    "type": "business",
    "name": "Bouquet Demo Treasury",
    "metadata": { "onboarded_via": "bouquet-wallet/scripts/onboard.sh" }
  }')
  ACCOUNT_ID=$(echo "$ACCOUNT_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$ACCOUNT_ID" ]]; then
    echo "✗ Failed to create account."; echo "$ACCOUNT_RESP" | python3 -m json.tool 2>/dev/null || echo "$ACCOUNT_RESP"; exit 1
  fi
  # Verify the new account to KYB tier 2 so agents can be provisioned
  # under it. Two attempts in case of brief eventual-consistency lag
  # between create and read on the account row.
  for attempt in 1 2; do
    V_RESP=$(post_json "/v1/accounts/$ACCOUNT_ID/verify" '{"tier":2,"verificationData":{"notes":"sandbox demo provisioning"}}')
    V_OK=$(echo "$V_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('y' if d.get('success', d.get('data',{}).get('verificationTier'))==2 or 'verified' in (d.get('data',{}).get('verificationStatus','') if isinstance(d.get('data',{}), dict) else '') else '')" 2>/dev/null)
    [[ -n "$V_OK" ]] && break
    [[ $attempt -eq 1 ]] && sleep 2
  done
fi
echo "  ✓ Treasury: $ACCOUNT_ID"

# ── Helper to ensure an agent exists ──────────────────────────────────
# Args: <agent name> <description> <env var name for stored token>
# Echoes "agent_id|agent_token" — token will be empty for already-existing
# agents (Sly only returns the token at creation).
ensure_agent() {
  local agent_name="$1" agent_desc="$2" token_env="$3"
  local existing
  existing=$(get_json "/v1/agents?search=$(printf '%s' "$agent_name" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")&limit=5" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == '$agent_name':
        print(a.get('id', '')); break
")
  local prior_token="${!token_env:-}"
  if [[ -n "$existing" ]]; then
    echo "$existing|$prior_token"
    return
  fi
  local resp
  resp=$(post_json "/v1/agents" "{
    \"accountId\": \"$ACCOUNT_ID\",
    \"name\": \"$agent_name\",
    \"description\": \"$agent_desc\",
    \"auto_create_wallet\": true,
    \"permissions\": {
      \"transactions\": { \"initiate\": true, \"approve\": false, \"view\": true },
      \"accounts\": { \"view\": true, \"create\": false }
    }
  }")
  local id token
  id=$(echo "$resp" | python3 -c "
import json, sys
d=json.load(sys.stdin); data=d.get('data',d); inner=data.get('data', data); print(inner.get('id',''))")
  token=$(echo "$resp" | python3 -c "
import json, sys
d=json.load(sys.stdin); data=d.get('data',d); creds=data.get('credentials', d.get('credentials',{})); print(creds.get('token',''))")
  if [[ -z "$id" || -z "$token" ]]; then
    echo "✗ Failed to create agent $agent_name." >&2
    echo "$resp" | python3 -m json.tool >&2 2>/dev/null || echo "$resp" >&2
    exit 1
  fi
  echo "$id|$token"
}

# ── 2. Three agents ───────────────────────────────────────────────────
echo "  • Resolving / creating Bouquet Buyer Agent…"
RES=$(ensure_agent "Bouquet Buyer Agent" "Buys gifts on behalf of the user · governed by Bouquet's AP2 mandate" "BOUQUET_AGENT_TOKEN")
BOUQUET_AGENT_ID="${RES%|*}"; BOUQUET_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $BOUQUET_AGENT_ID"

echo "  • Resolving / creating Coral Merchant Agent…"
RES=$(ensure_agent "Coral Merchant Agent" "Boutique merchant — accepts ACP checkouts from Bouquet" "CORAL_AGENT_TOKEN")
CORAL_AGENT_ID="${RES%|*}"; CORAL_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $CORAL_AGENT_ID"

echo "  • Resolving / creating Maya Advisor Agent…"
RES=$(ensure_agent "Maya Advisor Agent" "Vets recipient + reviews gift suitability for Bouquet" "MAYA_AGENT_TOKEN")
MAYA_AGENT_ID="${RES%|*}"; MAYA_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $MAYA_AGENT_ID"

# ── 3. Write env block ────────────────────────────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by bouquet-wallet/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"BOUQUET_ACCOUNT_ID=$ACCOUNT_ID",
    f"CORAL_ACCOUNT_ID=$ACCOUNT_ID",
    f"MAYA_ACCOUNT_ID=$ACCOUNT_ID",
    f"BOUQUET_AGENT_ID=$BOUQUET_AGENT_ID",
    f"CORAL_AGENT_ID=$CORAL_AGENT_ID",
    f"MAYA_AGENT_ID=$MAYA_AGENT_ID",
]
for env_name, val in (
    ("BOUQUET_AGENT_TOKEN", "$BOUQUET_AGENT_TOKEN"),
    ("CORAL_AGENT_TOKEN",   "$CORAL_AGENT_TOKEN"),
    ("MAYA_AGENT_TOKEN",    "$MAYA_AGENT_TOKEN"),
):
    if val:
        lines.append(f"{env_name}={val}")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by bouquet-wallet/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3212"
