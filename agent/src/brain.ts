/**
 * Brain reader — single source of truth for AgentFloat operational config.
 *
 * Reads strategy specs from `~/brain/skills/agentfloat-strategies/*.md` and
 * scoring rules from `~/brain/wiki/agentfloat-scoring.md`. The brain is the
 * API; this module is the parser.
 *
 * Any change to a strategy's `paused` flag, scoring thresholds, or new
 * strategy registration takes effect on the next epoch — no restart required.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');

export interface StrategySpec {
  name: string;
  strategy_id: number;
  contract_address: `0x${string}`;
  network: string;
  chain_id: number;
  status: 'active' | 'shadow' | 'paused' | 'retired';
  is_shadow: boolean;
  expected_apy_bps: number;
  risk_profile: 'zero' | 'simulated' | 'protocol' | 'experimental';
  paused: boolean;
  description: string;
  // Path to the source file — useful for logging
  sourceFile: string;
}

export interface ScoringRules {
  // Epoch cadence
  epochDurationSeconds: number;
  // Promotion thresholds
  minDeltaBps: number;
  minEpochsConsecutive: number;
  minObservations: number;
  // Anti-promotion guards
  maxActiveAgeForReplacementEpochs: number;
  maxShadowDropPercent: number;
  maxRevertCount: number;
  // Penalty caps
  recallLatencyPenaltyCap: number;
  // Reflexive layer — how often to re-run the consolidator from inside the watcher
  consolidateEveryEpochs: number;
  // Generative layer — how often the LLM orchestrator proposes improvements
  orchestrateEveryEpochs: number;
  // Source file for traceability
  sourceFile: string;
}

const DEFAULT_SCORING: Omit<ScoringRules, 'sourceFile'> = {
  epochDurationSeconds: 300,
  minDeltaBps: 10,
  minEpochsConsecutive: 5,
  minObservations: 20,
  maxActiveAgeForReplacementEpochs: 100,
  maxShadowDropPercent: 50,
  maxRevertCount: 3,
  recallLatencyPenaltyCap: 5000,
  consolidateEveryEpochs: 50,
  orchestrateEveryEpochs: 600,
};

/**
 * Load all strategy specs from ~/brain/skills/agentfloat-strategies/.
 * Skips README.md and retired strategies. Returns an array sorted by strategy_id.
 */
export function loadStrategySpecs(): StrategySpec[] {
  const dir = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies');

  if (!fs.existsSync(dir)) {
    console.warn(`[brain] Strategy specs directory missing: ${dir}`);
    return [];
  }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const specs: StrategySpec[] = [];

  for (const file of files) {
    const filepath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filepath, 'utf8');
      const parsed = matter(raw);
      const data = parsed.data;

      // Do not skip retired strategies, so they are kept in sync in the SQLite DB
      // and displayed correctly on the dashboard.

      // Validate required fields
      if (typeof data.strategy_id !== 'number' || !data.contract_address) {
        console.warn(`[brain] Skipping ${file}: missing strategy_id or contract_address`);
        continue;
      }

      specs.push({
        name: data.name || path.basename(file, '.md'),
        strategy_id: data.strategy_id,
        contract_address: data.contract_address as `0x${string}`,
        network: data.network || 'unknown',
        chain_id: data.chain_id || 0,
        status: data.status || 'shadow',
        is_shadow: data.is_shadow !== false,
        expected_apy_bps: data.expected_apy_bps || 0,
        risk_profile: data.risk_profile || 'experimental',
        paused: data.paused === true,
        description: data.description || '',
        sourceFile: filepath,
      });
    } catch (err) {
      console.warn(`[brain] Failed to parse ${file}: ${(err as Error).message}`);
    }
  }

  return specs.sort((a, b) => a.strategy_id - b.strategy_id);
}

/**
 * Load scoring rules from ~/brain/wiki/agentfloat-scoring.md.
 *
 * The wiki article holds the human-readable methodology. Machine-readable
 * thresholds can be overridden in a `<!-- config -->` block (JSON) embedded
 * in the article. If absent, defaults are used.
 */
export function loadScoringRules(): ScoringRules {
  const filepath = path.join(BRAIN_PATH, 'wiki', 'agentfloat-scoring.md');

  if (!fs.existsSync(filepath)) {
    console.warn(`[brain] Scoring rules file missing: ${filepath}. Using defaults.`);
    return { ...DEFAULT_SCORING, sourceFile: '(defaults)' };
  }

  const raw = fs.readFileSync(filepath, 'utf8');

  // Look for an HTML comment block containing JSON config.
  // Requires the comment to start with `<!-- config` on its own, then a JSON object.
  // This avoids matching inline references like `<!-- config -->` in prose.
  const configMatch = raw.match(/<!--\s*config\s*\n\s*(\{[\s\S]*?\})\s*-->/);
  if (configMatch) {
    try {
      const overrides = JSON.parse(configMatch[1]);
      return { ...DEFAULT_SCORING, ...overrides, sourceFile: filepath };
    } catch (err) {
      console.warn(`[brain] Failed to parse config block in scoring rules: ${(err as Error).message}`);
    }
  }

  return { ...DEFAULT_SCORING, sourceFile: filepath };
}

// ─── Operating mode ───────────────────────────────────────────────────────

