# AgentFloat — 90-Second Demo Script

**Target length:** 75–90 seconds
**Aspect ratio:** 16:9, 1920×1080
**Audio:** Voiceover only (measured, calm, fact-led)

---

## Shot 1 (0:00–0:15) — The Hook & JIT Recall

**On screen:** Uniswap v4 pool interface. Zoom in on an "out of range" concentrated liquidity position. Transition to a clean animation of the Hook routing out-of-range capital to Aave V3, then instantly returning it on a swap.

**Voiceover:**
> "Concentrated liquidity is highly efficient, but when price moves out of range, LP capital sits idle. AgentFloat is a Uniswap v4 Hook that solves this. It sweeps out-of-range capital to earn Aave V3 yield, and recalls it inside the swap path before execution. LP capital earns while it waits, and the pool stays ready for real swap demand."

---

## Shot 2 (0:15–0:30) — Flap Ecosystem Integration

**On screen:** Cut to the Flap tax vault interface. Show the custom tax vault deploying via `FlapYieldTaxVaultFactory` on X Layer Mainnet, routing USDT0 taxes directly to the `FloatVault`.

**Voiceover:**
> "We also integrated with the Flap token launchpad. Instead of token transaction taxes sitting idle in creator contracts, our custom Flap Yield Tax Vault sweeps quote tokens directly to the yield vault, putting idle ecosystem capital to work."

---

## Shot 3 (0:30–0:50) — The AI Strategy Loop

**On screen:** Cut to the dashboard's "Strategy Race" showing the active Aave strategy in gold, and shadow strategies below it. Open the proposals feed showing recent strategy proposals.

**Voiceover:**
> "To optimize yield, the vault runs multiple strategies in parallel. One earns real money. The others are shadow strategies tested side-by-side. Every hour, our off-chain AI reads the system's own performance history and proposes strategy parameter variants using Groq's llama three point three."

---

## Shot 4 (0:50–1:10) — Safety & On-Chain Promotion

**On screen:** Split screen. Left: A pending proposal markdown file. Right: The on-chain win counter ticking up to 5/5. Trigger a promotion transaction on-chain.

**Voiceover:**
> "But the AI cannot touch real capital. The AI thinks, but the chain decides. Only strategies that win over consecutive evaluation epochs on-chain can be promoted. Once a strategy proves itself, anyone can trustlessly call the promotion transaction to redeploy the pooled vault assets."

---

## Shot 5 (1:10–1:30) — Close & Mainnet Proof

**On screen:** AgentFloat brand mark on cream background, displaying:
* **Hook Address:** `0x5Ba6671e8219C34edA373BF95895306929174580`
* **Vault Address:** `0xbF06de108735332D1EDb81C7A77A750DD428a6f4`
* **GitHub:** `github.com/ronkenx9/agentfloat-hook`

**Voiceover:**
> "AgentFloat is verified and live on X Layer Mainnet. Yield routing that learns and ships its own upgrades. Built for Hook the Future on X Layer."
