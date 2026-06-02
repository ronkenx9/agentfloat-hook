# AgentFloat — Scoring Methodology

The off-chain brain agent scores each registered strategy at a fixed epoch cadence. Active and shadow strategies are scored against the same conditions; only the active strategy holds real capital.

## Score formula

```
score = base_yield_score
      - recall_latency_penalty
      - drawdown_penalty
      + adaptive_bonus
```

### Components

**`base_yield_score`** — Realized return per epoch.
- Active strategy: `(currentValue - totalDeposited) / totalDeposited * 1e6`
- Shadow strategy: same formula, but `currentValue` is simulated against the active strategy's input cashflows
- Unit: micro-basis points (1e6 = 100%)

**`recall_latency_penalty`** — Cost of slow withdrawals on JIT recall.
- Measured as blocks between `withdraw()` call and funds available
- Penalty: `latency_blocks * 10` (μbps)
- Caps at 5000 μbps per epoch

**`drawdown_penalty`** — Worst peak-to-trough over the epoch.
- Computed from `currentValue()` samples at every event
- Penalty: `max_drawdown_bps * 100` (μbps)

**`adaptive_bonus`** — Reward for strategies whose performance is stable across market conditions.
- Computed as inverse coefficient of variation over rolling 50 epochs
- Bonus: `1000 / (cv * 100)` (μbps), capped at 2000

## Epoch cadence

- Default epoch: **5 minutes** (~25 blocks on Ethereum, ~150 on X Layer)
- Configurable via `EPOCH_DURATION_SECONDS` in `~/brain/projects/AGENTFLOAT.md` config block
- Score is computed and written at the end of each epoch

## Promotion thresholds

A shadow strategy is promoted when:

1. Its score has exceeded the active strategy's score by ≥ `MIN_DELTA_BPS` (default: 10 bps = 100,000 μbps)
2. For ≥ `MIN_EPOCHS_CONSECUTIVE` consecutive epochs (default: 5)
3. AND the shadow has accumulated ≥ `MIN_OBSERVATIONS` total scoring events (default: 20)

All three must be true simultaneously. If any breaks, the counter resets.

## Demotion

Active strategy is **never** automatically demoted to shadow. The only path out of `active` is to be replaced by a promoted shadow. This is a deliberate constraint — flipping back and forth is worse than stale.

## Anti-promotion guards

The agent will refuse to call `promote()` if:
- The shadow strategy's `currentValue()` reverts in any of the last 3 calls
- The shadow's score has dropped by > 50% in the last 2 epochs (unstable)
- The active strategy has held position for < 100 epochs (too young to replace)
- The shadow has a `paused` flag in its brain skill spec

## What gets written where

| Layer | File | Frequency |
|-------|------|-----------|
| Raw score log | `~/brain/raw/agentfloat-strategy-scores.md` | Every epoch |
| Promotion events | `~/brain/journal/YYYY-MM-DD.md` | On promotion |
| Pattern summary | `~/brain/wiki/agentfloat-history.md` | Weekly consolidation |
| Strategy specs | `~/brain/skills/agentfloat-strategies/*.md` | Manual + on registration |

## How to change scoring

Scoring rules live in this file. To change them:
1. Edit the `<!-- config -->` JSON block below
2. The agent re-reads on every epoch — no restart needed
3. Document the change in today's journal

Do not hardcode scoring in TypeScript. The brain is the source of truth.

## Machine-readable config

The agent parses the JSON block below. Keys that are not listed fall back to defaults in `agent/src/brain.ts`.

<!-- config
{
  "epochDurationSeconds": 300,
  "minDeltaBps": 10,
  "minEpochsConsecutive": 5,
  "minObservations": 20,
  "maxActiveAgeForReplacementEpochs": 100,
  "maxShadowDropPercent": 50,
  "maxRevertCount": 3,
  "recallLatencyPenaltyCap": 5000,
  "consolidateEveryEpochs": 50,
  "orchestrateEveryEpochs": 600
}
-->

### Tunable summary

| Key | Default | Meaning |
|-----|---------|---------|
| `epochDurationSeconds` | 300 | Target time per scoring epoch (used downstream for cadence math) |
| `minDeltaBps` | 10 | Shadow must beat active by this margin to count as a win |
| `minEpochsConsecutive` | 5 | Wins required in a row before promotion fires |
| `minObservations` | 20 | Minimum total observations before any promotion is allowed |
| `maxActiveAgeForReplacementEpochs` | 100 | Active strategy must hold for this long before being replaceable |
| `maxShadowDropPercent` | 50 | If a shadow drops by this % in 2 epochs, it's considered unstable |
| `maxRevertCount` | 3 | Reverts allowed before promotion is blocked |
| `recallLatencyPenaltyCap` | 5000 | μbps cap on the latency penalty |
| `consolidateEveryEpochs` | 50 | How often the watcher refreshes `agentfloat-history.md` |
| `orchestrateEveryEpochs` | 600 | How often the orchestrator (Groq llama-3.3) reads brain + writes a proposal (~hourly at 5s poll) |

_See also: [[AGENTFLOAT]], [[multi-agent-shared-memory]]_
