# AgentFloat

> **A Uniswap v4 hook that keeps pool capital productive.** When liquidity isn't needed, the hook routes idle capital into yield. When a swap needs it, the hook recalls it just in time. In the background, an AI tests better yield strategies — but only strategies that win on-chain performance checks can ever touch real capital.

**Live on X Layer mainnet**, earning real Aave V3 yield. Built for the **Hook the Future** hackathon (OKX × Uniswap × Flap), May 22–28, 2026.

---

## Why AgentFloat?

### The Problem: Idle Capital & Collapsed Depth
In concentrated liquidity pools (like Uniswap v4), Liquidity Providers (LPs) choose specific price ranges to deploy their assets. When the market price moves outside this range:
1. **Capital sits idle:** It stops earning trading fees.
2. **Depth collapses:** When a large position goes out of range, the pool's liquidity depth drops, and the effective spread widens.
3. **Arbitrageurs exploit the pool:** Arbitrage bots spot these widened spreads instantly and exploit the price differences before LPs can manually rebalance their positions.

### The Solution: JIT (Just-In-Time) Recall Hook
AgentFloat solves this using a Uniswap v4 Hook that monitors and routes capital dynamically:
* **Idle Sweeps:** When a position goes out of range, the hook automatically sweeps the idle capital into the `FloatVault` to generate yield in active strategies like Aave V3.
* **Just-In-Time Recall:** The moment a swap starts, the hook's `beforeSwap` callback instantly pulls the capital back into the pool.
* **Spread Protection:** By recalling the capital in the exact transaction of the trade, the pool's full depth is restored. The spread stays tight, traders get perfect execution, and LPs capture yield while waiting.

### The Guardrail: "The AI Thinks, the Chain Decides"
To optimize yield, an off-chain AI continuously simulates and proposes alternative strategies. But the AI has zero permission to move real capital:
* **On-Chain Gatekeeper:** A strategy must win consecutive performance checks against the active strategy directly on-chain.
* **Trustless Promotion:** Once a strategy proves itself, anyone can call `promote()` on-chain to migrate the pool's capital. The AI cannot bypass this rule.

---

---

## TL;DR — what makes this submission different

