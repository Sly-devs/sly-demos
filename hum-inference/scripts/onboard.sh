#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for hum-inference.
#
# Reads HUM_API_KEY from .env.local, provisions:
#   - Hum Buyer Treasury (KYB T2) + Hum Inference Agent (the buyer)
#   - Hum Seller Treasury (KYB T2) + Hum Relay Agent (the seller)
# Writes IDs + agent tokens back to .env.local.
#
# Idempotent — re-running finds existing rows by name.
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

KEY="${HUM_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ HUM_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai and paste it into .env.local:"
  echo "    HUM_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning hum-inference against $API_URL …"
echo

post_json() { curl -sS -X POST "$API_URL$1" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$2"; }
get_json()  { curl -sS "$API_URL$1" -H "Authorization: Bearer $KEY"; }

# Helper: ensure-account-by-name. Echoes the account id.
ensure_account() {
  local name="$1"
  local search_qs
  search_qs=$(printf '%s' "$name" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
  local existing
  existing=$(get_json "/v1/accounts?search=$search_qs&limit=10" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == '$name':
        print(a.get('id', '')); break
")
  if [[ -n "$existing" ]]; then
    echo "$existing"; return
  fi
  local body resp id
  body=$(printf '{"type":"business","name":"%s","metadata":{"onboarded_via":"hum-inference/scripts/onboard.sh"}}' "$name")
  resp=$(post_json "/v1/accounts" "$body")
  id=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$id" ]]; then
    echo "✗ Failed to create $name." >&2; echo "$resp" >&2; exit 1
  fi
  for attempt in 1 2 3 4; do
    V_RESP=$(post_json "/v1/accounts/$id/verify" '{"tier":2,"verificationData":{"notes":"sandbox demo provisioning"}}')
    V_OK=$(echo "$V_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('y' if d.get('success', False) else '')" 2>/dev/null)
    [[ -n "$V_OK" ]] && break
    [[ $attempt -lt 4 ]] && sleep 3
  done
  echo "$id"
}

# Helper: ensure-agent-by-name. Echoes "id|token" (token blank for existing).
ensure_agent() {
  local name="$1" desc="$2" account_id="$3"
  local search_qs existing
  search_qs=$(printf '%s' "$name" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
  existing=$(get_json "/v1/agents?search=$search_qs&limit=10" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == '$name':
        print(a.get('id', '')); break
")
  if [[ -n "$existing" ]]; then
    echo "$existing|"
    return
  fi
  local body resp id token
  body=$(printf '{"accountId":"%s","name":"%s","description":"%s","auto_create_wallet":true,"permissions":{"transactions":{"initiate":true,"approve":false,"view":true},"accounts":{"view":true,"create":false}}}' "$account_id" "$name" "$desc")
  resp=$(post_json "/v1/agents" "$body")
  id=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); inner=data.get('data', data); print(inner.get('id',''))")
  token=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); creds=data.get('credentials', d.get('credentials',{})); print(creds.get('token',''))")
  if [[ -z "$id" || -z "$token" ]]; then
    echo "✗ Failed to create agent $name." >&2; echo "$resp" >&2; exit 1
  fi
  echo "$id|$token"
}

# ── 1. Two business accounts ──────────────────────────────────────────
echo "  • Resolving / creating Hum Buyer Treasury…"
HUM_ACCOUNT_ID=$(ensure_account "Hum Buyer Treasury")
echo "    ✓ $HUM_ACCOUNT_ID"

echo "  • Resolving / creating Hum Seller Treasury…"
HUM_SELLER_ACCOUNT_ID=$(ensure_account "Hum Seller Treasury")
echo "    ✓ $HUM_SELLER_ACCOUNT_ID"

# ── 2. Two agents ─────────────────────────────────────────────────────
echo "  • Resolving / creating Hum Inference Agent (buyer)…"
RES=$(ensure_agent "Hum Inference Agent" "x402 buyer paying for inference cycles" "$HUM_ACCOUNT_ID")
HUM_AGENT_ID="${RES%|*}"; HUM_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $HUM_AGENT_ID"

echo "  • Resolving / creating Hum Relay Agent (seller)…"
RES=$(ensure_agent "Hum Relay Agent" "x402 seller — sells spare phone NPU cycles" "$HUM_SELLER_ACCOUNT_ID")
HUM_RELAY_AGENT_ID="${RES%|*}"; HUM_RELAY_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $HUM_RELAY_AGENT_ID"

# ── 3. Env block ──────────────────────────────────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by hum-inference/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"HUM_ACCOUNT_ID=$HUM_ACCOUNT_ID",
    f"HUM_SELLER_ACCOUNT_ID=$HUM_SELLER_ACCOUNT_ID",
    f"HUM_AGENT_ID=$HUM_AGENT_ID",
    f"HUM_RELAY_AGENT_ID=$HUM_RELAY_AGENT_ID",
]
if "$HUM_AGENT_TOKEN":
    lines.append(f"HUM_AGENT_TOKEN=$HUM_AGENT_TOKEN")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by hum-inference/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3260"
