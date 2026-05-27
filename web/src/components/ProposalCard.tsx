import type { Proposal } from "@/lib/types";
import { Countdown, TimeAgo } from "./Countdown";
import { RejectButton } from "./RejectButton";

export function ProposalCard({
  proposal,
  explorerBase,
}: {
  proposal: Proposal;
  explorerBase: string;
}) {
  const status = statusMeta(proposal.status);

  return (
    <article className="border border-rule p-6 bg-paper-2/50 hover:bg-paper-2 transition-colors">
      {/* Top meta line */}
      <div className="flex items-center justify-between text-[10px] uppercase mono text-ink-soft mb-4 pb-3 border-b border-rule-faint">
        <span className="flex items-center gap-3">
          <TimeAgo iso={proposal.proposedAt} />
          <span className="text-ink-faint">·</span>
          <span>{proposal.model}</span>
          <span className="text-ink-faint">·</span>
          <span>{proposal.actionType.replace(/_/g, " ")}</span>
        </span>
        <span
          className="px-2 py-0.5"
          style={{ backgroundColor: status.bg, color: status.fg }}
        >
          {status.label}
        </span>
      </div>

      {/* Headline */}
      <h3 className="serif text-2xl leading-tight mb-4 tracking-tight">{proposal.headline}</h3>

      {/* Reasoning — the main content, in editorial style */}
      <p className="serif text-base text-ink leading-relaxed mb-4">{proposal.reasoning}</p>

      {/* Proposed change & expected outcome — compact pair */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-1">Proposed change</div>
          <p className="text-ink leading-relaxed">{proposal.proposedChange}</p>
        </div>
        <div>
          <div className="mono text-[10px] uppercase text-ink-soft mb-1">Expected outcome</div>
          <p className="text-ink leading-relaxed">{proposal.expectedOutcome}</p>
        </div>
      </div>

      {/* Evidence + risks */}
      <details className="text-xs text-ink-soft mb-4">
        <summary className="mono uppercase cursor-pointer hover:text-ink list-none">
          ▸ Evidence & risks
        </summary>
        <div className="mt-2 pl-3 border-l border-rule-faint space-y-2">
          <p>
            <span className="mono uppercase text-[10px] text-ink-soft">Evidence:</span>{" "}
            {proposal.evidence || "—"}
          </p>
          <p>
            <span className="mono uppercase text-[10px] text-ink-soft">Risks:</span>{" "}
            {proposal.risks || "—"}
          </p>
        </div>
      </details>

      {/* Footer — execution or pending state */}
      {proposal.execution?.txHash ? (
        <div className="pt-3 border-t border-rule-faint flex items-center justify-between text-[11px]">
          <span className="text-ink-soft">
            Deployed at{" "}
            {proposal.execution.deployedAddress && (
              <a
                href={`${explorerBase}/address/${proposal.execution.deployedAddress}`}
                target="_blank"
                rel="noreferrer"
                className="mono text-ink hover:text-accent underline decoration-rule decoration-1 underline-offset-2"
              >
                {truncate(proposal.execution.deployedAddress)}
              </a>
            )}
            {proposal.execution.strategyId !== null && (
              <> as strategy id={proposal.execution.strategyId}</>
            )}
          </span>
          <a
            href={`${explorerBase}/tx/${proposal.execution.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mono text-ink-soft hover:text-accent"
          >
            View tx →
          </a>
        </div>
      ) : proposal.autoApprovesAt && proposal.status === "pending" ? (
        <div className="pt-3 border-t border-rule-faint flex items-center justify-between text-[11px]">
          <span className="text-ink-soft">
            Auto-approves <Countdown targetIso={proposal.autoApprovesAt} /> · current mode
          </span>
          <RejectButton proposalId={proposal.id} />
        </div>
      ) : (
        <div className="pt-3 border-t border-rule-faint text-[11px] text-ink-soft">
          {proposal.status === "approved" && "Approved — awaiting deploy loop"}
          {proposal.status === "pending_review" && "Pending — requires human approval"}
          {proposal.status === "rejected" && "Rejected"}
          {proposal.status === "rejected_by_rule" && "Blocked by guardrail"}
          {proposal.status === "pending" && !proposal.autoApprovesAt && "Pending"}
        </div>
      )}
    </article>
  );
}

function statusMeta(status: string) {
  switch (status) {
    case "executed":
      return { label: "Shipped", bg: "var(--signal-green)", fg: "var(--paper)" };
    case "approved":
      return { label: "Approved", bg: "var(--ink)", fg: "var(--paper)" };
    case "pending":
      return { label: "Pending", bg: "var(--paper-deep)", fg: "var(--ink)" };
    case "pending_review":
      return { label: "Awaiting review", bg: "var(--paper-deep)", fg: "var(--ink)" };
    case "rejected":
    case "rejected_by_rule":
      return { label: "Rejected", bg: "var(--accent)", fg: "var(--paper)" };
    default:
      return { label: status, bg: "var(--paper-deep)", fg: "var(--ink)" };
  }
}

function truncate(a: string) {
  if (a.length < 12) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}
