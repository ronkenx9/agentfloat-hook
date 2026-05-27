/**
 * Approver — applies the operating mode policy to pending proposals.
 *
 * Walks all pending proposals in ~/brain/skills/agentfloat-strategies/proposals/,
 * checks each against the active operating mode and guardrails, then updates
 * each proposal's frontmatter status to one of:
 *   - approved          → ready for deploy loop to pick up (Phase 2)
 *   - rejected_by_rule  → guardrail blocked it
 *   - pending           → unchanged, awaits human or veto-window expiry
 *
 * Runs every epoch from the watcher. Cheap (just reads + writes markdown).
 *
 * THE APPROVER NEVER TOUCHES CONTRACTS. It only mutates proposal metadata.
 * The deploy loop (Phase 2) reads `status: approved` and acts.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import { loadOperatingMode, loadStrategySpecs, type OperatingMode } from './brain';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');
const PROPOSALS_DIR = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');

interface ProposalRecord {
  filepath: string;
  frontmatter: Record<string, any>;
  body: string;
}

function loadProposals(): ProposalRecord[] {
  if (!fs.existsSync(PROPOSALS_DIR)) return [];
  const files = fs.readdirSync(PROPOSALS_DIR).filter((f) => f.endsWith('.md'));
  const records: ProposalRecord[] = [];
  for (const f of files) {
    const filepath = path.join(PROPOSALS_DIR, f);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      const parsed = matter(raw);
      records.push({ filepath, frontmatter: parsed.data, body: parsed.content });
    } catch (err) {
      console.warn(`[approver] Skipped ${f}: ${(err as Error).message}`);
    }
  }
  return records;
}

function saveProposal(rec: ProposalRecord) {
  const out = matter.stringify(rec.body, rec.frontmatter);
  fs.writeFileSync(rec.filepath, out);
}

function todayProposalCount(records: ProposalRecord[]): number {
  const today = new Date().toISOString().slice(0, 10);
  return records.filter((r) => typeof r.frontmatter.proposed_at === 'string' && r.frontmatter.proposed_at.startsWith(today)).length;
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

interface Decision {
  newStatus: string;
  reason: string;
}

function decide(rec: ProposalRecord, mode: OperatingMode, ctx: { todayCount: number; registeredCount: number }): Decision | null {
  const fm = rec.frontmatter;
  const currentStatus: string = fm.status || 'pending';

  // Only re-evaluate proposals currently pending — never override human approve/reject
  if (currentStatus !== 'pending') return null;

  const action: string = fm.action_type;
  const proposedAt: string | undefined = fm.proposed_at;

  // ── Hard guardrails (apply in every mode except `watch`) ─────────────
  if (mode.mode !== 'watch') {
    if (mode.blocked_action_types.includes(action)) {
      return { newStatus: 'rejected_by_rule', reason: `action_type "${action}" is in blocked_action_types` };
    }

    if (ctx.todayCount > mode.max_proposals_per_day) {
      return { newStatus: 'rejected_by_rule', reason: `daily proposal cap (${mode.max_proposals_per_day}) exceeded` };
    }

    // Don't auto-retire pinned strategies
    if (action === 'retire') {
      const targetIdMatch = String(fm.headline || rec.body).match(/(?:id[=\s:]*|strategy[\s_]*)(\d+)/i);
      const targetId = targetIdMatch ? parseInt(targetIdMatch[1], 10) : null;
      if (targetId !== null && mode.pinned_strategy_ids.includes(targetId)) {
        return { newStatus: 'rejected_by_rule', reason: `strategy ${targetId} is pinned in operating mode` };
      }
    }

    // New shadows blocked if registry is at capacity
    if (action === 'parameter_variant' || action === 'new_strategy') {
      if (ctx.registeredCount >= mode.max_strategies_registered) {
        return {
          newStatus: 'rejected_by_rule',
          reason: `registry at capacity (${ctx.registeredCount}/${mode.max_strategies_registered})`,
        };
      }
    }

    // Items requiring security audit can't auto-approve in Phase 1 (audit is Phase 3)
    if (mode.require_security_audit_for.includes(action)) {
      return null; // stays pending; explicit human approval required for now
    }
  }

  // ── Mode-specific behavior ──────────────────────────────────────────
  switch (mode.mode) {
    case 'watch':
      // Never auto-approve. Stay pending.
      return null;

    case 'review': {
      if (mode.auto_approve_after_hours === null || !proposedAt) return null;
      const age = hoursSince(proposedAt);
      if (age >= mode.auto_approve_after_hours) {
        return {
          newStatus: 'approved',
          reason: `review mode: ${age.toFixed(1)}h since proposal, threshold ${mode.auto_approve_after_hours}h`,
        };
      }
      return null;
    }

    case 'auto-shadow': {
      // Auto-approve if action_type is whitelisted; otherwise wait
      if (mode.auto_approve_action_types.includes(action)) {
        return { newStatus: 'approved', reason: `auto-shadow mode: action_type "${action}" is whitelisted` };
      }
      return null;
    }

    case 'autonomous': {
      // Auto-approve everything that survived the hard guardrails
      // EXCEPT items in require_security_audit_for (handled above — they stay pending)
      return { newStatus: 'approved', reason: 'autonomous mode: all guardrails cleared' };
    }
  }
  return null;
}

function logDecision(rec: ProposalRecord, decision: Decision) {
  const today = new Date().toISOString().slice(0, 10);
  const journalDir = path.join(BRAIN_PATH, 'journal');
  if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true });
  const journalPath = path.join(journalDir, `${today}.md`);

  const filename = path.basename(rec.filepath);
  const entry = `
## Approver decision

- **Proposal:** \`${filename}\`
- **Action type:** ${rec.frontmatter.action_type}
- **New status:** ${decision.newStatus}
- **Reason:** ${decision.reason}
- **Time:** ${new Date().toISOString()}
`;
  fs.appendFileSync(journalPath, entry);
}

export async function runApprover(): Promise<{ approved: number; rejected: number; pending: number; total: number; mode: string }> {
  const mode = loadOperatingMode();
  const specs = loadStrategySpecs();
  const registeredCount = specs.filter((s) => s.status !== 'retired').length;
  const proposals = loadProposals();
  const todayCount = todayProposalCount(proposals);

  let approved = 0;
  let rejected = 0;
  let stayedPending = 0;

  for (const rec of proposals) {
    const decision = decide(rec, mode, { todayCount, registeredCount });
    if (!decision) {
      if (rec.frontmatter.status === 'pending') stayedPending += 1;
      continue;
    }

    rec.frontmatter.status = decision.newStatus;
    rec.frontmatter.decided_at = new Date().toISOString();
    rec.frontmatter.decided_by = 'approver';
    rec.frontmatter.decision_reason = decision.reason;
    saveProposal(rec);
    logDecision(rec, decision);

    if (decision.newStatus === 'approved') approved += 1;
    else if (decision.newStatus.startsWith('rejected')) rejected += 1;
  }

  console.log(
    `[Approver] mode=${mode.mode} · proposals=${proposals.length} · approved=${approved} · rejected=${rejected} · pending=${stayedPending}`,
  );

  return { approved, rejected, pending: stayedPending, total: proposals.length, mode: mode.mode };
}

if (require.main === module) {
  runApprover().catch((err) => {
    console.error('[Approver] Fatal:', err);
    process.exit(1);
  });
}
