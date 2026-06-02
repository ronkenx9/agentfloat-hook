---
proposed_at: '2026-06-01T12:20:18.594Z'
model: llama-3.3-70b-versatile
action_type: parameter_variant
status: rejected_by_rule
headline: 4bps MockYield
decided_at: '2026-06-01T12:20:32.049Z'
decided_by: approver
decision_reason: >-
  action_type "parameter_variant" not in chain_actions_allowed for chain 196
  (mainnet bounds AI to library register/retire/scoring)
---

# 4bps MockYield

## Reasoning
The previous proposal to retire id=3 was approved, and id=4 (Aave V3 Yield Strategy) has been active with a high score mean of 10000 μbps. To explore potential improvements, a new instance of MockYieldStrategy with a rate of 4bps is proposed for testing in shadow mode.

## Proposed change
Deploy a new instance of MockYieldStrategy with rate=4bps

## Expected outcome
The new strategy will be deployed in shadow mode and its performance will be evaluated against the current active strategy.

## Evidence
agentfloat-history.md and recent score samples from ~/brain/raw/agentfloat-strategy-scores.md

## Risks
As the new strategy starts in shadow mode, there is no risk to the active capital. The promoter will only consider promoting it if it outperforms the active strategy for N consecutive epochs.

---

_To approve: edit frontmatter `status: pending` → `status: approved` and (for parameter_variant) the orchestrator's deploy loop will pick it up. To reject: set `status: rejected` with a note._
