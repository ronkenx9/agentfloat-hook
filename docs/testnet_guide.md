# AgentFloat — X Layer Testnet Testing Guide

This guide explains how you can interact with **AgentFloat** on the **X Layer Testnet** to verify its functionality, faucet test tokens, deposit to the vault, and see the automated AI loop in action.

---

## ⚡ Testnet Contract Directory

All contracts are deployed and verified on **X Layer Testnet (Chain ID 1952)**:

| Contract | Address | OKLink Testnet Link |
|---|---|---|
| **AgentFloatHook** | `0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F` | [View Hook](https://www.oklink.com/xlayer-test/address/0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F) |
| **FloatVault** | `0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f` | [View Vault](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f) |
| **MockUSDC** (Test Token) | `0x39684D42654752F246449e84524Fc972D57Ef985` | [View USDC](https://www.oklink.com/xlayer-test/address/0x39684D42654752F246449e84524Fc972D57Ef985) |
| **MockYieldStrategy** | `0x970d233f4dab7a4b970bed33420c38fa14243d00` | [View Strategy](https://www.oklink.com/xlayer-test/address/0x970d233f4dab7a4b970bed33420c38fa14243d00) |
| **IdleStrategy** (Baseline) | `0x11ec5c3c0a80007a29117604120d82674c9d58b2` | [View Strategy](https://www.oklink.com/xlayer-test/address/0x11ec5c3c0a80007a29117604120d82674c9d58b2) |

---

## 🛠️ Step 1: Wallet Network Setup

To interact with the contracts, configure your Web3 wallet (e.g., MetaMask) for X Layer Testnet:

* **Network Name:** X Layer Testnet
* **New RPC URL:** `https://testrpc.xlayer.tech/terigon`
* **Chain ID:** `1952`
* **Currency Symbol:** `OKB`
* **Block Explorer URL:** `https://www.oklink.com/xlayer-test`

*Need testnet OKB gas?* Get test tokens from the official faucet:
👉 **[OKX X Layer Testnet Faucet](https://www.okx.com/xlayer/faucet)**

---

## 💻 Option A: Interactive Dashboard (Recommended)

You can run the web dashboard locally and configure it to point to the X Layer Testnet.

1. **Clone & install dependencies:**
   ```bash
   git clone https://github.com/ronkenx9/agentfloat-hook.git
   cd agentfloat-hook/web
   npm install
   ```

2. **Run the app configured for Testnet:**
   Set the chain ID environment variable to `1952`:
   ```bash
   NEXT_PUBLIC_CHAIN_ID=1952 npm run dev
   ```
   Open **`http://localhost:3000`** in your browser.

3. **Mint & Deposit in 1-Click:**
   * Click **Connect Wallet** in the top right.
   * Click **Deposit** to open the transact panel.
   * Click **"No USDC? Mint 1,000 test USDC (faucet) →"** to receive test USDC instantly to your wallet.
   * Enter the amount you want to deposit, approve the vault, and click **Deposit to vault**.

---

## 🔍 Option B: Direct Contract Interaction (No Code)

If you don't want to run the frontend code, you can do everything directly through the OKLink Testnet Block Explorer:

### 1. Mint Mock USDC Faucet Tokens
1. Go to the [MockUSDC Contract Page](https://www.oklink.com/xlayer-test/address/0x39684D42654752F246449e84524Fc972D57Ef985#writeContract).
2. Click **Connect Wallet** to connect Metamask.
3. Find the `mint` function:
   * `to (address)`: Put your wallet address.
   * `amount (uint256)`: Put `1000000000` (this represents 1,000 USDC, since the token uses 6 decimals).
4. Click **Write** and approve the transaction. You now have Mock USDC!

### 2. Approve the Vault to Spend your USDC
1. On the same MockUSDC write page, find the `approve` function:
   * `spender (address)`: Put the FloatVault address (`0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f`).
   * `amount (uint256)`: Put `1000000000` (1,000 USDC).
2. Click **Write** and approve the transaction.

### 3. Park Capital in the Vault
1. Go to the [FloatVault Contract Page](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f#writeContract).
2. Connect your wallet.
3. Find the `park` function:
   * `amount (uint256)`: Put `1000000000` (1,000 USDC).
4. Click **Write** and approve the transaction. 

Your capital is now generating yield in the active strategy!

---

## 🤖 How to Verify the AI Loop is Real

The off-chain agent continuously scores strategies, polls the chain, and handles evolution:
1. **Scoring:** The agent calls `postScore` on the `FloatVault` contract every block epoch. You can view these scoring updates in the [FloatVault Event Logs](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f#events). Look for `ScoreUpdated` events.
2. **On-Chain Wins:** If a shadow strategy outperforms the active strategy, the contract tracks it automatically. You can read the `consecutiveWins` counter on the [FloatVault Read Contract Page](https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f#readContract) under function `consecutiveWins` by querying strategy ID `2` (the Yield strategy).
3. **Promotion:** Once the wins cross `5`, anyone can call `promote(2)` to migrate the pool's assets to the new strategy, fully verified on-chain.