1. **A Uniswap v4 hook deployed live on X Layer mainnet** (chain 196), real Aave V3 USDT, attached to the canonical PoolManager. Hook address: [`0x5Ba6671e8219C34edA373BF95895306929174580`](https://www.oklink.com/xlayer/address/0x5Ba6671e8219C34edA373BF95895306929174580) with permission bits `0x580` verified.
2. **An AI orchestrator (Groq llama-3.3-70b)** that reads the system's own performance every hour from a markdown second-brain and writes structured strategy proposals.
3. **An autonomous deploy proof on testnet**: the AI proposed a parameter variant, the operating-mode guardrails cleared it, and the deployer module shipped a real on-chain contract at [`0xb742…ac63bd`](https://www.oklink.com/xlayer-test/address/0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd) with no human in the loop.
4. **Trustless on-chain promotion**: `consecutiveWins[strategyId]` lives on the vault. When a shadow strategy outperforms the active one for N epochs, anyone can call `promote()` — no gatekeeper.
5. **Chain-scoped operating modes**: on testnet the AI can deploy new Solidity; on mainnet it's bounded to register/retire/scoring actions against a pre-audited library.
6. **Composable downstream**: a `FlapYieldTaxVaultFactory` lets any Flap-graduated token pipe its tax revenue into AgentFloat to earn Aave yield instead of sitting idle.

13/13 Forge tests passing (incl. a strategy-drain regression test). Real Aave V3 integration. ~$0.09 to deploy the entire system to X Layer mainnet.

---

## ⚡ Live on X Layer Mainnet (chain 196)

| Contract | Address | Bytecode |
|----------|---------|---------|
| **AgentFloatHook** | [`0x5Ba6671e8219C34edA373BF95895306929174580`](https://www.oklink.com/xlayer/address/0x5Ba6671e8219C34edA373BF95895306929174580) | 5,101 b · permission bits `0x580` |
| **FloatVault** | [`0xbF06de108735332D1EDb81C7A77A750DD428a6f4`](https://www.oklink.com/xlayer/address/0xbF06de108735332D1EDb81C7A77A750DD428a6f4) | 5,115 b |
| **FlapYieldTaxVaultFactory** | [`0x87D665B83557365ADf320a439B8a2DFD03c024F8`](https://www.oklink.com/xlayer/address/0x87D665B83557365ADf320a439B8a2DFD03c024F8) | 10,050 b |
| **AaveStrategy** (real Aave V3 USDT, `onlyVault`-guarded) | [`0xB433487F82572FF201A2455BF7a06325a7B8bFEa`](https://www.oklink.com/xlayer/address/0xB433487F82572FF201A2455BF7a06325a7B8bFEa) | 2,5xx b |
| **IdleStrategy** (baseline) | [`0xf292e500459393F5CfaF8fbccFe1426bC3495EEb`](https://www.oklink.com/xlayer/address/0xf292e500459393F5CfaF8fbccFe1426bC3495EEb) | 939 b |

Attached to canonical X Layer mainnet infrastructure (no PoolManager or Aave redeploy needed):

| External contract | Address |
|---|---|
| Uniswap v4 PoolManager | [`0x360e68faccca8ca495c1b759fd9eee466db9fb32`](https://www.oklink.com/xlayer/address/0x360e68faccca8ca495c1b759fd9eee466db9fb32) |
| Aave V3 Pool | [`0xE3F3Caefdd7180F884c01E57f65Df979Af84f116`](https://www.oklink.com/xlayer/address/0xE3F3Caefdd7180F884c01E57f65Df979Af84f116) |
| USDT / USDC | [`0x779Ded0c9e1022225f8E0630b35a9b54bE713736`](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736) |
| aUSDT | [`0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297`](https://www.oklink.com/xlayer/address/0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297) |

Total deploy cost: **0.000372 OKB (~$0.09)** at 0.02 gwei.

**Live yield, verifiable now:** the AaveStrategy `0xB433…` holds a real interest-bearing **aUSDT** position supplied to Aave V3 — capital that flowed through the vault and is earning lending yield block-by-block. Check `aUSDT.balanceOf(0xB433487F82572FF201A2455BF7a06325a7B8bFEa)` on chain 196. (The prior strategy `0x4C109…` was superseded by this `onlyVault`-hardened build; funds were migrated trustlessly via the on-chain `promote()` path.)

---

## Proof the AI loop actually closes (X Layer Testnet)

The system autonomously deployed a new strategy contract from a Groq-generated proposal — full evidence on-chain:

| Event | Value |
|------|-------|
| Proposal markdown | `~/brain/skills/agentfloat-strategies/proposals/2026-05-26-999-parameter_variant.md` |
| Model | `llama-3.3-70b-versatile` (Groq) |
| Approver decision | Operating mode `autonomous`, all guardrails cleared |
| Deploy tx | [`0x4245ab63…51e88`](https://www.oklink.com/xlayer-test/tx/0x4245ab63dbd189b42bd0ba3882458ca924a777828fb60fe69b0ffa75eb5ff54e) |
| Deployed contract | [`0xb74204…ac63bd`](https://www.oklink.com/xlayer-test/address/0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd) |

End-to-end: LLM read history → wrote proposal → approver guardrails cleared it → deployer broadcast → on-chain registration. **No human in the loop.**

Additional proof from continuous operation on testnet:
- **4,800+ scoring epochs** posted to chain
- **6 LLM proposals** generated by Groq across 36 hours (parameter variants, retire recommendations, and one "Momentum Strategy" novel-class idea)
- **2 autonomous on-chain promotions** — `MockYieldStrategy` was promoted from shadow → active by the on-chain `consecutiveWins` counter, no manual call.

---

## Architecture

```
LP → Uniswap v4 Pool (canonical X Layer)
         │
         │ afterAddLiquidity / beforeSwap / afterRemoveLiquidity
         ▼
   AgentFloatHook ───── out-of-range USDT routes here
         │
         ▼
     FloatVault ◄────── FlapYieldTaxVault (downstream consumer:
         │              token tax revenue earns Aave yield)
         │
         │   StrategyRegistry
         │   ├── activeStrategyId    (real capital deploys here)
         │   └── shadowStrategyIds[] (scored against same conditions)
         │
         │   On-chain consecutiveWins counter — promote() is trustless
         │
         ▼ IStrategy interface
   ┌──────────────┬──────────────────┬─────────────────────┐
   IdleStrategy   AaveStrategy       (future: Morpho,      pre-audited
   (baseline)     (Aave V3 USDT)      Compound, etc.)      library
                                                            │
   ┌────────────────────────────────────────────────────────┘
   ▼
Off-chain Brain Agent (TypeScript) - the AI layer
  ├── Watcher       polls X Layer, ticks epochs
  ├── Scorer        computes score per strategy, posts on-chain
  ├── Promoter      checks guards, fires promote() when threshold met
  ├── Orchestrator  Groq llama-3.3 reads brain history, writes proposals
  ├── Approver      applies operating-mode policy
  ├── Deployer      ships approved proposals on-chain
  ├── Consolidator  distills raw + journal events into history wiki
  └── REST API      exposes state for dashboard (port 4000)

Operator Brain (Markdown vault, ~/brain/) - the policy layer
  ├── projects/AGENTFLOAT.md              live project state
  ├── skills/agentfloat-strategies/*.md   strategy specs (paused, retired editable)
  ├── skills/agentfloat-strategies/
  │       proposals/*.md                  LLM-generated proposals
  ├── wiki/agentfloat-scoring.md          scoring rules + JSON config block
  ├── wiki/agentfloat-operating-mode.md   chain_actions_allowed + guardrails
  └── wiki/agentfloat-history.md          auto-generated by consolidator
```

The contracts execute. The brain is the policy. The LLM is the planner. Deterministic on-chain gates prevent bad proposals from touching real capital.

---

## Composability — Flap-graduated token integration

`contracts/src/flap/` is a downstream consumer of FloatVault. Any token launched on **Flap** can route its tax revenue (native OKB or ERC20) into AgentFloat to earn Aave yield instead of sitting idle in the tax vault.

| Contract | What it does |
|----------|--------------|
| `FlapYieldTaxVault.sol` | Receives tax revenue, parks it into FloatVault. Yields accrue via Aave. Creator/guardian can withdraw with accumulated yield. |
| `FlapYieldTaxVaultFactory.sol` | Anyone can call `newVault(taxToken, quoteToken, creator)` to deploy a per-token tax vault wired to the FloatVault automatically. |
| `VaultBaseV2.sol` | Flap base contract (guardian / receive logic). |
| `IVaultSchemasV1.sol` | Flap's schema interface. |

What this means for the ecosystem: a token launcher on Flap doesn't have to design their own yield optimization. They opt in to AgentFloat by deploying through the factory; the AI handles strategy selection downstream.

Handles three quote types:
- **USDT/USDC** → ERC20 path, parks directly into FloatVault
- **Native OKB** → wraps to WOKB via `0xe538905c…D59b2b`, then parks
- **Custom ERC20** → standard `safeTransferFrom` path

---

## The four operating modes + chain-scoped guardrails

| Mode | What the AI does | What the human does |
|------|------------------|---------------------|
| `watch` | Proposes only. Writes markdown. | Approves every proposal manually. |
| `review` | Proposes, waits N hours. Auto-approves if not rejected. | Vetoes anything they don't want. |
| `auto-shadow` | Auto-deploys whitelisted action types (parameter variants). | Reviews novel proposals. |
| `autonomous` | Handles everything subject to guardrails. | Sets policy, reviews periodically. |

**Chain-scoped allowlist** (the mainnet safety boundary):

| Network | Chain | AI can | AI cannot |
|---------|-------|--------|-----------|
| X Layer Testnet | 1952 | Deploy new Solidity strategies, propose param variants, modify scoring | Promote shadows to active (on-chain `consecutiveWins` is the gate) |
| **X Layer Mainnet** | **196** | **Register/retire strategies from the pre-audited library, adjust scoring within bounds** | **Deploy new Solidity to mainnet** |

The `chain_actions_allowed` policy in `~/brain/wiki/agentfloat-operating-mode.md` enforces this. On mainnet, the AI's autonomy is scoped to picking from + parameterizing a library that humans audit; new Solidity requires `v4-security-foundations` review before being added.

Other guardrails: `max_proposals_per_day`, `max_strategies_registered`, `pinned_strategy_ids`, `require_security_audit_for`, `blocked_action_types`.

---

## Test results — 13/13 passing

```
Ran 3 test suites: 13 tests passed, 0 failed, 0 skipped

[PASS] test_Integration_Workflow()                (gas: 700264) — full end-to-end path
[PASS] test_DecentralizedPromotion_Success()       — trustless promote() works
[PASS] test_DecentralizedPromotion_WinsResetOnLoss() — counter resets correctly
[PASS] test_ParkAndWithdraw()                       (gas: 274304)
[PASS] test_Revert_DirectStrategyWithdraw()          — strategy funds are onlyVault-gated
[PASS] test_PostScore()                              (gas: 147575)
[PASS] test_Promote()                                (gas: 410532)
[PASS] test_RegisterStrategy()                       (gas: 181338)
[PASS] test_Revert_NonPromoterPromote()              (gas: 192474)
[PASS] FlapYieldTaxVault — ERC20 path
[PASS] FlapYieldTaxVault — native OKB → WOKB path
[PASS] FlapYieldTaxVault — withdraw with accrued yield
[PASS] FlapYieldTaxVaultFactory — deterministic per-token vault deploy
```

`test_Integration_Workflow` is the full path: deploy hook via CREATE2 with mined salt → init pool → add out-of-range liquidity → hook routes USDT to vault → swap triggers JIT recall → vault balance returns to zero.

---

## Quick start

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- (Optional) Groq API key for the LLM orchestrator

### Smart contracts

```bash
cd contracts
./setup.sh                  # installs Foundry deps + builds + runs tests
forge test                  # 13/13 should pass
```

### Mainnet deploy (~$0.09 total)

```bash
# 1. Deploy vault + strategies (atomic, one tx each)
forge create --rpc-url $X_LAYER_MAINNET_RPC --private-key $PK --legacy --broadcast \
  src/FloatVault.sol:FloatVault --constructor-args $USDT
# (repeat for IdleStrategy, AaveStrategy)
# Register them on the vault via cast send

# 2. Mine + deploy the hook via universal CREATE2 deployer
forge script script/DeployHookOnly.s.sol --rpc-url $X_LAYER_MAINNET_RPC \
  --broadcast --legacy
```

Or use the bundled `DeployMainnet.s.sol` for a one-shot deploy with safer nonce handling on a low-traffic RPC.

### Off-chain agent

```bash
cd agent
npm install
cp ../.env.example ../.env
# Fill in: X_LAYER_RPC_URL, VAULT_ADDRESS, HOOK_ADDRESS, PROMOTER_PRIVATE_KEY, GROQ_API_KEY
npm start                   # full loop on port 4000
```

Agent commands:
- `npm start` — watcher + scorer + promoter + orchestrator + consolidator + approver + deployer + REST API
- `npm run consolidate` — one-shot: refresh `~/brain/wiki/agentfloat-history.md`
- `npm run orchestrate` — one-shot: have Groq propose an action now
- `npm run approve` — one-shot: run the approver against pending proposals

### Dashboard

```bash
cd web
npm install
npm run dev                 # http://localhost:3000
```

Demo mode (no agent needed): `http://localhost:3000/?demo=1`

---

## Security model

Built against the Uniswap `v4-security-foundations` threat model.

- **`validateHookAddress(this)` enforced in `BaseHook` constructor** — deployed hook address must encode correct permission bits in its low 14 bits; misdeployed hooks revert at construction. Our mainnet hook at `0x5Ba6671e8219C34edA373BF95895306929174580` encodes `0x580` (afterAddLiquidity + afterRemoveLiquidity + beforeSwap).
- **`onlyPoolManager` modifier on every external callback** via the canonical `BaseHook` internal-callback pattern (we inlined the canonical source because the installed v4-periphery submodule doesn't ship `src/utils/BaseHook.sol`).
- **`onlyVault` on every strategy entry point** — `deposit()` and `withdraw()` on `AaveStrategy`/`IdleStrategy`/`MockYieldStrategy` revert unless called by their bound vault, so pooled funds can never be drained by a direct external call to a strategy. Covered by `test_Revert_DirectStrategyWithdraw`.
- **`ReentrancyGuard` on the vault** — `park()`, `withdraw()`, and `promote()` are `nonReentrant`.
- **`forceApprove` (zero-then-set)** everywhere the hook grants allowances, for USDT-style tokens that reject non-zero→non-zero `approve`.
- **Trustless promotion gate** — `consecutiveWins` mapping lives on-chain, anyone can call `promote()` once threshold is met; promotion is not promoter-gated, scoring is.
- **EIP-1153 transient storage** for tracking parked USDT within the swap transaction lifecycle, reducing storage gas on JIT recall.
- **Owner-gated strategy registration + score posting** via OpenZeppelin `Ownable`.
- **Encrypted private key support** for the off-chain promoter — AES-256-GCM + PBKDF2 via `agent/src/crypto.ts`; raw keys never need to touch disk.
- **Chain-scoped operating-mode guardrails** prevent the AI from deploying new Solidity to mainnet.
- **Per-mode rate limits**: `max_proposals_per_day`, `max_strategies_registered`, `pinned_strategy_ids`, `require_security_audit_for`, `blocked_action_types`.

---

## Repository layout

```
agentfloat-hook/
├── contracts/                  Foundry workspace
│   ├── src/
│   │   ├── AgentFloatHook.sol      v4 hook with afterAddLiquidity + beforeSwap
│   │   ├── FloatVault.sol          strategy registry + on-chain consecutiveWins
│   │   ├── base/BaseHook.sol       canonical inlined from v4-periphery
│   │   ├── strategies/
│   │   │   ├── IStrategy.sol
│   │   │   ├── IdleStrategy.sol
│   │   │   ├── AaveStrategy.sol    real Aave V3 USDT integration
│   │   │   └── MockYieldStrategy.sol
│   │   └── flap/                   Flap-graduated-pool yield adapter
│   │       ├── FlapYieldTaxVault.sol
│   │       ├── FlapYieldTaxVaultFactory.sol
│   │       ├── VaultBaseV2.sol
│   │       └── IVaultSchemasV1.sol
│   ├── script/
│   │   ├── Deploy.s.sol            one-shot (chain-aware: branches on 196 vs 1952)
│   │   ├── DeployMainnet.s.sol     mainnet-only deploy
│   │   ├── DeployHookOnly.s.sol    CREATE2 salt mining + hook deploy
│   │   ├── MineHookSalt.s.sol      standalone salt miner
│   │   ├── DeployFlapFactory.s.sol Flap factory deploy
│   │   └── XLayerMainnet.sol       canonical external address constants
│   └── test/                       13 tests, all passing
│
├── agent/                       Off-chain agent (TypeScript)
│   └── src/
│       ├── index.ts                entry point — starts watcher + API
│       ├── watcher.ts              block polling, epoch loop
│       ├── scorer.ts               computes scores, posts on-chain
│       ├── promoter.ts             guards + promote() calls
│       ├── orchestrator.ts         Groq llama-3.3 proposal generator
│       ├── approver.ts             chain-scoped + mode-scoped policy
│       ├── deployer.ts             ships approved proposals on-chain
│       ├── consolidator.ts         distills history into wiki
│       ├── brain.ts                markdown reader + types
│       ├── store.ts                SQLite mirror
│       ├── api.ts                  REST + SIWE auth
│       └── crypto.ts               AES-256-GCM key encryption
│
├── web/                         Next.js dashboard
│   └── src/
│       ├── app/                    pages + layout
│       ├── components/             Receipt, ModeDial, StrategyRace, etc.
│       └── lib/                    wallet, api client, types
│
├── docs/
│   ├── architecture.md
│   ├── faq.md                   how strategies handle market volatility
│   ├── submission.md            hackathon submission package
│   ├── tweet_thread.md          4-tweet draft
│   └── video_script.md          90-second demo storyboard
│
├── .agents/skills/              Uniswap official AI skills
└── README.md                    this file
```

---

## License

MIT — see [LICENSE](LICENSE) for full text.
