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
} from "@/lib/vault";

type Tab = "deposit" | "withdraw";

export function TransactModal({ open, initialTab, onClose }: { open: boolean; initialTab: Tab; onClose: () => void }) {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [balances, setBalances] = useState<{ usdc: string; vault: string; allowance: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onTestnet = wallet.chainId === X_LAYER_TESTNET.id;

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open || !wallet.address || !onTestnet) return;
    void refreshBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, wallet.address, onTestnet, success]);

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
      setSuccess(`Minted 1,000 test USDC · ${truncTx(hash)}`);
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
      setError("Amount exceeds USDC balance. Use the faucet to mint test USDC first.");
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-6" onClick={() => !busy && onClose()}>
      <div className="bg-paper border border-rule max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Tabs */}
        <div className="flex border-b border-rule">
          {(["deposit", "withdraw"] as const).map((t) => (
            <button
              key={t}
              disabled={busy}
              onClick={() => {
                setTab(t);
                setError(null);
                setSuccess(null);
                setAmount("");
              }}
              className={`flex-1 py-3 mono text-[11px] uppercase tracking-wider transition-colors ${
                tab === t ? "bg-paper text-ink" : "bg-paper-2 text-ink-soft hover:text-ink"
              } disabled:opacity-50`}
            >
              {t}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={onClose}
            className="px-4 mono text-[11px] uppercase text-ink-soft hover:text-accent border-l border-rule disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Testnet guard */}
          {!onTestnet ? (
            <div className="text-center py-4">
              <p className="serif text-xl mb-2 leading-tight">Testnet only.</p>
              <p className="text-sm text-ink-soft leading-relaxed mb-4">
                AgentFloat deposits are limited to X Layer Testnet (chain 1952) for now. Switch your
                wallet to the testnet to continue.
              </p>
              <a
                href="https://docs.xlayer.tech/getting-started/quick-start#x-layer-testnet"
                target="_blank"
                rel="noreferrer"
                className="mono text-[11px] uppercase border-b border-ink pb-0.5 hover:text-accent hover:border-accent"
              >
                Network config →
              </a>
            </div>
          ) : (
            <>
              {/* Balances */}
              <div className="space-y-1 pb-4 border-b border-rule-faint">
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>Wallet USDC</span>
                  <span className="mono text-ink">{balances ? fmt(balances.usdc) : "—"}</span>
                </div>
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>In vault</span>
                  <span className="mono text-ink">{balances ? fmt(balances.vault) : "—"}</span>
                </div>
                <div className="flex justify-between text-xs text-ink-soft">
                  <span>Approval</span>
                  <span className="mono text-ink-faint">{balances ? fmt(balances.allowance) : "—"}</span>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="mono text-[10px] uppercase text-ink-soft block mb-2">Amount (USDC)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    disabled={busy}
                    className="flex-1 bg-paper-2 border border-rule px-3 py-2 mono text-sm focus:border-ink focus:outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() =>
                      setAmount(tab === "deposit" ? balances?.usdc ?? "" : balances?.vault ?? "")
                    }
                    disabled={busy || !balances}
                    className="mono text-[10px] uppercase px-3 border border-rule text-ink-soft hover:text-ink hover:border-ink disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
              </div>

              {/* Action button */}
              <button
                onClick={tab === "deposit" ? onDeposit : onWithdraw}
                disabled={busy || !amount || !balances}
                className="w-full py-3 bg-ink text-paper mono text-[11px] uppercase tracking-wider hover:bg-accent transition-colors disabled:opacity-50"
              >
                {busy ? step : tab === "deposit" ? "Deposit to vault" : "Withdraw from vault"}
              </button>

              {/* Faucet */}
              {tab === "deposit" && (
                <div className="text-center pt-3 border-t border-rule-faint">
                  <button
                    onClick={onFaucet}
                    disabled={busy}
                    className="mono text-[10px] uppercase text-ink-soft hover:text-accent disabled:opacity-50"
                  >
                    No USDC? Mint 1,000 test USDC (faucet) →
                  </button>
                </div>
              )}

              {/* Status */}
              {error && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--accent)" }}>
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs leading-relaxed" style={{ color: "var(--signal-green)" }}>
                  {success}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
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
