# AgentFloat — Hook the Future Submission

## Google Form — Paste-Ready Fields

**Project Name:**
AgentFloat

**One-line description:**
A Uniswap v4 Hook that turns idle, out-of-range pool liquidity into yield-generating assets while preserving swap readiness.

**GitHub Repository:**
https://github.com/ronkenx9/agentfloat-hook

**Primary Verifiable Contract Address (the Hook):**
`0x5Ba6671e8219C34edA373BF95895306929174580` — https://www.oklink.com/xlayer/address/0x5Ba6671e8219C34edA373BF95895306929174580

**Demo Video:**
[TBD — record per `docs/video_script.md`, upload as unlisted YouTube, paste link here]

**Project X Account:**
[TBD — create handle, post the tweet thread in `docs/tweet_thread.md`, paste profile URL here]

---

## ⚡ Deployed Contracts — X Layer Mainnet (Chain 196)

All contracts are live on X Layer Mainnet:

| Contract / Asset | Address | Explorer Link |
| :--- | :--- | :--- |
| **AgentFloatHook** | `0x5Ba6671e8219C34edA373BF95895306929174580` | [OKLink](https://www.oklink.com/xlayer/address/0x5Ba6671e8219C34edA373BF95895306929174580) |
| **FloatVault** | `0xbF06de108735332D1EDb81C7A77A750DD428a6f4` | [OKLink](https://www.oklink.com/xlayer/address/0xbF06de108735332D1EDb81C7A77A750DD428a6f4) |
| **FlapYieldTaxVaultFactory** | `0x87D665B83557365ADf320a439B8a2DFD03c024F8` | [OKLink](https://www.oklink.com/xlayer/address/0x87D665B83557365ADf320a439B8a2DFD03c024F8) |
| **IdleStrategy** (ID 1) | `0xf292e500459393F5CfaF8fbccFe1426bC3495EEb` | [OKLink](https://www.oklink.com/xlayer/address/0xf292e500459393F5CfaF8fbccFe1426bC3495EEb) |
| **AaveStrategy** (ID 4, ACTIVE) | `0xB433487F82572FF201A2455BF7a06325a7B8bFEa` | [OKLink](https://www.oklink.com/xlayer/address/0xB433487F82572FF201A2455BF7a06325a7B8bFEa) |
| **USDC/USDT0 (underlying)** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | [OKLink](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736) |
| **Uniswap v4 PoolManager (canonical)** | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | [OKLink](https://www.oklink.com/xlayer/address/0x360e68faccca8ca495c1b759fd9eee466db9fb32) |

> Strategy IDs 2 (`0x4C109f12…`, prior AaveStrategy) and 3 (`MockYieldStrategy`) are retired shadows. ID 2 was superseded by ID 4 after a security pass added an `onlyVault` guard to all strategy entry points; pooled capital was migrated to ID 4 trustlessly via the on-chain `promote()` path. The mainnet active strategy (ID 4) is the real, hardened Aave V3 integration.

**Live yield — verifiable on-chain right now:**
The active AaveStrategy holds a real interest-bearing **aUSDT** position supplied to Aave V3. Query on chain 196:
`aUSDT.balanceOf(0xB433487F82572FF201A2455BF7a06325a7B8bFEa)` → non-zero, growing block-by-block.
aUSDT token: `0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297`

---

## 💡 Simple Pitch

### The Problem
Concentrated liquidity (Uniswap v4) is highly efficient, but has a major drawback: when the pool price moves out of an LP's specified range, their capital sits completely idle and earns zero trading fees. This creates massive capital inefficiency for LPs and pool operators alike.

### The AgentFloat Solution
AgentFloat is a Uniswap v4 Hook that keeps pool capital productive. 
* **Out-of-Range Sweeps:** When liquidity becomes out-of-range, the Hook (`afterModifyLiquidity`) automatically routes the idle capital into the `FloatVault` to generate yield in an active strategy (Aave V3).
* **JIT (Just-In-Time) Recall:** Normally, when a large position goes out-of-range, liquidity depth collapses and the pool's effective spread widens—allowing arbitrageurs to exploit it before rebalancers can respond. AgentFloat's Hook solves this. The moment a swap comes in that requires the liquidity, the Hook's `beforeSwap` method instantly recalls the capital back into the pool just-in-time, restoring full depth and tight spreads. LPs capture yield while waiting, and traders experience zero execution delay.
* **Self-Improving AI Loop:** An off-chain AI agent continuously tests alternative "shadow" yield strategies. If a shadow strategy beats the active baseline over consecutive blocks, its win counter increases.
* **Trustless Promotion:** Once a strategy is proven on-chain, anyone can trustlessly call `promote()` to migrate the entire pooled capital to the new strategy.

**"The AI thinks; the chain decides what touches real capital."**

---

## 🔍 Scoring Criteria Alignment

### 1. Hook Relevance
Could this have been built as a normal vault without a Uniswap v4 Hook? 
**No.** The Hook is a native extension that lets AgentFloat intercept transactions at the pool execution layer. When price moves out of range, depth collapses and the spread widens. By intercepting swap execution, our Hook dynamically recalls capital to the pool just-in-time (JIT recall) before the swap executes, instantly restoring depth and protecting the pool from arbitrage exploitation. Using EIP-1153 transient storage, we cache parked amounts within the swap lifecycle to achieve ultra-optimized gas profiles.

### 2. Innovation
Instead of hardcoding a static routing path, AgentFloat introduces a self-improving strategy layer:
* **Separation of Concerns:** The AI proposes strategies, but on-chain promotion rules (based on consecutive win epochs) act as the final gatekeeper.
* **Risk-Bounded Autonomy:** The AI cannot deploy arbitrary execution logic on mainnet (which requires human admin sign-off). It can only suggest parameter variants and register/retire shadow paths, ensuring complete fund safety.

### 3. Market Potential
* **For LPs & Pool Launchers:** Maximizes yield on idle assets.
* **Flap Protocol Integration:** Flap token creators collect transaction taxes that typically sit idle in contract balances. We deployed `FlapYieldTaxVaultFactory` to automatically generate yield-bearing tax vaults, routing those idle collections directly into Aave V3 via `FloatVault` and enhancing utility for the entire Flap token launch ecosystem.

### 4. Completion
13/13 Forge tests pass, including end-to-end integration flows and a strategy-drain access-control regression test. Active daemon runs on X Layer Mainnet, actively scoring strategies, posting scores, and parsing obsidian specs.
