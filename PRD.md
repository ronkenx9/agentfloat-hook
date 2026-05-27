# AgentFloat Hook — Build PRD

## Context for the building agent

You are building a submission for the **Hook the Future** hackathon (OKX/X Layer + Uniswap + Flap). Deadline: **2026-05-28 23:59 UTC** — roughly 48 hours from now. Quality and a working demo matter more than feature breadth.

Project context lives at `~/brain/projects/AGENTFLOAT.md`. Read it first.

## CRITICAL: Use the official Uniswap AI skills

The project workspace has 11 official Uniswap skills pre-installed at `.agents/skills/`. **Use these — do not write hooks from scratch.** The relevant ones for this build:

| Skill | When to use |
|-------|-------------|
| `v4-hook-generator` | Generate the hook contract via OpenZeppelin MCP — use this FIRST to scaffold `AgentFloatHook.sol` |
| `v4-security-foundations` | Run IMMEDIATELY after hook generation to audit permissions, delta accounting, access control. Mandatory. |
| `v4-sdk-integration` | For wiring the off-chain agent to v4 |
| `viem-integration` | For the brain agent (`agent/src/`) — use this stack |
| `deployer` | For deploy scripts |
| `liquidity-planner` | For detecting out-of-range LP positions |
| `swap-planner` | For JIT recall logic in `beforeSwap` |
| `configurator` | For hook permission config |

The skills are universal — they work in Antigravity, Codex, Gemini CLI, Claude Code, and 8 others.

**Build order with skills:**
1. Invoke `v4-hook-generator` → scaffold `AgentFloatHook.sol` with the right permissions for our case (afterAddLiquidity + beforeSwap)
2. Invoke `v4-security-foundations` → audit the generated hook
3. Use `configurator` → set hook flags correctly
4. Use `deployer` → deploy script generation
5. Use `viem-integration` → off-chain brain agent
6. Use `liquidity-planner` + `swap-planner` → logic for range detection and recall

## What you're building

A Uniswap v4 hook + yield vault system on X Layer testnet where:

1. Out-of-range LP USDC flows from the pool into a vault via the hook
2. The vault runs **multiple yield strategies** in parallel — one `active` (deploys real funds), others `shadow` (simulated against the same conditions but with no real capital)
3. An **off-chain brain agent** scores shadow strategies on rolling windows and writes scores to a journal file
4. When a shadow strategy beats the active one for N epochs, the agent calls `promote()` on-chain and the shadow becomes the new active strategy
5. The brain keeps testing new variants in parallel

Tagline: **"Yield routing that learns and ships its own upgrades."**

---

## Repository structure to create

```
agentfloat-hook/
├── PRD.md                     # this file
├── README.md                  # public-facing project description
├── contracts/                 # Foundry project
│   ├── foundry.toml
│   ├── remappings.txt
│   ├── lib/
│   │   ├── openzeppelin-contracts/
│   │   ├── v4-core/
│   │   └── v4-periphery/
│   ├── src/
│   │   ├── AgentFloatHook.sol
│   │   ├── FloatVault.sol
│   │   ├── interfaces/
│   │   │   └── IStrategy.sol
│   │   └── strategies/
│   │       ├── IdleStrategy.sol
│   │       └── MockYieldStrategy.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── test/
│       ├── AgentFloatHook.t.sol
│       └── FloatVault.t.sol
├── agent/                     # off-chain brain agent
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts           # entry point
│       ├── watcher.ts         # listens to vault events
│       ├── scorer.ts          # scores shadow strategies
│       ├── promoter.ts        # calls promote() when threshold met
│       └── config.ts
├── web/                       # demo dashboard (single-page Next.js or even static)
│   ├── package.json
│   └── src/
│       └── app/
│           └── page.tsx       # live vs shadow strategy comparison
├── docs/
│   ├── architecture.md
│   └── submission.md          # final submission text + links
└── .env.example
```

---

## Contract specifications

### `IStrategy.sol`

```solidity
interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external returns (uint256 actualOut);
    function currentValue() external view returns (uint256);
    function asset() external view returns (address);
    function name() external view returns (string memory);
}
```

### `FloatVault.sol`

Extend the existing FloatVault at `~/Documents/vibecoding/float-yield-router/contracts/contracts/FloatVault.sol` (61 lines) with:

