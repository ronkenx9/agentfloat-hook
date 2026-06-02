---
name: agentfloat-strategy-aave-yield
strategy_id: 4
contract_address: "0xB433487F82572FF201A2455BF7a06325a7B8bFEa"
network: x-layer-mainnet
chain_id: 196
status: active
is_shadow: false
expected_apy_bps: 317
risk_profile: low
paused: false
description: Real Aave V3 yield integration strategy. Interacts with the Aave V3 POOL contract on X Layer Mainnet. Earns real yield in USD₮0 when active, and simulates yield dynamically using Aave's liquidityIndex when in shadow mode.
---

# Aave V3 Yield Strategy

An integration strategy that deposits underlying USD₮0 into the Aave V3 lending market on X Layer Mainnet.

## Yield mechanism
- On deposit, supplies USD₮0 to Aave Pool `0xE3F3Caefdd7180F884c01E57f65Df979Af84f116` and gains interest-bearing `aUSD₮0` tokens (`0xF356ae412dB5df43BD3a10746f7ad4e1C4De4297`).
- **Simulated Shadow Yield**: When in shadow mode, currentValue is calculated dynamically:
  `currentValue = (storedBalance * currentLiquidityIndex) / lastLiquidityIndex`
  where `liquidityIndex` is queried directly from Aave's `getReserveData()` on-chain. This provides mathematically perfect shadow simulation without locking up actual capital.

## Score behavior
- `base_yield_score` reflects the real-time supply rate of the Aave V3 market on X Layer (currently around 3.17% APY).
- `recall_latency_penalty` = 0 (withdrawals are instant subject to reserve pool liquidity).
- `drawdown_penalty` = 0 (Aave deposits are principal-protected).
