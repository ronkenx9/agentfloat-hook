"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import type { Receipt as ReceiptT } from "@/lib/types";
import { readBalances, fromUsdc, X_LAYER_TESTNET } from "@/lib/vault";
import { TransactModal } from "./TransactModal";

export function Receipt({ receipt }: { receipt: ReceiptT }) {
  const wallet = useWallet();
  const [vaultDeposit, setVaultDeposit] = useState<string | null>(null);
  const [modal, setModal] = useState<"deposit" | "withdraw" | null>(null);

  const onTestnet = wallet.chainId === X_LAYER_TESTNET.id;
  const isLive = !receipt.hasData && wallet.address && onTestnet;

  // Read vault deposit when connected on testnet
  useEffect(() => {
    if (!isLive || !wallet.address) {
      setVaultDeposit(null);
      return;
    }
    let cancelled = false;
    void readBalances(wallet.address)
      .then((b) => {
        if (!cancelled) setVaultDeposit(fromUsdc(b.vaultDeposit));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLive, wallet.address, modal]);

  // ── Demo state ─────────────────────────────────────────────────────────
  if (receipt.hasData) {
    return (
      <article className="p-8 flex flex-col justify-between min-h-[280px]">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[10px] uppercase text-ink-soft">Your idle USDC has earned</span>
          <span className="mono text-[10px] text-ink-faint">{truncateAddr(receipt.wallet || "")}</span>
        </div>
        <div>
          <p className="serif font-light text-[88px] leading-none tracking-tighter">
            <span className="text-ink-soft text-[44px] align-top mr-1">$</span>
            {receipt.earnedUsd.toFixed(2)}
          </p>
          <p className="text-sm text-ink-soft mt-3">
            over <span className="text-ink">{receipt.daysActive}</span> days · across{" "}
            <span className="text-ink">{receipt.strategiesTested}</span> strategies tested
          </p>
        </div>
        <div className="flex gap-3">
          <button className="mono text-[11px] uppercase border-b border-ink pb-0.5 hover:text-accent hover:border-accent transition-colors">
            Deposit more
          </button>
          <button className="mono text-[11px] uppercase text-ink-soft hover:text-ink transition-colors">
            Withdraw
          </button>
        </div>
      </article>
    );
  }

  // ── Disconnected ──────────────────────────────────────────────────────
  if (!wallet.address) {
    return (
      <article className="p-8 flex flex-col justify-between min-h-[280px]">
        <span className="mono text-[10px] uppercase text-ink-soft">Your idle USDC</span>
        <div>
          <p className="serif text-[44px] leading-[1.05] tracking-tight mb-3">
            Connect a wallet to see what your idle USDC is earning.
          </p>
          <p className="text-sm text-ink-soft max-w-[36ch] leading-relaxed">
            Capital sitting out-of-range in Uniswap v4 LP positions routes into AgentFloat
            automatically. Yield strategies are tested in shadow before any migration.
          </p>
        </div>
        <button
          onClick={wallet.connect}
          disabled={wallet.connecting}
          className="mono text-[11px] uppercase border-b border-ink pb-0.5 w-fit self-start hover:text-accent hover:border-accent transition-colors disabled:opacity-50"
        >
          {wallet.connecting ? "Connecting…" : "Connect wallet →"}
        </button>
        {wallet.error && <p className="text-xs text-accent mt-2">{wallet.error}</p>}
      </article>
    );
  }

  // ── Connected, wrong chain ─────────────────────────────────────────────
  if (!onTestnet) {
    return (
      <article className="p-8 flex flex-col justify-between min-h-[280px]">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[10px] uppercase text-ink-soft">Wrong network</span>
          <button onClick={wallet.disconnect} className="mono text-[10px] uppercase text-ink-faint hover:text-accent">
            {truncateAddr(wallet.address)} · disconnect
          </button>
        </div>
        <div>
          <p className="serif text-2xl leading-tight mb-3">
            Please switch to <em>X Layer Testnet</em> (chain 1952).
          </p>
          <p className="text-sm text-ink-soft leading-relaxed">
            AgentFloat is currently testnet-only. Mainnet support arrives after audits.
          </p>
        </div>
        <div className="text-[11px] mono uppercase text-ink-soft">
          Current chain: <span className="text-ink">{wallet.chainId ?? "—"}</span>
        </div>
      </article>
    );
  }

  // ── Connected, on testnet — live ───────────────────────────────────────
  return (
    <>
      <article className="p-8 flex flex-col justify-between min-h-[280px]">
        <div className="flex items-baseline justify-between">
          <span className="mono text-[10px] uppercase text-ink-soft">Your USDC in AgentFloat</span>
          <button onClick={wallet.disconnect} className="mono text-[10px] uppercase text-ink-faint hover:text-accent" title={wallet.address || ""}>
            {truncateAddr(wallet.address)} · disconnect
          </button>
        </div>
        <div>
          <p className="serif font-light text-[88px] leading-none tracking-tighter">
            <span className="text-ink-soft text-[44px] align-top mr-1">$</span>
            {vaultDeposit !== null ? fmt(vaultDeposit) : "—"}
          </p>
          <p className="text-sm text-ink-soft mt-3 leading-relaxed">
            Wallet USDC: <span className="text-ink mono">{wallet.usdcBalance ?? "—"}</span> · across{" "}
            <span className="text-ink">{receipt.strategiesTested}</span> registered strategies
            <span className="mono text-[10px] uppercase ml-2 text-ink-faint">Testnet only</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setModal("deposit")}
            className="mono text-[11px] uppercase border-b border-ink pb-0.5 hover:text-accent hover:border-accent transition-colors"
          >
            Deposit to vault
          </button>
          <button
            onClick={() => setModal("withdraw")}
            className="mono text-[11px] uppercase text-ink-soft hover:text-ink transition-colors"
          >
            Withdraw
          </button>
        </div>
      </article>
      <TransactModal
        open={modal !== null}
        initialTab={modal ?? "deposit"}
        onClose={() => setModal(null)}
      />
    </>
  );
}

function truncateAddr(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmt(s: string) {
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  if (n === 0) return "0";
  if (n < 0.01) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
