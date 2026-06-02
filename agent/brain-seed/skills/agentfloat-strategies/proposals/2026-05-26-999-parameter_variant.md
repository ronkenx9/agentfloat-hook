---
proposed_at: '2026-05-26T23:50:00.000Z'
model: test-fixture
action_type: parameter_variant
status: executed
headline: 'TEST: deploy MockYieldStrategy with rate=2bps'
decided_at: '2026-05-26T23:38:31.029Z'
decided_by: approver
decision_reason: 'autonomous mode: all guardrails cleared'
executed_at: '2026-05-26T23:51:31.994Z'
executed_tx: '0x4245ab63dbd189b42bd0ba3882458ca924a777828fb60fe69b0ffa75eb5ff54e'
strategy_id: 3
deployed_address: '0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd'
---

# TEST: deploy MockYieldStrategy with rate=2bps

## Reasoning
Synthetic test fixture to verify the approver's auto-approval path for non-audit action types.

## Proposed change
Deploy a new MockYieldStrategy contract with constructor arg RATE_PER_BLOCK_BPS=2 (vs the existing instance which uses RATE_PER_BLOCK_BPS=1).

## Expected outcome
Higher yield accrual rate — should beat the existing shadow's score after ~enough blocks.

## Evidence
Test fixture — not real data.

## Risks
This is a test proposal. Should auto-approve in autonomous mode.
