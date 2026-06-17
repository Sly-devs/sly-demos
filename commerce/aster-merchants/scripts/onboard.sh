#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for aster-merchants.
#
# Reads ASTER_API_KEY from .env.local, provisions the 5 merchant
# business accounts the operator console expects (Lume Goods, North
# Field Supply, Atelier Mode, Still Roast Coffee, Verdant Botanics)
# with their seed catalog + auto-accept policy in account metadata.
#
# aster-merchants resolves these by name when the static seed IDs don't
# match (which is always true for partner-onboarded tenants), so a
# fresh tenant lights up live mode after this runs.
#
# Idempotent: skips merchants that already exist by name.
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

echo "→ Provisioning aster-merchants against $API_URL …"
echo

post_json() { curl -sS -X POST "$API_URL$1" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d "$2"; }
get_json()  { curl -sS "$API_URL$1" -H "Authorization: Bearer $KEY"; }

ensure_merchant() {
  local name="$1" storefront="$2" blurb="$3" min_kya="$4" min_rep="$5"
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
    echo "  ✓ $name (existing: $existing)"
    return
  fi
  local body
  body=$(python3 -c "
import json
print(json.dumps({
  'type': 'business',
  'name': '''$name''',
  'metadata': {
    'onboarded_via': 'aster-merchants/scripts/onboard.sh',
    'storefront': '''$storefront''',
    'blurb': '''$blurb''',
    'auto_accept_policy': {
      'min_kya_tier': int('$min_kya'),
      'min_reputation': float('$min_rep'),
      'min_cross_tenant_tx': 1,
    },
  },
}))
")
  local resp
  resp=$(post_json "/v1/accounts" "$body")
  local id
  id=$(echo "$resp" | python3 -c "
import json,sys
d=json.load(sys.stdin); data=d.get('data',d); data=data.get('data',data) if isinstance(data,dict) and 'id' not in data else data; print(data.get('id',''))")
  if [[ -z "$id" ]]; then
    echo "✗ Failed to create $name. Response:" >&2
    echo "$resp" | python3 -m json.tool 2>/dev/null >&2 || echo "$resp" >&2
    exit 1
  fi
  for attempt in 1 2 3 4; do
    V_RESP=$(post_json "/v1/accounts/$id/verify" '{"tier":2,"verificationData":{"notes":"sandbox demo provisioning"}}')
    V_OK=$(echo "$V_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print('y' if d.get('success', False) else '')" 2>/dev/null)
    [[ -n "$V_OK" ]] && break
    [[ $attempt -lt 4 ]] && sleep 3
  done
  echo "  ✓ $name (created: $id)"
}

ensure_merchant "Lume Goods"          "lume-goods"       "Warm, editorial home goods — lighting, textiles, ceramics."   "2" "4.0"
ensure_merchant "North Field Supply"  "north-field"      "Durable outdoor and workshop goods, built to be repaired."    "1" "3.5"
ensure_merchant "Atelier Mode"        "atelier-mode"     "Considered apparel and small leather goods."                  "2" "4.2"
ensure_merchant "Still Roast Coffee"  "still-roast"      "Single-origin coffee and brewing equipment."                  "1" "3.5"
ensure_merchant "Verdant Botanics"    "verdant-botanics" "Houseplants, planters, and care goods."                       "1" "3.8"

# Write env block (no agent IDs to capture — the directory is account-only)
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by aster-merchants/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    "# === End auto-written block ===",
]
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by aster-merchants/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3230"
