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

interface Strategy {
  strategy_id: number;
  name: string;
  status: string;
  is_shadow: number;
  paused: number;
  expected_apy_bps: number;
}

interface State {
  strategies: Strategy[];
}

export function StrategyRace() {
  const state = usePolling<State>(`${API_URL}/api/state`, 20_000);
  const scoresResp = usePolling<{ scores: Score[] }>(`${API_URL}/api/scores?limit=50`, 8_000);

  const strategies = state?.strategies ?? [];
  const scores = scoresResp?.scores ?? [];

  // Most recent score per strategy
  const latestByStrategy = new Map<number, Score>();
  for (const s of scores) {
    const existing = latestByStrategy.get(s.strategy_id);
    if (!existing || new Date(s.ts).getTime() > new Date(existing.ts).getTime()) {
      latestByStrategy.set(s.strategy_id, s);
    }
  }

  const enriched = strategies
    .filter((s) => s.status !== "retired")
    .map((s) => {
      const latest = latestByStrategy.get(s.strategy_id);
      return {
        ...s,
        score: latest?.score ?? null,
        isLiveActive: latest?.is_active === 1,
      };
    });

  // Normalize to a 0-100 scale for bar widths
  const maxScore = Math.max(...enriched.map((e) => e.score ?? 0), 1);

  return (
    <section className="bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 py-12 w-full">
        <div className="flex items-baseline justify-between mb-6 pb-3 border-b border-rule">
          <div>
            <span className="mono text-[10px] uppercase text-ink-soft tracking-[0.12em]">
              Live strategy race
            </span>
            <h2 className="serif text-xl mt-2 tracking-tight">
              Real scores · re-evaluated every epoch.
            </h2>
          </div>
          <span className="mono text-[10px] uppercase text-ink-faint hidden md:block">
            polling 8s
          </span>
        </div>

        {enriched.length === 0 ? (
          <p className="text-sm text-ink-soft text-center py-6">
            No strategies registered yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {enriched.map((s) => {
              const widthPct = Math.max(2, Math.round(((s.score ?? 0) / maxScore) * 100));
              return (
                <li key={s.strategy_id}>
                  <div className="flex items-baseline justify-between mb-1.5 gap-3">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="mono text-[10px] uppercase text-ink-soft shrink-0">
                        #{s.strategy_id}
                      </span>
                      <span className="serif text-sm truncate">{s.name}</span>
                      <Pill
                        text={s.isLiveActive ? "Active" : s.paused ? "Paused" : "Shadow"}
                        tone={s.isLiveActive ? "active" : s.paused ? "warn" : "neutral"}
                      />
                    </div>
                    <span
                      className="mono text-xs shrink-0"
                      style={{
                        color: s.isLiveActive ? "var(--signal-green)" : "var(--ink)",
                      }}
                    >
                      {s.score !== null ? s.score.toLocaleString() : "—"} μbps
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-paper-deep overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: s.isLiveActive ? "var(--signal-green)" : "var(--ink-soft)",
                        opacity: s.paused ? 0.4 : 1,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Pill({ text, tone }: { text: string; tone: "active" | "neutral" | "warn" }) {
  const bg =
    tone === "active" ? "var(--signal-green)" : tone === "warn" ? "var(--accent)" : "var(--paper-deep)";
  const fg = tone === "neutral" ? "var(--ink)" : "var(--paper)";
  return (
    <span
      className="mono text-[9px] uppercase tracking-[0.1em] px-1.5 py-0.5"
      style={{ backgroundColor: bg, color: fg }}
    >
      {text}
    </span>
  );
}