```solidity
struct StrategyEntry {
    address strategy;       // address of IStrategy implementation
    bool isActive;
    bool isShadow;
    uint256 totalDeposited; // tracked separately from real deposits
    uint256 lastScore;      // last score posted by the brain agent
    uint256 lastScoreAt;
}

mapping(uint256 => StrategyEntry) public strategies;
uint256 public activeStrategyId;
uint256 public strategyCount;

address public promoter;  // address authorized to call promote()

event StrategyRegistered(uint256 indexed id, address strategy, string name);
event StrategyPromoted(uint256 indexed fromId, uint256 indexed toId, uint256 atBlock);
event ScoreUpdated(uint256 indexed strategyId, uint256 score, uint256 epoch);

function registerStrategy(address strategy, bool asShadow) external onlyOwner returns (uint256 id);
function postScore(uint256 strategyId, uint256 score) external;  // callable only by promoter
function promote(uint256 strategyId) external;                    // callable only by promoter
function park(uint256 amount) external;                            // unchanged, but routes to activeStrategyId
function withdraw(uint256 amount) external;                        // unchanged, but pulls from activeStrategyId
```

**Promotion logic:** when `promote(id)` is called, the vault should:
1. Withdraw all funds from current active strategy
2. Deposit them into the new active strategy
3. Update `activeStrategyId`
4. Emit `StrategyPromoted` event

### `AgentFloatHook.sol`

A minimal Uniswap v4 hook:

```solidity
import {BaseHook} from "v4-periphery/utils/BaseHook.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract AgentFloatHook is BaseHook {
    FloatVault public immutable vault;
    
    constructor(IPoolManager _poolManager, FloatVault _vault) BaseHook(_poolManager) {
        vault = _vault;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,        // detect range, route idle
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: true,
            beforeSwap: true,                // JIT recall on swap
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    // implement _afterAddLiquidity: if position is out of range, pull idle USDC into vault.park()
    // implement _beforeSwap: if swap moves price back into LP range, call vault.withdraw() for JIT
}
```

**Note:** The actual mechanics of detecting out-of-range LP and routing USDC are non-trivial in v4 due to flash accounting. For the MVP, **stub the logic with a clear comment** if full implementation isn't feasible in 48h. The judges should see the architecture clearly even if the exact accounting is simplified.

### `IdleStrategy.sol` and `MockYieldStrategy.sol`

- `IdleStrategy` — just holds USDC, `currentValue()` returns raw balance. Baseline.
- `MockYieldStrategy` — accrues simulated yield at N bps per block (use `block.number` since last update). For the demo, this represents what a real yield protocol would do.

Both implement `IStrategy`.

---

## Off-chain brain agent (`agent/`)

A Node/TypeScript long-running script. Stack: `viem` for RPC, `dotenv` for config, plain Node for file writes.

### `agent/src/index.ts`

Entry point. Starts the watcher loop.

### `agent/src/watcher.ts`

- Connects to X Layer testnet RPC
- Listens to `FloatVault` events: `Parked`, `Withdrawn`, `ScoreUpdated`
- On each event, fetches current state and triggers scoring

### `agent/src/scorer.ts`

For each registered strategy (active + shadow):
- Compute `score = currentValue / totalDeposited` (simple yield ratio)
- Optional: penalize for high recall latency (track via block delta on `Withdrawn`)
- Append a line to `~/brain/raw/agentfloat-strategy-scores.md`:
  ```
  [2026-05-27 14:32:01] epoch=42 strategy=1 (MockYield) score=10042 active=true
  [2026-05-27 14:32:01] epoch=42 strategy=2 (IdleStrategy) score=10000 active=false
  ```
- Call `postScore(strategyId, score)` on the vault for each strategy

### `agent/src/promoter.ts`

- Tracks rolling N-epoch performance per strategy
- If a shadow strategy beats the active strategy by `MIN_DELTA_BPS` for `MIN_EPOCHS` consecutive epochs, calls `vault.promote(shadowId)`
- Logs the promotion to `~/brain/journal/YYYY-MM-DD.md`

### `agent/src/config.ts`