export type OperatingModeName = 'watch' | 'review' | 'auto-shadow' | 'autonomous';

export interface OperatingMode {
  mode: OperatingModeName;
  auto_approve_after_hours: number | null;
  auto_approve_action_types: string[];
  max_proposals_per_day: number;
  max_strategies_registered: number;
  tvl_cap_usd: number | null;
  pinned_strategy_ids: number[];
  blocked_action_types: string[];
  require_security_audit_for: string[];
  veto_window_hours: Record<string, number>;
  /**
   * Chain-scoped allowlist. The agent reads `process.env.X_LAYER_CHAIN_ID` and
   * applies the matching entry. Action types not listed are blocked on that chain.
   *
   * The intent: on mainnet, the AI can register/un-register strategies from a
   * pre-audited library, but cannot deploy new Solidity. New strategy contracts
   * require human signoff + audit before being added to the library.
   */
  chain_actions_allowed: Record<string, string[]>;
  sourceFile: string;
}

const DEFAULT_MODE: Omit<OperatingMode, 'sourceFile'> = {
  mode: 'watch',
  auto_approve_after_hours: null,
  auto_approve_action_types: [],
  max_proposals_per_day: 6,
  max_strategies_registered: 5,
  tvl_cap_usd: null,
  pinned_strategy_ids: [],
  blocked_action_types: [],
  require_security_audit_for: ['new_strategy'],
  veto_window_hours: {},
  // chain "0" or absent = no chain-scoped restriction (testnet default permissive)
  chain_actions_allowed: {
    // X Layer mainnet (chain 196) — only safe actions on real money
    '196': ['register_strategy', 'retire', 'scoring_change', 'no_action'],
    // X Layer testnet (chain 1952) — everything goes for experimentation
    '1952': ['parameter_variant', 'new_strategy', 'scoring_change', 'retire', 'no_action', 'register_strategy'],
  },
};

/**
 * Load operating mode from ~/brain/wiki/agentfloat-operating-mode.md.
 * Falls back to safe `watch` mode defaults if file or block is missing.
 */
export function loadOperatingMode(): OperatingMode {
  const filepath = path.join(BRAIN_PATH, 'wiki', 'agentfloat-operating-mode.md');
  if (!fs.existsSync(filepath)) {
    console.warn(`[brain] Operating mode file missing: ${filepath}. Defaulting to 'watch'.`);
    return { ...DEFAULT_MODE, sourceFile: '(defaults)' };
  }

  const raw = fs.readFileSync(filepath, 'utf8');
  const configMatch = raw.match(/<!--\s*mode-config\s*\n\s*(\{[\s\S]*?\})\s*-->/);
  if (!configMatch) {
    console.warn('[brain] No mode-config block found. Defaulting to safe watch mode.');
    return { ...DEFAULT_MODE, sourceFile: filepath };
  }

  try {
    const overrides = JSON.parse(configMatch[1]);
    return { ...DEFAULT_MODE, ...overrides, sourceFile: filepath };
  } catch (err) {
    console.warn(`[brain] Failed to parse mode-config: ${(err as Error).message}. Defaulting to watch.`);
    return { ...DEFAULT_MODE, sourceFile: filepath };
  }
}

/**
 * Append a promotion event to today's journal.
 */
export function logPromotion(opts: {
  fromStrategyId: number;
  fromStrategyName: string;
  toStrategyId: number;
  toStrategyName: string;
  blockNumber: bigint;
  txHash: `0x${string}`;
  scoreDelta: number;
  consecutiveEpochs: number;
}): void {
  const today = new Date().toISOString().slice(0, 10);
  const journalPath = path.join(BRAIN_PATH, 'journal', `${today}.md`);
  const journalDir = path.dirname(journalPath);

  if (!fs.existsSync(journalDir)) {
    fs.mkdirSync(journalDir, { recursive: true });
  }

  const entry = `
## AgentFloat promotion

- **From:** [${opts.fromStrategyId}] ${opts.fromStrategyName}
- **To:** [${opts.toStrategyId}] ${opts.toStrategyName}
- **Block:** ${opts.blockNumber}
- **Tx:** ${opts.txHash}
- **Score delta:** ${opts.scoreDelta} μbps
- **Consecutive epochs:** ${opts.consecutiveEpochs}
- **Time:** ${new Date().toISOString()}
`;

  fs.appendFileSync(journalPath, entry);
  console.log(`[brain] Logged promotion to ${journalPath}`);
}

/**
 * Append a score entry to the raw score log.
 */
export function logScore(opts: {
  epoch: number;
  strategyId: number;
  strategyName: string;
  score: number;
  isActive: boolean;
}): void {
  const filepath = path.join(BRAIN_PATH, 'raw', 'agentfloat-strategy-scores.md');
  const dir = path.dirname(filepath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filepath)) {
    fs.writeFileSync(filepath, '# AgentFloat Strategy Scores\n\nAppend-only log. Newest at the bottom.\n\n');
  }

  const ts = new Date().toISOString();
  const activeFlag = opts.isActive ? 'active=true' : 'active=false';
  const line = `[${ts}] epoch=${opts.epoch} strategy=${opts.strategyId} (${opts.strategyName}) score=${opts.score} ${activeFlag}\n`;
  fs.appendFileSync(filepath, line);
}
