---
name: agentfloat-strategy-mock-yield
strategy_id: 3
contract_address: "0x5954F08A3EFFaa1598ED13a594E7F5cF2657d4fc"
network: x-layer-mainnet
chain_id: 196
status: retired
is_shadow: false
expected_apy_bps: 200
risk_profile: simulated
paused: true
description: Test strategy that accrues simulated yield at a fixed rate per block. For testing the scoring + promotion loop. Not a real DeFi integration.
---

# Mock Yield Strategy

Accrues simulated yield at a configurable rate per block. Used to validate the promotion loop end-to-end without external protocol dependencies.

## Yield mechanism
- On deposit, records `block.number` and `amount`
- `currentValue()` returns `amount + (block.number - depositBlock) * RATE_PER_BLOCK_BPS * amount / 10000`
- `RATE_PER_BLOCK_BPS` is a constructor parameter (default: 2 bps per block)
