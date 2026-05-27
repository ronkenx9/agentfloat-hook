# AgentFloat — Hook the Future submission

## Google Form — paste-ready fields

**Project name:**
AgentFloat

**One-line description:**
A Uniswap v4 hook on X Layer that routes out-of-range LP capital into a self-improving yield system — an LLM proposes new strategies hourly, only proven winners ship on-chain.

**GitHub repository:**
https://github.com/ronkenx9/agentfloat-hook

**Primary verifiable contract address (the Hook):**
**MAINNET:** `0x010023fcb7Cc4a6f4f867D3AF0C428d80d2B8580` — https://www.oklink.com/xlayer/address/0x010023fcb7Cc4a6f4f867D3AF0C428d80d2B8580
TESTNET: `0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F` — https://www.oklink.com/xlayer-test/address/0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F

**Demo video:**
[TBD — record per `docs/video_script.md`, upload as unlisted YouTube, paste link here]

**Project X account:**
[TBD — create handle, post the tweet thread in `docs/tweet_thread.md`, paste profile URL here]

---

## ⚡ Deployed contracts — X Layer **Mainnet** (chain 196)

| Role | Address |
|------|---------|
| **FloatVault** | [`0x42Ff0c72A17d5b13bf01a20B194b0D1fe43e50BF`](https://www.oklink.com/xlayer/address/0x42Ff0c72A17d5b13bf01a20B194b0D1fe43e50BF) |
| **AgentFloatHook** | [`0x010023fcb7Cc4a6f4f867D3AF0C428d80d2B8580`](https://www.oklink.com/xlayer/address/0x010023fcb7Cc4a6f4f867D3AF0C428d80d2B8580) |
| IdleStrategy | [`0xBC049aAD700ee69a72bedF7AE7032e462450Fb5d`](https://www.oklink.com/xlayer/address/0xBC049aAD700ee69a72bedF7AE7032e462450Fb5d) |
| AaveStrategy | [`0x1f34e7b58A81a84Def4fdE0ED23daE4B60c500cf`](https://www.oklink.com/xlayer/address/0x1f34e7b58A81a84Def4fdE0ED23daE4B60c500cf) |
| Uniswap v4 PoolManager (canonical) | [`0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32`](https://www.oklink.com/xlayer/address/0x360E68faCcca8cA495c1B759Fd9EEe466db9FB32) |
| Aave V3 Pool (USDT reserve) | [`0xE3F3Caefdd7180F884c01E57f65Df979Af84f116`](https://www.oklink.com/xlayer/address/0xE3F3Caefdd7180F884c01E57f65Df979Af84f116) |
| USDT (underlying) | [`0x779Ded0c9e1022225f8E0630b35a9b54bE713736`](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736) |

Total deploy cost: **0.000372 OKB (~$0.09)**. The mainnet build uses real USDT routed through real Aave V3, attaches to the canonical Uniswap v4 PoolManager (no PoolManager redeploy needed). The AI operating mode is bounded to `register_strategy / retire / scoring_change / no_action` on chain 196 — new Solidity to mainnet requires human review per `chain_actions_allowed`.

---

## Deployed contracts — X Layer Testnet (chain 1952)

| Role | Address | Explorer |
|------|---------|----------|
| Uniswap v4 PoolManager (fresh deploy) | `0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe` | [view](https://www.oklink.com/xlayer-test/address/0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe) |
| MockUSDC | `0x39684D42654752F246449e84524Fc972D57Ef985` | [view](https://www.oklink.com/xlayer-test/address/0x39684D42654752F246449e84524Fc972D57Ef985) |
| **FloatVault** | `0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f` | [view](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f) |
| **AgentFloatHook** ⚡ | `0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F` | [view](https://www.oklink.com/xlayer-test/address/0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F) |
| IdleStrategy (baseline floor) | `0x11eC5C3c0A80007a29117604120d82674C9D58B2` | [view](https://www.oklink.com/xlayer-test/address/0x11eC5C3c0A80007a29117604120d82674C9D58B2) |
| MockYieldStrategy v1 (shadow) | `0x970D233F4DAB7a4B970Bed33420C38FA14243d00` | [view](https://www.oklink.com/xlayer-test/address/0x970D233F4DAB7a4B970Bed33420C38FA14243d00) |
| **MockYieldStrategy v3 (AI-deployed)** | `0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd` | [view](https://www.oklink.com/xlayer-test/address/0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd) |

The v3 strategy is the proof point — deployed autonomously by the off-chain agent after Groq llama-3.3 proposed it and the operating-mode guardrails cleared it. Deployment tx:
https://www.oklink.com/xlayer-test/tx/0x4245ab63dbd189b42bd0ba3882458ca924a777828fb60fe69b0ffa75eb5ff54e

---

## Scoring criteria — how we map

### Innovation
The hook itself routes out-of-range LP USDC into a vault — mechanically simple. The innovation is the **system around the hook**: a multi-strategy vault where new strategies are proposed by an LLM, scored against the active strategy in shadow mode, then promoted on-chain via a trustless `consecutiveWins` counter. The pattern of "AI imagines + system tests + only winners ship" is novel to v4 and to DeFi yield generally.

### Market potential
Every concentrated-liquidity LP on v4 has capital that sits idle when price moves out of range. AgentFloat captures that opportunity cost without requiring LPs to change their behaviour. As v4 hooks become composable building blocks, AgentFloat is a yield-optimization plugin that any pool launcher can attach to their pool.

### Completion
8/8 Forge tests passing including `test_Integration_Workflow` (end-to-end: deploy hook → init pool → add out-of-range liquidity → hook routes → swap → recall). Six contracts verified on X Layer Testnet. Off-chain agent: watcher + scorer + promoter + orchestrator (Groq) + consolidator + approver + deployer + REST API. SQLite store. Next.js dashboard with wallet connect, SIWE auth, real deposit/withdraw flow. The MockYieldStrategy v3 deployment is on-chain proof the full loop runs autonomously end-to-end.

### Demo video
See `docs/video_script.md` — 90 seconds, six shots, voiceover lines written verbatim.

---

## Required social tags

Every tweet from the project X account must tag: **@XLayerOfficial · @Uniswap · @flapdotsh**

See `docs/tweet_thread.md` for the four-tweet submission thread.

---

## Marketing copy (long form)

### The problem
Concentrated liquidity is the v4 thesis. But when price moves out of an LP's range, their capital sits idle and stops earning trading fees. That's a structural opportunity cost across the entire v4 ecosystem.

### The AgentFloat solution
A v4 hook that detects out-of-range LP capital and routes it into a yield vault. The vault runs multiple strategies in parallel — one earning real funds (active), others tested in shadow mode against the same conditions. When a shadow consistently beats the active strategy across N consecutive epochs, the on-chain counter passes the promotion threshold and anyone can trustlessly call `promote()`. JIT recall returns the capital to the pool the moment price moves back into range.

The novel layer: an off-chain agent runs a Groq llama-3.3 orchestrator every hour. It reads the system's own performance history from a markdown-based "second brain" and proposes new strategy variants. Proposals flow through configurable operating-mode guardrails (`watch`, `review`, `auto-shadow`, `autonomous`) before being acted on. Approved proposals get auto-deployed by the deployer module — and that's how `0xb742…` came to exist on-chain.

The deterministic on-chain promotion gate is the floor regardless of mode. The AI can imagine new strategies, but only the on-chain `consecutiveWins` counter can promote one to active. Bad AI proposals show up as bad scores and never ship to real capital.
