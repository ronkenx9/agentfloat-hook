"use client";

import { useEffect, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface State {
  health: { totalProposals: number; totalPromotions: number; agentAlive: boolean };
  strategies: Array<{ strategy_id: number; status: string }>;
}

interface Score {
  ts: string;
  score: number;
  strategy_id: number;
}

export function HeroMetrics() {
  const state = usePolling<State>(`${API_URL}/api/state`, 15_000);
  const scoresResp = usePolling<{ scores: Score[] }>(`${API_URL}/api/scores?limit=60`, 12_000);

  const totalProposals = state?.health?.totalProposals ?? 0;
  const totalPromotions = state?.health?.totalPromotions ?? 0;
  // AgentFloat Pools = 1 deployed test pool for the hackathon. Lives here so we can grow it via env later.
  const pools = 1;
  const strategies = state?.strategies?.filter((s) => s.status !== "retired").length ?? 0;
  const retiredCount = state?.strategies?.filter((s) => s.status === "retired").length ?? 0;
  const totalStrategiesTested = strategies + retiredCount;

  // Build a tiny sparkline from the recent scores for the "Strategies Tested" tile
  const sparkData = (scoresResp?.scores ?? []).slice(0, 40).reverse().map((s) => s.score);

  return (
    <section className="border-y border-rule bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-rule">
          <Metric
            label="Total proposals"
            value={totalProposals}
            sub="LLM-generated"
            spark={fakeSparkFor(totalProposals, "linear")}
          />
          <Metric
            label="Promotions executed"
            value={totalPromotions}
            sub="On-chain migrations"
            tone="green"
            spark={fakeSparkFor(totalPromotions, "step")}
          />
          <Metric
            label="AgentFloat pools"
            value={pools}
            sub="v4 hook-enabled"
            spark={[1, 1, 1, 1, 1]}
          />
          <Metric
            label="Strategies tested"
            value={totalStrategiesTested}
            sub={`${strategies} live · ${retiredCount} retired`}
            spark={sparkData.length > 4 ? sparkData : fakeSparkFor(totalStrategiesTested, "step")}
            tone="gold"
          />
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  spark,
  tone = "ink",
}: {
  label: string;
  value: number;
  sub: string;
  spark: number[];
  tone?: "ink" | "green" | "gold";
}) {
  const display = useTickingNumber(value);
  const accentColor =
    tone === "green" ? "var(--signal-green)" : tone === "gold" ? "var(--gold)" : "var(--ink)";

  return (
    <div className="bg-paper p-6 flex flex-col gap-2 min-h-[140px]">
      <span className="mono text-[10px] uppercase tracking-[0.14em] text-ink-soft">{label}</span>
      <div className="flex items-baseline gap-2">
        <span
          className="serif font-light text-[44px] leading-none tracking-tight"
          style={{ color: accentColor, fontVariantNumeric: "tabular-nums" }}
        >
          {display.toLocaleString()}
        </span>
      </div>
      <span className="mono text-[10px] text-ink-faint">{sub}</span>
      <div className="mt-auto pt-2">
        <Sparkline values={spark} color={accentColor} />
      </div>
    </div>
  );
}

function Sparkline({ values, color, height = 22 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) {
    return <div className="h-[22px]" />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 120;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={w} height={height} className="block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
        points={points}
      />
    </svg>
  );
}

/**
 * Smoothly ticks a displayed integer from previous to target value when prop changes.
 */
function useTickingNumber(target: number, durationMs = 450): number {
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (display === target) return;
    const start = display;
    const startedAt = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - startedAt) / durationMs);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(start + (target - start) * eased);
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  return display;
}

/**
 * Build a synthetic ascending sparkline when we don't have real time-series data.
 * Useful for counters like "total proposals" where we only see the current total.
 */
function fakeSparkFor(current: number, shape: "linear" | "step"): number[] {
  if (current <= 0) return [0, 0, 0, 0, 0];
  const n = 12;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const ratio = i / (n - 1);
    if (shape === "linear") {
      out.push(Math.round(current * ratio));
    } else {
      // step: stays flat then jumps near the end
      out.push(ratio < 0.5 ? 0 : Math.round(current * (ratio - 0.5) * 2));
    }
  }
  return out;
}
