# Compass demo videos

Six narrated MP4s + the narration scripts. All recorded at 1600×1000 @ 30fps, AAC mono audio.

| File | Length | What |
|---|---|---|
| `coral-compass-narrated.mp4` | 1:01 | **Hero · consumer POV.** Maya borrows on Coral mobile → Sly's just-in-time approval → real on-chain Aave borrow on Base. |
| `compass-live-narrated.mp4` | 1:22 | **Long-form · operator POV.** Walks 4 scenarios in the compass-live UI + cuts to live `compass credit positions` CLI output as proof. |
| `compass-autonomous-yield-narrated.mp4` | 0:39 | Short clip — agent rebalances from Morpho into Aave V3 (multi-step, both gated). |
| `compass-borrow-and-pay-narrated.mp4` | 0:47 | Short clip — credit borrow → Safe-to-EOA withdraw (multi-step). |
| `compass-treasury-of-agents-narrated.mp4` | 0:43 | Short clip — **FAKED PREVIEW.** Hierarchical delegation (parent treasury · scoped sub-agents). Underlying primitive is roadmap. |
| `compass-perps-order-narrated.mp4` | 0:43 | Short clip — **FAKED BROADCAST.** Sly gate is real; Hyperliquid signature scheme is roadmap. |

## Faked previews — what that means

Two of the six clips are labelled "faked preview." The Sly gate fires for real in those scenarios — every policy check evaluates, every audit row gets written. What's faked is the result that comes back from the agent client: the underlying capability (hierarchical agent delegation · Hyperliquid signing) isn't built in v1. The visual shows what the demo will look like once we ship it.

We mark them clearly in the UI and the narration so partners can tell which clips are real today vs. roadmap.

## Narration scripts

Every video has a matching `*.narration.md` next to it. The scripts are the spoken text + lower-third "chips" the editor can pull into a co-branded blog post.

## Re-recording

The recording pipeline (`gen-*-narrated.mjs` scripts in the internal Sly repo) drives Playwright against the running compass-live + coral-mobile apps and synthesizes voiceover via ElevenLabs. If you want to remix the videos with different narration, the scripts are in `apps/demo/_shots/` in the [Sly-devs/sly](https://github.com/Sly-devs/sly) repo (internal — email `eng@getsly.ai` for access).
