"use client";

import { usePolling } from "@/lib/usePolling";
import { API_URL } from "@/lib/api";

interface HealthState {
  health: {
    agentAlive: boolean;
    totalEpochs: number;
    lastEpochAt: string | null;
  };
  contracts: {
    explorerBase: string;
    vault: string;
  };
}

export function StudioRunway() {
  const state = usePolling<HealthState>(`${API_URL}/api/state`, 15_000);
  const agentAlive = state?.health?.agentAlive ?? false;
  const totalEpochs = state?.health?.totalEpochs ?? 0;
  const explorerBase = state?.contracts?.explorerBase ?? "https://www.oklink.com/xlayer-test";
  const vaultAddress = state?.contracts?.vault ?? "";

  return (
    <article className="p-8 flex flex-col justify-between min-h-[280px]">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[10px] uppercase text-ink-soft">Studio Compute Runway</span>
        <span className="mono text-[10px] flex items-center gap-1.5 text-ink-soft">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              agentAlive ? "live-dot" : ""
            }`}
            style={{
              backgroundColor: agentAlive ? "var(--signal-green)" : "var(--ink-faint)",
            }}
          />
          {agentAlive ? "Agent active" : "Agent offline"}
        </span>
      </div>

      <div className="my-4">
        <h3 className="serif text-[32px] leading-tight font-light tracking-tight text-ink">
          Float Studio Agent
        </h3>
        <div className="text-sm text-ink-soft mt-3 space-y-1.5">
          <div className="block">
            <span className="mono text-[9px] uppercase tracking-wider text-ink-faint">Orchestrator:</span>{" "}
            <span className="mono text-xs">deepseek-v3.2</span> via Bankr Gateway
          </div>
          <div className="block">
            <span className="mono text-[9px] uppercase tracking-wider text-ink-faint">Critic / Evaluator:</span>{" "}
            <span className="mono text-xs">llama-3.3-70b</span> via Groq
          </div>
          <div className="block">
            <span className="mono text-[9px] uppercase tracking-wider text-ink-faint">Network:</span>{" "}
            <span className="mono text-xs">X Layer Testnet (1952)</span>
          </div>
          <div className="block">
            <span className="mono text-[9px] uppercase tracking-wider text-ink-faint">System Ticks:</span>{" "}
            <span className="mono text-xs">{totalEpochs.toLocaleString()} epochs</span> logged
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-2 border-t border-rule-faint mt-auto">
        <a
          href="https://github.com/ronkenx9/agentfloat-hook"
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[11px] uppercase border-b border-ink pb-0.5 hover:text-accent hover:border-accent transition-colors"
        >
          View codebase →
        </a>
        {vaultAddress && (
          <a
            href={`${explorerBase}/address/${vaultAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] uppercase text-ink-soft hover:text-ink transition-colors"
          >
            Vault contract
          </a>
        )}
      </div>
    </article>
  );
}
