---
name: agentfloat-strategy-idle
strategy_id: 1
contract_address: "0xf292e500459393F5CfaF8fbccFe1426bC3495EEb"
network: x-layer-mainnet
chain_id: 196
status: shadow
is_shadow: true
expected_apy_bps: 0
risk_profile: zero
paused: false
description: Baseline strategy. Holds USDC/USDT without deploying it anywhere. currentValue() returns the raw balance. Used as the floor any other strategy must beat.
---

# Idle Strategy

The baseline. Capital sits in the vault; no protocol risk; no yield.

## When this should be active
- At system bootstrap before any other strategy has been observed long enough to promote
- During market conditions where every other registered strategy has either paused or failed safety checks
- As an emergency fallback if all shadow strategies are demoted
