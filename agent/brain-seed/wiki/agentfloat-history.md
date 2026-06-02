# AgentFloat — Operational History

> LLM-maintained by the consolidator. Edits will be overwritten on next run.
> Last consolidated: 2026-06-02 13:40:04 UTC
> Coverage: 2026-05-27 14:41:11 UTC → 2026-06-02 13:40:04 UTC
> Score entries analyzed: 24116
> Scoring rules source: /Users/gadgetplug/brain/wiki/agentfloat-scoring.md

## Summary

- Total strategies tracked: **4** (2 eligible, 1 paused, 1 retired)
- Total epochs scored: **24116**
- Promotions executed: **1**

## Strategy Performance

### agentfloat-strategy-idle (id=1)

- **Brain spec:** `~/brain/skills/agentfloat-strategies/idle-strategy.md`
- **Status:** shadow
- **Contract:** `0xf292e500459393F5CfaF8fbccFe1426bC3495EEb`
- **First observed:** 2026-05-27 14:41:11 UTC
- **Last observed:** 2026-06-02 13:39:55 UTC
- **Observations:** 6507
- **Score mean:** 2050 μbps (σ=4037, min=0, max=10000)
- **Time as active:** 0 epochs · **as shadow:** 6507 epochs
- **Shadow win rate vs active:** 0.0% (1/6492)

### Aave V3 Yield Strategy (id=2)

- **Brain spec:** _missing — anomaly_
- **First observed:** 2026-05-27 14:41:16 UTC
- **Last observed:** 2026-06-02 13:39:57 UTC
- **Observations:** 6501
- **Score mean:** 2886 μbps (σ=4531, min=0, max=10000)
- **Time as active:** 1876 epochs · **as shadow:** 4625 epochs
- **Shadow win rate vs active:** 0.0% (0/4616)

### agentfloat-strategy-mock-yield (id=3)

- **Brain spec:** `~/brain/skills/agentfloat-strategies/mock-yield-strategy.md`
- **Status:** retired · ⏸ paused
- **Contract:** `0x5954F08A3EFFaa1598ED13a594E7F5cF2657d4fc`
- **First observed:** 2026-05-27 14:41:20 UTC
- **Last observed:** 2026-06-02 13:40:01 UTC
- **Observations:** 6492
- **Score mean:** 580503 μbps (σ=369301, min=10000, max=1040327)
- **Time as active:** 0 epochs · **as shadow:** 6492 epochs
- **Shadow win rate vs active:** 79.5% (5160/6489)

### agentfloat-strategy-aave-yield (id=4)

- **Brain spec:** `~/brain/skills/agentfloat-strategies/aave-strategy.md`
- **Status:** active
- **Contract:** `0xB433487F82572FF201A2455BF7a06325a7B8bFEa`
- **First observed:** 2026-05-28 23:00:08 UTC
- **Last observed:** 2026-06-02 13:40:04 UTC
- **Observations:** 4616
- **Score mean:** 10000 μbps (σ=0, min=9999, max=10000)
- **Time as active:** 4616 epochs · **as shadow:** 0 epochs
- **Shadow win rate vs active:** n/a (0/0)

## Promotion Timeline

| Date | From | To | Δ Score (μbps) | Consecutive | Tx |
|------|------|----|----|----|----|
| 2026-05-26 | [1] Idle USDC Strategy | [2] Mock Yield Strategy | 16410 | 5 | [`0x578b39a3…`](https://www.oklink.com/xlayer/tx/0x578b39a3e16e1143de44e3400d3c349183cf603e5646f3c8d77bbabc8f0c98cc) |

## Patterns Observed

- Strategy 1 (agentfloat-strategy-idle) is the baseline floor (risk_profile=zero) — low win rate is expected behavior.
- Strategy 2 (Aave V3 Yield Strategy) wins only 0% of head-to-head epochs — consider retiring.
- 1 promotion(s) executed. Latest: Mock Yield Strategy on 2026-05-26.

## Anomalies & Review Items

- ⚠️  Strategy 2 (Aave V3 Yield Strategy) has no brain spec at ~/brain/skills/agentfloat-strategies/.

## System Health

- Agent is active — last score 0 minutes ago.
- Strategy 3 (agentfloat-strategy-mock-yield) is paused per brain spec.

---

## How this article is generated

The consolidator (`agent/src/consolidator.ts`) reads:
- Raw score log: `~/brain/raw/agentfloat-strategy-scores.md`
- Promotion events: `~/brain/journal/*.md`
- Strategy specs: `~/brain/skills/agentfloat-strategies/*.md`
- Scoring rules: `~/brain/wiki/agentfloat-scoring.md`

Run: `cd ~/Documents/vibecoding/agentfloat-hook/agent && npm run consolidate`

_See also: [[AGENTFLOAT]], [[agentfloat-scoring]]_