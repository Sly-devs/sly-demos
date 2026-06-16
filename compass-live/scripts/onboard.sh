#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for compass-live.
#
# Reads SLY_DEMO_TENANT_API_KEY from .env.local (or process env), calls
# POST /v1/onboarding/compass-demo, pretty-prints what got created, and
# tells you what to do next.
#
# Usage:
#   ./scripts/onboard.sh                        # default: compass-live only
#   ./scripts/onboard.sh --include-coral        # also enable Coral × Compass extras
#   ./scripts/onboard.sh --api-url <url>        # override API URL (default https://sandbox.getsly.ai)
#
# Re-runnable — the endpoint is idempotent.

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Parse args ─────────────────────────────────────────────────────────
INCLUDE_CORAL=false
API_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --include-coral) INCLUDE_CORAL=true; shift ;;
    --api-url) API_URL="$2"; shift 2 ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \?//'
      exit 0 ;;
    *)
      echo "Unknown flag: $1 (try --help)" >&2
      exit 1 ;;
  esac
done

# ── Read .env.local ────────────────────────────────────────────────────
if [[ -f .env.local ]]; then
  # Source carefully — set -a auto-exports, set +a stops.
  set -a; source .env.local; set +a
fi

KEY="${SLY_DEMO_TENANT_API_KEY:-}"
if [[ -z "$KEY" || "$KEY" == *"<paste"* || "$KEY" == "your-key-here" ]]; then
  echo "✗ SLY_DEMO_TENANT_API_KEY is missing from .env.local"
  echo "  Get one at https://app.getsly.ai, then paste it into .env.local:"
  echo "    SLY_DEMO_TENANT_API_KEY=pk_test_…"
  exit 1
fi

# Default API URL: prefer NEXT_PUBLIC_API_URL from .env.local, else sandbox.
if [[ -z "$API_URL" ]]; then
  API_URL="${NEXT_PUBLIC_API_URL:-https://sandbox.getsly.ai}"
fi
API_URL="${API_URL%/}"  # trim trailing slash

# ── Build request body ─────────────────────────────────────────────────
if [[ "$INCLUDE_CORAL" == "true" ]]; then
  BODY='{"include":{"compass_live":true,"coral_compass":true}}'
  HUMAN_INCLUDE="compass-live + Coral × Compass"
else
  BODY='{"include":{"compass_live":true,"coral_compass":false}}'
  HUMAN_INCLUDE="compass-live"
fi

echo "→ Provisioning $HUMAN_INCLUDE against $API_URL …"
echo

# ── Call the endpoint ──────────────────────────────────────────────────
RESPONSE_FILE="$(mktemp)"
HTTP_CODE=$(curl -sS -o "$RESPONSE_FILE" -w "%{http_code}" \
  -X POST "$API_URL/v1/onboarding/compass-demo" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d "$BODY") || HTTP_CODE="0"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "✗ Onboarding failed (HTTP $HTTP_CODE)"
  echo
  cat "$RESPONSE_FILE" | python3 -m json.tool 2>/dev/null || cat "$RESPONSE_FILE"
  echo
  rm -f "$RESPONSE_FILE"
  exit 1
fi

# ── Pretty-print ───────────────────────────────────────────────────────
python3 - <<PY
import json
d = json.load(open("$RESPONSE_FILE"), strict=False)
data = d.get("data", d)
print("✓ Onboarding successful")
print()
print(f"  Tenant:   {data['tenant_id']}")
print(f"  Treasury: {data['treasury_account_id']}")
print()
print(f"  Agents:")
for role in ("earn", "credit", "operator"):
    a = data["agents"][role]
    print(f"    {role:10s}  T{a['kya_tier']}  {a['eoa']}  id={a['id']}")
print()
print(f"  Features: {', '.join(data.get('features_enabled', [])) or '(none)'}")
print()
on_chain = data.get("on_chain_setup", [])
if on_chain:
    print(f"  On-chain side effects:")
    for x in on_chain:
        amount = f" ({x['amount']})" if x.get("amount") else ""
        tx = f" tx={x['tx'][:18]}…" if x.get("tx") else ""
        print(f"    • {x['step']}{amount}{tx}")
    print()
print(f"  What happened:")
for s in data.get("what_happened", []):
    print(f"    • {s}")
PY
rm -f "$RESPONSE_FILE"

echo
echo "Next steps:"
echo "  1. Make sure these are also set in .env.local:"
echo "       NEXT_PUBLIC_API_URL=$API_URL"
echo "       COMPASS_API_KEY_AUTH=<your Compass key>"
echo "       COMPASS_BIN=\$(which compass)     # install: curl -fsSL https://compasslabs.ai/install.sh | bash"
echo "  2. pnpm install && pnpm dev   # → http://localhost:3270"
