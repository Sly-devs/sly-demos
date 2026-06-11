# Sly × Compass · Perps order — Narration

Edit the spoken text under each `## Beat N — …` heading.

- One paragraph per beat. Newlines inside a beat collapse to a single
  space when the script reads it.
- Do **not** rename headings or change beat order: the script reads
  them in order (1 → 4).
- Optional `**Chips:**` block under a beat = lower-third punch phrases
  burned onto the video, evenly slotted across the beat.

> NOTE — this demo's broadcast leg is a faked preview. The Compass
> CLI's perps signing payload is real; Sly's executor doesn't yet
> implement the Hyperliquid signature scheme. See
> `docs/prd/compass-perps-execution-scoping.md`.

---

## Beat 1 — Framing (slate)

A perps order on Hyperliquid — through Compass, governed by Sly. The
same gate, the same policy, the same audit trail. Just a different
venue.

**Chips:**
- HYPERLIQUID · VIA COMPASS
- SAME GATE · SAME POLICY

## Beat 2 — Watch the gate fire

The agent places a long on B-T-C. Sly evaluates: position risk inside
the cap, perp asset on the allowlist, K-Y-A tier matches. Approve. The
Compass C-L-I returns the Hyperliquid signing payload, which is what
gets handed to the owner key.

**Chips:**
- POSITION RISK · CAP
- ALLOWLISTED ASSET
- TYPED DATA RETURNED

## Beat 3 — Why it matters

You don't have to expose Hyperliquid credentials to the agent. The
sign-and-submit step is the same C-D-P key it uses everywhere else.
Compass owns the venue. Sly owns the gate. One policy, every venue.

**Chips:**
- ONE KEY · EVERY VENUE
- ONE POLICY · EVERY ASSET

## Beat 4 — Outro (slate)

Perps. Governed by Sly. Executed via Compass.

**Chips:**
- SLY GOVERNS
- COMPASS EXECUTES
