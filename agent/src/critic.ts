import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { loadOperatingMode, loadStrategySpecs } from './brain';

// Load env variables from parent and local directories
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');
const PROPOSALS_DIR = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');

interface ProposalRecord {
  filepath: string;
  frontmatter: Record<string, any>;
  body: string;
}

function loadPendingProposals(): ProposalRecord[] {
  if (!fs.existsSync(PROPOSALS_DIR)) return [];
  const files = fs.readdirSync(PROPOSALS_DIR).filter((f) => f.endsWith('.md'));
  const records: ProposalRecord[] = [];
  for (const f of files) {
    const filepath = path.join(PROPOSALS_DIR, f);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      const parsed = matter(raw);
      if (parsed.data.status === 'pending') {
        records.push({ filepath, frontmatter: parsed.data, body: parsed.content });
      }
    } catch (err) {
      console.warn(`[critic] Skipped ${f}: ${(err as Error).message}`);
    }
  }
  return records;
}

const CRITIC_SYSTEM_PROMPT = `You are the Independent AI Critic and Risk Evaluator for AgentFloat on the X Layer Testnet.

Your job: evaluate a proposed system improvement or strategy deployment. Decide if the proposal is logical, technically sound, supported by history/evidence, and does not pose unacceptable risks to the testnet vault.

You must output STRICTLY valid JSON with this shape:
{
  "decision": "approve" | "reject",
  "reason": "1-2 sentences explaining your decision"
}

No prose outside the JSON. No markdown fences.`;

function buildCriticUserMessage(proposal: ProposalRecord, ctx: any): string {
  const specSummary = ctx.specs
    .map(
      (s: any) =>
        `- id=${s.strategy_id} ${s.name} · status=${s.status} · paused=${s.paused} · risk=${s.risk_profile} · expected_apy=${s.expected_apy_bps}bps`,
    )
    .join('\n');

  return `## Proposal to Evaluate
File Name: ${path.basename(proposal.filepath)}
Action Type: ${proposal.frontmatter.action_type}
Headline: ${proposal.frontmatter.headline}

### Body:
${proposal.body}

## Current Strategies Registered
${specSummary || '(none)'}

## System History and Scores
${ctx.history}

Should this proposal be approved or rejected? Output JSON only.`;
}

function logDecisionToJournal(rec: ProposalRecord, decision: string, reason: string, model: string) {
  const today = new Date().toISOString().slice(0, 10);
  const journalDir = path.join(BRAIN_PATH, 'journal');
  if (!fs.existsSync(journalDir)) fs.mkdirSync(journalDir, { recursive: true });
  const journalPath = path.join(journalDir, `${today}.md`);

  const entry = `
## Critic decision (${model})

- **Proposal:** \`${path.basename(rec.filepath)}\`
- **Action type:** ${rec.frontmatter.action_type}
- **Decision:** ${decision.toUpperCase()}
- **Reason:** ${reason}
- **Time:** ${new Date().toISOString()}
`;
  fs.appendFileSync(journalPath, entry);
}

export async function runCritic(): Promise<{ processed: number; approved: number; rejected: number }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.warn('[Critic] GROQ_API_KEY is not configured in .env. Skipping critic loop.');
    return { processed: 0, approved: 0, rejected: 0 };
  }

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const baseURL = 'https://api.groq.com/openai/v1';
  const client = new OpenAI({ apiKey, baseURL });

  const pending = loadPendingProposals();
  if (pending.length === 0) {
    return { processed: 0, approved: 0, rejected: 0 };
  }

  const mode = loadOperatingMode();
  const thresholdHours = mode.auto_approve_after_hours ?? 0.05; // default to 0.05 hours (3 mins)

  const specs = loadStrategySpecs();
  const historyPath = path.join(BRAIN_PATH, 'wiki', 'agentfloat-history.md');
  const history = fs.existsSync(historyPath) ? fs.readFileSync(historyPath, 'utf8') : '';

  let processed = 0;
  let approved = 0;
  let rejected = 0;

  for (const rec of pending) {
    const proposedAt = rec.frontmatter.proposed_at;
    if (!proposedAt) continue;

    const ageHours = (Date.now() - new Date(proposedAt).getTime()) / 3_600_000;
    if (ageHours < thresholdHours) {
      console.log(`[Critic] Proposal ${path.basename(rec.filepath)} is too young: ${(ageHours * 60).toFixed(1)}m old (threshold: ${(thresholdHours * 60).toFixed(1)}m). Skipping.`);
      continue;
    }

    console.log(`[Critic] Evaluating aged proposal ${path.basename(rec.filepath)} (${(ageHours * 60).toFixed(1)}m old)...`);
    processed += 1;

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: CRITIC_SYSTEM_PROMPT },
          { role: 'user', content: buildCriticUserMessage(rec, { specs, history }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      const text = response.choices[0]?.message?.content;
      if (!text) throw new Error('Groq returned empty response');

      const decision = JSON.parse(text);
      if (decision.decision === 'approve') {
        rec.frontmatter.status = 'approved';
        approved += 1;
      } else {
        rec.frontmatter.status = 'rejected_by_rule';
        rejected += 1;
      }

      rec.frontmatter.decided_at = new Date().toISOString();
      rec.frontmatter.decided_by = `critic-${model}`;
      rec.frontmatter.decision_reason = decision.reason;

      // Save proposal file
      const out = matter.stringify(rec.body, rec.frontmatter);
      fs.writeFileSync(rec.filepath, out);

      // Log decision to journal
      logDecisionToJournal(rec, decision.decision, decision.reason, model);

      console.log(`[Critic] Decision for ${path.basename(rec.filepath)}: ${decision.decision.toUpperCase()}. Reason: ${decision.reason}`);
    } catch (err) {
      console.error(`[Critic] Failed to evaluate proposal ${path.basename(rec.filepath)}:`, err);
    }
  }

  return { processed, approved, rejected };
}

if (require.main === module) {
  runCritic().catch((err) => {
    console.error('[Critic] Fatal:', err);
    process.exit(1);
  });
}
