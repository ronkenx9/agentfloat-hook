"use client";

import { useEffect, useMemo, useState } from "react";
import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface Strategy {
  strategy_id: number;
  name: string;
  address: string;
  status: "active" | "shadow" | "paused" | "retired";
  expected_apy_bps: number;
  risk_profile: string;
  is_shadow: number;
}

interface Score {
  ts: string;
  strategy_id: number;
  score: number;
}

interface State {
  strategies: Strategy[];
  contracts?: {
    explorerBase: string;
  };
}

export function StrategyDeck() {
  const state = usePolling<State>(`${API_URL}/api/state`, 20_000);
  const scoresResp = usePolling<{ scores: Score[] }>(`${API_URL}/api/scores?limit=200`, 15_000);
  const [flipped, setFlipped] = useState<number | null>(null);

  const strategies = state?.strategies ?? [];
  const explorerBase = state?.contracts?.explorerBase || "https://www.oklink.com/xlayer";
  const scoresByStrategy = useMemo(() => {
    const map = new Map<number, number[]>();
    for (const s of scoresResp?.scores ?? []) {
      if (!map.has(s.strategy_id)) map.set(s.strategy_id, []);
      map.get(s.strategy_id)!.push(s.score);
    }
    return map;
  }, [scoresResp]);

  return (
    <section className="border-y border-rule bg-paper">
      <div className="max-w-[1180px] mx-auto px-6 py-12">
        <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-rule">
          <div>
            <span className="mono text-[10px] uppercase text-ink-soft tracking-[0.12em]">
              Strategy deck
            </span>
            <h2 className="serif text-2xl mt-1 tracking-tight">
              Every strategy the AI has tested, as a card.
            </h2>
          </div>
          <span className="mono text-[10px] uppercase text-ink-faint hidden md:block">
            Tap a card to flip
          </span>
        </div>

        {strategies.length === 0 ? (
          <p className="text-sm text-ink-soft text-center py-12">No strategies registered yet.</p>
        ) : (
          <div className="flex gap-5 overflow-x-auto pb-4 -mx-6 px-6 snap-x snap-mandatory">
            {strategies.map((s) => (
              <StrategyCard
                key={s.strategy_id}
                strategy={s}
                scores={scoresByStrategy.get(s.strategy_id) ?? []}
                isFlipped={flipped === s.strategy_id}
                onFlip={() => setFlipped(flipped === s.strategy_id ? null : s.strategy_id)}
                explorerBase={explorerBase}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StrategyCard({
  strategy,
  scores,
  isFlipped,
  onFlip,
  explorerBase,
}: {
  strategy: Strategy;
  scores: number[];
  isFlipped: boolean;
  onFlip: () => void;
  explorerBase: string;
}) {
  const status = strategy.status;
  const accent =
    status === "active" ? "var(--signal-green)" :
    status === "retired" ? "var(--ink-faint)" :
    status === "paused" ? "var(--accent)" :
    "var(--gold)";

  const score = scores[0] ?? null;

  return (
    <div
      className="snap-start shrink-0 cursor-pointer group"
      style={{ perspective: "1200px", width: "260px", height: "380px" }}
      onClick={onFlip}
    >
      <div
        className="relative w-full h-full transition-transform duration-700"
        style={{
          transformStyle: "preserve-3d",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* FRONT */}
        <article
          className="absolute inset-0 border-2 flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            borderColor: accent,
            backgroundColor: "var(--paper)",
            opacity: status === "retired" ? 0.6 : 1,
            boxShadow: status === "active" ? "0 0 20px rgba(195, 156, 78, 0.18)" : "none",
          }}
        >
          {/* Top band */}
          <div
            className="px-3 py-2 flex items-baseline justify-between"
            style={{ backgroundColor: accent, color: "var(--paper)" }}
          >
            <span className="mono text-[10px] uppercase tracking-wider">
              #{strategy.strategy_id.toString().padStart(3, "0")}
            </span>
            <span className="mono text-[9px] uppercase tracking-wider opacity-80">
              {status}
            </span>
          </div>

          {/* Procedural artwork */}
          <div className="relative h-[160px] overflow-hidden" style={{ backgroundColor: "var(--paper-deep)" }}>
            <ProceduralArt seed={strategy.address} accent={accent} />
          </div>

          {/* Name */}
          <div className="px-4 py-3 border-y border-rule-faint">
            <h3 className="serif text-lg leading-tight tracking-tight truncate">{strategy.name}</h3>
            <p className="mono text-[9px] uppercase tracking-wider text-ink-soft mt-1">
              {strategy.risk_profile} risk
            </p>
          </div>

          {/* Stats */}
          <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs flex-1">
            <Stat label="Score" value={score !== null ? score.toLocaleString() : "—"} />
            <Stat label="Target APY" value={`${(strategy.expected_apy_bps / 100).toFixed(2)}%`} />
            <Stat label="Type" value={strategy.is_shadow ? "Shadow" : "Active"} />
            <Stat label="Samples" value={scores.length.toString()} />
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-rule-faint mono text-[9px] uppercase tracking-wider text-ink-soft text-center">
            Tap to flip ↻
          </div>
        </article>

        {/* BACK */}
        <article
          className="absolute inset-0 border-2 flex flex-col p-5"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderColor: accent,
            backgroundColor: "var(--paper-2)",
          }}
        >
          <div className="flex-1 flex flex-col gap-3 text-xs leading-relaxed">
            <div>
              <span className="mono text-[9px] uppercase tracking-wider text-ink-soft block">
                Contract
              </span>
              <a
                href={`${explorerBase}/address/${strategy.address}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="mono text-[10px] break-all underline decoration-rule hover:text-accent"
              >
                {strategy.address}
              </a>
            </div>

            <div>
              <span className="mono text-[9px] uppercase tracking-wider text-ink-soft block mb-1">
                Score history
              </span>
              {scores.length > 1 ? (
                <CardSparkline values={scores.slice(0, 40).reverse()} color={accent} />
              ) : (
                <p className="text-ink-soft text-[11px]">Not enough samples yet.</p>
              )}
            </div>

            <div>
              <span className="mono text-[9px] uppercase tracking-wider text-ink-soft block">
                Notes
              </span>
              <p className="text-[11px] text-ink mt-1">
                {status === "active" && "Currently handling real capital. Earned via N consecutive shadow wins."}
                {status === "shadow" && "Tested against the active strategy. Awaiting threshold to be promoted."}
                {status === "paused" && "Marked paused in brain spec. Approver will not promote."}
                {status === "retired" && "Retired from rotation. Contract remains on-chain as evidence."}
              </p>
            </div>
          </div>

          <div className="mono text-[9px] uppercase tracking-wider text-ink-soft text-center pt-3 border-t border-rule-faint">
            Tap to flip back ↺
          </div>
        </article>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mono text-[9px] uppercase tracking-wider text-ink-soft block">{label}</span>
      <span className="mono text-[12px] text-ink">{value}</span>
    </div>
  );
}

/**
 * Deterministic abstract art derived from the strategy contract address.
 * Two intersecting wave-paths whose frequency + phase come from the address bytes.
 * Same input → same art forever, but each strategy gets its own pattern.
 */
function ProceduralArt({ seed, accent }: { seed: string; accent: string }) {
  // Pull 6 values from the address hex to drive the art
  const hex = seed.replace(/^0x/, "");
  const n = (offset: number, mod: number) =>
    parseInt(hex.slice(offset, offset + 2) || "00", 16) % mod;

  const freq1 = 2 + n(2, 6);
  const freq2 = 3 + n(8, 5);
  const phase1 = n(14, 360);
  const phase2 = n(20, 360);
  const amp = 20 + n(26, 20);
  const dotCount = 8 + n(32, 10);

  const w = 240;
  const h = 160;

  const path1 = buildWave(w, h * 0.4, h * 0.55, freq1, phase1, amp);
  const path2 = buildWave(w, h * 0.6, h * 0.4, freq2, phase2, amp * 0.7);

  const dots = Array.from({ length: dotCount }, (_, i) => ({
    cx: ((i + 1) * w) / (dotCount + 1),
    cy: h / 2 + Math.sin((i / dotCount) * Math.PI * 2 + phase1 / 50) * (amp / 2),
    r: 1.5 + (i % 3) * 0.5,
  }));

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid slice"
      className="w-full h-full"
    >
      <rect width={w} height={h} fill="var(--paper-deep)" />
      <path d={path1} fill="none" stroke="var(--ink)" strokeWidth={1} opacity={0.55} />
      <path d={path2} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.85} />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={accent} opacity={0.55} />
      ))}
    </svg>
  );
}

function buildWave(width: number, yCenter: number, _yRange: number, freq: number, phase: number, amp: number) {
  const points: string[] = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * width;
    const t = (i / steps) * Math.PI * 2 * freq + (phase * Math.PI) / 180;
    const y = yCenter + Math.sin(t) * amp;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return points.join(" ");
}

function CardSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 220;
  const h = 40;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} className="block">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.3} opacity={0.85} />
    </svg>
  );
}
