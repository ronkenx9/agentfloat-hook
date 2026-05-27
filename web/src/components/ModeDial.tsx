"use client";

import { useState } from "react";
import type { ModeState, OperatingMode } from "@/lib/types";
import { useWallet } from "@/lib/wallet";
import { postMode } from "@/lib/api";

const MODES: Array<{
  id: OperatingMode;
  label: string;
  description: string;
}> = [
  { id: "watch", label: "Watch", description: "AI proposes. I approve every change." },
  { id: "review", label: "Review", description: "Ships after a timer if I don't reject." },
  { id: "auto-shadow", label: "Auto-shadow", description: "Parameter tweaks auto. Novel pending." },
  { id: "autonomous", label: "Autonomous", description: "Full automation, within guardrails." },
];

export function ModeDial({ mode, isDemo }: { mode: ModeState; isDemo: boolean }) {
  const wallet = useWallet();
  const [pending, setPending] = useState<OperatingMode | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const onSelect = (target: OperatingMode) => {
    if (target === mode.current) return;
    setPending(target);
    setFeedback(null);
  };

  const onConfirm = async () => {
    if (!pending) return;
    if (isDemo) {
      setFeedback({ ok: true, msg: `Demo mode — would switch to ${pending}. Connect a real wallet to persist.` });
      setPending(null);
      return;
    }
    if (!wallet.address) {
      await wallet.connect();
      return;
    }

    setSubmitting(true);
    const signed = await wallet.signSiwe(
      `Authorize AgentFloat operating mode change to ${pending}`,
    );
    if (!signed) {
      setSubmitting(false);
      setFeedback({ ok: false, msg: "Signature cancelled." });
      return;
    }

    const result = await postMode(signed.message, signed.signature, { mode: pending });
    setSubmitting(false);

    if (result.ok) {
      setFeedback({ ok: true, msg: `Switched to ${result.mode}. Refresh to see changes apply.` });
      setPending(null);
    } else {
      setFeedback({ ok: false, msg: result.error || "Mode change failed." });
    }
  };

  return (
    <article className="p-8 flex flex-col gap-5 min-h-[280px]">
      <div className="flex items-baseline justify-between">
        <span className="mono text-[10px] uppercase text-ink-soft">How much should AgentFloat do?</span>
        {isDemo && <span className="mono text-[10px] text-ink-faint">Demo · not persistent</span>}
      </div>

      <ul className="flex flex-col gap-2">
        {MODES.map((m) => {
          const active = m.id === mode.current;
          return (
            <li key={m.id}>
              <button
                onClick={() => onSelect(m.id)}
                className={`w-full text-left flex items-baseline gap-3 py-2 px-3 transition-colors border ${
                  active
                    ? "border-ink bg-paper-2"
                    : "border-transparent hover:border-rule-faint hover:bg-paper-2/50"
                }`}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-colors ${
                    active ? "bg-accent" : "bg-rule"
                  }`}
                  style={{ backgroundColor: active ? "var(--accent)" : "var(--rule)" }}
                />
                <span className="flex-1">
                  <span className="serif text-base">{m.label}</span>
                  <span className="block text-xs text-ink-soft mt-0.5">{m.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="text-[11px] text-ink-soft pt-2 border-t border-rule-faint">
        <span className="mono uppercase">Active:</span> {mode.current}
        {mode.current === "review" && mode.autoApproveAfterHours !== null && (
          <> · proposals ship after {mode.autoApproveAfterHours}h if not rejected</>
        )}
      </div>

      {feedback && (
        <p className={`text-xs ${feedback.ok ? "text-signal-green" : "text-accent"}`} style={{ color: feedback.ok ? "var(--signal-green)" : "var(--accent)" }}>
          {feedback.msg}
        </p>
      )}

      {pending && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center z-50 p-6" onClick={() => !submitting && setPending(null)}>
          <div className="bg-paper border border-rule max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <span className="mono text-[10px] uppercase text-ink-soft">Confirm mode change</span>
            <p className="serif text-2xl mt-2 mb-3 leading-tight">
              Switch from <em>{mode.current}</em> to <em>{pending}</em>?
            </p>
            <p className="text-sm text-ink-soft mb-5 leading-relaxed">
              {wallet.address
                ? `Sign with Ethereum to authorize the change. The agent re-reads the operating policy on the next epoch.`
                : `Connect a wallet first. Only admin wallets can change operating mode.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={onConfirm}
                disabled={submitting}
                className="mono text-[11px] uppercase border-b border-ink pb-0.5 hover:text-accent hover:border-accent disabled:opacity-50"
              >
                {submitting ? "Signing…" : wallet.address ? "Sign and confirm →" : "Connect wallet →"}
              </button>
              <button
                onClick={() => setPending(null)}
                disabled={submitting}
                className="mono text-[11px] uppercase text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
