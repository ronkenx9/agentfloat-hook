# AgentFloat — Settlement-Build Hardening Spec (`0x588`)

Patterns adapted from the `uniswap-v4-hooks` security skill (igoryuzo). We took
the *ideas*, not the skill's permission-flag table — that table is bit-inverted
vs canonical v4. Our verified encoding stands: `0x580` (park/recall) →
`0x588` adds `beforeSwapReturnDelta` (`1<<3`) for settlement.

## Risk self-score (skill's 0–33 framework)

| Dimension | Score | Note |
|---|---|---|
| Code complexity | 3 | hook + vault + strategies + transient storage + AI loop |
| Custom math | 2 | AaveStrategy liquidityIndex scaling only |
| External dependencies | 2 | Aave V3 + Uniswap v4 PoolManager |
| External liquidity | 2 | pool + Aave market depth |
| TVL potential | 3 | targets idle LP capital |
| Team maturity | 1 | solo/hackathon |
| Upgradeability | 2 | hooks immutable; vault owner params; strategy swap via promote |
| Autonomous updates | 2 | AI proposes, on-chain gate promotes (bounded) |
| Price-impacting | 0 → **3** | ZERO_DELTA today; **becomes price-impacting once settlement ships** |

**Now (pre-settlement): ~17 — top of Medium.**
**Post-`0x588`: ~20 — solidly High.**

Implication (skill's tiering): shipping the settlement delta moves AgentFloat
from "1–2 audits + bug bounty recommended" to **High = 2 audits (1 math
specialist) + mandatory bug bounty + monitoring.** The `0x8` bit isn't just
code — it raises the audit bar. Budget for that before mainnet settlement.

## Inspired hardening (lands in the `0x588` rewrite)

1. **Real settlement leg.** `_beforeSwap` does proper `take`/`settle` against
   PoolManager and returns a correctly-signed `BeforeSwapDelta`, replacing the
   current `ZERO_DELTA` stub. Round against the hook, never the user.

2. **`msgSender` router pattern (replaces hookData LP decode).** Maintain a
   `trustedRouters` allowlist; resolve the real LP via `IMsgSender(sender).msgSender()`
   instead of decoding `lpProvider` from `hookData`. Fixes the `lpProvider` vs
   `sender` accounting divergence flagged in the audit — harder to spoof, and
   reverts on untrusted routers rather than silently mis-crediting.

3. **FullMath.mulDiv in AaveStrategy.** Replace `(storedBalance * currentIndex) /
   lastLiquidityIndex` with `FullMath.mulDiv`. Overflow is unrealistic at current
   scale but the skill's "never raw-multiply price math" rule is cheap insurance.

4. **Fee-on-transfer guard on park.** Wrap the `transferFrom` into the hook with
   a `balanceBefore`/`balanceAfter` check and park the *actual* received amount.
   USDT0 isn't FoT, but it makes the park path correct for any underlying.

5. **Invariant + both-direction tests.** Add `invariant_deltasBalance`
   (`currencyDelta(hook, c0/c1) == 0`), fuzz the recall amount, and test
   `zeroForOne` true *and* false. The settlement leg is where delta bugs hide.

## Already satisfied (skill checklist)

- `onlyPoolManager` on every callback — via canonical BaseHook internal-callback pattern ✓
- `nonReentrant` on vault park/withdraw/promote ✓ (prior audit)
- `onlyVault` on strategy entry points ✓ (prior audit)
- Minimal permission bits, address-verified at construction (`validateHookAddress`) ✓

## Explicitly NOT doing

- Not enabling `beforeSwapReturnDelta` until the settlement logic + tests are
  done. The bit is the rug-pull vector when the take/settle accounting is wrong;
  the envelope ships *with* the implementation, never empty.
