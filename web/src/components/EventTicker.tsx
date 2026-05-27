"use client";

import { useEffect, useState } from "react";
import { fetchRecentEvents, type EventItem } from "@/lib/api";

export function EventTicker() {
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const e = await fetchRecentEvents(12);
      if (!cancelled) setEvents(e);
    };
    void tick();
    const t = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (events.length === 0) return null;

  // Duplicate events for seamless marquee loop
  const loop = [...events, ...events];

  return (
    <div className="border-y border-rule overflow-hidden" style={{ backgroundColor: "var(--paper-2)" }}>
      <div className="max-w-[1180px] mx-auto px-6 py-2 flex items-center gap-4">
        <span className="mono text-[9px] uppercase tracking-[0.14em] text-ink-soft shrink-0">
          Recent events ›
        </span>
        <div className="flex-1 overflow-hidden">
          <div className="marquee flex gap-8 whitespace-nowrap">
            {loop.map((e, i) => (
              <span key={i} className="mono text-[11px] text-ink-soft shrink-0">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
                  style={{ backgroundColor: kindColor(e.kind) }}
                />
                <span className="text-ink-faint">{formatAgo(e.ts)}</span>{" "}
                <span className="text-ink">{e.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .marquee {
          animation: marquee-scroll 60s linear infinite;
        }
        .marquee:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}

function kindColor(k: EventItem["kind"]) {
  switch (k) {
    case "execution":
      return "var(--signal-green)";
    case "promotion":
      return "var(--ink)";
    case "proposal":
      return "var(--accent)";
    case "score":
    default:
      return "var(--ink-faint)";
  }
}

function formatAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}
