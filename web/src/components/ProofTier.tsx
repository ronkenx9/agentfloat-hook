import type { DashboardState } from "@/lib/types";
import { TimeAgo } from "./Countdown";

export function ProofTier({ state }: { state: DashboardState }) {
  const contracts = [
    { label: "FloatVault", addr: state.contracts.vault },
    { label: "AgentFloatHook", addr: state.contracts.hook },
    { label: "PoolManager", addr: state.contracts.poolManager },
  ];

  return (
    <section className="pt-12 pb-16">
      <div className="max-w-[1180px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 text-sm">
        {/* Contracts */}
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-3">Deployed on X Layer</div>
          <ul className="space-y-2">
            {contracts.map((c) => (
              <li key={c.label}>
                <a
                  href={`${state.contracts.explorerBase}/address/${c.addr}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block hover:text-accent"
                >
                  <span className="serif text-sm block">{c.label}</span>
                  <span className="mono text-[10px] text-ink-soft">{truncate(c.addr)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Strategy registry */}
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-3">Strategy registry</div>
          <ul className="space-y-2">
            {state.strategies.length === 0 && (
              <li className="text-xs text-ink-soft">No strategies registered.</li>
            )}
            {state.strategies.map((s) => (
              <li key={s.strategyId} className="flex items-baseline justify-between gap-2">
                <span className="serif text-sm truncate">
                  <span className="mono text-[10px] text-ink-soft mr-2">#{s.strategyId}</span>
                  {s.name}
                </span>
                <span
                  className="mono text-[10px] uppercase"
                  style={{ color: statusColor(s.status) }}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* System health */}
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-3">System</div>
          <ul className="space-y-2 text-xs">
            <li className="flex justify-between">
              <span className="text-ink-soft">Total epochs</span>
              <span className="mono">{state.health.totalEpochs.toLocaleString()}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-soft">Proposals</span>
              <span className="mono">{state.health.totalProposals}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-soft">Promotions</span>
              <span className="mono">{state.health.totalPromotions}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-soft">Tests</span>
              <span className="mono" style={{ color: "var(--signal-green)" }}>
                {state.health.testsPassed}/{state.health.testsTotal}
              </span>
            </li>
            {state.health.lastEpochAt && (
              <li className="flex justify-between pt-2 border-t border-rule-faint">
                <span className="text-ink-soft">Last epoch</span>
                <span className="mono">
                  <TimeAgo iso={state.health.lastEpochAt} />
                </span>
              </li>
            )}
          </ul>
        </div>

        {/* Read more */}
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-3">Read more</div>
          <ul className="space-y-2 text-xs">
            <li>
              <a
                href="https://github.com/ronkenx9/agentfloat-hook"
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                Source code →
              </a>
            </li>
            <li>
              <a
                href="https://github.com/ronkenx9/agentfloat-hook/blob/main/docs/faq.md"
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                FAQ — how strategies work →
              </a>
            </li>
            <li>
              <a
                href="https://github.com/ronkenx9/agentfloat-hook/blob/main/docs/architecture.md"
                target="_blank"
                rel="noreferrer"
                className="hover:text-accent"
              >
                Architecture →
              </a>
            </li>
            <li className="pt-2 text-ink-soft">
              {state.isDemo ? (
                <>
                  Viewing demo data ·{" "}
                  <a href="/" className="underline decoration-rule hover:text-accent">
                    See real state
                  </a>
                </>
              ) : (
                <>
                  Viewing live data ·{" "}
                  <a href="/?demo=1" className="underline decoration-rule hover:text-accent">
                    See demo
                  </a>
                </>
              )}
            </li>
          </ul>
        </div>
      </div>

    </section>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "var(--signal-green)";
    case "shadow":
      return "var(--ink-soft)";
    case "paused":
      return "var(--accent)";
    case "retired":
      return "var(--ink-faint)";
    default:
      return "var(--ink-soft)";
  }
}

function truncate(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 10)}…${a.slice(-8)}`;
}
