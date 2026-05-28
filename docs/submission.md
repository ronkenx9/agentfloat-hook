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
| **AaveStrategy** (ID 2, ACTIVE) | `0x4C109f12d2FA55037439b73CE4E9Ee2C1e1656E1` | [OKLink](https://www.oklink.com/xlayer/address/0x4C109f12d2FA55037439b73CE4E9Ee2C1e1656E1) |
| **USDC/USDT0 (underlying)** | `0x779Ded0c9e1022225f8E0630b35a9b54bE713736` | [OKLink](https://www.oklink.com/xlayer/address/0x779Ded0c9e1022225f8E0630b35a9b54bE713736) |
| **Uniswap v4 PoolManager (canonical)** | `0x360e68faccca8ca495c1b759fd9eee466db9fb32` | [OKLink](https://www.oklink.com/xlayer/address/0x360e68faccca8ca495c1b759fd9eee466db9fb32) |

> A third strategy, `MockYieldStrategy` (`0x5954F08A…`), exists for the testnet promotion-loop demo and is retired on mainnet. The mainnet active strategy is the real Aave V3 integration.

**Live yield — verifiable on-chain right now:**
The active AaveStrategy holds a real interest-bearing **aUSDT** position supplied to Aave V3. Query on chain 196:
`aUSDT.balanceOf(0x4C109f12d2FA55037439b73CE4E9Ee2C1e1656E1)` → non-zero, growing block-by-block.
aUSDT token: `0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297`

---

## 💡 Simple Pitch

### The Problem
Concentrated liquidity (Uniswap v4) is highly efficient, but has a major drawback: when the pool price moves out of an LP's specified range, their capital sits completely idle and earns zero trading fees. This creates massive capital inefficiency for LPs and pool operators alike.

### The AgentFloat Solution
AgentFloat is a Uniswap v4 Hook that keeps pool capital productive. 
* **Out-of-Range Sweeps:** When liquidity becomes out-of-range, the Hook (`afterModifyLiquidity`) automatically routes the idle capital into the `FloatVault` to generate yield in an active strategy (Aave V3).
* **JIT (Just-In-Time) Recall:** The moment a swap comes in that requires the liquidity, the Hook's `beforeSwap` method instantly pulls the capital back into the pool. Traders experience zero execution delay, and LPs capture yield while waiting.
* **Self-Improving AI Loop:** An off-chain AI agent continuously tests alternative "shadow" yield strategies. If a shadow strategy beats the active baseline over consecutive blocks, its win counter increases.
* **Trustless Promotion:** Once a strategy is proven on-chain, anyone can trustlessly call `promote()` to migrate the entire pooled capital to the new strategy.

**"The AI thinks; the chain decides what touches real capital."**

---

## 🔍 Scoring Criteria Alignment

### 1. Hook Relevance
Could this have been built as a normal vault without a Uniswap v4 Hook? 
**No.** The Hook is a native extension that lets AgentFloat intercept transactions at the pool execution layer. This allows the protocol to dynamically shift capital between active yield strategies and the pool based on real-time swap demand (JIT recall). Using EIP-1153 transient storage, we cache parked amounts within the swap lifecycle to achieve ultra-optimized gas profiles.

### 2. Innovation
Instead of hardcoding a static routing path, AgentFloat introduces a self-improving strategy layer:
* **Separation of Concerns:** The AI proposes strategies, but on-chain promotion rules (based on consecutive win epochs) act as the final gatekeeper.
* **Risk-Bounded Autonomy:** The AI cannot deploy arbitrary execution logic on mainnet (which requires human admin sign-off). It can only suggest parameter variants and register/retire shadow paths, ensuring complete fund safety.

### 3. Market Potential
* **For LPs & Pool Launchers:** Maximizes yield on idle assets.
* **Flap Protocol Integration:** Flap token creators collect transaction taxes that typically sit idle in contract balances. We deployed `FlapYieldTaxVaultFactory` to automatically generate yield-bearing tax vaults, routing those idle collections directly into Aave V3 via `FloatVault` and enhancing utility for the entire Flap token launch ecosystem.

### 4. Completion
12/12 Forge tests pass, including end-to-end integration flows. Active daemon runs on X Layer Mainnet, actively scoring strategies, posting scores, and parsing obsidian specs.
