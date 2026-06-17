#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for span-broker.
#
# Reads SPAN_API_KEY from .env.local, provisions:
#   - Span Demo (KYB T2) — the Span / Claude side
#   - Outpost Demo (KYB T2) — the Outpost Outdoors merchant side
#   - Span Buyer Agent (Claude shopping agent)
#   - Outpost Merchant Agent (the ChatGPT-mock counterparty)
# Writes IDs + agent tokens + a SPAN_OUTPOST_API_KEY (defaulting to the
# same SPAN_API_KEY since both sides live on one tenant in this demo)
# back to .env.local.
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

KEY="${SPAN_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"REPLACE_ME"* ]]; then
  echo "✗ SPAN_API_KEY is missing from .env.local"
  echo "  Get a sandbox tenant key at https://app.getsly.ai, then paste it into .env.local:"
  echo "    SPAN_API_KEY=pk_test_…"
  exit 1
fi

API_URL="${API_URL:-${SLY_API_URL:-https://sandbox.getsly.ai}}"
API_URL="${API_URL%/}"

echo "→ Provisioning span-broker against $API_URL …"
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
  body=$(printf '{"type":"business","name":"%s","metadata":{"onboarded_via":"span-broker/scripts/onboard.sh"}}' "$name")
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
echo "  • Resolving / creating Span Demo account…"
SPAN_ACCT=$(ensure_account "Span Demo")
echo "    ✓ $SPAN_ACCT"

echo "  • Resolving / creating Outpost Demo account…"
OUTPOST_ACCT=$(ensure_account "Outpost Demo")
echo "    ✓ $OUTPOST_ACCT"

# ── 2. Two agents ─────────────────────────────────────────────────────
echo "  • Resolving / creating Span Buyer Agent…"
RES=$(ensure_agent "Span Buyer Agent" "Span shopping agent — Claude side of the cross-platform broker viewer" "$SPAN_ACCT")
SPAN_AGENT_ID="${RES%|*}"; SPAN_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $SPAN_AGENT_ID"

echo "  • Resolving / creating Outpost Merchant Agent…"
RES=$(ensure_agent "Outpost Merchant Agent" "Outpost Outdoors merchant — ChatGPT-mock counterparty for the broker" "$OUTPOST_ACCT")
OUTPOST_AGENT_ID="${RES%|*}"; OUTPOST_AGENT_TOKEN="${RES#*|}"
echo "    ✓ $OUTPOST_AGENT_ID"

# ── 3. Env block ──────────────────────────────────────────────────────
python3 - <<PY
import re, pathlib
env_path = pathlib.Path(".env.local")
lines = [
    "",
    "# === Auto-written by span-broker/scripts/onboard.sh — do not edit by hand ===",
    "SLY_API_URL=$API_URL",
    f"SPAN_ACCOUNT_ID=$SPAN_ACCT",
    f"SPAN_AGENT_ID=$SPAN_AGENT_ID",
    # Both sides share one tenant in the script's default config — span-broker
    # uses SPAN_OUTPOST_API_KEY to authenticate the merchant-side calls; we
    # default it to the same SPAN_API_KEY so a single tenant runs both halves.
    f"SPAN_OUTPOST_API_KEY=$KEY",
    f"SPAN_OUTPOST_ACCOUNT_ID=$OUTPOST_ACCT",
    f"SPAN_OUTPOST_AGENT_ID=$OUTPOST_AGENT_ID",
]
if "$SPAN_AGENT_TOKEN":
    lines.append(f"SPAN_AGENT_TOKEN=$SPAN_AGENT_TOKEN")
if "$OUTPOST_AGENT_TOKEN":
    lines.append(f"SPAN_OUTPOST_AGENT_TOKEN=$OUTPOST_AGENT_TOKEN")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"
current = env_path.read_text() if env_path.exists() else ""
current = re.sub(
    r"\n?# === Auto-written by span-broker/scripts/onboard\.sh.*?# === End auto-written block ===\n?",
    "", current, flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print("  → wrote env block to .env.local")
PY

echo
echo "✓ Onboarding complete. Run: pnpm install && pnpm dev   # → http://localhost:3220"
