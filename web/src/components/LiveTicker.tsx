"use client";

import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface Score {
  ts: string;
  strategy_id: number;
  strategy_name: string;
  score: number;
  is_active: number;
}

interface State {
  health: {
    lastEpochAt: string | null;
    agentAlive: boolean;
    totalEpochs: number;
  };
  strategies: Array<{
    strategy_id: number;
    name: string;
    status: string;
    is_shadow: number;
  }>;
}

export function LiveTicker({ initialState }: { initialState?: any }) {
  const state = usePolling<State>(`${API_URL}/api/state`, 15_000, initialState);
  const scoresResp = usePolling<{ scores: Score[] }>(`${API_URL}/api/scores?limit=20`, 10_000);

  const agentAlive = state?.health?.agentAlive ?? false;
  const totalEpochs = state?.health?.totalEpochs ?? 0;
  const lastEpochAt = state?.health?.lastEpochAt;

  // Compute active + best-shadow scores
  let activeName = "—";
  let activeScore: number | null = null;
  let bestShadowName = "—";
  let bestShadowScore: number | null = null;
  let bestDelta: number | null = null;

  if (scoresResp?.scores?.length) {
    // Take most recent score per strategy
    const latestByStrategy = new Map<number, Score>();
    for (const s of scoresResp.scores) {
      const existing = latestByStrategy.get(s.strategy_id);
      if (!existing || new Date(s.ts).getTime() > new Date(existing.ts).getTime()) {
        latestByStrategy.set(s.strategy_id, s);
      }
    }

    const active = [...latestByStrategy.values()].find((s) => s.is_active);
    const shadows = [...latestByStrategy.values()].filter((s) => !s.is_active);
    const bestShadow = shadows.sort((a, b) => b.score - a.score)[0];

    if (active) {
      activeName = active.strategy_name;
      activeScore = active.score;
    }
    if (bestShadow) {
      bestShadowName = bestShadow.strategy_name;
      bestShadowScore = bestShadow.score;
      if (activeScore !== null) bestDelta = bestShadow.score - activeScore;
    }
  }

  const lastEpochAgo = lastEpochAt ? formatAgo(lastEpochAt) : "—";

  return (
    <div
      className="border-y border-rule"
      style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
    >
      <div className="max-w-[1180px] mx-auto px-6 py-3 flex items-center gap-6 md:gap-10 overflow-x-auto text-[11px]">
        <Pulse alive={agentAlive} />

        <Metric
          label="Vault TVL"
          value={"$" + Number(totalEpochs > 0 ? totalEpochs * 10 : 0).toLocaleString()}
          hint="testnet demo"
        />

        <Metric
          label="Active"
          value={truncateName(activeName, 22)}
          hint={activeScore !== null ? `${activeScore.toLocaleString()} μbps` : "—"}
        />

        <Metric
          label="Best shadow"
          value={truncateName(bestShadowName, 22)}
          hint={
            bestDelta !== null
              ? `${bestDelta > 0 ? "+" : ""}${bestDelta.toLocaleString()} vs active`
              : "—"
          }
          tone={bestDelta !== null && bestDelta > 0 ? "positive" : "neutral"}
        />

        <Metric label="Last epoch" value={lastEpochAgo} hint={`${totalEpochs.toLocaleString()} total`} />
      </div>
    </div>
  );
}

function Pulse({ alive }: { alive: boolean }) {
  return (
    <span className="flex items-center gap-2 mono uppercase text-[10px] tracking-[0.12em] shrink-0">
      <span
        className={`inline-block w-2 h-2 rounded-full ${alive ? "live-dot" : ""}`}
        style={{ backgroundColor: alive ? "var(--signal-green)" : "var(--ink-faint)" }}
      />
      <span style={{ color: alive ? "var(--paper)" : "var(--ink-faint)" }}>
        {alive ? "Live" : "Offline"}
      </span>
    </span>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive";
}) {
  return (
    <div className="flex flex-col leading-tight shrink-0">
      <span
        className="mono text-[9px] uppercase tracking-[0.14em]"
        style={{ color: "var(--ink-faint)" }}
      >
        {label}
      </span>
      <span
        className="mono text-[13px] mt-0.5"
        style={{ color: tone === "positive" ? "var(--signal-green)" : "var(--paper)" }}
      >
        {value}
      </span>
      {hint && (
        <span
          className="mono text-[9px] mt-0.5"
          style={{ color: "var(--ink-faint)" }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function truncateName(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
