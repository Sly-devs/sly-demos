# Sly × Compass · Platform walkthrough — Narration

Edit the spoken text under each `## Beat N — …` heading.

- One paragraph per beat. Newlines inside a beat collapse to a single
  space when the script reads it.
- Do **not** rename headings or change beat order: the script reads
  them in order (1 → 7) and feeds them into the 7 narration beats.
- Optional `**Chips:**` block under a beat = lower-third punch phrases
  burned onto the video, evenly slotted across the beat. Keep each
  chip ≤ 6 words, ALL-CAPS, short.

---

## Beat 1 — Framing (slate)

This is the operator view. An AI agent calls a Compass DeFi action. Sly
evaluates every state-changing call before Compass touches the chain.

**Chips:**
- AGENT CALLS COMPASS
- SLY GATES EVERY CALL
- BILATERAL RECEIPTS

## Beat 2 — Single approve, Earn deposit

The agent deposits into a Morpho vault. Sly checks the venue
allowlist, the spending policy, the K-Y-A tier — approve. The exact
Compass C-L-I command is logged, the unsigned transaction is broadcast
through Coinbase Developer Platform, and Compass tracks the event.

**Chips:**
- KYA · ALLOWLIST · CAPS
- COMPASS CLI LOGGED
- ON-CHAIN VIA CDP

## Beat 3 — Denied by Sly · kill-switch

When an operator kills the agent, Sly stops the call before it ever
reaches Compass. The right pane shows what would have run — locked in
red. No transaction. No drain. The receipt is signed all the same.

**Chips:**
- OPERATOR KILL-SWITCH
- BLOCKED BEFORE COMPASS
- DENY · SIGNED · AUDITED

## Beat 4 — Multi-step · Borrow-and-pay loop

Two governed calls in sequence. The agent borrows half a dollar against
its Aave collateral; then withdraws the same half dollar from the
Compass Safe into its own account. Each step independently gated by
Sly, each receipt anchored on Base.

**Chips:**
- TWO STEPS, ONE FLOW
- EACH GATE FIRES
- SPENDABLE AT THE END

## Beat 5 — Multi-step · Autonomous yield

The agent finds a higher rate and rebalances on its own. Sly enforces
the venue allowlist on both legs — out of Morpho, into Aave V-3. No
human in the loop, no human needed.

**Chips:**
- AUTONOMOUS REBALANCE
- VENUE ALLOWLIST HOLDS
- POLICY > AGENT WILL

## Beat 6 — Compass dashboard · cross-side proof

Compass sees the same activity from their side. Every Sly-approved
call shows up as an event — transfers, borrows, deposits — counted on
the Compass dashboard the customer already uses.

**Chips:**
- BOTH SYSTEMS, SAME TRUTH
- COMPASS COUNTS THE EVENTS
- NO RECONCILIATION DRIFT

## Beat 7 — Outro (slate)

This is what governed agentic DeFi looks like. Sly governs. Compass
executes. Bilateral receipts on both sides.

**Chips:**
- SLY GOVERNS
- COMPASS EXECUTES
- BILATERAL RECEIPTS
