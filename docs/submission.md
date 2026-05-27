# AgentFloat — Hackathon Submission Details

## Google Form Details
* **Project Name**: AgentFloat
* **One-line Description**: Dynamic yield routing for Uniswap v4 out-of-range liquidity that runs shadow strategy simulations and autonomously promotes the highest-performing yield logic.
* **GitHub Repository**: [github.com/ronkenx9/agentfloat-hook](https://github.com/ronkenx9/agentfloat-hook)
* **X Layer Testnet Explorer Link**: [FloatVault on OKLink](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f)
* **Demo Video**: [TBD]

---

## Contract Addresses (X Layer Testnet)

| Contract | Address | Explorer Link |
|----------|---------|---------------|
| **PoolManager** | `0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe) |
| **MockUSDC** | `0x39684D42654752F246449e84524Fc972D57Ef985` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x39684D42654752F246449e84524Fc972D57Ef985) |
| **FloatVault** | `0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f) |
| **AgentFloatHook** | `0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F) |
| **IdleStrategy** | `0x11eC5C3c0A80007a29117604120d82674C9D58B2` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x11eC5C3c0A80007a29117604120d82674C9D58B2) |
| **MockYieldStrategy** | `0x970D233F4DAB7a4B970Bed33420C38FA14243d00` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0x970D233F4DAB7a4B970Bed33420C38FA14243d00) |
| **MockYieldStrategy v3** | `0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd` | [View on OKLink](https://www.oklink.com/xlayer-test/address/0xb74204048456a5b51f7f8b57ac3f1ec7ffac63bd) |

---

## Tweet Thread Draft

1. 🌊 Introducing **AgentFloat** — yield routing for Uniswap v4 out-of-range liquidity that learns and autonomously promotes its own strategy upgrades. Built on @XLayerOfficial for the **Hook the Future** Hackathon! 🚀 [1/4]

2. 📈 When an LP's range goes out-of-bounds, their capital sits idle. AgentFloat captures this idle liquidity via custom Uniswap v4 hook callbacks, routing it to `FloatVault` where real yield strategies generate returns. [2/4]

3. 🤖 In parallel, the vault registers simulated "shadow" strategies. An off-chain brain agent scores shadow options against the active strategy in real-time, executing an on-chain promotion once a shadow outperforms the baseline for consecutive epochs. [3/4]

4. 🏗️ High-performance yield routing that autonomously learns, tests, and ships its own upgrades. 
Check out our demo video and read the code:
🔗 Video: [TBD]
🔗 Code: https://github.com/ronkenx9/agentfloat-hook [4/4]

---

## Marketing Copy

### The Problem
Concentrated liquidity pools in Uniswap v4 offer superior fee efficiency, but they introduce a challenge: out-of-range positions produce zero yield. When price movements push LPs out of range, capital lies idle, resulting in opportunity costs.

### The AgentFloat Solution
AgentFloat introduces a self-upgrading yield router built on Uniswap v4 and X Layer:
- **Automatic Routing**: As soon as an LP position becomes out-of-range, our hook redirects the inactive capital into the `FloatVault`.
- **Shadow Simulation Registry**: Rather than locking developers into a single static yield strategy, the vault tracks multiple "shadow" strategies, running live simulations on-chain.
- **Autonomous Governance**: An AI promoter watches performance ratios, scoring strategies continuously. If a shadow strategy consistently beats the active yield baseline, the agent automatically triggers an on-chain migration (`promote()`), reallocating capital instantly.
- **Just-In-Time Recall**: The moment a swap indicates price is returning to the LP's range, the hook withdraws capital from the vault and returns it to the pool, preserving standard market-making returns.