```typescript
export const CONFIG = {
  rpcUrl: process.env.X_LAYER_RPC_URL!,
  vaultAddress: process.env.VAULT_ADDRESS! as `0x${string}`,
  hookAddress: process.env.HOOK_ADDRESS! as `0x${string}`,
  promoterPrivateKey: process.env.PROMOTER_PRIVATE_KEY!,
  pollIntervalMs: 5000,
  minEpochsToPromote: 5,
  minDeltaBps: 10,
};
```

---

## Demo dashboard (`web/`)

A single Next.js page (App Router) showing:

- Vault total deposits
- Current active strategy: name, current value, total deposited
- Shadow strategies: name, simulated current value, score delta vs active, "would be promoted in X more epochs" counter
- Recent events feed (Parked, Withdrawn, ScoreUpdated, StrategyPromoted) — last 20
- Reads directly from X Layer testnet via viem; no backend needed

Style: clean, editorial, near-cream background (`#F4F0E8`), JetBrains Mono for numbers, no animations. Lean on the same aesthetic as the Claude portfolio at `~/Documents/vibecoding/portfolio-redesign/claude/index.html`.

---

## Deployment & submission

### Deploy script (`contracts/script/Deploy.s.sol`)

Foundry script that:
1. Deploys `FloatVault` with placeholder USDC address (or a mock USDC if X Layer doesn't have native USDC)
2. Deploys `IdleStrategy` + `MockYieldStrategy`
3. Registers both with the vault (Idle as active, MockYield as shadow)
4. Deploys `AgentFloatHook` with the correct hook permission flags encoded in the address (use `HookMiner` from v4-periphery)
5. Outputs all addresses to `deployments/x-layer-testnet.json`

### `.env.example`

```
X_LAYER_RPC_URL=
X_LAYER_CHAIN_ID=
DEPLOYER_PRIVATE_KEY=
PROMOTER_PRIVATE_KEY=
USDC_ADDRESS=
POOL_MANAGER_ADDRESS=
```

### Open question for builder

**Check whether X Layer has Uniswap v4 PoolManager deployed.** If not, deploy a fresh PoolManager from `v4-core` as part of the deploy script. Document the address.

### Submission checklist

In `docs/submission.md`:
- [ ] Contract addresses table
- [ ] X Layer explorer links for each
- [ ] Demo video link (90 sec, YouTube unlisted is fine)
- [ ] Landing page URL (Vercel deploy)
- [ ] Twitter thread URL (tagging `@XLayerOfficial`, `@Uniswap`, `@flapdotsh`)
- [ ] GitHub repo (this directory pushed to github.com/ronkenx9/agentfloat-hook)
- [ ] One-line description for the Google Form

---

## Build order (suggested)

1. **Hour 0–4** — Foundry init, install v4-core + v4-periphery as submodules, write `IStrategy` + `IdleStrategy` + `MockYieldStrategy`, basic Forge tests
2. **Hour 4–10** — `FloatVault` v2 with strategy registry, promotion logic, full Forge test coverage
3. **Hour 10–18** — `AgentFloatHook` skeleton, hook permissions, deploy script with HookMiner, deploy to X Layer testnet
4. **Hour 18–26** — Off-chain brain agent (`agent/`), watcher + scorer + promoter loops, test against live testnet contracts
5. **Hour 26–34** — Demo dashboard (`web/`), Vercel deploy
6. **Hour 34–42** — Demo video, tweet thread, landing copy, submission form
7. **Hour 42–48** — Buffer for fixes, polish, deployment retries

---

## Constraints & non-negotiables

- **No new untested ideas during build.** If something in the architecture turns out to be infeasible, stub it with a clear comment and document the limitation — don't pivot mid-build.
- **Demo must work end-to-end.** A non-running demo loses to a simpler running demo.
- **Test the hook deployment early.** Hook address mining can take time; do it in hour 4, not hour 40.
- **Keep the strategy interface narrow.** Two strategies (Idle + MockYield) is enough to tell the story. Don't add a third.
- **No Mantle, no Pharos, no Swarms.** This is X Layer only. Ship one thing well.

---

## Definition of success

The submission is a winner if:
- The demo video clearly shows: LP capital → vault → live strategy → shadow strategy scoring → automatic promotion
- A judge can read the README and understand the system in 60 seconds
- The contracts compile, deploy, and the `promote()` flow has been executed at least once on testnet
- The Twitter thread frames it as "yield routing that learns" — not just another yield hook

That's the bar. Anything beyond that is bonus.
