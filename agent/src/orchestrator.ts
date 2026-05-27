/**
 * Strategy Orchestrator — the AI brain of AgentFloat.
 *
 * Runs hourly. Reads the entire second brain context (history, strategy specs,
 * scoring rules, recent journal entries). Asks Groq llama-3.3 to propose ONE
 * concrete action to improve the system. Writes the proposal to
 * `~/brain/skills/agentfloat-strategies/proposals/` and logs reasoning to today's
 * journal.
 *
 * Proposals are JSON markdown files — humans (or future automation) read them
 * and decide whether to actuate. The orchestrator never touches contracts
 * directly in this phase.
 *
 * Triggered:
 *   - Manually:    `npm run orchestrate`
 *   - Automatic:   from the watcher every `orchestrateEveryEpochs` (default 600)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import Groq from 'groq-sdk';
import * as dotenv from 'dotenv';
import { loadStrategySpecs, loadScoringRules } from './brain';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');
const PROPOSALS_DIR = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');
const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ─── Context assembly ────────────────────────────────────────────────────

function readFileIfExists(p: string, maxLines = 200): string {
  if (!fs.existsSync(p)) return '(missing)';
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  if (lines.length <= maxLines) return lines.join('\n');
  // Take head + tail so the model sees recent activity + framing
  const head = lines.slice(0, Math.floor(maxLines * 0.3));
  const tail = lines.slice(-Math.floor(maxLines * 0.7));
  return [...head, `\n... (${lines.length - maxLines} lines elided) ...\n`, ...tail].join('\n');
}

function listRecentProposals(limit = 10): string {
  if (!fs.existsSync(PROPOSALS_DIR)) return '(none yet)';
  const files = fs
    .readdirSync(PROPOSALS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .slice(-limit);
  if (files.length === 0) return '(none yet)';
  return files
    .map((f) => {
      const content = fs.readFileSync(path.join(PROPOSALS_DIR, f), 'utf8').split('\n').slice(0, 8).join('\n');
      return `=== ${f} ===\n${content}`;
    })
    .join('\n\n');
}

function buildContext() {
  const specs = loadStrategySpecs();
  const scoring = loadScoringRules();
  const history = readFileIfExists(path.join(BRAIN_PATH, 'wiki', 'agentfloat-history.md'), 150);
  const recentScores = readFileIfExists(path.join(BRAIN_PATH, 'raw', 'agentfloat-strategy-scores.md'), 60);
  const todayJournal = readFileIfExists(
    path.join(BRAIN_PATH, 'journal', new Date().toISOString().slice(0, 10) + '.md'),
    80,
  );
  const recentProposals = listRecentProposals(5);

  return { specs, scoring, history, recentScores, todayJournal, recentProposals };
}

// ─── Prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Strategy Orchestrator for AgentFloat — a self-improving yield routing system on Uniswap v4 (X Layer).

Your job: read the operational state of the system from its second brain, then propose ONE concrete action to improve it. You are the planner; deterministic code is the executor. Your proposals are written to markdown for human review (and eventually automated actuation).

The system is built so bad proposals can't hurt anyone:
- Strategies start in shadow mode (no real capital)
- An on-chain promoter only promotes shadows that beat the active for N consecutive epochs
- Your proposals deploy shadows; the promoter decides if they ship

This means you can be bold. Don't hedge. Propose specific, testable actions.

Available action types:
1. "parameter_variant" — propose a new instance of an existing strategy with different constructor args (e.g., MockYieldStrategy with rate=2bps)
2. "new_strategy" — sketch a novel strategy idea (rough Solidity is fine, will be reviewed)
3. "scoring_change" — propose a tuning to the scoring rules in agentfloat-scoring.md
4. "retire" — mark a strategy that's clearly losing
5. "no_action" — explain why no change is warranted right now

For every proposal, cite specific evidence from the history or score log. "Score variance went from 0 to 87638 over the last 484 obs" is good. "Things look fine" is not.

Output STRICTLY valid JSON with this shape:
{
  "action_type": "parameter_variant" | "new_strategy" | "scoring_change" | "retire" | "no_action",
  "headline": "one-line summary, under 80 chars",
  "reasoning": "2-4 sentences citing concrete evidence",
  "proposed_change": "concrete description — for parameter_variant include params; for new_strategy include sketch; for scoring_change include exact field + new value; for retire include strategy id",
  "expected_outcome": "what you predict will happen if this ships",
  "evidence_basis": "which file(s) and what specifically you observed",
  "risk_notes": "anything to watch for"
}

No prose outside the JSON. No markdown fences.`;

function buildUserMessage(ctx: ReturnType<typeof buildContext>): string {
  const specSummary = ctx.specs
    .map(
      (s) =>
        `- id=${s.strategy_id} ${s.name} · status=${s.status} · paused=${s.paused} · risk=${s.risk_profile} · expected_apy=${s.expected_apy_bps}bps`,
    )
    .join('\n');

  const scoringSummary = JSON.stringify(
    {
      minDeltaBps: ctx.scoring.minDeltaBps,
      minEpochsConsecutive: ctx.scoring.minEpochsConsecutive,
      minObservations: ctx.scoring.minObservations,
      maxActiveAgeForReplacementEpochs: ctx.scoring.maxActiveAgeForReplacementEpochs,
      consolidateEveryEpochs: ctx.scoring.consolidateEveryEpochs,
      orchestrateEveryEpochs: ctx.scoring.orchestrateEveryEpochs,
    },
    null,
    2,
  );

  return `## Current strategies registered
${specSummary || '(none)'}

## Current scoring rules (from ~/brain/wiki/agentfloat-scoring.md)
\`\`\`json
${scoringSummary}
\`\`\`

## Consolidated history (~/brain/wiki/agentfloat-history.md)
${ctx.history}

## Recent score samples (tail of ~/brain/raw/agentfloat-strategy-scores.md)
\`\`\`
${ctx.recentScores}
\`\`\`

## Today's journal notes
${ctx.todayJournal}

## Your recent proposals (don't repeat verbatim)
${ctx.recentProposals}

Propose ONE action now. Output JSON only.`;
}

// ─── Proposal writing ────────────────────────────────────────────────────

interface Proposal {
  action_type: string;
  headline: string;
  reasoning: string;
  proposed_change: string;
  expected_outcome: string;
  evidence_basis: string;
  risk_notes: string;
}

function writeProposal(proposal: Proposal, modelUsed: string): string {
  if (!fs.existsSync(PROPOSALS_DIR)) fs.mkdirSync(PROPOSALS_DIR, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const existing = fs.readdirSync(PROPOSALS_DIR).filter((f) => f.startsWith(date));
  const n = String(existing.length + 1).padStart(3, '0');
  const filename = `${date}-${n}-${proposal.action_type}.md`;
  const filepath = path.join(PROPOSALS_DIR, filename);

  const frontmatter = `---
proposed_at: "${new Date().toISOString()}"
model: "${modelUsed}"
action_type: ${proposal.action_type}
status: pending
headline: "${proposal.headline.replace(/"/g, '\\"')}"
---`;

  const body = `# ${proposal.headline}

## Reasoning
${proposal.reasoning}

## Proposed change
${proposal.proposed_change}

## Expected outcome
${proposal.expected_outcome}

## Evidence
${proposal.evidence_basis}

## Risks
${proposal.risk_notes}

---

_To approve: edit frontmatter \`status: pending\` → \`status: approved\` and (for parameter_variant) the orchestrator's deploy loop will pick it up. To reject: set \`status: rejected\` with a note._
`;

  fs.writeFileSync(filepath, `${frontmatter}\n\n${body}`);
  return filepath;
}

function logToJournal(filepath: string, proposal: Proposal, modelUsed: string) {
  const today = new Date().toISOString().slice(0, 10);
  const journalDir = path.join(BRAIN_PATH, 'journal');
  if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true });
  const journalPath = path.join(journalDir, `${today}.md`);

  const entry = `
## Orchestrator proposal (${modelUsed})

- **Type:** ${proposal.action_type}
- **Headline:** ${proposal.headline}
- **File:** \`${filepath.replace(BRAIN_PATH, '~/brain')}\`
- **Time:** ${new Date().toISOString()}
`;
  fs.appendFileSync(journalPath, entry);
}

// ─── Entry point ─────────────────────────────────────────────────────────

export async function runOrchestrator(): Promise<void> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY missing — set in agent/.env');
  }

  console.log(`[Orchestrator] Building brain context...`);
  const ctx = buildContext();
  console.log(
    `[Orchestrator] Loaded ${ctx.specs.length} strategy specs · history=${ctx.history.length}B · scores=${ctx.recentScores.length}B`,
  );

  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  console.log(`[Orchestrator] Calling ${MODEL}...`);

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(ctx) },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 1200,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Groq returned empty response');

  let proposal: Proposal;
  try {
    proposal = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse Groq JSON: ${(err as Error).message}\nRaw: ${raw.slice(0, 400)}`);
  }

  // Validate
  const required: (keyof Proposal)[] = [
    'action_type',
    'headline',
    'reasoning',
    'proposed_change',
    'expected_outcome',
    'evidence_basis',
    'risk_notes',
  ];
  for (const key of required) {
    if (typeof (proposal as any)[key] !== 'string') {
      throw new Error(`Missing/invalid field "${key}" in proposal: ${JSON.stringify(proposal).slice(0, 300)}`);
    }
  }

  const filepath = writeProposal(proposal, MODEL);
  logToJournal(filepath, proposal, MODEL);

  console.log(`[Orchestrator] Wrote proposal: ${filepath}`);
  console.log(`[Orchestrator] Action: ${proposal.action_type} — ${proposal.headline}`);
}

if (require.main === module) {
  runOrchestrator().catch((err) => {
    console.error('[Orchestrator] Fatal:', err);
    process.exit(1);
  });
}
