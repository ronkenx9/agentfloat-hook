"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import {
  readBalances,
  fromUsdc,
  toUsdc,
  mintTestUsdc,
  approveVault,
  park,
  withdrawFromVault,
  X_LAYER_TESTNET,
  USDC_ADDRESS,
  VAULT_ADDRESS,
} from "@/lib/vault";

export function SandboxView() {
  const wallet = useWallet();
  const [balances, setBalances] = useState<{ usdc: string; vault: string; allowance: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<"deposit" | "withdraw">("deposit");

  const onTestnet = wallet.chainId === X_LAYER_TESTNET.id;
  const isConnected = !!wallet.address;

  useEffect(() => {
    if (!isConnected || !onTestnet) {
      setBalances(null);
      return;
    }
    void refreshBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, onTestnet, success]);

  async function refreshBalances() {
    if (!wallet.address) return;
    try {
      const b = await readBalances(wallet.address);
      setBalances({
        usdc: fromUsdc(b.usdcBalance),
        vault: fromUsdc(b.vaultDeposit),
        allowance: fromUsdc(b.vaultAllowance),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to read balances");
    }
  }

  async function onFaucet() {
    if (!wallet.address) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    setStep("Minting 1,000 test USDC…");
    try {
      const hash = await mintTestUsdc(wallet.address, "1000");
      setSuccess(`Successfully minted 1,000 test USDC! Tx: ${truncTx(hash)}`);
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Mint failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  async function onDeposit() {
    if (!wallet.address || !balances || !amount) return;
    const wantRaw = toUsdc(amount);
    const allowanceRaw = toUsdc(balances.allowance);
    const usdcRaw = toUsdc(balances.usdc);

    if (wantRaw > usdcRaw) {
      setError("Amount exceeds USDC balance. Mint test USDC using the faucet first.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      if (allowanceRaw < wantRaw) {
        setStep("1/2 · Approving vault to spend USDC…");
        await approveVault(wallet.address, amount);
      }
      setStep(allowanceRaw < wantRaw ? "2/2 · Depositing to vault…" : "Depositing to vault…");
      const hash = await park(wallet.address, amount);
      setSuccess(`Deposited ${amount} USDC · ${truncTx(hash)}`);
      setAmount("");
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Deposit failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  async function onWithdraw() {
    if (!wallet.address || !balances || !amount) return;
    const wantRaw = toUsdc(amount);
    const vaultRaw = toUsdc(balances.vault);
    if (wantRaw > vaultRaw) {
      setError("Amount exceeds vault deposit balance.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    setStep("Withdrawing from vault…");
    try {
      const hash = await withdrawFromVault(wallet.address, amount);
      setSuccess(`Withdrew ${amount} USDC · ${truncTx(hash)}`);
      setAmount("");
    } catch (err: any) {
      setError(err?.shortMessage || err?.message || "Withdraw failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  const [copiedText, setCopiedText] = useState<string | null>(null);
  function copyToClipboard(text: string, id: string) {
    void navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  }

  return (
    <section className="max-w-[1180px] mx-auto px-6 py-10 w-full flex-1 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* ── LEFT/MIDDLE COLUMNS: STEP-BY-STEP DEVELOEPR GUIDE ── */}
      <div className="lg:col-span-2 space-y-8">
        <div>
          <span className="mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">
            Developer Sandbox
          </span>
          <h1 className="serif text-3xl md:text-5xl mt-2 tracking-tight">
            Run your own <em className="italic">Shadow Agent</em>.
          </h1>
          <p className="text-base text-ink-soft mt-3 leading-relaxed max-w-[64ch]">
            Verify the loop on X Layer Testnet. Below is a step-by-step developer guide to clone, configure, and start your own off-chain strategist bot. You will see it poll scores, suggest strategy parameter variations, and write to a local Obsidian memory brain.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6 pt-4 border-t border-rule">
          {/* Step 1 */}
          <div className="space-y-3">
            <h3 className="mono text-xs uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ink text-paper flex items-center justify-center text-[9px] font-bold">1</span>
              Clone & Install Dependencies
            </h3>
            <p className="text-sm text-ink-soft">
              Download the repository and install the off-chain TypeScript agent packages:
            </p>
            <div className="relative bg-paper-2 border border-rule px-4 py-3 mono text-xs text-ink">
              <pre className="overflow-x-auto">
{`git clone https://github.com/ronkenx9/agentfloat-hook.git
cd agentfloat-hook/agent
npm install`}
              </pre>
              <button
                onClick={() => copyToClipboard("git clone https://github.com/ronkenx9/agentfloat-hook.git\ncd agentfloat-hook/agent\nnpm install", "step1")}
                className="absolute top-2 right-2 mono text-[9px] uppercase border border-rule-faint px-2 py-0.5 hover:border-ink hover:text-accent transition-colors"
              >
                {copiedText === "step1" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-3">
            <h3 className="mono text-xs uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ink text-paper flex items-center justify-center text-[9px] font-bold">2</span>
              Configure Local Environment
            </h3>
            <p className="text-sm text-ink-soft">
              Copy the environment template and fill in your keys. Use the default public testnet RPC and contract addresses matching the sandbox:
            </p>
            <div className="relative bg-paper-2 border border-rule px-4 py-3 mono text-xs text-ink">
              <pre className="overflow-x-auto">
{`cp .env.example .env
# Open .env and ensure the following testnet variables are set:
X_LAYER_CHAIN_ID=1952
X_LAYER_RPC_URL=https://testrpc.xlayer.tech/terigon
VAULT_ADDRESS=${VAULT_ADDRESS}
HOOK_ADDRESS=0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F
GROQ_API_KEY=your_groq_api_key_here`}
              </pre>
              <button
                onClick={() => copyToClipboard(`cp .env.example .env\n# Open .env and ensure the following testnet variables are set:\nX_LAYER_CHAIN_ID=1952\nX_LAYER_RPC_URL=https://testrpc.xlayer.tech/terigon\nVAULT_ADDRESS=${VAULT_ADDRESS}\nHOOK_ADDRESS=0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F\nGROQ_API_KEY=your_groq_api_key_here`, "step2")}
                className="absolute top-2 right-2 mono text-[9px] uppercase border border-rule-faint px-2 py-0.5 hover:border-ink hover:text-accent transition-colors"
              >
                {copiedText === "step2" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-3">
            <h3 className="mono text-xs uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ink text-paper flex items-center justify-center text-[9px] font-bold">3</span>
              Run Strategy Scorer & Watcher
            </h3>
            <p className="text-sm text-ink-soft">
              Start the daemon. The watcher will poll block numbers, compile logs, compute yield differentials, and score strategy targets side-by-side in your console:
            </p>
            <div className="relative bg-paper-2 border border-rule px-4 py-3 mono text-xs text-ink">
              <pre className="overflow-x-auto">
{`npm start`}
              </pre>
              <button
                onClick={() => copyToClipboard("npm start", "step3")}
                className="absolute top-2 right-2 mono text-[9px] uppercase border border-rule-faint px-2 py-0.5 hover:border-ink hover:text-accent transition-colors"
              >
                {copiedText === "step3" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-3">
            <h3 className="mono text-xs uppercase tracking-wider text-ink flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-ink text-paper flex items-center justify-center text-[9px] font-bold">4</span>
              Trigger AI Strategy Evolution
            </h3>
            <p className="text-sm text-ink-soft">
              Run the orchestrator script to trigger the LLM brain. It reads score logs, runs analysis on strategy trends, and writes structured Markdown parameter upgrades directly to your local obsidian memory:
            </p>
            <div className="relative bg-paper-2 border border-rule px-4 py-3 mono text-xs text-ink">
              <pre className="overflow-x-auto">
{`npm run orchestrate`}
              </pre>
              <button
                onClick={() => copyToClipboard("npm run orchestrate", "step4")}
                className="absolute top-2 right-2 mono text-[9px] uppercase border border-rule-faint px-2 py-0.5 hover:border-ink hover:text-accent transition-colors"
              >
                {copiedText === "step4" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT COLUMN: INTERACTIVE WALLET & FAUCET MINT PANEL ── */}
      <div>
        <div className="bg-paper border border-rule sticky top-6">
          <div className="p-4 border-b border-rule bg-paper-2 flex justify-between items-center">
            <span className="mono text-[10px] uppercase tracking-wider font-bold">On-Chain Sandbox</span>
            <span className="mono text-[8px] px-1.5 py-0.5 bg-accent text-paper font-bold uppercase">Testnet</span>
          </div>

          <div className="p-6 space-y-6">
            {!isConnected ? (
              <div className="text-center py-6 space-y-4">
                <p className="serif text-lg leading-tight">Connect your wallet to mint and transact.</p>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Connect MetaMask or any Web3 wallet to access our Mock USDC faucet and deposit directly into the testnet yield vault.
                </p>
                <button
                  onClick={wallet.connect}
                  disabled={wallet.connecting}
                  className="w-full py-2.5 bg-ink text-paper mono text-[10px] uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {wallet.connecting ? "Connecting…" : "Connect wallet"}
                </button>
              </div>
            ) : !onTestnet ? (
              <div className="text-center py-6 space-y-4">
                <p className="serif text-lg leading-tight" style={{ color: "var(--accent)" }}>Wrong Network Detected</p>
                <p className="text-xs text-ink-soft leading-relaxed">
                  Your wallet is connected, but not to X Layer Testnet (Chain ID 1952). Please update your wallet settings to connect to the test network.
                </p>
                <button
                  onClick={wallet.disconnect}
                  className="w-full py-2 border border-rule text-ink-soft hover:text-ink mono text-[10px] uppercase tracking-wider transition-colors"
                >
                  Disconnect Wallet
                </button>
              </div>
            ) : (
              <>
                {/* Connection Status */}
                <div className="flex justify-between items-center text-[10px] mono text-ink-soft pb-3 border-b border-rule-faint">
                  <span>Connected wallet</span>
                  <button
                    onClick={wallet.disconnect}
                    className="underline hover:text-accent"
                    title={wallet.address || ""}
                  >
                    {wallet.address ? `${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` : ""}
                  </button>
                </div>

                {/* Balances list */}
                <div className="space-y-1.5 py-1 text-xs mono text-ink">
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Your USDC Balance:</span>
                    <span>{balances ? fmt(balances.usdc) : "—"} USDC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-soft">Deposited in Vault:</span>
                    <span>{balances ? fmt(balances.vault) : "—"} USDC</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-ink-faint">Vault Allowance:</span>
                    <span className="text-ink-faint">{balances ? fmt(balances.allowance) : "—"} USDC</span>
                  </div>
                </div>

                {/* Faucet button */}
                <div className="bg-paper-2 border border-rule-faint p-4 text-center space-y-2.5">
                  <span className="mono text-[9px] uppercase tracking-wider text-ink-soft block">Mock USDC Faucet</span>
                  <p className="text-[10px] text-ink-soft leading-normal">
                    Mint 1,000 Mock USDC directly to your wallet for free to test the dynamic yield sweeps.
                  </p>
                  <button
                    onClick={onFaucet}
                    disabled={busy}
                    className="w-full py-2 bg-paper border border-rule mono text-[9px] uppercase hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
                  >
                    {busy && step.includes("Minting") ? step : "Mint 1,000 mock USDC"}
                  </button>
                </div>

                {/* Tab selectors for deposit/withdraw */}
                <div className="space-y-4 border-t border-rule-faint pt-4">
                  <div className="flex border border-rule">
                    {(["deposit", "withdraw"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setActiveForm(t);
                          setError(null);
                          setSuccess(null);
                          setAmount("");
                        }}
                        className={`flex-1 py-1.5 mono text-[9px] uppercase tracking-wider transition-colors ${
                          activeForm === t ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:text-ink"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div>
                    <label className="mono text-[9px] uppercase text-ink-soft block mb-1.5">Amount (USDC)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                        disabled={busy}
                        className="flex-1 bg-paper-2 border border-rule px-2 py-1.5 mono text-xs focus:border-ink focus:outline-none disabled:opacity-50"
                      />
                      <button
                        onClick={() =>
                          setAmount(activeForm === "deposit" ? balances?.usdc ?? "" : balances?.vault ?? "")
                        }
                        disabled={busy || !balances}
                        className="mono text-[9px] uppercase px-2.5 border border-rule text-ink-soft hover:text-ink hover:border-ink disabled:opacity-50"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={activeForm === "deposit" ? onDeposit : onWithdraw}
                    disabled={busy || !amount || !balances}
                    className="w-full py-2.5 bg-ink text-paper mono text-[10px] uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {busy && !step.includes("Minting") ? step : activeForm === "deposit" ? "Deposit" : "Withdraw"}
                  </button>
                </div>

                {/* Notifications */}
                {error && (
                  <p className="text-[11px] leading-relaxed break-words" style={{ color: "var(--accent)" }}>
                    ✕ {error}
                  </p>
                )}
                {success && (
                  <p className="text-[11px] leading-relaxed break-words" style={{ color: "var(--signal-green)" }}>
                    ✓ {success}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function truncTx(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function fmt(s: string) {
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  if (n === 0) return "0";
  if (n < 0.01) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
