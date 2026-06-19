"use client";

import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface JournalEntry {
  title: string;
  content: string;
  date: string;
}

interface JournalResponse {
  journal: JournalEntry[];
}

export function JournalFeed() {
  const data = usePolling<JournalResponse>(`${API_URL}/api/journal?limit=15`, 10_000);
  const entries = data?.journal ?? [];

  return (
    <section className="bg-paper border-t border-rule">
      <div className="max-w-[1180px] mx-auto px-6 py-12 w-full">
        <div className="flex items-baseline justify-between mb-8 pb-3 border-b border-rule">
          <div>
            <span className="mono text-[10px] uppercase text-ink-soft tracking-[0.12em]">
              Studio Shipping Journal
            </span>
            <h2 className="serif text-2xl mt-2 tracking-tight">
              Live updates from our second brain.
            </h2>
          </div>
          <span className="mono text-[10px] uppercase text-ink-faint hidden md:block">
            polling 10s
          </span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-16 text-ink-soft">
            <p className="serif text-xl mb-2">No journal logs found.</p>
            <p className="text-xs">
              The AI builder logs its tasks and decisions in real-time. Check back shortly.
            </p>
          </div>
        ) : (
          <div className="relative border-l border-rule-faint pl-6 ml-2 space-y-8 py-2">
            {entries.map((entry, idx) => (
              <div key={idx} className="relative">
                {/* Timeline node */}
                <div
                  className="absolute -left-[31px] top-1.5 w-2 h-2 rounded-full border border-paper bg-ink"
                  style={{ backgroundColor: "var(--ink)" }}
                />
                
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="mono text-[10px] text-ink-faint shrink-0">
                    {entry.date}
                  </span>
                  <h3 className="serif text-base font-medium text-ink leading-tight">
                    {entry.title}
                  </h3>
                </div>

                {renderContent(entry.content)}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function renderContent(content: string) {
  const lines = content.split("\n");
  return (
    <ul className="space-y-1.5 list-disc list-inside mt-2 text-xs text-ink-soft pl-1">
      {lines.map((line, idx) => {
        const cleaned = line.replace(/^[-*]\s+/, "").trim();
        if (!cleaned) return null;

        // Convert markdown bold (**text**) to HTML <strong> tags
        const parts = cleaned.split("**");
        return (
          <li key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              const isBold = pIdx % 2 === 1;
              return isBold ? (
                <strong key={pIdx} className="font-semibold text-ink">
                  {part}
                </strong>
              ) : (
                part
              );
            })}
          </li>
        );
      })}
    </ul>
  );
}
