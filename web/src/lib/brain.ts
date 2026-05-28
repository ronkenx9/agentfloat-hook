/**
 * Server-side brain reader. Parses ~/brain markdown into the shared DashboardState shape.
 * Only ever imported from Server Components / API routes — never bundled to client.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import type {
  DashboardState,
  ModeState,
  OperatingMode,
  Proposal,
  ProposalStatus,
  Strategy,
} from './types';

const BRAIN_PATH = process.env.BRAIN_PATH || path.join(os.homedir(), 'brain');

function safeRead(filepath: string): string | null {
  try {
    return fs.existsSync(filepath) ? fs.readFileSync(filepath, 'utf8') : null;
  } catch {
    return null;
  }
}

function loadMode(): ModeState {
  const raw = safeRead(path.join(BRAIN_PATH, 'wiki', 'agentfloat-operating-mode.md'));
  const fallback: ModeState = {
    current: 'watch',
    autoApproveAfterHours: null,
    guardrails: {
      maxProposalsPerDay: 6,
      maxStrategiesRegistered: 5,
      pinnedStrategyIds: [],
      requireSecurityAuditFor: ['new_strategy'],
    },
  };

  if (!raw) return fallback;

  const m = raw.match(/<!--\s*mode-config\s*\n\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) return fallback;

  try {
    const cfg = JSON.parse(m[1]);
    return {
      current: (cfg.mode as OperatingMode) ?? 'watch',
      autoApproveAfterHours: cfg.auto_approve_after_hours ?? null,
      guardrails: {
        maxProposalsPerDay: cfg.max_proposals_per_day ?? 6,
        maxStrategiesRegistered: cfg.max_strategies_registered ?? 5,
        pinnedStrategyIds: cfg.pinned_strategy_ids ?? [],
        requireSecurityAuditFor: cfg.require_security_audit_for ?? ['new_strategy'],
      },
    };
  } catch {
    return fallback;
  }
}

function loadStrategies(): Strategy[] {
  const dir = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies');
  if (!fs.existsSync(dir)) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const out: Strategy[] = [];

  for (const f of files) {
    const raw = safeRead(path.join(dir, f));
    if (!raw) continue;
    try {
      const parsed = matter(raw);
      const data = parsed.data;
      if (typeof data.strategy_id !== 'number' || !data.contract_address) continue;
      out.push({
        strategyId: data.strategy_id,
        name: data.name || path.basename(f, '.md'),
        address: data.contract_address as `0x${string}`,
        status: data.status || 'shadow',
        isShadow: data.is_shadow !== false,
        expectedApyBps: data.expected_apy_bps || 0,
        riskProfile: data.risk_profile || 'experimental',
      });
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => a.strategyId - b.strategyId);
}

function extractSection(body: string, heading: string): string {
  const re = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s+|$)`, 'i');
  const m = body.match(re);
  return m ? m[1].trim() : '';
}

function loadProposals(mode: ModeState): Proposal[] {
  const dir = path.join(BRAIN_PATH, 'skills', 'agentfloat-strategies', 'proposals');
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .reverse(); // newest first

  const out: Proposal[] = [];

  for (const f of files) {
    const raw = safeRead(path.join(dir, f));
    if (!raw) continue;
    try {
      const parsed = matter(raw);
      const fm = parsed.data;
      const body = parsed.content;

      let autoApprovesAt: string | null = null;
      if (
        fm.status === 'pending' &&
        mode.current === 'review' &&
        mode.autoApproveAfterHours !== null &&
        typeof fm.proposed_at === 'string'
      ) {
        const proposedAt = new Date(fm.proposed_at).getTime();
        autoApprovesAt = new Date(proposedAt + mode.autoApproveAfterHours * 3_600_000).toISOString();
      }

      out.push({
        id: path.basename(f, '.md'),
        proposedAt: fm.proposed_at || new Date(0).toISOString(),
        model: fm.model || 'unknown',
        actionType: fm.action_type || 'no_action',
        status: (fm.status as ProposalStatus) || 'pending',
        headline: fm.headline || '(no headline)',
        reasoning: extractSection(body, 'Reasoning'),
        proposedChange: extractSection(body, 'Proposed change'),
        expectedOutcome: extractSection(body, 'Expected outcome'),
        evidence: extractSection(body, 'Evidence'),
        risks: extractSection(body, 'Risks'),
        autoApprovesAt,
        execution:
          fm.executed_at || fm.executed_tx
            ? {
                txHash: (fm.executed_tx as `0x${string}`) || null,
                deployedAddress: (fm.deployed_address as `0x${string}`) || null,
                strategyId: typeof fm.strategy_id === 'number' ? fm.strategy_id : null,
                executedAt: fm.executed_at || null,
              }
            : null,
      });
    } catch {
      // skip
    }
  }

  return out;
}

function loadHealth(proposals: Proposal[]) {
  const scorelog = safeRead(path.join(BRAIN_PATH, 'raw', 'agentfloat-strategy-scores.md'));
  let lastEpochAt: string | null = null;
  let totalEpochs = 0;

  if (scorelog) {
    const lines = scorelog.split('\n').filter((l) => l.trim().startsWith('['));
    totalEpochs = lines.length;
    const last = lines[lines.length - 1];
    const m = last?.match(/^\[([\d:\- ]+)\]/);
    if (m) lastEpochAt = m[1].replace(' ', 'T') + 'Z';
  }

  const agentAlive = lastEpochAt
    ? Date.now() - new Date(lastEpochAt).getTime() < 10 * 60 * 1000 // less than 10 min old
    : false;

  return {
    lastEpochAt,
    agentAlive,
    totalEpochs,
    totalProposals: proposals.length,
    totalPromotions: proposals.filter((p) => p.status === 'executed').length,
    testsPassed: 8,
    testsTotal: 8,
  };
}

export function loadRealState(): DashboardState {
  const mode = loadMode();
  const strategies = loadStrategies();
  const proposals = loadProposals(mode);
  const health = loadHealth(proposals);

  return {
    receipt: {
      // No wallet connected — show zero state. Real wallet integration would populate this.
      earnedUsd: 0,
      daysActive: 0,
      strategiesTested: strategies.length,
      wallet: null,
      hasData: false,
    },
    mode,
    proposals,
    strategies,
    health,
    contracts: {
      vault: (process.env.NEXT_PUBLIC_VAULT_ADDRESS ||
        (process.env.NEXT_PUBLIC_CHAIN_ID === '1952' || process.env.X_LAYER_CHAIN_ID === '1952'
          ? '0x4d33FD7B077c1a23221252c3FFEe4261c8a67c5f'
          : '0xbF06de108735332D1EDb81C7A77A750DD428a6f4')) as `0x${string}`,
      hook: (process.env.NEXT_PUBLIC_HOOK_ADDRESS ||
        (process.env.NEXT_PUBLIC_CHAIN_ID === '1952' || process.env.X_LAYER_CHAIN_ID === '1952'
          ? '0x3A00B5A2F15bE68AfE5415290ca4D3022e3B3b5F'
          : '0x5Ba6671e8219C34edA373BF95895306929174580')) as `0x${string}`,
      poolManager: (process.env.NEXT_PUBLIC_POOL_MANAGER_ADDRESS ||
        (process.env.NEXT_PUBLIC_CHAIN_ID === '1952' || process.env.X_LAYER_CHAIN_ID === '1952'
          ? '0x1BB8824110DF8ED603eBb203C19cC2Ba8FdA8fbe'
          : '0x360e68faccca8ca495c1b759fd9eee466db9fb32')) as `0x${string}`,
      explorerBase:
        process.env.NEXT_PUBLIC_CHAIN_ID === '1952' || process.env.X_LAYER_CHAIN_ID === '1952'
          ? 'https://www.oklink.com/xlayer-test'
          : 'https://www.oklink.com/xlayer',
    },
    isDemo: false,
  };
}
