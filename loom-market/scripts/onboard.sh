#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for loom-market.
#
# Reads LOOM_API_KEY from .env.local, provisions:
#   - Loom Buyer Treasury (KYB T2) + Beacon (buyer agent)
#   - Loom Provider Treasury (KYB T2) + Forge (provider agent)
#   - Forge's x402 endpoint at /v1/forge/infer priced at $0.02/call
# Writes IDs + agent tokens + endpoint id back to .env.local.
#
# Idempotent — re-running finds existing rows by name.

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

KEY="${LOOM_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ LOOM_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai, then paste it into .env.local:"
  echo "    LOOM_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning loom-market against $API_URL …"
echo

post_json() { curl -sS -X POST "$API_URL$1" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$2"; }
get_json()  { curl -sS "$API_URL$1" -H "Authorization: Bearer $KEY"; }

ensure_account() {
  local name="$1"
  local search_qs existing
  search_qs=$(printf '%s' "$name" | python3 -c "import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))")
  existing=$(get_json "/v1/accounts?search=$search_qs&limit=10" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for a in (arr if isinstance(arr, list) else []):
    if a.get('name') == '$name':
        print(a.get('id', '')); break
")
  if [[ -n "$existing" ]]; then echo "$existing"; return; fi
  local body resp id
  body=$(printf '{"type":"business","name":"%s","metadata":{"onboarded_via":"loom-market/scripts/onboard.sh"}}' "$name")
  resp=$(post_json "/v1/accounts" "$body")
  id=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$id" ]]; then echo "✗ Failed to create $name." >&2; echo "$resp" >&2; exit 1; fi
  for attempt in 1 2 3 4; do
    V_RESP=$(post_json "/v1/accounts/$id/verify" '{"tier":2,"verificationData":{"notes":"sandbox demo provisioning"}}')
    V_OK=$(echo "$V_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('y' if d.get('success', False) else '')" 2>/dev/null)
    [[ -n "$V_OK" ]] && break
    [[ $attempt -lt 4 ]] && sleep 3
  done
  echo "$id"
}

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
  if [[ -n "$existing" ]]; then echo "$existing|"; return; fi
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
echo "  • Resolving / creating Loom Buyer Treasury…"
BUYER_ACCT=$(ensure_account "Loom Buyer Treasury")
echo "    ✓ $BUYER_ACCT"

echo "  • Resolving / creating Loom Provider Treasury…"
PROVIDER_ACCT=$(ensure_account "Loom Provider Treasury")
echo "    ✓ $PROVIDER_ACCT"

# ── 2. Two agents ─────────────────────────────────────────────────────
echo "  • Resolving / creating Beacon (buyer)…"
RES=$(ensure_agent "Beacon" "Buyer — runs document parsing pipeline; pays per inference call" "$BUYER_ACCT")
BUYER_AGENT_ID="${RES%|*}"; BUYER_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $BUYER_AGENT_ID"

echo "  • Resolving / creating Forge (provider)…"
RES=$(ensure_agent "Forge" "Provider — sells GPU inference time on LLama-3.1-70B" "$PROVIDER_ACCT")
PROVIDER_AGENT_ID="${RES%|*}"; PROVIDER_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $PROVIDER_AGENT_ID"

# ── 3. Forge's x402 endpoint ──────────────────────────────────────────
echo "  • Resolving / creating Forge x402 endpoint…"
EXISTING_EP=$(get_json "/v1/x402/endpoints?limit=50" | python3 -c "
import json, sys
d = json.load(sys.stdin)
arr = d.get('data', d) if isinstance(d.get('data', []), list) else d.get('data', {}).get('data', [])
for e in (arr if isinstance(arr, list) else []):
    if e.get('name') == 'Forge Inference' or e.get('path') == '/v1/forge/infer':
        print(e.get('id', '')); break
")
if [[ -n "$EXISTING_EP" ]]; then
  ENDPOINT_ID="$EXISTING_EP"
  echo "    ✓ $ENDPOINT_ID (existing)"
else
  body=$(printf '{"name":"Forge Inference","path":"/v1/forge/infer","method":"POST","description":"LLama-3.1-70B-Instruct GPU inference (loom-market demo)","accountId":"%s","basePrice":0.02,"currency":"USDC","network":"base-mainnet"}' "$PROVIDER_ACCT")
  resp=$(post_json "/v1/x402/endpoints" "$body")
  ENDPOINT_ID=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$ENDPOINT_ID" ]]; then
    echo "✗ Failed to create endpoint." >&2; echo "$resp" >&2; exit 1
  fi
  echo "    ✓ $ENDPOINT_ID (created)"
fi

# ── 4. Env block ──────────────────────────────────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by loom-market/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"LOOM_BUYER_ACCOUNT_ID=$BUYER_ACCT",
    f"LOOM_PROVIDER_ACCOUNT_ID=$PROVIDER_ACCT",
    f"LOOM_BUYER_AGENT_ID=$BUYER_AGENT_ID",
    f"LOOM_PROVIDER_AGENT_ID=$PROVIDER_AGENT_ID",
    f"LOOM_PROVIDER_ENDPOINT_ID=$ENDPOINT_ID",
]
if "$BUYER_AGENT_TOKEN":
    lines.append(f"LOOM_BUYER_AGENT_TOKEN=$BUYER_AGENT_TOKEN")
if "$PROVIDER_AGENT_TOKEN":
    lines.append(f"LOOM_PROVIDER_AGENT_TOKEN=$PROVIDER_AGENT_TOKEN")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by loom-market/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3243"
