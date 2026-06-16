#!/usr/bin/env bash
#
# scripts/onboard.sh — partner self-serve provisioning for compass-live.
#
# Reads SLY_DEMO_TENANT_API_KEY from .env.local (or process env), calls
# POST /v1/onboarding/compass-demo, pretty-prints what got created, and
# tells you what to do next.
#
# Usage:
#   ./scripts/onboard.sh                        # default: compass-live + Coral × Compass
#   ./scripts/onboard.sh --compass-only         # skip Coral extras (no usdc_faucet, no Coral env)
#   ./scripts/onboard.sh --api-url <url>        # override API URL (default https://sandbox.getsly.ai)
#
# Re-runnable — the endpoint is idempotent.

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Parse args ─────────────────────────────────────────────────────────
# Default: both demos enabled. --compass-only opts out of the Coral
# extras (usdc_faucet flag + Coral env block) when partners want a
# minimal compass-live-only setup.
INCLUDE_CORAL=true
API_URL=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --compass-only) INCLUDE_CORAL=false; shift ;;
    --include-coral) INCLUDE_CORAL=true; shift ;;   # legacy alias, no-op now (default)
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
  HUMAN_INCLUDE="compass-live (Coral extras skipped)"
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
next_steps = data.get("next_steps", [])
if next_steps:
    print()
    print(f"  Next steps:")
    for i, s in enumerate(next_steps, 1):
        print(f"    {i}. {s}")
PY

# ── Persist the agent IDs/EOAs to .env.local ───────────────────────────
# scenarios.ts reads NEXT_PUBLIC_COMPASS_AGENT_* to know which agent UUIDs
# to drive — without these, the demo would target the local-seed defaults
# (which don't exist in sandbox). We append/overwrite the block in-place
# so re-runs stay idempotent.
python3 - <<PY
import json, re, pathlib
env_path = pathlib.Path(".env.local")
data = json.load(open("$RESPONSE_FILE"), strict=False).get("data", {})
agents = data.get("agents", {})
if not agents:
    raise SystemExit(0)
lines = []
lines.append("")
lines.append("# === Auto-written by pnpm onboard — do not edit by hand ===")
for role in ("earn", "credit", "operator"):
    a = agents.get(role)
    if not a: continue
    role_upper = role.upper()
    lines.append(f"NEXT_PUBLIC_COMPASS_AGENT_{role_upper}_ID={a['id']}")
    lines.append(f"NEXT_PUBLIC_COMPASS_AGENT_{role_upper}_EOA={a['eoa']}")
lines.append("# === End auto-written block ===")
block = "\n".join(lines) + "\n"

current = env_path.read_text() if env_path.exists() else ""
# Strip any previous auto-block, then append the fresh one.
current = re.sub(
    r"\n?# === Auto-written by pnpm onboard.*?# === End auto-written block ===\n?",
    "",
    current,
    flags=re.DOTALL,
)
env_path.write_text(current.rstrip() + "\n" + block)
print(f"  → wrote {sum(1 for r in ('earn','credit','operator') if agents.get(r))} agent env blocks to .env.local")
PY

rm -f "$RESPONSE_FILE"

echo
echo "Make sure .env.local has these set:"
echo "  NEXT_PUBLIC_API_URL=$API_URL"
echo "  COMPASS_API_KEY_AUTH=<your Compass key>"
echo "  COMPASS_BIN=\$(which compass)     # install: curl -fsSL https://compasslabs.ai/install.sh | bash"
echo
echo "Then: pnpm install && pnpm dev   # → http://localhost:3270"
