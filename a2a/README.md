# A2A · agent-to-agent coordination

Demos where agents discover, negotiate with, and pay each other directly — without a human in the middle. Sly's policy engine sits between every state-changing call.

| Demo | Port | What it shows |
|---|---|---|
| [`barter-market/`](./barter-market) | 3252 | A2A haggling market — offers, counters, accept, governed end-to-end. Two-agent demo (buyer + seller). |
| [`anvil-reverse/`](./anvil-reverse) | 3254 | Reverse marketplace — you post an intent, KYA-bonded sellers bid, Sly gates the settlement. |
| [`sigil-skills/`](./sigil-skills) | 3263 | A2A skill rental. Time-bounded skill grants with auto-revoke when the window closes. |
| [`helix-live/`](./helix-live) | 3241 | Live agentic-marketplace wall-board across 4 protocol rails (ACP, UCP, x402, A2A). Read-only feed off any tenant key — no provisioning. |
| [`span-broker/`](./span-broker) | 3220 | Split-screen Claude ↔ Sly ↔ ChatGPT broker viewer. Watch a cross-platform agent transaction in real time. |
| [`span-chatgpt-mock/`](./span-chatgpt-mock) | 3221 | High-fidelity ChatGPT custom-GPT mock ('Outpost Outdoors') for the broker viewer to negotiate against. |
