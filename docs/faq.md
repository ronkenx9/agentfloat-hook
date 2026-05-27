# AgentFloat — Frequently Asked Questions (FAQ)

This document addresses key questions regarding the architectural design, market risks, and simulation mechanics of AgentFloat's strategy-routing engine.

---

### Q1: Since markets change constantly, what happens if a yield spike disappears before a shadow strategy completes its evaluation and gets promoted?

This is a classic problem in automated asset management known as **yield chasing and churn**. If a system migrates capital to a strategy immediately upon seeing a yield spike, it often pays high gas costs only to arrive after the rate has already normalized.

AgentFloat mitigates this risk on-chain through two key parameters in its state machine:

1. **`minDeltaBps` (Yield Delta Threshold)**: A shadow strategy must beat the active strategy's yield by a minimum margin (e.g., 10 basis points or 0.1% APY equivalent) to justify the transaction costs of promotion.
2. **`minEpochsConsecutive` (Consistent Evaluation Window)**: The shadow strategy must consistently outperform the active strategy for a consecutive number of blocks (epochs) before it can be promoted.

**The Reset Mechanic**:
If a shadow strategy is on Block 4 of its evaluation and the yield spike decays—dropping its yield below the active baseline + `minDeltaBps`—the on-chain `consecutiveWins` counter for that strategy **instantly resets to `0`**. 

This temporal filter ensures that capital is only migrated for **sustained, structurally superior yields**, and not short-term noise.

---

### Q2: What exactly are these strategies in a production deployment?

In a production environment, the strategies registered in `FloatVault` are separate ERC-4626 or custom integration contracts that route deposits into active DeFi yield sources:
* **USDC Lending vault integrations** (e.g., Aave, Compound, Morpho Blue, Spark Protocol).
* **Automated Liquidity Provision** (e.g., stablecoin pegged liquidity pools on Curve or Uniswap).
* **Basis Yield / Delta-Neutral positions** (e.g., funding rate arbitrage).

All strategies conform to the simple [IStrategy.sol](file:///Users/gadgetplug/Documents/vibecoding/agentfloat-hook/contracts/src/interfaces/IStrategy.sol) interface:
```solidity
interface IStrategy {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external returns (uint256);
    function currentValue() external view returns (uint256);
    function asset() external view returns (address);
    function name() external view returns (string memory);
}
```

---

### Q3: How do shadow strategies simulate yield without real capital?

Shadow strategies are registered with `isShadow = true` in the `FloatVault` contract. They track a virtual deposit balance equal to the vault's total deposits:
* When LPs park capital via the hook, the vault updates the virtual `totalDeposited` track for **all** strategies (both active and shadow).
* When yield is scored, the off-chain brain agent queries the strategy contract's `currentValue()` function. 
* The strategy contract itself simulates yield accrual on its virtual balance based on the current market rates of its target protocol (e.g. querying Aave's current supply rate index).
* Because shadow strategies do not hold real tokens, they do not suffer from liquidity locks or impermanent loss during simulation, allowing risk-free, real-time testing of new ideas.

---

### Q4: What happens if a strategy's target protocol experiences a security exploit?

If a security exploit or systemic risk is detected in a strategy's underlying protocol:
1. **Off-Chain Trust Policy Gating**: The operator updates the strategy spec file in the Obsidian brain (e.g., setting `paused: true` or `status: retired` in the markdown frontmatter).
2. **Autonomous Rejection**: On the very next block tick, the off-chain agent reads the updated brain configuration. The promoter blocks any promotion to that strategy (`checkGuards()` returns a block reason), preventing migration.
3. **Emergency Downgrade/Promotion**: The owner or promoter can call `promote()` manually on-chain to migrate capital out of the compromised active strategy to a safe shadow strategy (such as the `IdleStrategy` which simply holds raw USDC in the vault) without waiting for the consecutive win epochs.
