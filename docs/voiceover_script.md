# AgentFloat Voiceover Script (1 Min 20 Secs)

**Target Duration:** ~80 seconds (1 minute and 20 seconds)  
**Tone:** Clear, paced, engaging, and professional.  
**Total Word Count:** 189 words (~142 words per minute reading pace)

---

### [0:00 - 0:12] Introduction
In Uniswap v4, concentrated liquidity is a game-changer. But when the market moves and an LP's position goes out of range, their capital sits completely idle, earning zero fees.

### [0:12 - 0:19] The Solution
AgentFloat fixes this inefficiency using a smart Uniswap v4 Hook.

### [0:19 - 0:34] Hook Core Mechanism: Part 1 (Sweeping)
Here is the core mechanism: When pool liquidity goes out of range, the hook automatically sweeps the idle capital into the FloatVault, where it generates yield in active strategies like Aave V3.

### [0:34 - 0:54] Hook Core Mechanism: Part 2 (Just-In-Time Recall)
But what happens when the price returns? Normally, when a large position goes out of range, liquidity depth collapses and the effective spread widens—which arbitrageurs exploit before rebalancers can respond. AgentFloat fixes this. The moment a swap is initiated, the hook instantly recalls the capital back into the pool just-in-time, restoring full depth and tight spreads.

### [0:54 - 1:07] Use Case: Ecosystem Taxes (Flap)
This mechanism also extends to launchpads like Flap. Instead of collected transaction taxes sitting idle in static treasury contracts, they are swept directly to the vault to earn yield.

### [1:07 - 1:15] Optimization Loop & Security
Under the hood, an off-chain AI suggests optimized strategy updates, but they must prove their performance on-chain before being promoted.

### [1:15 - 1:20] Call to Action
AgentFloat is live on X Layer Mainnet. Put your idle liquidity to work.
