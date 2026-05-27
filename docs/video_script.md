# AgentFloat — 90-Second Demo Video Script

**Duration**: 90 Seconds  
**Format**: Screencast + Voiceover

---

## Screenplay Outline

| Time | Visual on Screen | Voiceover / Audio |
|------|------------------|-------------------|
| **0:00 - 0:15** | Next.js Cream dashboard showing out-of-range state (0 deposits) | "LPs on Uniswap v4 lose out on yield when the market moves and their positions go out of range. Introducing AgentFloat: dynamic yield routing for Uniswap v4 out-of-range liquidity that learns and upgrades itself." |
| **0:15 - 0:35** | Visualizing the hook code (`afterAddLiquidity` callback) or the architecture diagram | "Using custom Uniswap v4 hook callbacks, AgentFloat automatically detects inactive positions and parks the idle USDC into a high-performance FloatVault. If the market returns, our JIT recall mechanism instantly pulls it back to settle the pool obligations." |
| **0:35 - 0:55** | Terminal window showing the TypeScript Brain Agent scoring strategies, logging yield ratios | "While real assets earn yield in the Active Strategy, the FloatVault runs multiple alternative strategies in a 'shadow simulation' mode on-chain. Our off-chain brain agent watches, scores, and logs their performance ratio continuously." |
| **0:55 - 1:15** | Terminal output showing promotion event log; Next.js dashboard updating with promoted flag status | "When a shadow strategy beats the active strategy for 5 consecutive epochs, the agent calls `promote` on-chain. Capital is migrated to the superior strategy automatically, without requiring user intervention. The agent then starts testing a new variant." |
| **1:15 - 1:30** | GitHub repo README, transaction link on X Layer Explorer, and closing slide | "AgentFloat is deployed on the X Layer testnet. Yield routing that learns, tests, and ships its own upgrades. Check out our GitHub repository to learn more." |

---

## Action Plan for Recording
1. **Prepare the Contracts**: Make sure the contracts are deployed to X Layer testnet.
2. **Launch the Agent**: Run `npm start` inside `agent/` to watch the event flow.
3. **Trigger LP Add**: Execute the integration script to add out-of-range liquidity. Show the agent capturing and parking the USDC.
4. **Trigger Promotion**: Run simulated block progression so the shadow strategy beats the active one. Show the agent executing `promote()`.
5. **Open Dashboard**: Refresh the dashboard at localhost:3000 to show the updated active strategy and transaction list.
