"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface State {
  health: { lastEpochAt: string | null };
  proposals: Array<{ executed_at?: string; status: string }>;
  strategies: Array<{ strategy_id: number; name: string; status: string }>;
}

/**
 * The hook architecture, as a single-screen explainer.
 * Three arrows pulse independently:
 *   - LP → Hook   : pulses when a Parked event would fire (proxy: recent score epoch)
 *   - Hook → Vault: pulses when capital was routed (proxy: recent score)
 *   - Vault → Strategy: pulses when a promotion was executed (proxy: recent executed proposal)
 *
 * For the hackathon, "recent" means within the last 60 seconds of polled state.
 * Real signal would come from event subscriptions on the contracts.
 */
export function HookDiagram() {
  const state = usePolling<State>(`${API_URL}/api/state`, 12_000);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2500);
    return () => clearInterval(t);
  }, []);

  const lastEpoch = state?.health?.lastEpochAt;
  const recentEpoch = lastEpoch ? Date.now() - new Date(lastEpoch).getTime() < 60_000 : false;
  const hasRecentExec =
    state?.proposals?.some(
      (p) => p.executed_at && Date.now() - new Date(p.executed_at).getTime() < 120_000,
    ) ?? false;

  // Cycle the three arrows so something is always animating
  const phase = tick % 3;
  const arrow1Active = phase === 0 || recentEpoch;
  const arrow2Active = phase === 1 || recentEpoch;
  const arrow3Active = phase === 2 || hasRecentExec;

  const activeStrategy = state?.strategies?.find((s) => s.status === "active");
  const shadowCount =
    state?.strategies?.filter((s) => s.status === "shadow" || s.status === "paused").length ?? 0;

  return (
    <section className="border-y border-rule bg-paper" id="how-it-works">
      <div className="max-w-[1180px] mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-rule">
          <div>
            <span className="mono text-[10px] uppercase text-ink-soft tracking-[0.12em]">
              How the hook works
            </span>
            <h2 className="serif text-2xl mt-1 tracking-tight">
              Capital flow, in real time.
            </h2>
          </div>
          <span className="mono text-[10px] uppercase text-ink-faint hidden md:block">
            Pulses on live events
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* LP */}
          <Node label="LP" detail="adds liquidity" />

          <Arrow active={arrow1Active} label="afterAddLiquidity" />

          {/* Hook */}
          <Node
            label="AgentFloatHook"
            detail="0x3A00…3b5F"
            href="https://www.oklink.com/xlayer-test/address/0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F"
          />

          <Arrow active={arrow2Active} label="vault.park()" />

          {/* Vault */}
          <Node
            label="FloatVault"
            detail="0x4d33…7c5f"
            href="https://www.oklink.com/xlayer-test/address/0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f"
            accent
          />
        </div>

        {/* Second row: vault → strategy registry */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          <div />
          <div />
          <div className="flex justify-center">
            <ArrowVertical active={arrow3Active} />
          </div>
          <div />
          <div />
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <StrategyTile
            heading={activeStrategy?.name ?? "Active strategy"}
            sub="Earning real funds"
            tone="active"
          />
          <StrategyTile
            heading={`${shadowCount} shadow${shadowCount === 1 ? "" : "s"}`}
            sub="Tested in parallel"
            tone="shadow"
          />
          <StrategyTile
            heading="LLM proposing next"
            sub="Groq · ~hourly"
            tone="ai"
          />
        </div>

        <p className="text-xs text-ink-soft mt-8 leading-relaxed max-w-[64ch]">
          When price moves out of an LP's range, the hook routes the idle USDC into the vault. The
          vault deploys it to the active strategy while scoring shadows against the same conditions.
          The on-chain <span className="mono">consecutiveWins</span> counter is the trustless gate
          — anyone can call <span className="mono">promote()</span> once a shadow earns it.
        </p>
      </div>
    </section>
  );
}

function Node({
  label,
  detail,
  href,
  accent,
}: {
  label: string;
  detail: string;
  href?: string;
  accent?: boolean;
}) {
  const content = (
    <div
      className={`border p-4 text-center transition-colors ${
        accent
          ? "border-2"
          : "border-rule hover:border-ink"
      }`}
      style={{
        borderColor: accent ? "var(--gold)" : undefined,
        backgroundColor: accent ? "var(--paper-2)" : "var(--paper)",
      }}
    >
      <div
        className="mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: accent ? "var(--gold)" : "var(--ink-soft)" }}
      >
        Contract
      </div>
      <div className="serif text-base mt-1 tracking-tight">{label}</div>
      <div className="mono text-[10px] text-ink-soft mt-0.5">{detail}</div>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }
  return content;
}

function Arrow({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <div className="relative w-full h-px">
        <div className="absolute inset-0" style={{ backgroundColor: "var(--rule)" }} />
        <div
          className="absolute inset-0 transition-all duration-700"
          style={{
            backgroundColor: "var(--gold)",
            opacity: active ? 1 : 0,
            transform: active ? "scaleX(1)" : "scaleX(0)",
            transformOrigin: "left",
          }}
        />
        <div
          className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0"
          style={{
            borderLeft: "5px solid",
            borderLeftColor: active ? "var(--gold)" : "var(--rule)",
            borderTop: "3px solid transparent",
            borderBottom: "3px solid transparent",
            transition: "border-left-color 0.7s",
          }}
        />
      </div>
      <span
        className="mono text-[9px] uppercase tracking-[0.1em]"
        style={{ color: active ? "var(--gold)" : "var(--ink-faint)", transition: "color 0.7s" }}
      >
        {label}
      </span>
    </div>
  );
}

function ArrowVertical({ active }: { active: boolean }) {
  return (
    <div className="relative h-10 w-px">
      <div className="absolute inset-0" style={{ backgroundColor: "var(--rule)" }} />
      <div
        className="absolute inset-0 origin-top transition-transform duration-700"
        style={{
          backgroundColor: "var(--gold)",
          transform: active ? "scaleY(1)" : "scaleY(0)",
        }}
      />
      <div
        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0"
        style={{
          borderTop: "5px solid",
          borderTopColor: active ? "var(--gold)" : "var(--rule)",
          borderLeft: "3px solid transparent",
          borderRight: "3px solid transparent",
          transition: "border-top-color 0.7s",
        }}
      />
    </div>
  );
}

function StrategyTile({
  heading,
  sub,
  tone,
}: {
  heading: string;
  sub: string;
  tone: "active" | "shadow" | "ai";
}) {
  const styles = {
    active: { border: "var(--signal-green)", label: "Active" },
    shadow: { border: "var(--rule)", label: "Shadows" },
    ai: { border: "var(--gold)", label: "AI proposal" },
  }[tone];

  return (
    <div
      className="border p-3 text-center"
      style={{ borderColor: styles.border, backgroundColor: "var(--paper)" }}
    >
      <div
        className="mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: styles.border }}
      >
        {styles.label}
      </div>
      <div className="serif text-sm mt-1 tracking-tight truncate">{heading}</div>
      <div className="mono text-[10px] text-ink-soft mt-0.5">{sub}</div>
    </div>
  );
}
